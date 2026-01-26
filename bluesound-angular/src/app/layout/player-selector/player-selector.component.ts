import { Component, inject, signal, OnInit, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerStateService } from '../../core/services/player-state.service';
import { PlaybackService } from '../../core/services/playback.service';
import { BluesoundApiService } from '../../core/services/bluesound-api.service';
import { BluesoundPlayer } from '../../core/models';

@Component({
  selector: 'app-player-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isVisible()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/50 z-[110]"
        (click)="close()"
      ></div>

      <!-- Panel -->
      <div
        class="fixed bottom-0 left-0 right-0 bg-bg-primary rounded-t-2xl z-[111] max-h-[80vh] overflow-hidden flex flex-col safe-area-bottom animate-slide-up"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2 class="text-lg font-semibold">Wiedergabegerät</h2>
          <button
            class="w-8 h-8 rounded-full hover:bg-bg-card flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
            (click)="close()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-2">
          <!-- Browser Option -->
          <button
            class="w-full flex items-center gap-4 p-4 rounded-xl transition-colors"
            [class.bg-accent-qobuz/10]="playerState.playerMode() === 'browser'"
            [class.border-accent-qobuz]="playerState.playerMode() === 'browser'"
            [class.border-2]="playerState.playerMode() === 'browser'"
            [class.bg-bg-card]="playerState.playerMode() !== 'browser'"
            [class.hover:bg-bg-card-hover]="playerState.playerMode() !== 'browser'"
            (click)="selectBrowser()"
          >
            <div
              class="w-12 h-12 rounded-xl flex items-center justify-center"
              [class.bg-accent-qobuz]="playerState.playerMode() === 'browser'"
              [class.text-white]="playerState.playerMode() === 'browser'"
              [class.bg-bg-secondary]="playerState.playerMode() !== 'browser'"
              [class.text-text-muted]="playerState.playerMode() !== 'browser'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div class="flex-1 text-left">
              <p class="font-medium" [class.text-accent-qobuz]="playerState.playerMode() === 'browser'">
                Dieser Browser
              </p>
              <p class="text-sm text-text-muted">Wiedergabe auf diesem Gerät</p>
            </div>
            @if (playerState.playerMode() === 'browser') {
              <div class="w-6 h-6 rounded-full bg-accent-qobuz text-white flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            }
          </button>

          <!-- Divider -->
          @if (players().length > 0) {
            <div class="flex items-center gap-3 py-3">
              <div class="flex-1 h-px bg-border-subtle"></div>
              <span class="text-xs text-text-muted uppercase tracking-wide">Bluesound Player</span>
              <div class="flex-1 h-px bg-border-subtle"></div>
            </div>
          }

          <!-- Bluesound Players -->
          @for (player of players(); track player.id) {
            @if (!player.isSecondaryStereoPairSpeaker) {
              <button
                class="w-full flex items-center gap-4 p-4 rounded-xl transition-colors"
                [class.bg-accent-qobuz/10]="isSelected(player)"
                [class.border-accent-qobuz]="isSelected(player)"
                [class.border-2]="isSelected(player)"
                [class.bg-bg-card]="!isSelected(player)"
                [class.hover:bg-bg-card-hover]="!isSelected(player)"
                (click)="selectPlayer(player)"
              >
                <div
                  class="w-12 h-12 rounded-xl flex items-center justify-center"
                  [class.bg-accent-qobuz]="isSelected(player)"
                  [class.text-white]="isSelected(player)"
                  [class.bg-bg-secondary]="!isSelected(player)"
                  [class.text-text-muted]="!isSelected(player)"
                >
                  <!-- Speaker icon -->
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div class="flex-1 text-left min-w-0">
                  <p class="font-medium truncate" [class.text-accent-qobuz]="isSelected(player)">
                    {{ player.name }}
                  </p>
                  <p class="text-sm text-text-muted truncate">
                    {{ getPlayerSubtitle(player) }}
                  </p>
                </div>
                @if (isSelected(player)) {
                  <div class="w-6 h-6 rounded-full bg-accent-qobuz text-white flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                }
              </button>
            }
          }

          <!-- Empty State -->
          @if (players().length === 0 && !isLoading()) {
            <div class="text-center py-8 text-text-muted">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <p class="font-medium mb-1">Keine Player gefunden</p>
              <p class="text-sm">Stellen Sie sicher, dass Ihre Bluesound Player eingeschaltet sind</p>
            </div>
          }

          <!-- Loading State -->
          @if (isLoading()) {
            <div class="text-center py-8">
              <div class="w-8 h-8 border-2 border-accent-qobuz border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p class="text-text-muted">Suche nach Playern...</p>
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-border-subtle">
          <button
            class="w-full flex items-center justify-center gap-2 py-3 text-sm text-text-secondary hover:text-text-primary transition-colors"
            (click)="refreshPlayers()"
            [disabled]="isLoading()"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4"
              [class.animate-spin]="isLoading()"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Player aktualisieren
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    .safe-area-bottom {
      padding-bottom: env(safe-area-inset-bottom, 0);
    }

    @keyframes slide-up {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    .animate-slide-up {
      animation: slide-up 0.3s ease-out;
    }
  `]
})
export class PlayerSelectorComponent implements OnInit {
  readonly playerState = inject(PlayerStateService);
  private readonly playback = inject(PlaybackService);
  private readonly bluesoundApi = inject(BluesoundApiService);

  readonly isVisible = signal(false);
  readonly isLoading = signal(false);
  readonly players = signal<BluesoundPlayer[]>([]);

  constructor() {
    // Watch the service signal and open/close accordingly
    effect(() => {
      const shouldOpen = this.playerState.isPlayerSelectorVisible();
      if (shouldOpen && !this.isVisible()) {
        this.open();
      } else if (!shouldOpen && this.isVisible()) {
        this.isVisible.set(false);
      }
    });
  }

  ngOnInit(): void {
    this.loadPlayers();
  }

  open(): void {
    this.playerState.isPlayerSelectorVisible.set(true);
    this.isVisible.set(true);
    this.loadPlayers();
  }

  close(): void {
    this.isVisible.set(false);
    this.playerState.isPlayerSelectorVisible.set(false);
  }

  async selectBrowser(): Promise<void> {
    await this.playback.switchToBrowser();
    this.close();
  }

  async selectPlayer(player: BluesoundPlayer): Promise<void> {
    await this.playback.switchToBluesound(player);
    this.close();
  }

  isSelected(player: BluesoundPlayer): boolean {
    const selected = this.playerState.selectedPlayer();
    return selected?.id === player.id;
  }

  getPlayerSubtitle(player: BluesoundPlayer): string {
    if (player.isStereoPaired) {
      return `${player.modelName} (Stereopaar)`;
    }
    if (player.isGrouped) {
      return player.isMaster
        ? `${player.groupName} (Master)`
        : `${player.groupName}`;
    }
    return player.modelName;
  }

  loadPlayers(): void {
    this.isLoading.set(true);
    this.bluesoundApi.getPlayers().subscribe({
      next: (players) => {
        this.players.set(players);
        this.playerState.players.set(players);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  refreshPlayers(): void {
    this.isLoading.set(true);
    this.bluesoundApi.refreshPlayers().subscribe({
      next: (players) => {
        this.players.set(players);
        this.playerState.players.set(players);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isVisible()) {
      this.close();
    }
  }
}
