import { Component, inject, signal, computed, OnInit, OnDestroy, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { RadioParadiseApiService } from '../../core/services/radioparadise-api.service';
import { PlayerStateService } from '../../core/services/player-state.service';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { RadioParadiseItem, RadioParadiseSection } from '../../core/models';
import { PlayerSelectorComponent, ProfileSwitcherComponent } from '../../layout';

@Component({
  selector: 'app-radio-paradise',
  standalone: true,
  imports: [CommonModule, RouterLink, PlayerSelectorComponent, ProfileSwitcherComponent],
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
              <svg class="w-7 h-7 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              <h1 class="text-xl font-semibold tracking-tight">Radio Paradise</h1>
            </div>
          </div>

          @if (auth.isLoggedIn()) {
            <button
              class="w-9 h-9 rounded-full text-white flex items-center justify-center text-sm font-semibold cursor-pointer hover:ring-2 hover:ring-emerald-500/50 transition-all"
              [style.background-color]="profileService.activeProfile() ? profileService.getProfileColor(profileService.activeProfile()!.id) : 'rgb(16 185 129)'"
              (click)="openProfileSwitcher()"
            >
              {{ profileInitial() }}
            </button>
          }
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
        <!-- No Player State -->
        @if (!hasBluesoundPlayer()) {
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <div class="w-20 h-20 rounded-2xl bg-bg-card flex items-center justify-center mb-6">
              <svg class="w-10 h-10 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 9v-2M12 17v-2M9 12H7M17 12h-2"/>
              </svg>
            </div>
            <h2 class="text-xl font-bold mb-2">Bluesound Player erforderlich</h2>
            <p class="text-text-secondary mb-6 max-w-sm">
              Radio Paradise verwendet die integrierte Radio-Funktion deines Bluesound Players. Bitte wähle einen Player aus.
            </p>
            <button
              class="px-5 py-2.5 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
              (click)="openPlayerSelector()"
            >
              Player auswählen
            </button>
          </div>
        } @else {
          <!-- Hero Banner -->
          <div class="bg-gradient-to-br from-emerald-600 to-emerald-800 rounded-2xl p-4 sm:p-6 mb-8">
            <div class="flex items-center gap-3 sm:gap-4">
              <div class="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-white/10 flex items-center justify-center">
                <svg class="w-6 h-6 sm:w-8 sm:h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <h2 class="text-lg sm:text-xl font-bold text-white">Radio Paradise</h2>
                <p class="text-white/70 text-sm">Eclectic Mix - Listener Supported</p>
              </div>
            </div>
          </div>

          <!-- Loading State -->
          @if (isLoading()) {
            <div class="flex items-center justify-center py-16">
              <div class="flex flex-col items-center gap-4">
                <div class="w-10 h-10 border-3 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                <span class="text-text-secondary">Laden...</span>
              </div>
            </div>
          } @else if (error()) {
            <!-- Error State -->
            <div class="flex flex-col items-center justify-center py-16 text-center">
              <div class="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <svg class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <p class="text-red-400 mb-4">{{ error() }}</p>
              <button
                class="px-4 py-2 bg-bg-card text-text-primary rounded-lg hover:bg-bg-card-hover transition-colors"
                (click)="loadChannels()"
              >
                Erneut versuchen
              </button>
            </div>
          } @else if (currentSections().length > 0) {
            <!-- Channels Sections -->
            <div class="space-y-8">
              @for (section of currentSections(); track section.title || $index) {
                <section>
                  @if (section.title) {
                    <div class="flex items-center gap-3 mb-4">
                      <h3 class="text-sm font-semibold text-text-muted uppercase tracking-wide">
                        {{ section.title }}
                      </h3>
                      @if (getQualityBadge(section.title)) {
                        <span
                          class="px-2 py-0.5 text-xs font-bold rounded"
                          [class]="getQualityBadgeClass(section.title)"
                        >
                          {{ getQualityBadge(section.title) }}
                        </span>
                      }
                    </div>
                  }
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    @for (item of section.items; track item.title) {
                      <button
                        class="flex items-center gap-4 p-4 bg-bg-card border border-border-accent rounded-xl hover:bg-bg-card-hover hover:border-emerald-500/30 transition-all group"
                        (click)="playChannel(item)"
                      >
                        <div class="w-14 h-14 rounded-lg bg-emerald-500/10 flex-shrink-0 overflow-hidden">
                          @if (item.imageUrl) {
                            <img [src]="item.imageUrl" class="w-full h-full object-cover" loading="lazy" />
                          } @else {
                            <div class="w-full h-full flex items-center justify-center text-emerald-500">
                              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" [innerHTML]="getChannelIconPath(item.title)"></svg>
                            </div>
                          }
                        </div>
                        <div class="flex-1 min-w-0 text-left">
                          <h4 class="font-medium text-text-primary truncate">{{ item.title }}</h4>
                          @if (item.subtitle) {
                            <p class="text-xs text-text-muted truncate">{{ item.subtitle }}</p>
                          }
                        </div>
                        <div class="flex-shrink-0">
                          <div class="w-11 h-11 rounded-full bg-emerald-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        </div>
                      </button>
                    }
                  </div>
                </section>
              }
            </div>
          } @else {
            <!-- Empty State -->
            <div class="flex flex-col items-center justify-center py-16 text-center">
              <svg class="w-16 h-16 text-text-muted mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
              <h3 class="text-lg font-medium mb-2">Keine Kanäle</h3>
              <p class="text-text-secondary">Radio Paradise konnte nicht geladen werden.</p>
            </div>
          }
        }
      </main>

      <!-- Player Selector -->
      <app-player-selector #playerSelector></app-player-selector>
    </div>
  `,
  styles: [`
    .safe-area-top {
      padding-top: env(safe-area-inset-top, 0);
    }
    .border-3 {
      border-width: 3px;
    }
  `]
})
export class RadioParadiseComponent implements OnInit, OnDestroy {
  @ViewChild('playerSelector') playerSelector!: PlayerSelectorComponent;
  readonly auth = inject(AuthService);
  readonly profileService = inject(ProfileService);
  private readonly rpApi = inject(RadioParadiseApiService);
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

  // State
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly currentSections = signal<RadioParadiseSection[]>([]);
  readonly isPlaying = signal(false);

  // Status polling
  private statusSubscription?: Subscription;

  // Track previous player to detect changes
  private previousPlayerId: string | null = null;

  // Computed
  readonly hasBluesoundPlayer = computed(() => {
    const player = this.playerState.selectedPlayer();
    return player !== null && player.ipAddress !== undefined;
  });

  constructor() {
    // React to player changes
    effect(() => {
      const player = this.playerState.selectedPlayer();
      const currentId = player?.id ?? null;

      // Only reload if player actually changed and we have a valid player
      if (currentId !== this.previousPlayerId && player?.ipAddress) {
        this.previousPlayerId = currentId;
        this.loadChannels();
      }
    });
  }

  ngOnInit(): void {
    if (this.hasBluesoundPlayer()) {
      this.loadChannels();
    }
  }

  openPlayerSelector(): void {
    this.playerSelector?.open();
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

  ngOnDestroy(): void {
    this.stopStatusPolling();
  }

  loadChannels(): void {
    const player = this.playerState.selectedPlayer();
    if (!player) return;

    this.isLoading.set(true);
    this.error.set(null);

    this.rpApi.getMenu(player).subscribe({
      next: (response) => {
        if (response.success) {
          this.currentSections.set(response.sections);
        } else {
          this.error.set(response.error || 'Radio Paradise konnte nicht geladen werden');
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Radio Paradise konnte nicht geladen werden');
        this.isLoading.set(false);
      }
    });
  }

  playChannel(item: RadioParadiseItem): void {
    const player = this.playerState.selectedPlayer();
    if (!player) return;

    this.rpApi.playChannel(player, item).subscribe({
      next: (response) => {
        if (response.success) {
          this.isPlaying.set(true);
          this.startStatusPolling();

          // Save to history
          const profileId = this.auth.getProfileId();
          if (profileId) {
            this.rpApi.saveToHistory(profileId, item).subscribe();
          }
        } else {
          this.error.set(response.error || 'Kanal konnte nicht abgespielt werden');
        }
      }
    });
  }

  getQualityBadge(title: string | undefined): string | null {
    if (!title) return null;
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('mqa')) return 'MQA';
    if (lowerTitle.includes('cd') || lowerTitle.includes('flac')) return 'FLAC';
    return null;
  }

  getQualityBadgeClass(title: string | undefined): string {
    if (!title) return '';
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('mqa')) {
      return 'bg-purple-500/20 text-purple-400';
    }
    if (lowerTitle.includes('cd') || lowerTitle.includes('flac')) {
      return 'bg-blue-500/20 text-blue-400';
    }
    return '';
  }

  getChannelIconPath(title: string): string {
    const lowerTitle = (title || '').toLowerCase();

    if (lowerTitle.includes('main')) {
      return '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>';
    }
    if (lowerTitle.includes('mellow')) {
      return '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>';
    }
    if (lowerTitle.includes('rock')) {
      return '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>';
    }
    if (lowerTitle.includes('global')) {
      return '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>';
    }

    // Default music icon
    return '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>';
  }

  private startStatusPolling(): void {
    this.stopStatusPolling();
    const player = this.playerState.selectedPlayer();
    if (!player) return;

    this.statusSubscription = interval(5000).subscribe(() => {
      const currentPlayer = this.playerState.selectedPlayer();
      if (!currentPlayer) {
        this.stopStatusPolling();
        return;
      }

      this.rpApi.getBluesoundStatus(currentPlayer).subscribe({
        next: (response) => {
          if (response.success && response.status) {
            this.isPlaying.set(
              response.status.state === 'play' || response.status.state === 'stream'
            );
          }
        }
      });
    });
  }

  private stopStatusPolling(): void {
    this.statusSubscription?.unsubscribe();
    this.statusSubscription = undefined;
  }
}
