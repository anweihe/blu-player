import { Component, Input, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { QobuzApiService } from '../../../../core/services/qobuz-api.service';
import { PlayerStateService } from '../../../../core/services/player-state.service';
import { PlaybackService } from '../../../../core/services/playback.service';
import { NavigationStateService } from '../../../../core/services/navigation-state.service';
import { ContextMenuService } from '../../../../shared/services/context-menu.service';
import {
  QobuzAlbumWithTracks,
  QobuzTrack,
  formatDuration,
  getAlbumCoverUrl,
  getTrackQualityLabel,
  getAlbumTypeLabel
} from '../../../../core/models';
import { TrackItemComponent } from '../../../../shared/components';

@Component({
  selector: 'app-album-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, TrackItemComponent],
  template: `
    <div class="album-detail bg-bg-primary min-h-screen pb-28">
      @if (loading()) {
        <div class="flex justify-center items-center h-64">
          <div class="loading-spinner"></div>
        </div>
      } @else if (album()) {
        <!-- Header with gradient background -->
        <div class="album-header relative">
          <!-- Background blur -->
          @if (album()?.image?.large) {
            <div
              class="absolute inset-0 bg-cover bg-center opacity-20 blur-2xl"
              [style.background-image]="'url(' + album()?.image?.large + ')'"
            ></div>
          }
          <div class="absolute inset-0 bg-gradient-to-b from-transparent via-bg-primary/50 to-bg-primary"></div>

          <div class="relative p-4 sm:p-6 pt-4">
            <!-- Back button removed - now in AppHeader -->

            <div class="flex gap-4 sm:gap-6 flex-col md:flex-row">
              <!-- Album Cover -->
              <div class="album-cover w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 rounded-xl overflow-hidden bg-bg-secondary flex-shrink-0 mx-auto md:mx-0 shadow-2xl">
                @if (album()?.image?.large) {
                  <img
                    [src]="album()?.image?.large"
                    [alt]="album()?.title"
                    class="w-full h-full object-cover"
                  />
                } @else {
                  <div class="w-full h-full flex items-center justify-center text-text-muted">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                }
              </div>

              <!-- Album Info -->
              <div class="album-meta flex flex-col justify-center text-center md:text-left flex-1 min-w-0">
                <!-- Type & Badges -->
                <div class="flex items-center justify-center md:justify-start gap-2 mb-2 flex-wrap">
                  <span class="text-xs text-text-muted uppercase tracking-wider">
                    {{ getAlbumTypeLabel(album()!) }}
                  </span>
                  @if (isHiRes()) {
                    <span class="px-2 py-0.5 bg-accent-qobuz text-white text-[10px] font-bold rounded">
                      Hi-Res
                    </span>
                  }
                  @if (qualityLabel()) {
                    <span class="text-[10px] text-accent-qobuz">
                      {{ qualityLabel() }}
                    </span>
                  }
                </div>

                <!-- Title -->
                <h1 class="text-xl sm:text-2xl md:text-3xl font-bold mb-2 line-clamp-2">
                  {{ album()?.title }}
                </h1>

                <!-- Artist -->
                @if (album()?.artist) {
                  <a
                    [routerLink]="['/qobuz/artist', album()?.artist?.id]"
                    class="text-lg text-text-secondary hover:text-accent-qobuz transition-colors"
                  >
                    {{ album()?.artist?.name }}
                  </a>
                }

                <!-- Meta info -->
                <div class="flex items-center justify-center md:justify-start gap-2 mt-3 text-sm text-text-muted flex-wrap">
                  @if (releaseYear()) {
                    <span>{{ releaseYear() }}</span>
                    <span class="text-border-subtle">•</span>
                  }
                  <span>{{ album()?.tracks_count }} Tracks</span>
                  <span class="text-border-subtle">•</span>
                  <span>{{ formatAlbumDuration(album()?.duration ?? 0) }}</span>
                </div>

                <!-- Label & Genre -->
                @if (album()?.label?.name || album()?.genre?.name) {
                  <div class="flex items-center justify-center md:justify-start gap-2 mt-2 text-xs text-text-muted flex-wrap">
                    @if (album()?.label?.name) {
                      <span>{{ album()?.label?.name }}</span>
                    }
                    @if (album()?.label?.name && album()?.genre?.name) {
                      <span class="text-border-subtle">•</span>
                    }
                    @if (album()?.genre?.name) {
                      <span>{{ album()?.genre?.name }}</span>
                    }
                  </div>
                }

                <!-- Action Buttons (matching Razor design) -->
                <div class="flex items-center justify-center md:justify-start gap-3 mt-5">
                  <!-- Play All Button -->
                  <button
                    class="w-12 h-12 flex items-center justify-center bg-accent-qobuz text-white rounded-full hover:bg-[#1ed760] hover:scale-110 transition-all shadow-lg"
                    (click)="playAll()"
                    title="Alle abspielen"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </button>

                  <!-- Album Info Button -->
                  <button
                    class="w-12 h-12 flex items-center justify-center bg-bg-card border border-border-accent rounded-full text-text-primary hover:bg-bg-card-hover hover:border-accent-blue hover:scale-110 transition-all"
                    (click)="fetchAlbumInfo()"
                    [disabled]="loadingAlbumInfo()"
                    title="Album-Info"
                  >
                    @if (loadingAlbumInfo()) {
                      <svg class="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    } @else {
                      <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5"/>
                      </svg>
                    }
                  </button>

                  <!-- Artist Menu Button -->
                  <button
                    class="w-12 h-12 flex items-center justify-center bg-bg-card border border-border-accent rounded-full text-text-primary hover:bg-bg-card-hover hover:border-accent-qobuz hover:scale-110 transition-all"
                    (click)="openArtistMenu($event)"
                    title="Mehr Optionen"
                  >
                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="5" r="2"/>
                      <circle cx="12" cy="12" r="2"/>
                      <circle cx="12" cy="19" r="2"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Album Info Container (wie in Razor) -->
        @if (showAlbumInfo()) {
          <div class="album-info-container mx-4 md:mx-6 mt-5 mb-6 p-5 bg-bg-card border border-border-subtle rounded-xl">
            <!-- Header -->
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-base font-semibold">Album-Info</h3>
              <button
                class="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-colors"
                (click)="closeAlbumInfo()"
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <!-- Content -->
            <div class="album-info-content">
              @if (loadingAlbumInfo()) {
                <!-- Loading -->
                <div class="flex justify-center py-10">
                  <div class="loading-spinner"></div>
                </div>
              } @else if (albumInfoError()) {
                <!-- Error -->
                <div class="text-center text-danger py-6 text-sm">
                  {{ albumInfoError() }}
                </div>
              } @else if (albumInfo()) {
                <!-- Style Quote -->
                @if (albumInfo()!.style) {
                  <div class="album-info-style relative p-5 mb-6 rounded-lg italic text-base leading-relaxed">
                    {{ albumInfo()!.style }}
                  </div>
                }
                <!-- Summary Text -->
                @if (albumInfo()!.summary) {
                  <div class="album-info-text text-sm leading-relaxed text-text-secondary whitespace-pre-wrap text-justify">
                    {{ albumInfo()!.summary }}
                  </div>
                }
              }
            </div>
          </div>
        }

        <!-- Track List -->
        <div class="tracks-list px-4 md:px-6">
          <!-- Header (desktop) -->
          <div class="hidden md:flex items-center gap-3 px-3 py-2 text-xs text-text-muted border-b border-border-subtle mb-2">
            <span class="w-8 text-center">#</span>
            <span class="flex-1">Titel</span>
            <span class="w-20 text-right">Dauer</span>
            <span class="w-8"></span>
          </div>

          @for (track of album()?.tracks?.items; track track.id; let i = $index) {
            <app-track-item
              [track]="track"
              [trackNumber]="i + 1"
              [showNumber]="true"
              [showArt]="false"
              [showArtist]="track.performer?.name !== album()?.artist?.name"
              [showAlbum]="false"
              [showQuality]="isTrackHiRes(track)"
              [showMenu]="true"
              [isPlaying]="isTrackPlaying(track)"
              (play)="playTrack(track, i)"
              (menu)="openTrackMenu($event)"
            />
          }
        </div>

        <!-- Album Description (from API) -->
        @if (album()?.description) {
          <div class="album-description mx-6 mt-6 p-4 bg-bg-card border border-border-subtle rounded-lg">
            <h3 class="text-sm font-semibold mb-2">Über das Album</h3>
            <div
              class="description-content text-sm text-text-secondary leading-relaxed"
              [innerHTML]="album()?.description"
            ></div>
          </div>
        }
      } @else {
        <!-- Error state -->
        <div class="flex flex-col items-center justify-center h-64 text-text-muted">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p>Album konnte nicht geladen werden</p>
          <button
            routerLink="/qobuz/browse"
            class="mt-4 px-4 py-2 bg-accent-qobuz text-white rounded-lg hover:bg-accent-qobuz/90 transition-colors"
          >
            Zurück zum Browser
          </button>
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

    /* Album Description HTML content styling */
    .description-content ::ng-deep p {
      margin-bottom: 0.75rem;
    }

    .description-content ::ng-deep p:last-child {
      margin-bottom: 0;
    }

    .description-content ::ng-deep a {
      color: var(--color-accent-qobuz);
      text-decoration: none;
    }

    .description-content ::ng-deep a:hover {
      text-decoration: underline;
    }

    /* Album Info Style Quote Block */
    .album-info-style {
      background: linear-gradient(135deg, rgba(29, 185, 84, 0.08) 0%, rgba(29, 185, 84, 0.02) 100%);
      color: var(--color-text-primary);
      border-left: 3px solid var(--color-accent-qobuz);
    }

    .album-info-style::before {
      content: '"';
      position: absolute;
      top: 8px;
      left: 12px;
      font-size: 3rem;
      font-family: Georgia, 'Times New Roman', serif;
      color: var(--color-accent-qobuz);
      opacity: 0.4;
      line-height: 1;
    }

    /* Album Info Text with Drop Cap */
    .album-info-text::first-letter {
      font-size: 1.8em;
      font-weight: 600;
      color: var(--color-text-primary);
      float: left;
      line-height: 1;
      margin-right: 6px;
      margin-top: 4px;
    }

    /* Mobile adjustments */
    @media (max-width: 380px) {
      .album-cover {
        width: 128px !important;
        height: 128px !important;
      }
    }

    .safe-area-top {
      padding-top: env(safe-area-inset-top, 0);
    }
  `]
})
export class AlbumDetailComponent implements OnInit, OnDestroy {
  @Input() id!: string;

  private readonly qobuzApi = inject(QobuzApiService);
  private readonly playerState = inject(PlayerStateService);
  private readonly playbackService = inject(PlaybackService);
  private readonly navState = inject(NavigationStateService);
  private readonly contextMenu = inject(ContextMenuService);

  readonly loading = signal(true);
  readonly album = signal<QobuzAlbumWithTracks | null>(null);
  readonly albumInfo = signal<{ style: string; summary: string } | null>(null);
  readonly showAlbumInfo = signal(false);
  readonly loadingAlbumInfo = signal(false);
  readonly albumInfoError = signal<string | null>(null);

  // Computed properties
  readonly isHiRes = computed(() => {
    const alb = this.album();
    return alb?.hires_streamable || alb?.hires ||
      (alb?.maximum_bit_depth && alb.maximum_bit_depth > 16);
  });

  readonly qualityLabel = computed(() => {
    const alb = this.album();
    if (!alb?.maximum_bit_depth || !alb?.maximum_sampling_rate) return null;
    if (alb.maximum_bit_depth > 16) {
      return `${alb.maximum_bit_depth}-Bit / ${alb.maximum_sampling_rate}kHz`;
    }
    return null;
  });

  readonly releaseYear = computed(() => {
    const alb = this.album();
    if (!alb?.released_at) return null;
    return new Date(alb.released_at * 1000).getFullYear();
  });

  readonly hasAlbumInfo = computed(() => {
    const alb = this.album();
    return alb?.title && alb?.artist?.name;
  });

  formatDuration = formatDuration;
  getAlbumTypeLabel = getAlbumTypeLabel;

  ngOnInit(): void {
    // Enter detail mode - back button and play button will appear in header
    this.navState.enterDetailMode('/qobuz/browse', 'Album', {
      showPlayButton: true,
      onPlayAll: () => this.playAll()
    });

    if (this.id) {
      this.loadAlbum();
    }
  }

  ngOnDestroy(): void {
    // Exit detail mode when leaving the page
    this.navState.exitDetailMode();
  }

  private loadAlbum(): void {
    this.qobuzApi.getAlbum(this.id).subscribe({
      next: album => {
        this.album.set(album);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  formatAlbumDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours} Std. ${mins} Min.`;
    }
    return `${mins} Min.`;
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
    const alb = this.album();
    const tracks = alb?.tracks?.items;
    if (alb && tracks?.length) {
      this.playbackService.playAlbum(alb, tracks, 0);
    }
  }

  shufflePlay(): void {
    const alb = this.album();
    const tracks = alb?.tracks?.items;
    if (alb && tracks?.length) {
      // Shuffle tracks and play from first
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      // For shuffle, we create a temporary playback context
      this.playbackService.playTrack(shuffled[0], {
        type: 'album',
        id: alb.id ?? '',
        tracks: shuffled,
        startIndex: 0
      });
    }
  }

  playTrack(track: QobuzTrack, index: number): void {
    const alb = this.album();
    const tracks = alb?.tracks?.items;
    if (alb && tracks?.length) {
      this.playbackService.playAlbum(alb, tracks, index);
    }
  }

  openTrackMenu(event: { track: QobuzTrack; event: MouseEvent }): void {
    this.contextMenu.openTrackMenu(event.event, event.track, {
      onPlay: () => this.playTrack(event.track, 0),
      onAddToQueue: () => console.log('Add to queue:', event.track.title)
    });
  }

  toggleAlbumInfo(): void {
    if (this.albumInfo()) {
      this.showAlbumInfo.update(v => !v);
    } else {
      this.fetchAlbumInfo();
    }
  }

  fetchAlbumInfo(): void {
    // Toggle: if already visible, close it
    if (this.showAlbumInfo()) {
      this.showAlbumInfo.set(false);
      return;
    }

    // Show container (will show loading state)
    this.showAlbumInfo.set(true);
    this.albumInfoError.set(null);

    // If already loaded, just show it
    if (this.albumInfo()) {
      return;
    }

    const alb = this.album();
    if (!alb?.id || !alb?.title || !alb?.artist?.name) {
      this.albumInfoError.set('Album-Informationen nicht verfügbar');
      return;
    }

    this.loadingAlbumInfo.set(true);
    this.qobuzApi.getAlbumInfo(alb.id, alb.title, alb.artist.name).subscribe({
      next: info => {
        this.albumInfo.set(info);
        this.loadingAlbumInfo.set(false);
      },
      error: (err: Error) => {
        this.albumInfoError.set(err.message || 'Fehler beim Laden der Album-Info');
        this.loadingAlbumInfo.set(false);
      }
    });
  }

  closeAlbumInfo(): void {
    this.showAlbumInfo.set(false);
  }

  openArtistMenu(event: MouseEvent): void {
    const alb = this.album();
    if (alb) {
      this.contextMenu.openAlbumMenu(event, alb);
    }
  }
}
