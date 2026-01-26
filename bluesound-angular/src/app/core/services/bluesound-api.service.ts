import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import { BluesoundPlayer, PlaybackStatus, QueueItem, QobuzTrack } from '../models';
import { AuthService } from './auth.service';
import { PlayerStateService } from './player-state.service';

/**
 * Bluesound/BluOS API Service
 * Handles all API calls to Bluesound players through the .NET backend
 */
@Injectable({ providedIn: 'root' })
export class BluesoundApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly playerState = inject(PlayerStateService);
  private readonly apiBaseUrl = '/api';
  private readonly qobuzApiUrl = '/api/qobuz';

  // ==================== Player Discovery ====================

  /**
   * Get all discovered players
   */
  getPlayers(): Observable<BluesoundPlayer[]> {
    return this.http.get<BluesoundPlayer[]>(`${this.apiBaseUrl}/players`).pipe(
      catchError(() => of([]))
    );
  }

  /**
   * Refresh player discovery
   */
  refreshPlayers(): Observable<BluesoundPlayer[]> {
    return this.http.post<BluesoundPlayer[]>(`${this.apiBaseUrl}/players/refresh`, {}).pipe(
      catchError(() => of([]))
    );
  }

  // ==================== Player Status ====================

  /**
   * Get player sync status
   */
  getSyncStatus(playerIp: string): Observable<BluesoundPlayer | null> {
    return this.http.get<BluesoundPlayer>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/sync`
    ).pipe(
      catchError(() => of(null))
    );
  }

  /**
   * Get playback status
   */
  getStatus(playerIp: string): Observable<PlaybackStatus | null> {
    return this.http.get<PlaybackStatus>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/status`
    ).pipe(
      catchError(() => of(null))
    );
  }

  /**
   * Get current queue
   */
  getQueue(playerIp: string): Observable<QueueItem[]> {
    return this.http.get<QueueItem[]>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/queue`
    ).pipe(
      catchError(() => of([]))
    );
  }

  // ==================== Playback Control ====================

  /**
   * Play
   */
  play(playerIp: string): Observable<boolean> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/play`, {}
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Pause
   */
  pause(playerIp: string): Observable<boolean> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/pause`, {}
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Stop
   */
  stop(playerIp: string): Observable<boolean> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/stop`, {}
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Skip to next track
   */
  skip(playerIp: string): Observable<boolean> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/skip`, {}
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Go back to previous track
   */
  back(playerIp: string): Observable<boolean> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/back`, {}
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Seek to position
   */
  seek(playerIp: string, seconds: number): Observable<boolean> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/seek`,
      { seconds }
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  // ==================== Volume Control ====================

  /**
   * Set volume (0-100)
   */
  setVolume(playerIp: string, level: number): Observable<boolean> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/volume`,
      { level }
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Mute/Unmute
   */
  setMute(playerIp: string, mute: boolean): Observable<boolean> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/mute`,
      { mute }
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  // ==================== Queue Management ====================

  /**
   * Play a Qobuz track on the player using stream URL
   * This uses the web app's Qobuz auth token to get the stream URL,
   * then sends it to the Bluesound player (doesn't require Bluesound to be logged into Qobuz)
   */
  playQobuzTrack(playerIp: string, trackId: number, track?: QobuzTrack): Observable<boolean> {
    const authToken = this.auth.authToken();
    const formatId = this.playerState.streamingQuality();

    if (!authToken) {
      console.error('No auth token available for Qobuz playback');
      return of(false);
    }

    return this.http.post<{ success: boolean }>(
      `${this.qobuzApiUrl}/play-on-bluesound`,
      {
        ip: playerIp,
        port: 11000,
        trackId,
        authToken,
        formatId,
        title: track?.title,
        artist: track?.performer?.name,
        album: track?.album?.title,
        imageUrl: track?.album?.image?.large
      }
    ).pipe(
      map(response => response.success),
      catchError(error => {
        console.error('Failed to play track on Bluesound:', error);
        return of(false);
      })
    );
  }

  /**
   * Play a Qobuz album on the player
   */
  playQobuzAlbum(playerIp: string, albumId: string, startTrackIndex = 0): Observable<boolean> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/play-qobuz-album`,
      { albumId, startTrackIndex }
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Play a Qobuz playlist on the player
   */
  playQobuzPlaylist(playerIp: string, playlistId: number, startTrackIndex = 0): Observable<boolean> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/play-qobuz-playlist`,
      { playlistId, startTrackIndex }
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Add track to queue
   */
  addToQueue(playerIp: string, trackId: number): Observable<boolean> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/queue/add`,
      { trackId }
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Clear queue
   */
  clearQueue(playerIp: string): Observable<boolean> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/queue/clear`, {}
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Play queue item at index
   */
  playQueueItem(playerIp: string, index: number): Observable<boolean> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/queue/play`,
      { index }
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Remove queue item at index
   */
  removeQueueItem(playerIp: string, index: number): Observable<boolean> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/queue/${index}`
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  // ==================== Group Management ====================

  /**
   * Create a group with the specified players
   */
  createGroup(masterIp: string, slaveIps: string[]): Observable<boolean> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(masterIp)}/group/create`,
      { slaveIps }
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Add a player to an existing group
   */
  addToGroup(masterIp: string, slaveIp: string): Observable<boolean> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(masterIp)}/group/add`,
      { slaveIp }
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Remove a player from a group
   */
  removeFromGroup(masterIp: string, slaveIp: string): Observable<boolean> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(masterIp)}/group/remove`,
      { slaveIp }
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /**
   * Leave current group (called on slave)
   */
  leaveGroup(playerIp: string): Observable<boolean> {
    return this.http.post<void>(
      `${this.apiBaseUrl}/player/${encodeURIComponent(playerIp)}/group/leave`, {}
    ).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }
}
