import { Component, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContextMenuService } from '../../services/context-menu.service';

/**
 * Global context menu component that renders at app level
 * Add this to app.component.html to enable context menus everywhere
 */
@Component({
  selector: 'app-global-context-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (menuService.isOpen()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 z-[1000]"
        (click)="menuService.close()"
      ></div>

      <!-- Menu -->
      <div
        class="context-menu fixed bg-bg-card border border-border-subtle rounded-lg shadow-xl overflow-hidden z-[1001] min-w-[180px]"
        [style.top.px]="menuService.position().y"
        [style.left.px]="menuService.position().x"
        [class.animate-in]="menuService.isOpen()"
      >
        @for (item of menuService.items(); track item.label) {
          @if (item.divider) {
            <div class="h-px bg-border-subtle my-1"></div>
          } @else {
            <button
              class="context-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              [class.text-text-muted]="item.disabled"
              [disabled]="item.disabled"
              (click)="onItemClick(item)"
            >
              <!-- Icons -->
              @switch (item.icon) {
                @case ('album') {
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                }
                @case ('artist') {
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                }
                @case ('play') {
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-text-muted" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                }
                @case ('queue') {
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                  </svg>
                }
                @case ('favorite') {
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                  </svg>
                }
              }
              <span>{{ item.label }}</span>
            </button>
          }
        }
      </div>
    }
  `,
  styles: [`
    .context-menu {
      transform-origin: top left;
    }

    .animate-in {
      animation: menu-appear 0.15s ease-out;
    }

    @keyframes menu-appear {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `]
})
export class GlobalContextMenuComponent {
  readonly menuService = inject(ContextMenuService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuService.close();
  }

  @HostListener('document:scroll')
  onScroll(): void {
    this.menuService.close();
  }

  onItemClick(item: { action: () => void; disabled?: boolean }): void {
    if (!item.disabled) {
      item.action();
      this.menuService.close();
    }
  }
}
