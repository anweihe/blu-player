import { Component, Input, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { QobuzApiService } from '../../../../core/services/qobuz-api.service';
import { PlayerStateService } from '../../../../core/services/player-state.service';
import { PlaybackService } from '../../../../core/services/playback.service';
import {
  QobuzTrack,
  QobuzAlbum,
  BackendArtistPageResponse,
  BackendArtistTrack,
  BackendReleaseCategory,
  BackendReleaseAlbum,
  BackendSimilarArtist,
  BackendAppearsOnTrack,
  formatDuration
} from '../../../../core/models';

/**
 * Release type labels in German
 */
const RELEASE_TYPE_LABELS: Record<string, string> = {
  'album': 'Alben',
  'single': 'Singles',
  'ep': 'EPs',
  'epSingle': 'EPs & Singles',
  'ep-single': 'EPs & Singles',
  'ep_single': 'EPs & Singles',
  'live': 'Live',
  'compilation': 'Compilations',
  'soundtrack': 'Soundtracks',
  'awardedRelease': 'Ausgezeichnet',
  'awardedReleases': 'Ausgezeichnet',
  'awarded_release': 'Ausgezeichnet',
  'other': 'Andere'
};

@Component({
  selector: 'app-artist',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="artist-page bg-bg-primary min-h-screen pb-28">
      @if (loading()) {
        <div class="flex justify-center items-center h-64">
          <div class="loading-spinner"></div>
        </div>
      } @else if (artist()) {
        <!-- Back Button Header -->
        <div class="artist-header p-4 pl-16">
          <button
            (click)="goBack()"
            class="btn-back inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <span>Zurück</span>
          </button>
        </div>

        <!-- Hero Section - Centered like Razor -->
        <div class="artist-hero flex flex-col items-center text-center px-5 py-8 mb-6 mx-4 rounded-xl"
             style="background: linear-gradient(180deg, rgba(29, 185, 84, 0.08) 0%, transparent 100%);">
          <!-- Portrait -->
          <div
            class="artist-portrait w-44 h-44 rounded-full overflow-hidden bg-bg-secondary shadow-2xl mb-5 flex-shrink-0"
            [class.cursor-pointer]="artistImage()"
            (click)="artistImage() && openImageLightbox()"
          >
            @if (artistImage()) {
              <img
                [src]="artistImage()"
                [alt]="artist()?.artist?.name"
                class="w-full h-full object-cover"
              />
            } @else {
              <div class="artist-portrait-placeholder w-full h-full flex items-center justify-center text-text-muted">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            }
          </div>

          <!-- Artist Info -->
          <div class="artist-hero-info flex flex-col items-center gap-2">
            @if (artist()?.artist?.category) {
              <span class="artist-category px-3 py-1 bg-accent-qobuz/15 text-accent-qobuz text-xs font-semibold rounded-full uppercase tracking-wider">
                {{ artist()?.artist?.category }}
              </span>
            }
            <h1 class="text-2xl font-bold m-0 leading-tight">
              {{ artist()?.artist?.name }}
            </h1>
          </div>
        </div>

        <!-- Biography Section -->
        @if (artist()?.artist?.biography) {
          <section class="artist-biography mx-4 mb-6 p-5 bg-bg-card border border-border-subtle rounded-xl">
            <div
              class="biography-content text-sm text-text-secondary leading-relaxed"
              [class.line-clamp-4]="!bioExpanded()"
              [innerHTML]="cleanBiography()"
            ></div>
            @if (bioNeedsExpand()) {
              <button
                class="btn-expand-bio mt-3 flex items-center gap-1 text-sm text-accent-qobuz hover:underline"
                (click)="bioExpanded.set(!bioExpanded())"
              >
                <span>{{ bioExpanded() ? 'Weniger anzeigen' : 'Mehr anzeigen' }}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-4 h-4 transition-transform duration-300"
                  [style.transform]="bioExpanded() ? 'rotate(180deg)' : ''"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/>
                </svg>
              </button>
            }
          </section>
        }

        <!-- Top Tracks Section -->
        @if (artist()?.topTracks?.length) {
          <section class="artist-section mx-4 mb-8">
            <h2 class="text-lg font-semibold mb-4 text-text-primary">Beliebte Titel</h2>
            <div class="artist-top-tracks space-y-1">
              @for (track of visibleTopTracks(); track track.id; let i = $index) {
                <div
                  class="track-row flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-card transition-colors cursor-pointer"
                  [class.bg-accent-qobuz/10]="isBackendTrackPlaying(track)"
                  (click)="playBackendTrack(track)"
                >
                  <span class="track-number w-6 text-sm text-text-muted text-right">{{ i + 1 }}</span>
                  @if (track.coverUrl) {
                    <img [src]="track.coverUrl" [alt]="track.albumTitle" class="w-10 h-10 rounded object-cover" />
                  } @else {
                    <div class="w-10 h-10 rounded bg-bg-secondary flex items-center justify-center text-text-muted">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  }
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-sm truncate" [class.text-accent-qobuz]="isBackendTrackPlaying(track)">{{ track.title }}</p>
                    <p class="text-xs text-text-muted truncate">{{ track.albumTitle }}</p>
                  </div>
                  @if (track.isHiRes) {
                    <span class="text-[10px] px-1.5 py-0.5 bg-accent-qobuz/20 text-accent-qobuz rounded font-medium">Hi-Res</span>
                  }
                  <span class="text-xs text-text-muted">{{ track.formattedDuration }}</span>
                </div>
              }
            </div>
            @if (hasMoreTopTracks()) {
              <button
                class="btn-expand-tracks mt-3 flex items-center gap-1 text-sm text-accent-qobuz hover:underline mx-auto"
                (click)="topTracksExpanded.set(!topTracksExpanded())"
              >
                <span>{{ topTracksExpanded() ? 'Weniger anzeigen' : 'Mehr anzeigen' }}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-4 h-4 transition-transform duration-300"
                  [style.transform]="topTracksExpanded() ? 'rotate(180deg)' : ''"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/>
                </svg>
              </button>
            }
          </section>
        }

        <!-- Discography Section -->
        @if (artist()?.releases?.length) {
          <section class="artist-section mx-4 mb-8">
            <h2 class="text-lg font-semibold mb-4 text-text-primary">Diskografie</h2>

            <!-- Sub-Navigation Tabs with "Alles" button -->
            <div class="discography-sub-nav flex gap-2 mb-4 pb-1 overflow-x-auto scrollbar-hide">
              @for (release of artist()!.releases; track release.type) {
                <button
                  class="sub-tab-btn flex-shrink-0 px-4 py-2 text-sm rounded-full border transition-colors whitespace-nowrap"
                  [class.bg-accent-qobuz]="currentReleaseType() === release.type"
                  [class.text-white]="currentReleaseType() === release.type"
                  [class.border-accent-qobuz]="currentReleaseType() === release.type"
                  [class.bg-transparent]="currentReleaseType() !== release.type"
                  [class.text-text-secondary]="currentReleaseType() !== release.type"
                  [class.border-border-accent]="currentReleaseType() !== release.type"
                  [class.hover:bg-bg-card]="currentReleaseType() !== release.type"
                  (click)="currentReleaseType.set(release.type!)"
                >
                  {{ getReleaseTypeLabel(release.type!) }}
                </button>
              }
              <!-- "Alles" Button -->
              <a
                [routerLink]="['/qobuz/artist', id, 'discography']"
                class="discography-all-btn ml-auto flex items-center gap-1 flex-shrink-0 px-4 py-2 text-sm rounded-full border border-border-accent text-text-secondary hover:bg-bg-card hover:text-text-primary transition-colors"
              >
                Alles
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </a>
            </div>

            <!-- Release Grid -->
            <div class="discography-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              @for (album of currentReleaseItems(); track album.id) {
                <a
                  [routerLink]="['/qobuz/album', album.id]"
                  class="release-card flex flex-col bg-bg-card border border-border-subtle rounded-lg overflow-hidden hover:border-border-accent hover:shadow-md transition-all cursor-pointer"
                >
                  @if (album.coverUrl) {
                    <img [src]="album.coverUrl" [alt]="album.title" class="aspect-square w-full object-cover" loading="lazy" />
                  } @else {
                    <div class="aspect-square w-full bg-bg-secondary flex items-center justify-center text-text-muted">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  }
                  <div class="p-3">
                    <p class="font-medium text-sm truncate">{{ album.title }}</p>
                    <p class="text-xs text-text-muted">{{ getYear(album.releasedAt) }}</p>
                  </div>
                </a>
              }
              @if (currentReleaseHasMore()) {
                <a
                  [routerLink]="['/qobuz/artist', id, 'discography']"
                  [queryParams]="{ type: currentReleaseType() }"
                  class="discography-more-card flex flex-col items-center justify-center aspect-square bg-bg-card border border-border-subtle rounded-lg hover:border-border-accent hover:bg-bg-card-hover transition-all cursor-pointer"
                >
                  <div class="more-card-content flex flex-col items-center gap-2 text-text-muted">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-accent-qobuz" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                    <span class="text-sm font-medium">Mehr</span>
                  </div>
                </a>
              }
            </div>
          </section>
        }

        <!-- Similar Artists Section -->
        @if (artist()?.similarArtists?.length) {
          <section class="artist-section mx-4 mb-8">
            <h2 class="text-lg font-semibold mb-4 text-text-primary">Ähnliche Künstler</h2>
            <div class="similar-artists-scroll flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
              @for (similar of artist()!.similarArtists; track similar.id) {
                <a
                  [routerLink]="['/qobuz/artist', similar.id]"
                  class="similar-artist-card flex flex-col items-center flex-shrink-0 w-28 p-3 bg-bg-card border border-border-subtle rounded-lg hover:border-border-accent hover:shadow-md transition-all cursor-pointer"
                >
                  <div class="similar-artist-avatar w-20 h-20 rounded-full overflow-hidden bg-bg-secondary mb-2 flex-shrink-0">
                    @if (similar.imageUrl) {
                      <img
                        [src]="similar.imageUrl"
                        [alt]="similar.name"
                        class="w-full h-full object-cover"
                        loading="lazy"
                      />
                    } @else {
                      <div class="similar-artist-placeholder w-full h-full flex items-center justify-center text-text-muted">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                      </div>
                    }
                  </div>
                  <span class="similar-artist-name text-xs font-semibold text-text-primary text-center truncate max-w-full">
                    {{ similar.name }}
                  </span>
                </a>
              }
            </div>
          </section>
        }

        <!-- Appears On Section -->
        @if (artist()?.appearsOn?.length) {
          <section class="artist-section mx-4 mb-8">
            <h2 class="text-lg font-semibold mb-4 text-text-primary">Tritt auf in</h2>
            <div class="appears-on-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              @for (track of artist()!.appearsOn!.slice(0, 10); track track.albumId) {
                <a
                  [routerLink]="['/qobuz/album', track.albumId]"
                  class="appears-on-card flex flex-col bg-bg-card border border-border-subtle rounded-lg overflow-hidden hover:border-border-accent hover:shadow-md transition-all cursor-pointer"
                >
                  @if (track.coverUrl) {
                    <img [src]="track.coverUrl" [alt]="track.albumTitle" class="aspect-square w-full object-cover" loading="lazy" />
                  } @else {
                    <div class="aspect-square w-full bg-bg-secondary flex items-center justify-center text-text-muted">
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  }
                  <div class="p-3">
                    <p class="font-medium text-sm truncate">{{ track.albumTitle }}</p>
                    <p class="text-xs text-text-muted truncate">{{ track.artistName }}</p>
                  </div>
                </a>
              }
            </div>
          </section>
        }
      } @else {
        <!-- Error state -->
        <div class="flex flex-col items-center justify-center h-64 text-text-muted">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p>Künstler konnte nicht geladen werden</p>
          <button
            routerLink="/qobuz/browse"
            class="mt-4 px-4 py-2 bg-accent-qobuz text-white rounded-lg hover:bg-accent-qobuz/90 transition-colors"
          >
            Zurück zum Browser
          </button>
        </div>
      }

      <!-- Image Lightbox -->
      @if (lightboxOpen()) {
        <div
          class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          (click)="lightboxOpen.set(false)"
        >
          <button
            class="absolute top-4 right-4 text-white/70 hover:text-white"
            (click)="lightboxOpen.set(false)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            [src]="artistImage()"
            [alt]="artist()?.artist?.name"
            class="max-w-full max-h-full object-contain rounded-lg"
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

    .line-clamp-4 {
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* Biography HTML content styling */
    .biography-content ::ng-deep p {
      margin-bottom: 0.75rem;
    }

    .biography-content ::ng-deep p:last-child {
      margin-bottom: 0;
    }

    .biography-content ::ng-deep a {
      color: var(--color-accent-qobuz);
      text-decoration: none;
    }

    .biography-content ::ng-deep a:hover {
      text-decoration: underline;
    }

    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }

    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }

    .scrollbar-thin {
      scrollbar-width: thin;
      scrollbar-color: var(--color-border-accent) transparent;
    }

    .scrollbar-thin::-webkit-scrollbar {
      height: 6px;
    }

    .scrollbar-thin::-webkit-scrollbar-track {
      background: transparent;
    }

    .scrollbar-thin::-webkit-scrollbar-thumb {
      background: var(--color-border-accent);
      border-radius: 3px;
    }

    .artist-portrait {
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }

    .artist-portrait.cursor-pointer {
      cursor: zoom-in;
      transition: transform 0.2s ease;
    }

    .artist-portrait.cursor-pointer:hover {
      transform: scale(1.02);
    }

    .similar-artist-card:hover {
      transform: translateY(-2px);
    }

    .discography-more-card:hover {
      transform: translateY(-2px);
    }

    /* Mobile adjustments */
    @media (max-width: 480px) {
      .artist-portrait {
        width: 140px !important;
        height: 140px !important;
      }

      .similar-artist-card {
        width: 100px;
        padding: 10px;
      }

      .similar-artist-avatar {
        width: 64px !important;
        height: 64px !important;
      }

      .similar-artist-name {
        font-size: 0.7rem;
      }
    }
  `]
})
export class ArtistComponent implements OnInit {
  @Input() id!: string;

  private readonly qobuzApi = inject(QobuzApiService);
  private readonly playerState = inject(PlayerStateService);
  private readonly playback = inject(PlaybackService);

  readonly loading = signal(true);
  readonly artist = signal<BackendArtistPageResponse | null>(null);
  readonly artistImage = signal<string | undefined>(undefined);

  // UI State
  readonly bioExpanded = signal(false);
  readonly topTracksExpanded = signal(false);
  readonly currentReleaseType = signal<string>('album');
  readonly lightboxOpen = signal(false);

  private readonly TOP_TRACKS_INITIAL = 5;

  // Computed properties
  readonly cleanBiography = computed(() => {
    const bio = this.artist()?.artist?.biography;
    if (!bio) return '';
    // Keep HTML formatting, just clean up whitespace
    return bio.trim();
  });

  readonly bioNeedsExpand = computed(() => {
    return (this.cleanBiography()?.length ?? 0) > 300;
  });

  readonly visibleTopTracks = computed((): BackendArtistTrack[] => {
    const tracks = this.artist()?.topTracks ?? [];
    if (this.topTracksExpanded()) {
      return tracks;
    }
    return tracks.slice(0, this.TOP_TRACKS_INITIAL);
  });

  readonly hasMoreTopTracks = computed(() => {
    return (this.artist()?.topTracks?.length ?? 0) > this.TOP_TRACKS_INITIAL;
  });

  readonly currentReleaseItems = computed((): BackendReleaseAlbum[] => {
    const releases = this.artist()?.releases ?? [];
    const current = releases.find(r => r.type === this.currentReleaseType());
    return current?.items ?? [];
  });

  readonly currentReleaseHasMore = computed(() => {
    const releases = this.artist()?.releases ?? [];
    const current = releases.find(r => r.type === this.currentReleaseType());
    return current?.hasMore ?? false;
  });

  formatDuration = formatDuration;

  ngOnInit(): void {
    if (this.id) {
      this.loadArtist();
    }
  }

  private loadArtist(): void {
    const artistId = parseInt(this.id, 10);
    this.qobuzApi.getArtistPage(artistId).subscribe({
      next: response => {
        this.artist.set(response);
        this.artistImage.set(response.artist?.portraitUrl);
        // Set initial release type
        if (response.releases?.length) {
          this.currentReleaseType.set(response.releases[0].type ?? 'album');
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  goBack(): void {
    window.history.back();
  }

  getReleaseTypeLabel(type: string): string {
    return RELEASE_TYPE_LABELS[type] ?? type;
  }

  getYear(timestamp?: number): string {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).getFullYear().toString();
  }

  isBackendTrackPlaying(track: BackendArtistTrack): boolean {
    const current = this.playerState.currentTrack();
    return current?.id === track.id && this.playerState.isPlaying();
  }

  playBackendTrack(track: BackendArtistTrack): void {
    // Convert backend track to QobuzTrack for playback
    const qobuzTrack: QobuzTrack = {
      id: track.id,
      title: track.title,
      duration: track.duration,
      track_number: 1,
      media_number: 1,
      performer: track.artistId ? { id: track.artistId, name: track.artistName } : undefined,
      album: track.albumId ? {
        id: track.albumId,
        title: track.albumTitle,
        image: { large: track.coverUrl, small: track.coverUrl },
        duration: 0,
        tracks_count: 0
      } : undefined,
      hires: track.isHiRes,
      hires_streamable: track.isHiRes,
      streamable: track.isStreamable
    };
    this.playback.playTrack(qobuzTrack);
  }

  openImageLightbox(): void {
    if (this.artistImage()) {
      this.lightboxOpen.set(true);
    }
  }
}
