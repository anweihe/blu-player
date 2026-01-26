import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { BluesoundApiService } from '../../core/services/bluesound-api.service';
import { PlayerStateService } from '../../core/services/player-state.service';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { BluesoundPlayer, PlayerGroup } from '../../core/models';
import { ProfileSwitcherComponent } from '../../layout';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [CommonModule, RouterLink, ProfileSwitcherComponent],
  template: `
    <div class="min-h-screen bg-bg-primary">
      <!-- Header -->
      <header class="sticky top-0 z-50 bg-bg-secondary border-b border-border-subtle safe-area-top">
        <div class="flex items-center justify-between px-4 py-3.5 max-w-5xl mx-auto">
          <div class="flex items-center gap-3">
            <a routerLink="/" class="w-9 h-9 rounded-lg hover:bg-bg-card flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M15 19l-7-7 7-7"/>
              </svg>
            </a>
            <div class="flex items-center gap-2.5">
              <svg class="w-7 h-7 text-text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 9v-2M12 17v-2M9 12H7M17 12h-2"/>
              </svg>
              <h1 class="text-xl font-semibold tracking-tight">Players</h1>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              class="flex items-center gap-2 px-3 py-2 bg-bg-card border border-border-accent rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition-colors"
              (click)="refreshPlayers()"
              [disabled]="isLoading()"
            >
              <svg class="w-4 h-4" [class.animate-spin]="isLoading()" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              <span class="hidden sm:inline text-sm">Aktualisieren</span>
            </button>

            @if (auth.isLoggedIn()) {
              <button
                class="w-9 h-9 rounded-full text-white flex items-center justify-center text-sm font-semibold cursor-pointer hover:ring-2 hover:ring-accent-qobuz/50 transition-all"
                [style.background-color]="profileService.activeProfile() ? profileService.getProfileColor(profileService.activeProfile()!.id) : 'var(--color-accent-qobuz)'"
                (click)="openProfileSwitcher()"
              >
                {{ profileInitial() }}
              </button>
            }
          </div>
        </div>
      </header>

      <!-- Profile Switcher Modal -->
      @if (showProfileSwitcher()) {
        <app-profile-switcher
          (closed)="closeProfileSwitcher()"
          (profileSelected)="onProfileSelected($event)"
        />
      }

      <!-- Main Content -->
      <main class="px-4 py-6 max-w-5xl mx-auto pb-28">
        <!-- Stats -->
        @if (!isLoading() && players().length > 0) {
          <div class="flex items-center gap-2 mb-4 text-sm text-text-secondary">
            <span><strong class="text-text-primary">{{ players().length }}</strong> Player</span>
            @if (groupCount() > 0) {
              <span class="text-text-muted">·</span>
              <span><strong class="text-text-primary">{{ groupCount() }}</strong> Gruppen</span>
            }
          </div>
        }

        <!-- Loading State -->
        @if (isLoading()) {
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            @for (i of [1, 2, 3]; track i) {
              <div class="bg-bg-card border border-border-subtle rounded-xl p-4 animate-pulse">
                <div class="flex justify-between items-start mb-4">
                  <div class="h-5 w-32 bg-bg-secondary rounded"></div>
                  <div class="h-6 w-16 bg-bg-secondary rounded-full"></div>
                </div>
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-bg-secondary rounded-lg"></div>
                  <div class="flex-1">
                    <div class="h-4 w-24 bg-bg-secondary rounded mb-2"></div>
                    <div class="h-3 w-32 bg-bg-secondary rounded"></div>
                  </div>
                </div>
              </div>
            }
          </div>
          <div class="flex items-center justify-center gap-3 mt-8 text-text-secondary">
            <div class="w-5 h-5 border-2 border-accent-qobuz/30 border-t-accent-qobuz rounded-full animate-spin"></div>
            <span class="text-sm">Suche nach Playern im Netzwerk...</span>
          </div>
        } @else if (players().length === 0) {
          <!-- Empty State -->
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <div class="w-20 h-20 rounded-2xl bg-bg-card flex items-center justify-center mb-6">
              <svg class="w-10 h-10 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <circle cx="12" cy="14" r="4"/>
                <line x1="12" y1="6" x2="12" y2="6.01"/>
              </svg>
            </div>
            <h2 class="text-xl font-bold mb-2">Keine Player gefunden</h2>
            <p class="text-text-secondary mb-6 max-w-sm">
              Stellen Sie sicher, dass Ihre Bluesound Player eingeschaltet sind und Sie sich im selben Netzwerk befinden.
            </p>
            <button
              class="flex items-center gap-2 px-5 py-2.5 bg-accent-qobuz text-white rounded-lg font-medium hover:bg-accent-qobuz/90 transition-colors"
              (click)="refreshPlayers()"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              Erneut suchen
            </button>
          </div>
        } @else {
          <!-- Player Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            @for (player of players(); track player.id) {
              <button
                class="text-left bg-bg-card border rounded-xl overflow-hidden transition-all hover:bg-bg-card-hover group"
                [class.border-accent-qobuz]="isSelected(player)"
                [class.border-border-subtle]="!isSelected(player)"
                [class.ring-1]="isSelected(player)"
                [class.ring-accent-qobuz]="isSelected(player)"
                [class.border-l-4]="true"
                [class.border-l-green-500]="player.isMaster"
                [class.border-l-blue-500]="player.isStereoPaired"
                [class.border-l-transparent]="!player.isMaster && !player.isStereoPaired"
                (click)="selectPlayer(player)"
              >
                <div class="p-4">
                  <!-- Card Header -->
                  <div class="flex justify-between items-start mb-3">
                    <h3 class="font-semibold text-text-primary truncate pr-2">{{ player.name }}</h3>
                    <span
                      class="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0"
                      [class]="getPlayerBadgeClass(player)"
                    >
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" [innerHTML]="getPlayerBadgeIcon(player)"></svg>
                      {{ getPlayerBadgeText(player) }}
                    </span>
                  </div>

                  <!-- Player Info -->
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-bg-secondary flex items-center justify-center shrink-0">
                      <svg class="w-5 h-5 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        @if (player.isStereoPaired) {
                          <rect x="4" y="6" width="6" height="12" rx="1"/>
                          <rect x="14" y="6" width="6" height="12" rx="1"/>
                        } @else {
                          <rect x="6" y="4" width="12" height="16" rx="2"/>
                          <circle cx="12" cy="14" r="3"/>
                          <circle cx="12" cy="7" r="1"/>
                        }
                      </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="text-sm text-text-primary truncate">{{ player.name }}</span>
                        @if (player.isMaster) {
                          <span class="px-1.5 py-0.5 bg-white/10 rounded text-[10px] font-semibold uppercase text-text-secondary">Master</span>
                        }
                      </div>
                      <div class="flex items-center gap-2 text-xs text-text-muted">
                        <span>{{ player.brand }} {{ player.modelName }}</span>
                        @if (player.channelMode) {
                          <span class="w-4 h-4 bg-blue-500 text-white rounded text-[10px] font-bold flex items-center justify-center">
                            {{ player.channelMode === 'left' ? 'L' : 'R' }}
                          </span>
                        }
                      </div>
                    </div>
                  </div>

                  <!-- Volume Control -->
                  <div class="mt-3 pl-13">
                    @if (player.isFixedVolume) {
                      <div class="flex items-center gap-2 text-text-muted text-xs">
                        <svg class="w-4 h-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="3" y="11" width="5" height="8" rx="1"/>
                          <path d="M8 15l4-4v8l-4-4z"/>
                          <path d="M16 12a4 4 0 0 1 0 6"/>
                        </svg>
                        <span>Fixed Volume</span>
                      </div>
                    } @else {
                      <div class="flex items-center gap-2" (click)="$event.stopPropagation()">
                        <button
                          class="w-7 h-7 rounded-full bg-bg-secondary border border-border-accent flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-blue-500 transition-colors"
                          (click)="adjustVolume(player, -5)"
                        >
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                        </button>
                        <div class="flex-1 max-w-[100px] sm:max-w-[120px] h-1 bg-bg-secondary rounded-full overflow-hidden">
                          <div
                            class="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
                            [style.width.%]="player.volume"
                          ></div>
                        </div>
                        <button
                          class="w-7 h-7 rounded-full bg-bg-secondary border border-border-accent flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-green-500 transition-colors"
                          (click)="adjustVolume(player, 5)"
                        >
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                        </button>
                        <span class="text-xs text-text-muted w-8 text-right">{{ player.volume }}%</span>
                      </div>
                    }
                  </div>
                </div>

                <!-- Selection Indicator -->
                @if (isSelected(player)) {
                  <div class="px-4 py-2 bg-accent-qobuz/10 border-t border-accent-qobuz/20">
                    <div class="flex items-center gap-2 text-accent-qobuz text-xs font-medium">
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      Aktiver Player
                    </div>
                  </div>
                }
              </button>
            }
          </div>

          <!-- Now Playing Section -->
          @if (selectedPlayer() && nowPlaying()) {
            <div class="mt-6 bg-bg-card border border-border-subtle rounded-xl overflow-hidden">
              <div class="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
                <h2 class="font-semibold">Wiedergabe</h2>
                <span class="px-2.5 py-1 bg-green-500/10 text-green-500 rounded-full text-xs font-medium">
                  {{ selectedPlayer()!.name }}
                </span>
              </div>
              <div class="p-4">
                <div class="flex gap-4">
                  <!-- Artwork -->
                  <div class="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 bg-bg-secondary rounded-lg flex-shrink-0 overflow-hidden">
                    @if (nowPlaying()!.imageUrl) {
                      <img [src]="nowPlaying()!.imageUrl" class="w-full h-full object-cover" />
                    } @else {
                      <div class="w-full h-full flex items-center justify-center text-text-muted">
                        <svg class="w-12 h-12 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                          <circle cx="12" cy="12" r="10"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      </div>
                    }
                  </div>

                  <!-- Info -->
                  <div class="flex-1 min-w-0">
                    <h3 class="font-semibold text-text-primary truncate mb-1">{{ nowPlaying()!.title || 'Kein Titel' }}</h3>
                    <p class="text-sm text-text-secondary truncate mb-0.5">{{ nowPlaying()!.artist }}</p>
                    <p class="text-xs text-text-muted truncate mb-3">{{ nowPlaying()!.album }}</p>

                    <!-- Progress -->
                    @if (nowPlaying()!.totalSeconds && nowPlaying()!.totalSeconds! > 0) {
                      <div class="mb-4">
                        <div class="h-1 bg-bg-secondary rounded-full overflow-hidden mb-1.5">
                          <div
                            class="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
                            [style.width.%]="getProgressPercent()"
                          ></div>
                        </div>
                        <div class="flex justify-between text-[10px] text-text-muted tabular-nums">
                          <span>{{ formatTime(nowPlaying()!.currentSeconds || 0) }}</span>
                          <span>{{ formatTime(nowPlaying()!.totalSeconds || 0) }}</span>
                        </div>
                      </div>
                    }

                    <!-- Controls -->
                    <div class="flex items-center gap-3">
                      <button
                        class="w-10 h-10 rounded-full bg-bg-secondary border border-border-accent flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-text-muted transition-colors"
                        (click)="controlPlayback('previous')"
                      >
                        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                        </svg>
                      </button>
                      <button
                        class="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-600 transition-colors"
                        (click)="controlPlayback('toggle')"
                      >
                        @if (nowPlaying()!.isPlaying) {
                          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                          </svg>
                        } @else {
                          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        }
                      </button>
                      <button
                        class="w-10 h-10 rounded-full bg-bg-secondary border border-border-accent flex items-center justify-center text-text-secondary hover:text-text-primary hover:border-text-muted transition-colors"
                        (click)="controlPlayback('next')"
                      >
                        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                        </svg>
                      </button>
                    </div>

                    @if (nowPlaying()!.service) {
                      <div class="mt-3 text-[10px] text-text-muted uppercase tracking-wider">
                        {{ nowPlaying()!.service }}
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
          }
        }
      </main>
    </div>
  `,
  styles: [`
    .safe-area-top {
      padding-top: env(safe-area-inset-top, 0);
    }
    .pl-13 {
      padding-left: 3.25rem;
    }
  `]
})
export class PlayersComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly profileService = inject(ProfileService);
  private readonly bluesoundApi = inject(BluesoundApiService);
  private readonly playerState = inject(PlayerStateService);

  // Profile switcher
  readonly showProfileSwitcher = signal(false);

  readonly profileInitial = computed(() => {
    const profile = this.profileService.activeProfile();
    if (profile) {
      return this.profileService.getProfileInitial(profile.name);
    }
    return this.auth.userInitial();
  });

  readonly isLoading = signal(true);
  readonly players = signal<BluesoundPlayer[]>([]);
  readonly nowPlaying = signal<{
    title?: string;
    artist?: string;
    album?: string;
    imageUrl?: string;
    currentSeconds?: number;
    totalSeconds?: number;
    isPlaying: boolean;
    service?: string;
  } | null>(null);

  private statusSubscription?: Subscription;

  readonly selectedPlayer = computed(() => this.playerState.selectedPlayer());
  readonly groupCount = computed(() =>
    this.players().filter(p => p.isMaster || p.isStereoPaired).length
  );

  ngOnInit(): void {
    this.loadPlayers();
  }

  ngOnDestroy(): void {
    this.stopStatusPolling();
  }

  openProfileSwitcher(): void {
    this.showProfileSwitcher.set(true);
  }

  closeProfileSwitcher(): void {
    this.showProfileSwitcher.set(false);
  }

  onProfileSelected(profile: { id: string }): void {
    this.profileService.setActiveProfileId(profile.id);
    this.closeProfileSwitcher();
  }

  loadPlayers(): void {
    this.isLoading.set(true);
    this.bluesoundApi.getPlayers().subscribe({
      next: players => {
        const visiblePlayers = players.filter(p => !p.isSecondaryStereoPairSpeaker);
        this.players.set(visiblePlayers);
        this.playerState.players.set(visiblePlayers);
        this.isLoading.set(false);

        // Start polling if a player is selected
        if (this.selectedPlayer()) {
          this.startStatusPolling();
        }
      },
      error: () => this.isLoading.set(false)
    });
  }

  refreshPlayers(): void {
    this.isLoading.set(true);
    this.bluesoundApi.refreshPlayers().subscribe({
      next: players => {
        const visiblePlayers = players.filter(p => !p.isSecondaryStereoPairSpeaker);
        this.players.set(visiblePlayers);
        this.playerState.players.set(visiblePlayers);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });
  }

  selectPlayer(player: BluesoundPlayer): void {
    this.playerState.selectPlayer(player);
    this.startStatusPolling();
    this.fetchPlaybackStatus();
  }

  isSelected(player: BluesoundPlayer): boolean {
    return this.playerState.selectedPlayer()?.id === player.id;
  }

  adjustVolume(player: BluesoundPlayer, delta: number): void {
    const newVolume = Math.max(0, Math.min(100, player.volume + delta));
    this.bluesoundApi.setVolume(player.ipAddress, newVolume).subscribe({
      next: () => {
        // Update local state
        const players = this.players();
        const index = players.findIndex(p => p.id === player.id);
        if (index >= 0) {
          const updated = [...players];
          updated[index] = { ...updated[index], volume: newVolume };
          this.players.set(updated);
        }
      }
    });
  }

  getPlayerBadgeClass(player: BluesoundPlayer): string {
    if (player.isMaster) {
      return 'bg-green-500/15 text-green-500';
    }
    if (player.isStereoPaired) {
      return 'bg-blue-500/15 text-blue-500';
    }
    return 'bg-zinc-500/15 text-zinc-400';
  }

  getPlayerBadgeIcon(player: BluesoundPlayer): string {
    if (player.isMaster) {
      return '<rect x="2" y="7" width="6" height="10" rx="1"/><rect x="16" y="7" width="6" height="10" rx="1"/><path d="M8 12h8"/>';
    }
    if (player.isStereoPaired) {
      return '<rect x="4" y="6" width="6" height="12" rx="1"/><rect x="14" y="6" width="6" height="12" rx="1"/>';
    }
    return '<rect x="6" y="4" width="12" height="16" rx="2"/><circle cx="12" cy="14" r="3"/><circle cx="12" cy="7" r="1"/>';
  }

  getPlayerBadgeText(player: BluesoundPlayer): string {
    if (player.isMaster) return 'Gruppe';
    if (player.isStereoPaired) return 'Stereo';
    return 'Einzeln';
  }

  controlPlayback(action: 'toggle' | 'previous' | 'next'): void {
    const player = this.selectedPlayer();
    if (!player) return;

    let observable;
    switch (action) {
      case 'toggle':
        observable = this.nowPlaying()?.isPlaying
          ? this.bluesoundApi.pause(player.ipAddress)
          : this.bluesoundApi.play(player.ipAddress);
        break;
      case 'previous':
        observable = this.bluesoundApi.back(player.ipAddress);
        break;
      case 'next':
        observable = this.bluesoundApi.skip(player.ipAddress);
        break;
    }

    observable.subscribe({
      next: () => {
        setTimeout(() => this.fetchPlaybackStatus(), 200);
      }
    });
  }

  getProgressPercent(): number {
    const np = this.nowPlaying();
    if (!np || !np.totalSeconds || np.totalSeconds <= 0) return 0;
    return ((np.currentSeconds || 0) / np.totalSeconds) * 100;
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private startStatusPolling(): void {
    this.stopStatusPolling();
    this.statusSubscription = interval(2000).subscribe(() => {
      this.fetchPlaybackStatus();
    });
  }

  private stopStatusPolling(): void {
    this.statusSubscription?.unsubscribe();
    this.statusSubscription = undefined;
  }

  private fetchPlaybackStatus(): void {
    const player = this.selectedPlayer();
    if (!player) {
      this.nowPlaying.set(null);
      return;
    }

    this.bluesoundApi.getStatus(player.ipAddress).subscribe({
      next: (status) => {
        if (status) {
          this.nowPlaying.set({
            title: status.title,
            artist: status.artist,
            album: status.album,
            imageUrl: status.imageUrl,
            currentSeconds: status.currentSeconds,
            totalSeconds: status.totalSeconds,
            isPlaying: status.state === 'play' || status.state === 'stream',
            service: status.service
          });
        } else {
          this.nowPlaying.set(null);
        }
      },
      error: () => {
        this.nowPlaying.set(null);
      }
    });
  }
}
