import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

/**
 * Context menu item definition
 */
export interface ContextMenuItem {
  label: string;
  icon?: string;
  action: () => void;
  disabled?: boolean;
  divider?: boolean;
}

/**
 * Context menu position
 */
export interface MenuPosition {
  x: number;
  y: number;
}

@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen()) {
      <div
        #menu
        class="context-menu fixed bg-bg-card border border-border-subtle rounded-lg shadow-xl overflow-hidden z-[1001] min-w-[180px] animate-in fade-in zoom-in-95 duration-150"
        [style.top.px]="position().y"
        [style.left.px]="position().x"
      >
        @for (item of items; track item.label) {
          @if (item.divider) {
            <div class="h-px bg-border-subtle my-1"></div>
          } @else {
            <button
              class="context-menu-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              [class.text-text-muted]="item.disabled"
              [disabled]="item.disabled"
              (click)="onItemClick(item)"
            >
              @if (item.icon === 'album') {
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              }
              @if (item.icon === 'artist') {
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              }
              @if (item.icon === 'play') {
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-text-muted" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              }
              @if (item.icon === 'queue') {
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
                </svg>
              }
              @if (item.icon === 'favorite') {
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
              }
              <span>{{ item.label }}</span>
            </button>
          }
        }
      </div>
      <div
        class="fixed inset-0 z-[1000]"
        (click)="close()"
      ></div>
    }
  `,
  styles: [`
    .context-menu {
      transform-origin: top left;
    }

    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes zoom-in-95 {
      from { transform: scale(0.95); }
      to { transform: scale(1); }
    }

    .animate-in {
      animation: fade-in 0.15s ease-out, zoom-in-95 0.15s ease-out;
    }
  `]
})
export class ContextMenuComponent {
  @ViewChild('menu') menuElement?: ElementRef<HTMLDivElement>;

  @Input() items: ContextMenuItem[] = [];

  @Output() closed = new EventEmitter<void>();

  readonly isOpen = signal(false);
  readonly position = signal<MenuPosition>({ x: 0, y: 0 });

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  @HostListener('document:scroll')
  onScroll(): void {
    this.close();
  }

  /**
   * Open context menu at position
   */
  open(x: number, y: number): void {
    // Adjust position to stay within viewport
    const menuWidth = 200;
    const menuHeight = this.items.length * 44;
    const padding = 10;
    const bottomOffset = 100; // Account for mini player

    // Check right edge
    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }

    // Check left edge
    if (x < padding) {
      x = padding;
    }

    // Check bottom edge (considering mini player)
    if (y + menuHeight > window.innerHeight - bottomOffset) {
      y = y - menuHeight - 8;
    }

    // Check top edge
    if (y < padding) {
      y = padding;
    }

    this.position.set({ x, y });
    this.isOpen.set(true);
  }

  /**
   * Open menu relative to element
   */
  openAtElement(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    this.open(rect.right - 200, rect.bottom + 4);
  }

  /**
   * Close the context menu
   */
  close(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.closed.emit();
    }
  }

  /**
   * Handle menu item click
   */
  onItemClick(item: ContextMenuItem): void {
    if (!item.disabled) {
      item.action();
      this.close();
    }
  }
}
