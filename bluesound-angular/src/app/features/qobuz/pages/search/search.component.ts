import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, Subject, switchMap, tap, takeUntil, catchError } from 'rxjs';
import { of } from 'rxjs';
import { QobuzApiService } from '../../../../core/services/qobuz-api.service';
import { PlayerStateService } from '../../../../core/services/player-state.service';
import { ContextMenuService } from '../../../../shared/services/context-menu.service';
import {
  QobuzSearchResult,
  QobuzAlbum,
  QobuzTrack,
  QobuzPlaylist,
  QobuzFavoriteArtist,
  formatDuration,
  getFavoriteArtistImageUrl
} from '../../../../core/models';
import {
  AlbumCardComponent,
  TrackItemComponent,
  PlaylistCardComponent,
  ArtistCardComponent
} from '../../../../shared/components';

/**
 * Search result tabs
 */
type SearchTab = 'all' | 'albums' | 'artists' | 'tracks' | 'playlists';

interface TabConfig {
  value: SearchTab;
  label: string;
}

const TABS: TabConfig[] = [
  { value: 'all', label: 'Alle' },
  { value: 'albums', label: 'Alben' },
  { value: 'artists', label: 'Künstler' },
  { value: 'tracks', label: 'Titel' },
  { value: 'playlists', label: 'Playlists' }
];

const RECENT_SEARCHES_KEY = 'qobuz_recent_searches';
const MAX_RECENT_SEARCHES = 8;

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AlbumCardComponent,
    TrackItemComponent,
    PlaylistCardComponent,
    ArtistCardComponent
  ],
  template: `
    <div class="search-page bg-bg-primary min-h-screen pb-28">
      <!-- Header -->
      <div class="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur-sm border-b border-border-subtle">
        <div class="p-4 pl-16">
          <!-- Search Input with Close Button -->
          <div class="flex items-center gap-3 mb-4">
            <button
              (click)="goBack()"
              class="flex-shrink-0 w-8 h-8 rounded-full bg-bg-card border border-border-subtle flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition-colors"
              title="Suche schließen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div class="flex-1 relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                #searchInput
                type="text"
                [(ngModel)]="query"
                (ngModelChange)="onSearch($event)"
                (keydown.escape)="clearSearch()"
                placeholder="Künstler, Alben, Titel..."
                class="w-full py-2.5 pl-10 pr-10 bg-bg-card border border-border-subtle rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-qobuz transition-colors"
              />
              @if (query) {
                <button
                  (click)="clearSearch()"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              }
            </div>
          </div>

          <!-- Tabs (only show when we have results) -->
          @if (hasResults()) {
            <div class="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
              @for (tab of tabs; track tab.value) {
                <button
                  class="flex-shrink-0 px-4 py-2 text-sm rounded-full border transition-colors whitespace-nowrap"
                  [class.bg-accent-qobuz]="currentTab() === tab.value"
                  [class.text-white]="currentTab() === tab.value"
                  [class.border-accent-qobuz]="currentTab() === tab.value"
                  [class.bg-transparent]="currentTab() !== tab.value"
                  [class.text-text-secondary]="currentTab() !== tab.value"
                  [class.border-border-subtle]="currentTab() !== tab.value"
                  [class.hover:border-border-accent]="currentTab() !== tab.value"
                  (click)="currentTab.set(tab.value)"
                >
                  {{ tab.label }}
                  @if (getTabCount(tab.value) > 0) {
                    <span class="ml-1 opacity-70">({{ getTabCount(tab.value) }})</span>
                  }
                </button>
              }
            </div>
          }
        </div>
      </div>

      <!-- Content -->
      <div class="p-4">
        <!-- Initial State / Recent Searches -->
        @if (!query && !loading()) {
          @if (recentSearches().length > 0) {
            <section class="mb-8">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-lg font-semibold">Letzte Suchen</h2>
                <button
                  class="text-sm text-text-muted hover:text-accent-qobuz transition-colors"
                  (click)="clearRecentSearches()"
                >
                  Löschen
                </button>
              </div>
              <div class="flex flex-wrap gap-2">
                @for (search of recentSearches(); track search) {
                  <button
                    class="px-4 py-2 bg-bg-card border border-border-subtle rounded-full text-sm hover:border-accent-qobuz transition-colors flex items-center gap-2"
                    (click)="searchFor(search)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {{ search }}
                  </button>
                }
              </div>
            </section>
          }

          <!-- Search Tips -->
          <div class="text-center py-12 text-text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p class="text-lg mb-2">Suche nach Musik</p>
            <p class="text-sm">Finde Künstler, Alben, Titel und Playlists</p>
          </div>
        }

        <!-- Loading State -->
        @if (loading()) {
          <div class="space-y-6">
            <!-- Albums Skeleton -->
            <section>
              <div class="h-6 w-20 bg-bg-secondary rounded animate-pulse mb-4"></div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                @for (i of [1,2,3,4]; track i) {
                  <div class="bg-bg-card rounded-lg overflow-hidden">
                    <div class="aspect-square bg-bg-secondary animate-pulse"></div>
                    <div class="p-3">
                      <div class="h-4 bg-bg-secondary rounded animate-pulse mb-2"></div>
                      <div class="h-3 bg-bg-secondary rounded animate-pulse w-2/3"></div>
                    </div>
                  </div>
                }
              </div>
            </section>
            <!-- Tracks Skeleton -->
            <section>
              <div class="h-6 w-16 bg-bg-secondary rounded animate-pulse mb-4"></div>
              <div class="space-y-2">
                @for (i of [1,2,3]; track i) {
                  <div class="flex items-center gap-3 p-3">
                    <div class="w-10 h-10 bg-bg-secondary rounded animate-pulse"></div>
                    <div class="flex-1">
                      <div class="h-4 bg-bg-secondary rounded animate-pulse mb-2 w-3/4"></div>
                      <div class="h-3 bg-bg-secondary rounded animate-pulse w-1/2"></div>
                    </div>
                  </div>
                }
              </div>
            </section>
          </div>
        }

        <!-- No Results -->
        @if (query && !loading() && !hasResults()) {
          <div class="text-center py-16 text-text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-lg mb-2">Keine Ergebnisse</p>
            <p class="text-sm">Keine Ergebnisse für "{{ query }}"</p>
          </div>
        }

        <!-- Results -->
        @if (!loading() && hasResults()) {
          <!-- All Tab -->
          @if (currentTab() === 'all') {
            <!-- Albums -->
            @if (results()!.albums.length > 0) {
              <section class="mb-8">
                <div class="flex items-center justify-between mb-4">
                  <h2 class="text-lg font-semibold">Alben</h2>
                  @if (results()!.albums.length > 4) {
                    <button
                      class="text-sm text-accent-qobuz hover:underline"
                      (click)="currentTab.set('albums')"
                    >
                      Alle anzeigen
                    </button>
                  }
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                  @for (album of results()!.albums.slice(0, 4); track album.id) {
                    <app-album-card
                      [album]="album"
                      (play)="playAlbum(album)"
                    />
                  }
                </div>
              </section>
            }

            <!-- Artists -->
            @if (results()!.artists.length > 0) {
              <section class="mb-8">
                <div class="flex items-center justify-between mb-4">
                  <h2 class="text-lg font-semibold">Künstler</h2>
                  @if (results()!.artists.length > 4) {
                    <button
                      class="text-sm text-accent-qobuz hover:underline"
                      (click)="currentTab.set('artists')"
                    >
                      Alle anzeigen
                    </button>
                  }
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                  @for (artist of results()!.artists.slice(0, 4); track artist.id) {
                    <app-artist-card [artist]="artist" />
                  }
                </div>
              </section>
            }

            <!-- Tracks -->
            @if (results()!.tracks.length > 0) {
              <section class="mb-8">
                <div class="flex items-center justify-between mb-4">
                  <h2 class="text-lg font-semibold">Titel</h2>
                  @if (results()!.tracks.length > 5) {
                    <button
                      class="text-sm text-accent-qobuz hover:underline"
                      (click)="currentTab.set('tracks')"
                    >
                      Alle anzeigen
                    </button>
                  }
                </div>
                <div class="space-y-1">
                  @for (track of results()!.tracks.slice(0, 5); track track.id; let i = $index) {
                    <app-track-item
                      [track]="track"
                      [trackNumber]="i + 1"
                      [showNumber]="false"
                      [showArt]="true"
                      [showArtist]="true"
                      [showAlbum]="true"
                      [showQuality]="isTrackHiRes(track)"
                      [showMenu]="true"
                      [isPlaying]="isTrackPlaying(track)"
                      (play)="playTrack(track)"
                      (menu)="openTrackMenu($event)"
                    />
                  }
                </div>
              </section>
            }

            <!-- Playlists -->
            @if (results()!.playlists.length > 0) {
              <section class="mb-8">
                <div class="flex items-center justify-between mb-4">
                  <h2 class="text-lg font-semibold">Playlists</h2>
                  @if (results()!.playlists.length > 4) {
                    <button
                      class="text-sm text-accent-qobuz hover:underline"
                      (click)="currentTab.set('playlists')"
                    >
                      Alle anzeigen
                    </button>
                  }
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                  @for (playlist of results()!.playlists.slice(0, 4); track playlist.id) {
                    <app-playlist-card
                      [playlist]="playlist"
                      (play)="playPlaylist(playlist)"
                    />
                  }
                </div>
              </section>
            }
          }

          <!-- Albums Tab -->
          @if (currentTab() === 'albums') {
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              @for (album of results()!.albums; track album.id) {
                <app-album-card
                  [album]="album"
                  [showYear]="true"
                  (play)="playAlbum(album)"
                />
              }
            </div>
            @if (results()!.albums.length === 0) {
              <div class="text-center py-8 text-text-muted">Keine Alben gefunden</div>
            }
          }

          <!-- Artists Tab -->
          @if (currentTab() === 'artists') {
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              @for (artist of results()!.artists; track artist.id) {
                <app-artist-card [artist]="artist" />
              }
            </div>
            @if (results()!.artists.length === 0) {
              <div class="text-center py-8 text-text-muted">Keine Künstler gefunden</div>
            }
          }

          <!-- Tracks Tab -->
          @if (currentTab() === 'tracks') {
            <div class="space-y-1">
              @for (track of results()!.tracks; track track.id; let i = $index) {
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
                  (play)="playTrack(track)"
                  (menu)="openTrackMenu($event)"
                />
              }
            </div>
            @if (results()!.tracks.length === 0) {
              <div class="text-center py-8 text-text-muted">Keine Titel gefunden</div>
            }
          }

          <!-- Playlists Tab -->
          @if (currentTab() === 'playlists') {
            <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              @for (playlist of results()!.playlists; track playlist.id) {
                <app-playlist-card
                  [playlist]="playlist"
                  [showOwner]="true"
                  (play)="playPlaylist(playlist)"
                />
              }
            </div>
            @if (results()!.playlists.length === 0) {
              <div class="text-center py-8 text-text-muted">Keine Playlists gefunden</div>
            }
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }

    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
  `]
})
export class SearchComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('searchInput') searchInputEl?: ElementRef<HTMLInputElement>;

  private readonly qobuzApi = inject(QobuzApiService);
  private readonly playerState = inject(PlayerStateService);
  private readonly contextMenu = inject(ContextMenuService);

  private readonly searchSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  query = '';
  readonly loading = signal(false);
  readonly results = signal<QobuzSearchResult | null>(null);
  readonly currentTab = signal<SearchTab>('all');
  readonly recentSearches = signal<string[]>([]);

  readonly tabs = TABS;

  // Computed
  readonly hasResults = computed(() => {
    const r = this.results();
    if (!r) return false;
    return r.albums.length > 0 || r.artists.length > 0 ||
           r.tracks.length > 0 || r.playlists.length > 0;
  });

  ngOnInit(): void {
    // Load recent searches from localStorage
    this.loadRecentSearches();

    // Setup search debounce
    this.searchSubject.pipe(
      takeUntil(this.destroy$),
      debounceTime(300),
      distinctUntilChanged(),
      tap(query => {
        if (query.trim()) {
          this.loading.set(true);
          this.addToRecentSearches(query);
        }
      }),
      switchMap(query => {
        if (!query.trim()) {
          return of(null);
        }
        return this.qobuzApi.search(query, 20).pipe(
          catchError(() => of({ albums: [], artists: [], tracks: [], playlists: [] }))
        );
      })
    ).subscribe(results => {
      this.results.set(results);
      this.loading.set(false);
      // Reset to All tab when new results come in
      if (results) {
        this.currentTab.set('all');
      }
    });
  }

  ngAfterViewInit(): void {
    // Auto-focus the search input
    setTimeout(() => {
      this.searchInputEl?.nativeElement.focus();
    }, 100);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(query: string): void {
    if (query.trim()) {
      this.searchSubject.next(query);
    } else {
      this.results.set(null);
      this.loading.set(false);
    }
  }

  searchFor(query: string): void {
    this.query = query;
    this.searchSubject.next(query);
  }

  clearSearch(): void {
    this.query = '';
    this.results.set(null);
    this.loading.set(false);
    this.searchInputEl?.nativeElement.focus();
  }

  goBack(): void {
    window.history.back();
  }

  getTabCount(tab: SearchTab): number {
    const r = this.results();
    if (!r) return 0;

    switch (tab) {
      case 'all': return 0; // Don't show count for All tab
      case 'albums': return r.albums.length;
      case 'artists': return r.artists.length;
      case 'tracks': return r.tracks.length;
      case 'playlists': return r.playlists.length;
    }
  }

  // Recent searches management
  private loadRecentSearches(): void {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        this.recentSearches.set(JSON.parse(stored));
      }
    } catch {
      // Ignore errors
    }
  }

  private addToRecentSearches(query: string): void {
    const trimmed = query.trim();
    if (!trimmed) return;

    const current = this.recentSearches();
    const filtered = current.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
    const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);

    this.recentSearches.set(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // Ignore errors
    }
  }

  clearRecentSearches(): void {
    this.recentSearches.set([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Ignore errors
    }
  }

  // Playback
  isTrackHiRes(track: QobuzTrack): boolean {
    return track.hires_streamable || track.hires ||
      (track.maximum_bit_depth !== undefined && track.maximum_bit_depth > 16);
  }

  isTrackPlaying(track: QobuzTrack): boolean {
    const current = this.playerState.currentTrack();
    return current?.id === track.id && this.playerState.isPlaying();
  }

  playTrack(track: QobuzTrack): void {
    this.playerState.currentTrack.set(track);
    console.log('Playing track:', track.title);
  }

  playAlbum(album: QobuzAlbum): void {
    console.log('Playing album:', album.title);
  }

  playPlaylist(playlist: QobuzPlaylist): void {
    console.log('Playing playlist:', playlist.name);
  }

  openTrackMenu(event: { track: QobuzTrack; event: MouseEvent }): void {
    this.contextMenu.openTrackMenu(event.event, event.track, {
      onPlay: () => this.playTrack(event.track),
      onAddToQueue: () => console.log('Add to queue:', event.track.title)
    });
  }

  formatDuration = formatDuration;
}
