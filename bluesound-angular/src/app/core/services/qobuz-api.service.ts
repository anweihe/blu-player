import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { AuthService } from './auth.service';
import {
  QobuzAlbum,
  QobuzAlbumWithTracks,
  QobuzAlbumsContainer,
  QobuzArtistPageResponse,
  QobuzFavoriteAlbumsResponse,
  QobuzFavoriteArtistsResponse,
  QobuzFavoriteTracksResponse,
  QobuzFeaturedAlbumsResponse,
  QobuzFeaturedPlaylistsResponse,
  QobuzPlaylist,
  QobuzPlaylistWithTracks,
  QobuzPlaylistsContainer,
  QobuzSearchResponse,
  QobuzTrack,
  BackendArtistPageResponse,
  BackendDiscographyResponse
} from '../models';

/**
 * Tab types for browse navigation
 */
export type BrowseTab =
  | 'new-releases'
  | 'album-charts'
  | 'playlists'
  | 'favorites'
  | 'recommendations';

/**
 * Favorites sub-tabs
 */
export type FavoritesSubTab = 'albums' | 'tracks' | 'artists';

/**
 * Qobuz API Service
 * Handles all API calls to the Qobuz backend through the .NET REST API
 */
@Injectable({ providedIn: 'root' })
export class QobuzApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly apiBaseUrl = '/api/qobuz'; // REST API Controller

  // ==================== Albums ====================

  /**
   * Get new releases
   */
  getNewReleases(offset = 0, limit = 50): Observable<QobuzAlbumsContainer> {
    return this.http.get<QobuzFeaturedAlbumsResponse>(
      `${this.apiBaseUrl}/new-releases`,
      {
        params: { offset: offset.toString(), limit: limit.toString() },
        headers: this.auth.getAuthHeaders()
      }
    ).pipe(
      map(response => response?.albums ?? { items: [], total: 0, offset: 0, limit }),
      catchError(error => {
        console.error('Failed to load new releases:', error);
        return of({ items: [], total: 0, offset: 0, limit });
      })
    );
  }

  /**
   * Get album charts
   */
  getAlbumCharts(offset = 0, limit = 50): Observable<QobuzAlbumsContainer> {
    return this.http.get<QobuzFeaturedAlbumsResponse>(
      `${this.apiBaseUrl}/album-charts`,
      {
        params: { offset: offset.toString(), limit: limit.toString() },
        headers: this.auth.getAuthHeaders()
      }
    ).pipe(
      map(response => response?.albums ?? { items: [], total: 0, offset: 0, limit }),
      catchError(error => {
        console.error('Failed to load album charts:', error);
        return of({ items: [], total: 0, offset: 0, limit });
      })
    );
  }

  /**
   * Get album details with tracks
   */
  getAlbum(albumId: string): Observable<QobuzAlbumWithTracks> {
    return this.http.get<QobuzAlbumWithTracks>(
      `${this.apiBaseUrl}/album/${encodeURIComponent(albumId)}`,
      {
        headers: this.auth.getAuthHeaders()
      }
    );
  }

  // ==================== Playlists ====================

  /**
   * Get featured/editorial playlists with optional tag and genre filtering
   * @param tags - Category tag like 'popular', 'new', 'hi-res', 'focus', 'mood', etc.
   * @param genreIds - Genre IDs for filtering
   */
  getFeaturedPlaylists(tags?: string, genreIds?: string[], offset = 0, limit = 50): Observable<QobuzPlaylistsContainer> {
    let params = new HttpParams()
      .set('offset', offset.toString())
      .set('limit', limit.toString());

    if (tags) {
      params = params.set('tags', tags);
    }

    if (genreIds?.length) {
      params = params.set('genreIds', genreIds.join(','));
    }

    return this.http.get<QobuzFeaturedPlaylistsResponse>(
      `${this.apiBaseUrl}/featured-playlists`,
      { params, headers: this.auth.getAuthHeaders() }
    ).pipe(
      map(response => response.playlists ?? { items: [], total: 0, offset: 0, limit })
    );
  }

  /**
   * Get user playlists
   */
  getUserPlaylists(offset = 0, limit = 50): Observable<QobuzPlaylistsContainer> {
    return this.http.get<{ playlists: QobuzPlaylistsContainer }>(
      `${this.apiBaseUrl}/user-playlists`,
      {
        params: { offset: offset.toString(), limit: limit.toString() },
        headers: this.auth.getAuthHeaders()
      }
    ).pipe(
      map(response => response.playlists ?? { items: [], total: 0, offset: 0, limit })
    );
  }

  /**
   * Get playlist details with tracks
   */
  getPlaylist(playlistId: number): Observable<QobuzPlaylistWithTracks> {
    return this.http.get<QobuzPlaylistWithTracks>(
      `${this.apiBaseUrl}/playlist/${playlistId}`,
      {
        headers: this.auth.getAuthHeaders()
      }
    );
  }

  // ==================== Artists ====================

  /**
   * Get artist page (bio, top tracks, discography)
   * Returns flattened structure from backend
   */
  getArtistPage(artistId: number): Observable<BackendArtistPageResponse> {
    return this.http.get<BackendArtistPageResponse>(
      `${this.apiBaseUrl}/artist/${artistId}`,
      {
        headers: this.auth.getAuthHeaders()
      }
    );
  }

  /**
   * Get artist discography
   * Maps backend response to QobuzAlbumsContainer
   */
  getArtistDiscography(
    artistId: number,
    releaseType: string = 'all',
    offset = 0,
    limit = 50,
    sort = 'release_date'
  ): Observable<QobuzAlbumsContainer> {
    return this.http.get<BackendDiscographyResponse>(
      `${this.apiBaseUrl}/artist/${artistId}/discography`,
      {
        params: {
          releaseType,
          offset: offset.toString(),
          limit: limit.toString(),
          sort
        },
        headers: this.auth.getAuthHeaders()
      }
    ).pipe(
      map(response => ({
        items: response.albums?.map(a => ({
          id: a.id,
          title: a.title,
          artist: { id: 0, name: a.artistName },
          image: { large: a.coverUrl, small: a.coverUrl },
          duration: 0,
          tracks_count: a.tracksCount ?? 0,
          released_at: a.releasedAt,
          release_type: a.typeLabel
        } as QobuzAlbum)) ?? [],
        total: response.albums?.length ?? 0,
        offset: response.offset,
        limit,
        hasMore: response.hasMore
      } as QobuzAlbumsContainer & { hasMore: boolean }))
    );
  }

  // ==================== Favorites ====================

  /**
   * Get favorite albums
   */
  getFavoriteAlbums(offset = 0, limit = 50): Observable<QobuzAlbumsContainer> {
    return this.http.get<QobuzFavoriteAlbumsResponse>(
      `${this.apiBaseUrl}/favorites/albums`,
      {
        params: { offset: offset.toString(), limit: limit.toString() },
        headers: this.auth.getAuthHeaders()
      }
    ).pipe(
      map(response => response.albums ?? { items: [], total: 0, offset: 0, limit })
    );
  }

  /**
   * Get favorite tracks
   */
  getFavoriteTracks(offset = 0, limit = 50): Observable<QobuzTrack[]> {
    return this.http.get<QobuzFavoriteTracksResponse>(
      `${this.apiBaseUrl}/favorites/tracks`,
      {
        params: { offset: offset.toString(), limit: limit.toString() },
        headers: this.auth.getAuthHeaders()
      }
    ).pipe(
      map(response => response.tracks?.items ?? [])
    );
  }

  /**
   * Get favorite artists
   */
  getFavoriteArtists(offset = 0, limit = 50): Observable<QobuzFavoriteArtistsResponse> {
    return this.http.get<QobuzFavoriteArtistsResponse>(
      `${this.apiBaseUrl}/favorites/artists`,
      {
        params: { offset: offset.toString(), limit: limit.toString() },
        headers: this.auth.getAuthHeaders()
      }
    );
  }

  // ==================== Search ====================

  /**
   * Search for albums, tracks, artists, and playlists
   */
  search(query: string, limit = 20, offset = 0): Observable<QobuzSearchResponse> {
    return this.http.get<QobuzSearchResponse>(
      `${this.apiBaseUrl}/search`,
      {
        params: {
          query,
          limit: limit.toString(),
          offset: offset.toString()
        },
        headers: this.auth.getAuthHeaders()
      }
    );
  }

  // ==================== Playback ====================

  /**
   * Get stream URL for a track
   */
  getTrackStreamUrl(trackId: number, formatId = 27): Observable<string> {
    return this.http.get<{ url: string }>(
      `${this.apiBaseUrl}/track-stream-url`,
      {
        params: {
          trackId: trackId.toString(),
          formatId: formatId.toString()
        },
        headers: this.auth.getAuthHeaders()
      }
    ).pipe(
      map(response => response.url)
    );
  }

  // ==================== Album Info ====================

  /**
   * Get AI-generated album info
   */
  getAlbumInfo(albumId: string, albumTitle: string, artistName: string): Observable<{ style: string; summary: string }> {
    return this.http.get<{ success: boolean; style?: string; summary?: string; error?: string }>(
      `${this.apiBaseUrl}/album-info`,
      {
        params: { albumId, albumTitle, artistName },
        headers: this.auth.getAuthHeaders()
      }
    ).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.error || 'Album-Info nicht verfügbar');
        }
        return { style: response.style || '', summary: response.summary || '' };
      })
    );
  }

  // ==================== Genres ====================

  /**
   * Get available genres for filtering
   */
  getGenres(): Observable<{ id: number; name: string }[]> {
    return this.http.get<{ genres: { id: number; name: string }[] }>(
      `${this.apiBaseUrl}/genres`,
      { headers: this.auth.getAuthHeaders() }
    ).pipe(
      map(response => response.genres ?? [])
    );
  }
}
