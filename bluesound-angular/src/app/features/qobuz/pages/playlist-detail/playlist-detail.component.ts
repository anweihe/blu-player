import { Component, Input, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { QobuzApiService } from '../../../../core/services/qobuz-api.service';
import { PlayerStateService } from '../../../../core/services/player-state.service';
import { NavigationStateService } from '../../../../core/services/navigation-state.service';
import { ContextMenuService } from '../../../../shared/services/context-menu.service';
import {
  QobuzPlaylistWithTracks,
  QobuzTrack,
  formatDuration,
  getPlaylistCoverUrl
} from '../../../../core/models';
import { TrackItemComponent } from '../../../../shared/components';

@Component({
  selector: 'app-playlist-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, TrackItemComponent],
  template: `
    <div class="playlist-detail bg-bg-primary min-h-screen pb-28">
      @if (loading()) {
        <div class="flex justify-center items-center h-64">
          <div class="loading-spinner"></div>
        </div>
      } @else if (playlist()) {
        <!-- Header with gradient background -->
        <div class="playlist-header relative">
          <!-- Background blur -->
          @if (coverImage()) {
            <div
              class="absolute inset-0 bg-cover bg-center opacity-20 blur-2xl"
              [style.background-image]="'url(' + coverImage() + ')'"
            ></div>
          }
          <div class="absolute inset-0 bg-gradient-to-b from-transparent via-bg-primary/50 to-bg-primary"></div>

          <div class="relative p-4 sm:p-6 pt-4">
            <!-- Back button removed - now in AppHeader -->

            <div class="flex gap-4 sm:gap-6 flex-col md:flex-row">
              <!-- Playlist Cover (clickable to enlarge) -->
              <div
                class="playlist-cover w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 rounded-xl overflow-hidden bg-bg-secondary flex-shrink-0 mx-auto md:mx-0 shadow-2xl cursor-zoom-in"
                (click)="coverImage() && openFullCover()"
              >
                @if (coverImage()) {
                  <img
                    [src]="coverImage()"
                    [alt]="playlist()?.name"
                    class="w-full h-full object-cover"
                  />
                } @else {
                  <div class="w-full h-full flex items-center justify-center text-text-muted bg-gradient-to-br from-bg-secondary to-bg-card">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </div>
                }
              </div>

              <!-- Playlist Info -->
              <div class="playlist-meta flex flex-col justify-center text-center md:text-left flex-1 min-w-0">
                <!-- Type -->
                <span class="text-xs text-text-muted uppercase tracking-wider mb-2">
                  Playlist
                </span>

                <!-- Title -->
                <h1 class="text-xl sm:text-2xl md:text-3xl font-bold mb-2 line-clamp-2">
                  {{ playlist()?.name }}
                </h1>

                <!-- Owner -->
                @if (playlist()?.owner?.name) {
                  <p class="text-text-secondary">
                    von {{ playlist()?.owner?.name }}
                  </p>
                }

                <!-- Meta info -->
                <div class="flex items-center justify-center md:justify-start gap-2 mt-3 text-sm text-text-muted flex-wrap">
                  <span>{{ playlist()?.tracks_count }} Tracks</span>
                  <span class="text-border-subtle">•</span>
                  <span>{{ formatPlaylistDuration(playlist()?.duration ?? 0) }}</span>
                  @if (playlist()?.updated_at) {
                    <span class="text-border-subtle">•</span>
                    <span>Aktualisiert {{ formatDate(playlist()!.updated_at!) }}</span>
                  }
                </div>

                <!-- Description -->
                @if (playlist()?.description) {
                  <p class="text-sm text-text-muted mt-3 line-clamp-3">
                    {{ playlist()?.description }}
                  </p>
                }

                <!-- Action Buttons -->
                <div class="flex items-center justify-center md:justify-start gap-3 mt-5">
                  <button
                    class="flex items-center gap-2 px-6 py-2.5 bg-accent-qobuz text-white rounded-full font-medium hover:bg-accent-qobuz/90 transition-colors shadow-lg"
                    (click)="playAll()"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                    Abspielen
                  </button>

                  <button
                    class="flex items-center gap-2 px-4 py-2.5 bg-bg-secondary border border-border-subtle rounded-full text-sm hover:border-border-accent transition-colors"
                    (click)="shufflePlay()"
                    title="Zufällige Wiedergabe"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Track List -->
        <div class="tracks-list px-4 md:px-6">
          <!-- Header (desktop) -->
          <div class="hidden md:flex items-center gap-3 px-3 py-2 text-xs text-text-muted border-b border-border-subtle mb-2">
            <span class="w-8 text-center">#</span>
            <span class="w-10"></span>
            <span class="flex-1">Titel</span>
            <span class="w-20 text-right">Dauer</span>
            <span class="w-8"></span>
          </div>

          @for (track of playlist()?.tracks?.items; track track.id; let i = $index) {
            <app-track-item
              [track]="track"
              [trackNumber]="i + 1"
              [showNumber]="true"
              [showArt]="true"
              [showArtist]="true"
              [showAlbum]="true"
              [showQuality]="isTrackHiRes(track)"
              [showMenu]="true"
              [isPlaying]="isTrackPlaying(track)"
              (play)="playTrack(track, i)"
              (menu)="openTrackMenu($event)"
            />
          }

          <!-- Empty state -->
          @if (!playlist()?.tracks?.items?.length) {
            <div class="flex flex-col items-center justify-center py-16 text-text-muted">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <p>Diese Playlist enthält keine Tracks</p>
            </div>
          }
        </div>
      } @else {
        <!-- Error state -->
        <div class="flex flex-col items-center justify-center h-64 text-text-muted">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p>Playlist konnte nicht geladen werden</p>
          <button
            routerLink="/qobuz/browse"
            class="mt-4 px-4 py-2 bg-accent-qobuz text-white rounded-lg hover:bg-accent-qobuz/90 transition-colors"
          >
            Zurück zum Browser
          </button>
        </div>
      }

      <!-- Fullscreen Cover Overlay -->
      @if (showFullCover()) {
        <div
          class="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center cursor-zoom-out"
          (click)="closeFullCover()"
        >
          <!-- Close Button -->
          <button
            class="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors safe-area-top safe-area-right"
            (click)="closeFullCover()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- Full-size Cover Image -->
          <img
            [src]="coverImage()"
            [alt]="playlist()?.name"
            class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            (click)="$event.stopPropagation()"
          />
        </div>
      }
    </div>
  `,
  styles: [`
    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 3px solid var(--color-border-accent);
      border-top-color: var(--color-accent-qobuz);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .line-clamp-3 {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* Mobile adjustments */
    @media (max-width: 380px) {
      .playlist-cover {
        width: 128px !important;
        height: 128px !important;
      }
    }

    .safe-area-top {
      padding-top: env(safe-area-inset-top, 0);
    }
  `]
})
export class PlaylistDetailComponent implements OnInit, OnDestroy {
  @Input() id!: string;

  private readonly qobuzApi = inject(QobuzApiService);
  private readonly playerState = inject(PlayerStateService);
  private readonly navState = inject(NavigationStateService);
  private readonly contextMenu = inject(ContextMenuService);

  readonly loading = signal(true);
  readonly playlist = signal<QobuzPlaylistWithTracks | null>(null);
  readonly showFullCover = signal(false);

  // Computed properties
  readonly coverImage = computed(() => {
    const pl = this.playlist();
    if (!pl) return null;
    return pl.images300?.[0] ?? pl.images150?.[0] ?? pl.images?.[0];
  });

  formatDuration = formatDuration;

  ngOnInit(): void {
    // Enter detail mode - back button will appear in header
    this.navState.enterDetailMode('/qobuz/browse', 'Playlist', {
      showPlayButton: true,
      onPlayAll: () => this.playAll()
    });

    if (this.id) {
      this.loadPlaylist();
    }
  }

  ngOnDestroy(): void {
    // Exit detail mode when leaving the page
    this.navState.exitDetailMode();
  }

  private loadPlaylist(): void {
    const playlistId = parseInt(this.id, 10);
    this.qobuzApi.getPlaylist(playlistId).subscribe({
      next: playlist => {
        this.playlist.set(playlist);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  formatPlaylistDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} Std. ${mins} Min.`;
    }
    return `${mins} Min.`;
  }

  formatDate(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  isTrackHiRes(track: QobuzTrack): boolean {
    return track.hires_streamable || track.hires ||
      (track.maximum_bit_depth !== undefined && track.maximum_bit_depth > 16);
  }

  isTrackPlaying(track: QobuzTrack): boolean {
    // Check both currentPlayingTrackId (for Bluesound) and currentTrack (for browser)
    const playingTrackId = this.playerState.currentPlayingTrackId();
    const current = this.playerState.currentTrack();
    const isThisTrack = playingTrackId === track.id || current?.id === track.id;
    return isThisTrack && this.playerState.isPlaying();
  }

  goBack(): void {
    window.history.back();
  }

  playAll(): void {
    const tracks = this.playlist()?.tracks?.items;
    if (tracks?.length) {
      this.playTrack(tracks[0], 0);
    }
  }

  shufflePlay(): void {
    const tracks = this.playlist()?.tracks?.items;
    if (tracks?.length) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      this.playTrack(shuffled[0], 0);
    }
  }

  playTrack(track: QobuzTrack, index: number): void {
    this.playerState.currentTrack.set(track);
    console.log('Playing track:', track.title, 'at index:', index);
    // TODO: Integrate with actual playback service
  }

  openTrackMenu(event: { track: QobuzTrack; event: MouseEvent }): void {
    this.contextMenu.openTrackMenu(event.event, event.track, {
      onPlay: () => this.playTrack(event.track, 0),
      onAddToQueue: () => console.log('Add to queue:', event.track.title)
    });
  }

  openFullCover(): void {
    this.showFullCover.set(true);
  }

  closeFullCover(): void {
    this.showFullCover.set(false);
  }
}
