import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import {
  ListeningHistoryResponse,
  HistorySection,
  HistoryDisplayItem,
  TuneInHistoryItem,
  RadioParadiseHistoryItem,
  QobuzAlbumHistoryItem,
  QobuzPlaylistHistoryItem
} from '../models/history.models';
import { AuthService } from './auth.service';

/**
 * Service for managing listening history
 */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /**
   * Get all listening history for the active profile
   */
  getHistory(): Observable<HistorySection[]> {
    const profileId = this.auth.getProfileId();

    if (!profileId) {
      return of([]);
    }

    return this.http.get<ListeningHistoryResponse>(
      `/Qobuz?handler=History&profileId=${encodeURIComponent(profileId)}`
    ).pipe(
      map(response => this.transformToSections(response)),
      catchError(() => of([]))
    );
  }

  /**
   * Transform API response to display sections
   */
  private transformToSections(response: ListeningHistoryResponse): HistorySection[] {
    const sections: HistorySection[] = [];

    // Qobuz Playlists
    if (response.qobuzPlaylists?.length > 0) {
      sections.push({
        title: 'Zuletzt gehört - Playlists',
        iconType: 'qobuz',
        items: response.qobuzPlaylists.map(item => this.transformPlaylist(item))
      });
    }

    // Qobuz Albums
    if (response.qobuzAlbums?.length > 0) {
      sections.push({
        title: 'Zuletzt gehört - Alben',
        iconType: 'qobuz',
        items: response.qobuzAlbums.map(item => this.transformAlbum(item))
      });
    }

    // TuneIn Radio
    if (response.tuneIn?.length > 0) {
      sections.push({
        title: 'Zuletzt gehört - Radio',
        iconType: 'tunein',
        items: response.tuneIn.map(item => this.transformTuneIn(item))
      });
    }

    // Radio Paradise
    if (response.radioParadise?.length > 0) {
      sections.push({
        title: 'Zuletzt gehört - Radio Paradise',
        iconType: 'radioparadise',
        items: response.radioParadise.map(item => this.transformRadioParadise(item))
      });
    }

    return sections;
  }

  private transformPlaylist(item: QobuzPlaylistHistoryItem): HistoryDisplayItem {
    return {
      id: item.id,
      title: item.playlistName,
      imageUrl: item.coverUrl,
      type: 'playlist',
      actionId: item.playlistId
    };
  }

  private transformAlbum(item: QobuzAlbumHistoryItem): HistoryDisplayItem {
    return {
      id: item.id,
      title: item.albumName,
      subtitle: item.artist,
      imageUrl: item.coverUrl,
      type: 'album',
      actionId: item.albumId
    };
  }

  private transformTuneIn(item: TuneInHistoryItem): HistoryDisplayItem {
    return {
      id: item.id,
      title: item.title,
      imageUrl: item.imageUrl,
      type: 'tunein',
      actionUrl: item.actionUrl
    };
  }

  private transformRadioParadise(item: RadioParadiseHistoryItem): HistoryDisplayItem {
    return {
      id: item.id,
      title: item.title,
      subtitle: item.quality,
      imageUrl: item.imageUrl,
      type: 'radioparadise',
      actionUrl: item.actionUrl
    };
  }

  /**
   * Add album to history
   */
  addAlbumToHistory(albumId: string, albumName: string, artist: string, coverUrl?: string): void {
    const profileId = this.auth.getProfileId();
    if (!profileId) return;

    // Store in localStorage for now (could be synced to backend)
    const key = `history_albums_${profileId}`;
    const history = this.getLocalHistory<QobuzAlbumHistoryItem>(key);

    // Remove if exists (to move to front)
    const filtered = history.filter(h => h.albumId !== albumId);

    // Add to front
    filtered.unshift({
      id: `album_${albumId}_${Date.now()}`,
      albumId,
      albumName,
      artist,
      coverUrl,
      type: 'album'
    });

    // Keep only last 20
    const trimmed = filtered.slice(0, 20);
    localStorage.setItem(key, JSON.stringify(trimmed));
  }

  /**
   * Add playlist to history
   */
  addPlaylistToHistory(playlistId: number, playlistName: string, coverUrl?: string): void {
    const profileId = this.auth.getProfileId();
    if (!profileId) return;

    const key = `history_playlists_${profileId}`;
    const history = this.getLocalHistory<QobuzPlaylistHistoryItem>(key);

    const filtered = history.filter(h => h.playlistId !== playlistId);

    filtered.unshift({
      id: `playlist_${playlistId}_${Date.now()}`,
      playlistId,
      playlistName,
      coverUrl,
      type: 'playlist'
    });

    const trimmed = filtered.slice(0, 20);
    localStorage.setItem(key, JSON.stringify(trimmed));
  }

  /**
   * Get local history from localStorage
   */
  private getLocalHistory<T>(key: string): T[] {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
}
