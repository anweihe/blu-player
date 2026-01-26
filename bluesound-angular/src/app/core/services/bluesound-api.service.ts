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
   * Play a Qobuz track on the player using native BluOS Qobuz integration via /ui/prf
   * This uses the Bluesound's built-in Qobuz integration for proper queue management
   *
   * @param playerIp - Player IP address
   * @param trackId - Qobuz track ID
   * @param trackIndex - Index of track in album/playlist (0-based)
   * @param context - Playback context (album or playlist)
   */
  playQobuzTrackNative(
    playerIp: string,
    trackId: number,
    trackIndex: number,
    context: { type: 'album'; albumId: string } | { type: 'playlist'; playlistId: number }
  ): Observable<boolean> {
    const body = context.type === 'album'
      ? {
          ip: playerIp,
          port: 11000,
          sourceType: 'album',
          albumId: context.albumId,
          trackId,
          trackIndex
        }
      : {
          ip: playerIp,
          port: 11000,
          sourceType: 'playlist',
          playlistId: context.playlistId,
          trackId,
          trackIndex
        };

    return this.http.post<{ success: boolean }>(
      `${this.qobuzApiUrl}/play-native-on-bluesound`,
      body
    ).pipe(
      map(response => response.success),
      catchError(error => {
        console.error('Failed to play track on Bluesound:', error);
        return of(false);
      })
    );
  }

  /**
   * @deprecated Use playQobuzTrackNative with context instead
   */
  playQobuzTrack(playerIp: string, trackId: number, track?: QobuzTrack): Observable<boolean> {
    // Fallback: if no context, try to play with just track ID (may not work well)
    console.warn('playQobuzTrack called without context - native playback requires album/playlist context');
    return of(false);
  }

  /**
   * Play a Qobuz album on the player using native BluOS /ui/prf endpoint
   * @param playerIp - Player IP address
   * @param albumId - Qobuz album ID
   * @param startTrackIndex - Index of track to start from (0-based)
   * @param trackId - Qobuz track ID of the starting track
   */
  playQobuzAlbum(playerIp: string, albumId: string, startTrackIndex = 0, trackId?: number): Observable<boolean> {
    // If trackId is not provided, we can't use native playback properly
    // The native /ui/prf endpoint requires both album ID and track ID
    if (!trackId) {
      console.warn('playQobuzAlbum called without trackId - native playback may not work correctly');
    }

    return this.http.post<{ success: boolean }>(
      `${this.qobuzApiUrl}/play-native-on-bluesound`,
      {
        ip: playerIp,
        port: 11000,
        sourceType: 'album',
        albumId,
        trackId: trackId ?? 0,
        trackIndex: startTrackIndex
      }
    ).pipe(
      map(response => response.success),
      catchError(error => {
        console.error('Failed to play album on Bluesound:', error);
        return of(false);
      })
    );
  }

  /**
   * Play a Qobuz playlist on the player using native BluOS /ui/prf endpoint
   * @param playerIp - Player IP address
   * @param playlistId - Qobuz playlist ID
   * @param startTrackIndex - Index of track to start from (0-based)
   * @param trackId - Qobuz track ID of the starting track
   */
  playQobuzPlaylist(playerIp: string, playlistId: number, startTrackIndex = 0, trackId?: number): Observable<boolean> {
    if (!trackId) {
      console.warn('playQobuzPlaylist called without trackId - native playback may not work correctly');
    }

    return this.http.post<{ success: boolean }>(
      `${this.qobuzApiUrl}/play-native-on-bluesound`,
      {
        ip: playerIp,
        port: 11000,
        sourceType: 'playlist',
        playlistId,
        trackId: trackId ?? 0,
        trackIndex: startTrackIndex
      }
    ).pipe(
      map(response => response.success),
      catchError(error => {
        console.error('Failed to play playlist on Bluesound:', error);
        return of(false);
      })
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
