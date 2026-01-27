import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { QobuzApiService } from '../../../../core/services/qobuz-api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ProfileService, Profile } from '../../../../core/services/profile.service';
import { PlaybackService } from '../../../../core/services/playback.service';
import { PlayerStateService } from '../../../../core/services/player-state.service';
import { AlbumRatingService } from '../../../../core/services/album-rating.service';
import { NavigationStateService } from '../../../../core/services/navigation-state.service';
import { QobuzBrowseStateService, TabType, FavoritesSubTab } from '../../../../core/services/qobuz-browse-state.service';
import { QobuzAlbum, QobuzPlaylist, QobuzTrack, QobuzFavoriteArtist } from '../../../../core/models';
import { firstValueFrom } from 'rxjs';
import {
  AlbumCardComponent,
  PlaylistCardComponent,
  TrackItemComponent,
  ArtistCardComponent,
  GenreFilterComponent,
  PlaylistTagsFilterComponent
} from '../../../../shared/components';
import { InfiniteScrollDirective } from '../../../../shared/directives';
import { ProfileSwitcherComponent } from '../../../../layout';

@Component({
  selector: 'app-qobuz-browse',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AlbumCardComponent,
    PlaylistCardComponent,
    TrackItemComponent,
    ArtistCardComponent,
    GenreFilterComponent,
    PlaylistTagsFilterComponent,
    InfiniteScrollDirective,
    ProfileSwitcherComponent
  ],
  template: `
    <div class="qobuz-browse" appInfiniteScroll [scrollDisabled]="!canLoadMore()" (scrolled)="loadMore()">
      <!-- Header -->
      <header class="browse-header">
        <div class="header-content">
          <div class="header-left">
            <!-- Hamburger Menu Button -->
            <button
              class="hamburger-btn"
              (click)="toggleMenu()"
              aria-label="Menü"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round"/>
              </svg>
            </button>
            <div class="brand">
              <svg class="brand-icon" viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="45" stroke="currentColor" stroke-width="4"/>
                <path d="M35 65V35L70 50L35 65Z" fill="currentColor"/>
              </svg>
              <h1>Qobuz</h1>
            </div>
          </div>
          <div class="header-actions">
            <a routerLink="/qobuz/search" class="search-btn" title="Suchen">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </a>
            @if (auth.isLoggedIn()) {
              <button
                class="profile-indicator cursor-pointer hover:ring-2 hover:ring-accent-qobuz/50 transition-all"
                [style.background-color]="profileService.activeProfile() ? profileService.getProfileColor(profileService.activeProfile()!.id) : 'var(--color-accent-qobuz)'"
                title="{{ auth.displayName() }} - Profil wechseln"
                (click)="openProfileSwitcher()"
              >
                <span class="profile-initial">{{ profileService.activeProfile() ? profileService.getProfileInitial(profileService.activeProfile()!.name) : auth.userInitial() }}</span>
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
      <main class="main-content">
        <!-- Primary Tabs -->
        <nav class="content-tabs">
          <button class="tab-btn" [class.active]="activeTab() === 'new-releases'" (click)="setTab('new-releases')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Neuheiten</span>
          </button>
          <button class="tab-btn" [class.active]="activeTab() === 'album-charts'" (click)="setTab('album-charts')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span>Album-Charts</span>
          </button>
          <button class="tab-btn" [class.active]="activeTab() === 'playlists'" (click)="setTab('playlists')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Qobuz Playlists</span>
          </button>
          <button class="tab-btn" [class.active]="activeTab() === 'favorites'" (click)="setTab('favorites')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span>Favoriten</span>
          </button>
        </nav>

        <!-- Playlist Filters (Tags + Genres) -->
        @if (activeTab() === 'playlists') {
          <div class="playlist-filters space-y-3 mb-4">
            <!-- Category Tags (Top-Playlists, Hi-Res, etc.) -->
            <app-playlist-tags-filter
              [initialTag]="browseState.selectedTag()"
              (tagChange)="onTagChange($event)"
            />

            <!-- Genre Filter (Pop/Rock, Jazz, etc.) - collapsible built into component -->
            <app-genre-filter
              [initialGenres]="browseState.selectedGenres()"
              (genreChange)="onGenreChange($event)"
            />
          </div>
        }

        <!-- Favorites Sub-Tabs -->
        @if (activeTab() === 'favorites') {
          <div class="favorites-sub-tabs mb-4">
            <button
              class="sub-tab"
              [class.active]="favoritesSubTab() === 'albums'"
              (click)="setFavoritesSubTab('albums')"
            >
              Alben
            </button>
            <button
              class="sub-tab"
              [class.active]="favoritesSubTab() === 'tracks'"
              (click)="setFavoritesSubTab('tracks')"
            >
              Tracks
            </button>
            <button
              class="sub-tab"
              [class.active]="favoritesSubTab() === 'artists'"
              (click)="setFavoritesSubTab('artists')"
            >
              Künstler
            </button>
          </div>
        }

        <!-- Loading Skeleton -->
        @if (loading() && !hasContent()) {
          <div class="content-grid">
            @for (i of [1,2,3,4,5,6,7,8]; track i) {
              <div class="skeleton-card">
                <div class="skeleton-cover"></div>
                <div class="skeleton-text"></div>
                <div class="skeleton-text short"></div>
              </div>
            }
          </div>
        }

        <!-- Albums Grid (New Releases, Charts, Favorite Albums) -->
        @if ((activeTab() === 'new-releases' || activeTab() === 'album-charts') ||
             (activeTab() === 'favorites' && favoritesSubTab() === 'albums')) {
          @if (albums().length > 0) {
            <div class="content-grid">
              @for (album of albums(); track album.id; let i = $index) {
                <app-album-card
                  [album]="album"
                  [showRank]="activeTab() === 'album-charts'"
                  [rank]="i + 1"
                  (play)="onPlayAlbum($event)"
                />
              }
            </div>
          } @else if (!loading()) {
            <div class="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <p>Keine Alben gefunden</p>
            </div>
          }
        }

        <!-- Playlists Grid -->
        @if (activeTab() === 'playlists') {
          @if (playlists().length > 0) {
            <div class="content-grid">
              @for (playlist of playlists(); track playlist.id) {
                <app-playlist-card
                  [playlist]="playlist"
                  [showOwner]="true"
                  (play)="onPlayPlaylist($event)"
                />
              }
            </div>
          } @else if (!loading()) {
            <div class="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <p>Keine Playlists gefunden</p>
            </div>
          }
        }

        <!-- Favorite Tracks -->
        @if (activeTab() === 'favorites' && favoritesSubTab() === 'tracks') {
          @if (tracks().length > 0) {
            <div class="tracks-list">
              @for (track of tracks(); track track.id; let i = $index) {
                <app-track-item
                  [track]="track"
                  [trackNumber]="i + 1"
                  [showAlbum]="true"
                  [showQuality]="true"
                  (play)="onPlayTrack($event)"
                />
              }
            </div>
          } @else if (!loading()) {
            <div class="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <p>Keine Favoriten-Tracks</p>
            </div>
          }
        }

        <!-- Favorite Artists -->
        @if (activeTab() === 'favorites' && favoritesSubTab() === 'artists') {
          @if (artists().length > 0) {
            <div class="artists-grid">
              @for (artist of artists(); track artist.id) {
                <app-artist-card [artist]="artist" />
              }
            </div>
          } @else if (!loading()) {
            <div class="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p>Keine Favoriten-Künstler</p>
            </div>
          }
        }

        <!-- Load More Indicator -->
        @if (loadingMore()) {
          <div class="loading-more">
            <div class="spinner"></div>
            <span>Lade mehr...</span>
          </div>
        }
      </main>
    </div>
  `,
  styles: [`
    .qobuz-browse {
      font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: var(--color-bg-primary);
      min-height: 100vh;
      color: var(--color-text-primary);
      overflow-x: hidden;
      width: 100%;
      max-width: 100vw;
    }

    .browse-header {
      background: var(--color-bg-secondary);
      border-bottom: 1px solid var(--color-border-subtle);
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
      padding: 0 max(16px, env(safe-area-inset-left));
      padding-top: env(safe-area-inset-top);
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 0;
      max-width: 1200px;
      margin: 0 auto;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .back-btn, .search-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: transparent;
      border: none;
      color: var(--color-text-secondary);
      cursor: pointer;
      border-radius: var(--radius-sm);
      transition: all 0.15s ease;
      text-decoration: none;
    }

    .back-btn:hover, .search-btn:hover {
      background: var(--color-bg-card);
      color: var(--color-text-primary);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .brand-icon {
      width: 28px;
      height: 28px;
      color: var(--color-accent-qobuz);
    }

    .brand h1 {
      font-size: 1.25rem;
      font-weight: 600;
      letter-spacing: -0.02em;
      margin: 0;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .profile-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: var(--color-accent-qobuz);
      border-radius: 50%;
      cursor: pointer;
    }

    .profile-initial {
      font-size: 0.9rem;
      font-weight: 600;
      color: white;
      text-transform: uppercase;
    }

    .hamburger-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      background: var(--color-bg-card);
      border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .hamburger-btn:hover {
      background: var(--color-bg-card-hover);
    }

    .hamburger-lines {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      width: 18px;
      height: 14px;
    }

    .hamburger-lines span {
      display: block;
      height: 2px;
      width: 100%;
      background: var(--color-text-primary);
      border-radius: 1px;
    }

    .main-content {
      padding: 20px max(16px, env(safe-area-inset-left));
      padding-top: calc(64px + env(safe-area-inset-top, 0) + 20px);
      padding-bottom: calc(120px + max(20px, env(safe-area-inset-bottom)));
      max-width: 1200px;
      margin: 0 auto;
      overflow-x: hidden;
    }

    .content-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--color-border-subtle);
      overflow-x: auto;
      scrollbar-width: none;
    }

    .content-tabs::-webkit-scrollbar {
      display: none;
    }

    .tab-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: transparent;
      border: 1px solid var(--color-border-accent);
      border-radius: var(--radius-md);
      color: var(--color-text-secondary);
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .tab-btn:hover {
      background: var(--color-bg-card);
      color: var(--color-text-primary);
    }

    .tab-btn.active {
      background: var(--color-accent-qobuz);
      border-color: var(--color-accent-qobuz);
      color: white;
    }

    .tab-btn svg {
      width: 18px;
      height: 18px;
    }

    .favorites-sub-tabs {
      display: flex;
      gap: 4px;
      padding: 4px;
      background: var(--color-bg-secondary);
      border-radius: var(--radius-md);
      width: fit-content;
    }

    .sub-tab {
      padding: 8px 16px;
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--color-text-secondary);
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .sub-tab:hover {
      color: var(--color-text-primary);
    }

    .sub-tab.active {
      background: var(--color-bg-card);
      color: var(--color-text-primary);
      box-shadow: var(--shadow-sm);
    }

    .content-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 16px;
      width: 100%;
    }

    .content-grid > * {
      min-width: 0;
    }

    .artists-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 16px;
      width: 100%;
    }

    .artists-grid > * {
      min-width: 0;
    }

    .tracks-list {
      display: flex;
      flex-direction: column;
    }

    .skeleton-card {
      background: var(--color-bg-card);
      border-radius: var(--radius-md);
      overflow: hidden;
    }

    .skeleton-cover {
      aspect-ratio: 1;
      background: var(--color-bg-secondary);
      animation: pulse 1.5s ease-in-out infinite;
    }

    .skeleton-text {
      height: 14px;
      background: var(--color-bg-secondary);
      border-radius: 4px;
      margin: 12px;
      animation: pulse 1.5s ease-in-out infinite;
    }

    .skeleton-text.short {
      width: 60%;
      height: 12px;
      margin-top: 8px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: var(--color-text-secondary);
    }

    .loading-more {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 32px;
      color: var(--color-text-muted);
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--color-border-accent);
      border-top-color: var(--color-accent-qobuz);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 640px) {
      .content-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .artists-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .main-content {
        padding-left: 12px;
        padding-right: 12px;
      }
    }

    @media (max-width: 380px) {
      .content-grid,
      .artists-grid {
        gap: 8px;
      }

      .main-content {
        padding-left: 10px;
        padding-right: 10px;
      }
    }
  `]
})
export class QobuzBrowseComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  readonly profileService = inject(ProfileService);
  readonly browseState = inject(QobuzBrowseStateService);
  private readonly router = inject(Router);
  private readonly qobuzApi = inject(QobuzApiService);
  private readonly playback = inject(PlaybackService);
  private readonly playerState = inject(PlayerStateService);
  private readonly ratingService = inject(AlbumRatingService);
  private readonly navState = inject(NavigationStateService);

  // Profile switcher
  readonly showProfileSwitcher = signal(false);

  // Tab state - now using browseState service
  readonly activeTab = this.browseState.activeTab;
  readonly favoritesSubTab = this.browseState.favoritesSubTab;

  // Loading state
  readonly loading = signal(true);
  readonly loadingMore = signal(false);

  // Data
  readonly albums = signal<QobuzAlbum[]>([]);
  readonly playlists = signal<QobuzPlaylist[]>([]);
  readonly tracks = signal<QobuzTrack[]>([]);
  readonly artists = signal<QobuzFavoriteArtist[]>([]);

  // Pagination
  private offset = 0;
  private readonly limit = 30;
  private total = 0;

  // Flag to restore scroll position only once on initial load
  private shouldRestoreScroll = true;

  // Scroll listener reference for cleanup
  private scrollListener?: () => void;

  // Computed
  readonly hasContent = computed(() => {
    return this.albums().length > 0 ||
           this.playlists().length > 0 ||
           this.tracks().length > 0 ||
           this.artists().length > 0;
  });

  readonly canLoadMore = computed(() => {
    if (this.loading()) return false;
    // loadingMore NICHT prüfen - sonst wird Scroll-Listener deaktiviert

    const currentCount = this.getCurrentCount();
    return currentCount > 0 && currentCount < this.total;
  });

  ngOnInit(): void {
    // Hide app header - this page has its own header
    this.navState.usePreset('hidden');

    // Check if user is logged in, redirect to login if not
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/qobuz/login']);
      return;
    }

    // Set up scroll listener to continuously save scroll position
    this.setupScrollListener();

    this.loadContent();
  }

  ngOnDestroy(): void {
    // Clean up scroll listener
    this.removeScrollListener();
  }

  /**
   * Set up scroll listener to save position on every scroll
   */
  private setupScrollListener(): void {
    const mainEl = document.querySelector('main');
    if (!mainEl) return;

    this.scrollListener = () => {
      const scrollPos = mainEl.scrollTop;
      if (scrollPos > 0) {
        this.browseState.saveScrollPosition(scrollPos);
      }
    };

    mainEl.addEventListener('scroll', this.scrollListener, { passive: true });
  }

  /**
   * Remove scroll listener
   */
  private removeScrollListener(): void {
    if (this.scrollListener) {
      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.removeEventListener('scroll', this.scrollListener);
      }
    }
  }

  /**
   * Restore scroll position after content is loaded
   * Only restores once on initial navigation, not on tab switches
   */
  private restoreScrollPosition(): void {
    if (!this.shouldRestoreScroll) return;

    const savedScrollPos = this.browseState.getScrollPosition();
    if (savedScrollPos > 0) {
      this.shouldRestoreScroll = false;
      this.tryRestoreScroll(savedScrollPos, 10);
    } else {
      this.shouldRestoreScroll = false;
    }
  }

  /**
   * Attempt to restore scroll position with retries
   * Waits for content to be tall enough to scroll
   */
  private tryRestoreScroll(targetPos: number, retriesLeft: number): void {
    const mainEl = document.querySelector('main');
    if (!mainEl) return;

    const maxScroll = mainEl.scrollHeight - mainEl.clientHeight;

    if (maxScroll >= targetPos) {
      mainEl.scrollTop = targetPos;
    } else if (retriesLeft > 0) {
      setTimeout(() => this.tryRestoreScroll(targetPos, retriesLeft - 1), 50);
    }
  }

  setTab(tab: TabType): void {
    if (this.activeTab() === tab) return;

    this.browseState.setTab(tab);
    this.browseState.resetScrollPosition(); // Reset scroll when changing tabs
    this.scrollToTop();
    this.resetPagination();
    this.loadContent();
  }

  setFavoritesSubTab(subTab: FavoritesSubTab): void {
    if (this.favoritesSubTab() === subTab) return;

    this.browseState.setFavoritesSubTab(subTab);
    this.browseState.resetScrollPosition(); // Reset scroll when changing sub-tabs
    this.scrollToTop();
    this.resetPagination();
    this.loadFavorites();
  }

  private scrollToTop(): void {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }

  onTagChange(tag: string): void {
    this.browseState.setTag(tag);
    this.resetPagination();
    this.loadPlaylists();
  }

  onGenreChange(genreIds: string[]): void {
    this.browseState.setGenres(genreIds);
    this.resetPagination();
    this.loadPlaylists();
  }

  loadMore(): void {
    // Guard gegen Doppel-Aufrufe hier statt in canLoadMore
    if (this.loadingMore()) return;
    if (!this.canLoadMore()) return;

    this.loadingMore.set(true);
    this.offset += this.limit;

    switch (this.activeTab()) {
      case 'new-releases':
        this.loadNewReleases(true);
        break;
      case 'album-charts':
        this.loadAlbumCharts(true);
        break;
      case 'playlists':
        this.loadPlaylists(true);
        break;
      case 'favorites':
        this.loadFavorites(true);
        break;
    }
  }

  async onPlayAlbum(album: QobuzAlbum): Promise<void> {
    if (!album.id) return;

    const mode = this.playerState.playerMode();
    const player = this.playerState.selectedPlayer();

    if (mode === 'bluesound' && player) {
      // Use native Bluesound album playback
      await this.playback.playAlbum(album, [], 0);
    } else {
      // Browser mode - load album tracks first
      try {
        const fullAlbum = await firstValueFrom(this.qobuzApi.getAlbum(album.id.toString()));
        if (fullAlbum?.tracks?.items) {
          await this.playback.playAlbum(album, fullAlbum.tracks.items, 0);
        }
      } catch (error) {
        console.error('Failed to load album tracks:', error);
      }
    }
  }

  async onPlayPlaylist(playlist: QobuzPlaylist): Promise<void> {
    const mode = this.playerState.playerMode();
    const player = this.playerState.selectedPlayer();

    if (mode === 'bluesound' && player) {
      // Use native Bluesound playlist playback
      await this.playback.playPlaylist(playlist, [], 0);
    } else {
      // Browser mode - load playlist tracks first
      try {
        const fullPlaylist = await firstValueFrom(this.qobuzApi.getPlaylist(playlist.id));
        if (fullPlaylist?.tracks?.items) {
          await this.playback.playPlaylist(playlist, fullPlaylist.tracks.items, 0);
        }
      } catch (error) {
        console.error('Failed to load playlist tracks:', error);
      }
    }
  }

  async onPlayTrack(track: QobuzTrack): Promise<void> {
    await this.playback.playTrack(track);
  }

  private resetPagination(): void {
    this.offset = 0;
    this.total = 0;
    this.albums.set([]);
    this.playlists.set([]);
    this.tracks.set([]);
    this.artists.set([]);
  }

  private getCurrentCount(): number {
    switch (this.activeTab()) {
      case 'new-releases':
      case 'album-charts':
        return this.albums().length;
      case 'playlists':
        return this.playlists().length;
      case 'favorites':
        switch (this.favoritesSubTab()) {
          case 'albums': return this.albums().length;
          case 'tracks': return this.tracks().length;
          case 'artists': return this.artists().length;
        }
    }
    return 0;
  }

  private loadContent(): void {
    this.loading.set(true);

    switch (this.activeTab()) {
      case 'new-releases':
        this.loadNewReleases();
        break;
      case 'album-charts':
        this.loadAlbumCharts();
        break;
      case 'playlists':
        this.loadPlaylists();
        break;
      case 'favorites':
        this.loadFavorites();
        break;
    }
  }

  private loadNewReleases(append = false): void {
    this.qobuzApi.getNewReleases(this.offset, this.limit).subscribe({
      next: container => {
        this.total = container.total ?? 0;
        const newAlbums = container.items ?? [];
        if (append) {
          this.albums.update(current => [...current, ...newAlbums]);
        } else {
          this.albums.set(newAlbums);
          // Restore scroll position after initial load
          this.restoreScrollPosition();
        }
        // Fetch ratings for loaded albums
        this.fetchRatingsForAlbums(newAlbums);
        this.loading.set(false);
        this.loadingMore.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    });
  }

  private loadAlbumCharts(append = false): void {
    this.qobuzApi.getAlbumCharts(this.offset, this.limit).subscribe({
      next: container => {
        this.total = container.total ?? 0;
        const newAlbums = container.items ?? [];
        if (append) {
          this.albums.update(current => [...current, ...newAlbums]);
        } else {
          this.albums.set(newAlbums);
          // Restore scroll position after initial load
          this.restoreScrollPosition();
        }
        // Fetch ratings for loaded albums
        this.fetchRatingsForAlbums(newAlbums);
        this.loading.set(false);
        this.loadingMore.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    });
  }

  private loadPlaylists(append = false): void {
    const tags = this.browseState.selectedTag() || undefined;
    const genres = this.browseState.selectedGenres();
    const genreIds = genres.length > 0 ? genres : undefined;

    this.qobuzApi.getFeaturedPlaylists(tags, genreIds, this.offset, this.limit).subscribe({
      next: container => {
        this.total = container.total ?? 0;
        if (append) {
          this.playlists.update(current => [...current, ...(container.items ?? [])]);
        } else {
          this.playlists.set(container.items ?? []);
          // Restore scroll position after initial load
          this.restoreScrollPosition();
        }
        this.loading.set(false);
        this.loadingMore.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    });
  }

  private loadFavorites(append = false): void {
    switch (this.favoritesSubTab()) {
      case 'albums':
        this.qobuzApi.getFavoriteAlbums(this.offset, this.limit).subscribe({
          next: container => {
            this.total = container.total ?? 0;
            const newAlbums = container.items ?? [];
            if (append) {
              this.albums.update(current => [...current, ...newAlbums]);
            } else {
              this.albums.set(newAlbums);
              // Restore scroll position after initial load
              this.restoreScrollPosition();
            }
            // Fetch ratings for loaded albums
            this.fetchRatingsForAlbums(newAlbums);
            this.loading.set(false);
            this.loadingMore.set(false);
          },
          error: () => {
            this.loading.set(false);
            this.loadingMore.set(false);
          }
        });
        break;

      case 'tracks':
        this.qobuzApi.getFavoriteTracks(this.offset, this.limit).subscribe({
          next: tracks => {
            // Note: tracks don't have container, so we estimate total
            this.total = tracks.length < this.limit ? this.offset + tracks.length : this.offset + this.limit + 1;
            if (append) {
              this.tracks.update(current => [...current, ...tracks]);
            } else {
              this.tracks.set(tracks);
              // Restore scroll position after initial load
              this.restoreScrollPosition();
            }
            this.loading.set(false);
            this.loadingMore.set(false);
          },
          error: () => {
            this.loading.set(false);
            this.loadingMore.set(false);
          }
        });
        break;

      case 'artists':
        this.qobuzApi.getFavoriteArtists(this.offset, this.limit).subscribe({
          next: response => {
            const artists = response.artists?.items ?? [];
            this.total = response.artists?.total ?? 0;
            if (append) {
              this.artists.update(current => [...current, ...artists]);
            } else {
              this.artists.set(artists);
              // Restore scroll position after initial load
              this.restoreScrollPosition();
            }
            this.loading.set(false);
            this.loadingMore.set(false);
          },
          error: () => {
            this.loading.set(false);
            this.loadingMore.set(false);
          }
        });
        break;
    }
  }

  // Profile switcher methods
  openProfileSwitcher(): void {
    this.showProfileSwitcher.set(true);
  }

  closeProfileSwitcher(): void {
    this.showProfileSwitcher.set(false);
  }

  onProfileSelected(profile: Profile): void {
    // Check if new profile has Qobuz credentials
    if (profile.qobuz?.authToken) {
      this.auth.loadFromProfileCredentials(profile.qobuz);
      // Reload content for new profile
      this.loadContent();
    } else {
      // No Qobuz credentials, redirect to login
      this.auth.logout();
      this.router.navigate(['/qobuz/login']);
    }
  }

  // Hamburger menu
  toggleMenu(): void {
    this.navState.toggleHamburger();
  }

  /**
   * Fetch ratings for a list of albums
   */
  private fetchRatingsForAlbums(albums: QobuzAlbum[]): void {
    if (!albums || albums.length === 0) return;

    const ratingRequests = albums
      .filter(album => album.id && album.title)
      .map(album => ({
        albumId: album.id!.toString(),
        artist: album.artist?.name ?? '',
        title: album.title!
      }));

    if (ratingRequests.length > 0) {
      this.ratingService.fetchRatings(ratingRequests);
    }
  }
}
