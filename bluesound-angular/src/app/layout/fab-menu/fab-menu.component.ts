import { Component, inject, signal, HostListener, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { PlayerStateService } from '../../core/services/player-state.service';

interface FabAction {
  id: string;
  label: string;
  iconHtml: SafeHtml;
  route?: string;
  action?: () => void;
  color: string;
}

@Component({
  selector: 'app-fab-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Backdrop when open -->
    @if (isOpen()) {
      <div
        class="fab-overlay fixed inset-0 bg-black/40 z-[449]"
        (click)="close()"
      ></div>
    }

    <!-- FAB Container -->
    <div class="fab-container fixed z-[450] right-4 md:right-6 transition-all duration-300"
         [style.bottom.px]="fabBottomPosition()">
      <!-- Mini FABs -->
      <div class="fab-actions absolute bottom-[68px] right-0 flex flex-col items-end gap-3"
           [class.pointer-events-none]="!isOpen()"
           [class.pointer-events-auto]="isOpen()">
        @for (action of actions; track action.id; let i = $index) {
          <button
            class="fab-mini flex items-center gap-3 h-12 px-4 pl-3 rounded-[14px] bg-bg-secondary border border-border-subtle text-text-primary text-sm font-medium whitespace-nowrap cursor-pointer shadow-lg transition-all"
            [class.fab-mini-visible]="isOpen()"
            [style.transition-delay]="getTransitionDelay(i)"
            [style.--icon-color]="action.color"
            (click)="executeAction(action)"
          >
            <span class="fab-icon w-6 h-6 flex-shrink-0" [innerHTML]="action.iconHtml"></span>
            <span class="fab-label">{{ action.label }}</span>
          </button>
        }
      </div>

      <!-- Main FAB Button -->
      <button
        class="fab-main w-14 h-14 rounded-2xl bg-accent-qobuz border-none cursor-pointer flex items-center justify-center shadow-xl transition-all duration-200 hover:shadow-2xl active:scale-95 relative z-[2]"
        [attr.aria-expanded]="isOpen()"
        aria-haspopup="true"
        aria-label="Menü öffnen"
        (click)="toggle()"
      >
        <svg
          class="fab-plus-icon w-6 h-6 text-white transition-transform duration-300"
          [class.rotate-45]="isOpen()"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>
  `,
  styles: [`
    .fab-mini {
      opacity: 0;
      transform: scale(0.3) translateY(20px);
      transition: opacity 0.25s cubic-bezier(0.32, 0.72, 0, 1),
                  transform 0.25s cubic-bezier(0.32, 0.72, 0, 1),
                  background 0.15s ease,
                  border-color 0.15s ease;
    }

    .fab-mini-visible {
      opacity: 1;
      transform: scale(1) translateY(0);
    }

    .fab-mini:hover {
      background: var(--color-bg-primary);
      border-color: var(--icon-color);
    }

    .fab-mini:active {
      transform: scale(0.97) translateY(0) !important;
    }

    .fab-icon {
      color: var(--icon-color);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .fab-icon :deep(svg) {
      width: 100%;
      height: 100%;
    }
  `]
})
export class FabMenuComponent {
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly playerState = inject(PlayerStateService);

  readonly isOpen = signal(false);

  // Move FAB up when volume panel or player selector is open
  readonly fabBottomPosition = computed(() => {
    const isVolumePanelOpen = this.playerState.isVolumePanelVisible();
    const basePosition = window.innerWidth >= 768 ? 116 : 100; // md:bottom-[116px] : bottom-[100px]
    const extraOffset = isVolumePanelOpen ? 320 : 0; // Move up when volume panel is open
    return basePosition + extraOffset;
  });

  // Service colors
  private readonly colors = {
    tunein: '#f97316',
    radioparadise: '#f97316',
    qobuz: '#1db954',
    player: '#a1a1aa'
  };

  // Icons as SafeHtml
  private readonly icons = {
    tunein: this.sanitizer.bypassSecurityTrustHtml(`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/>
        <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/>
        <circle cx="12" cy="12" r="2"/>
        <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/>
        <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>
      </svg>
    `),
    radioparadise: this.sanitizer.bypassSecurityTrustHtml(`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="2"/>
        <path d="M16.24 7.76a6 6 0 0 1 0 8.49"/>
        <path d="M7.76 16.24a6 6 0 0 1 0-8.49"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        <path d="M4.93 19.07a10 10 0 0 1 0-14.14"/>
      </svg>
    `),
    qobuz: this.sanitizer.bypassSecurityTrustHtml(`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>
    `),
    player: this.sanitizer.bypassSecurityTrustHtml(`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    `)
  };

  // Define actions matching Razor version
  readonly actions: FabAction[] = [
    {
      id: 'tunein',
      label: 'TuneIn',
      iconHtml: this.icons.tunein,
      route: '/tunein',
      color: this.colors.tunein
    },
    {
      id: 'radio-paradise',
      label: 'Radio Paradise',
      iconHtml: this.icons.radioparadise,
      route: '/radioparadise',
      color: this.colors.radioparadise
    },
    {
      id: 'qobuz',
      label: 'Qobuz',
      iconHtml: this.icons.qobuz,
      route: '/qobuz/browse',
      color: this.colors.qobuz
    },
    {
      id: 'player',
      label: 'Player',
      iconHtml: this.icons.player,
      route: '/players',
      color: this.colors.player
    }
  ];

  // Staggered animation - Player (last/4th) appears first, TuneIn (first/1st) last
  getTransitionDelay(index: number): string {
    if (this.isOpen()) {
      return `${(this.actions.length - 1 - index) * 50}ms`;
    } else {
      return `${index * 30}ms`;
    }
  }

  toggle(): void {
    this.isOpen.update(v => !v);
  }

  close(): void {
    this.isOpen.set(false);
  }

  executeAction(action: FabAction): void {
    this.close();

    setTimeout(() => {
      if (action.route) {
        this.router.navigate([action.route]);
      } else if (action.action) {
        action.action();
      }
    }, 100);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) {
      this.close();
    }
  }
}
