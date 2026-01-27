import { Injectable, signal } from '@angular/core';

export type TabType = 'new-releases' | 'album-charts' | 'playlists' | 'favorites';
export type FavoritesSubTab = 'albums' | 'tracks' | 'artists';

/**
 * Service to persist Qobuz browse state across navigation
 * This allows users to return to the same tab/filter state after viewing details
 */
@Injectable({ providedIn: 'root' })
export class QobuzBrowseStateService {
  // Tab state
  readonly activeTab = signal<TabType>('new-releases');
  readonly favoritesSubTab = signal<FavoritesSubTab>('albums');

  // Playlist filters
  readonly selectedTag = signal<string>('');
  readonly selectedGenres = signal<string[]>([]);

  // Scroll position (optional, for better UX)
  private scrollPosition = 0;

  /**
   * Save current scroll position
   */
  saveScrollPosition(position: number): void {
    this.scrollPosition = position;
  }

  /**
   * Get saved scroll position
   */
  getScrollPosition(): number {
    return this.scrollPosition;
  }

  /**
   * Reset scroll position
   */
  resetScrollPosition(): void {
    this.scrollPosition = 0;
  }

  /**
   * Set tab and optionally reset filters when changing tabs
   */
  setTab(tab: TabType, resetFilters = false): void {
    this.activeTab.set(tab);
    if (resetFilters) {
      this.selectedTag.set('');
      this.selectedGenres.set([]);
    }
  }

  /**
   * Set favorites sub-tab
   */
  setFavoritesSubTab(subTab: FavoritesSubTab): void {
    this.favoritesSubTab.set(subTab);
  }

  /**
   * Set selected tag for playlist filter
   */
  setTag(tag: string): void {
    this.selectedTag.set(tag);
  }

  /**
   * Set selected genres for playlist filter
   */
  setGenres(genres: string[]): void {
    this.selectedGenres.set(genres);
  }

  /**
   * Reset all state to defaults
   */
  reset(): void {
    this.activeTab.set('new-releases');
    this.favoritesSubTab.set('albums');
    this.selectedTag.set('');
    this.selectedGenres.set([]);
    this.scrollPosition = 0;
  }
}
