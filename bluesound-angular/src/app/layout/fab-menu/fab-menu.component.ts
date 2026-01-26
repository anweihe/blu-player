import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PlayerStateService } from '../../core/services/player-state.service';
import { AuthService } from '../../core/services/auth.service';

interface FabAction {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  color?: string;
}

@Component({
  selector: 'app-fab-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- FAB Container - positioned above global player -->
    <div class="fixed right-4 z-40 transition-all duration-300" [style.bottom]="fabBottom()">
      <!-- Mini Action Buttons -->
      @if (isOpen()) {
        <div class="flex flex-col-reverse items-end gap-3 mb-3">
          @for (action of visibleActions(); track action.id; let i = $index) {
            <div
              class="flex items-center gap-3 animate-fab-item"
              [style.animation-delay]="(i * 50) + 'ms'"
            >
              <!-- Label -->
              <span class="px-3 py-1.5 bg-bg-card rounded-lg text-sm font-medium shadow-lg whitespace-nowrap">
                {{ action.label }}
              </span>
              <!-- Button -->
              <button
                class="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110"
                [class]="action.color || 'bg-bg-card text-text-primary'"
                (click)="executeAction(action)"
              >
                <span [innerHTML]="action.icon" class="w-6 h-6"></span>
              </button>
            </div>
          }
        </div>
      }

      <!-- Main FAB Button -->
      <button
        class="w-14 h-14 rounded-full bg-accent-qobuz text-white shadow-xl flex items-center justify-center transition-all duration-300 hover:shadow-2xl"
        [class.rotate-45]="isOpen()"
        (click)="toggle()"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-7 h-7 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>

    <!-- Backdrop when open -->
    @if (isOpen()) {
      <div
        class="fixed inset-0 bg-black/30 z-30"
        (click)="close()"
      ></div>
    }
  `,
  styles: [`
    @keyframes fab-item-enter {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.9);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .animate-fab-item {
      animation: fab-item-enter 0.2s ease-out forwards;
      opacity: 0;
    }
  `]
})
export class FabMenuComponent {
  private readonly router = inject(Router);
  private readonly playerState = inject(PlayerStateService);
  private readonly auth = inject(AuthService);

  readonly isOpen = signal(false);

  // Calculate bottom position - global player is always visible now
  readonly fabBottom = computed(() => {
    // Player bar is always visible (~100px height + safe area)
    return 'calc(100px + env(safe-area-inset-bottom, 0px))';
  });

  // Define all possible actions
  private readonly allActions: FabAction[] = [
    {
      id: 'search',
      label: 'Suchen',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>`,
      action: () => this.router.navigate(['/qobuz/search']),
      color: 'bg-accent-qobuz text-white'
    },
    {
      id: 'volume',
      label: 'Lautstärke',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>`,
      action: () => this.playerState.isVolumePanelVisible.set(true)
    },
    {
      id: 'quality',
      label: 'Qualität',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>`,
      action: () => this.showQualitySelector()
    },
    {
      id: 'player',
      label: 'Gerät wählen',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>`,
      action: () => this.router.navigate(['/players'])
    }
  ];

  // Only show relevant actions based on auth state
  readonly visibleActions = computed(() => {
    if (!this.auth.isLoggedIn()) {
      return this.allActions.filter(a => a.id === 'player');
    }
    return this.allActions;
  });

  toggle(): void {
    this.isOpen.update(v => !v);
  }

  close(): void {
    this.isOpen.set(false);
  }

  executeAction(action: FabAction): void {
    action.action();
    this.close();
  }

  private showQualitySelector(): void {
    // TODO: Open quality selector modal
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) {
      this.close();
    }
  }
}
