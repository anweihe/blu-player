import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
import {
  TuneInMenuResponse,
  TuneInBrowseResponse,
  TuneInItem,
  PlayTuneInStationRequest
} from '../models/tunein.models';
import { BluesoundPlayer } from '../models/bluesound.models';

/**
 * Service for TuneIn Radio API interactions
 * TuneIn uses the Bluesound player's built-in TuneIn integration
 */
@Injectable({ providedIn: 'root' })
export class TuneInApiService {
  private readonly http = inject(HttpClient);

  /**
   * Get TuneIn main menu from a Bluesound player
   */
  getMenu(player: BluesoundPlayer): Observable<TuneInMenuResponse> {
    return this.http.get<TuneInMenuResponse>(
      `/TuneIn?handler=Menu&playerIp=${encodeURIComponent(player.ipAddress)}&port=${player.port || 11000}`
    ).pipe(
      catchError(error => {
        console.error('Failed to get TuneIn menu:', error);
        return of({ success: false, items: [], error: 'TuneIn-Menu konnte nicht geladen werden' });
      })
    );
  }

  /**
   * Browse a TuneIn category or subcategory
   */
  browse(player: BluesoundPlayer, uri: string): Observable<TuneInBrowseResponse> {
    return this.http.get<TuneInBrowseResponse>(
      `/TuneIn?handler=Browse&playerIp=${encodeURIComponent(player.ipAddress)}&port=${player.port || 11000}&uri=${encodeURIComponent(uri)}`
    ).pipe(
      catchError(error => {
        console.error('Failed to browse TuneIn:', error);
        return of({
          success: false,
          items: [],
          sections: [],
          hasMultipleSections: false,
          error: 'Kategorie konnte nicht geladen werden'
        });
      })
    );
  }

  /**
   * Play a TuneIn station on a Bluesound player
   */
  playStation(player: BluesoundPlayer, item: TuneInItem): Observable<{ success: boolean; error?: string }> {
    const playUrl = item.actionUrl || item.actionUri;
    if (!playUrl) {
      return of({ success: false, error: 'Keine Play-URL vorhanden' });
    }

    const request: PlayTuneInStationRequest = {
      ip: player.ipAddress,
      port: player.port || 11000,
      playUrl,
      title: item.title,
      imageUrl: item.imageUrl
    };

    return this.http.post<{ success: boolean; error?: string }>(
      '/TuneIn?handler=PlayStation',
      request
    ).pipe(
      catchError(error => {
        console.error('Failed to play TuneIn station:', error);
        return of({ success: false, error: 'Station konnte nicht abgespielt werden' });
      })
    );
  }

  /**
   * Get playback status from a Bluesound player
   */
  getBluesoundStatus(player: BluesoundPlayer): Observable<{
    success: boolean;
    status?: {
      state: string;
      title?: string;
      artist?: string;
      album?: string;
      imageUrl?: string;
      currentSeconds?: number;
      totalSeconds?: number;
      service?: string;
    };
    error?: string;
  }> {
    return this.http.get<any>(
      `/TuneIn?handler=BluesoundStatus&ip=${player.ipAddress}&port=${player.port || 11000}`
    ).pipe(
      catchError(error => {
        console.error('Failed to get Bluesound status:', error);
        return of({ success: false, error: 'Status konnte nicht abgerufen werden' });
      })
    );
  }

  /**
   * Control playback on a Bluesound player
   */
  controlPlayback(player: BluesoundPlayer, action: 'play' | 'pause' | 'stop'): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      '/TuneIn?handler=BluesoundControl',
      {
        ip: player.ipAddress,
        port: player.port || 11000,
        action
      }
    ).pipe(
      catchError(() => of({ success: false }))
    );
  }

  /**
   * Save station to listening history
   */
  saveToHistory(profileId: string, item: TuneInItem): Observable<{ success: boolean }> {
    const actionUrl = item.actionUrl || item.actionUri;
    if (!actionUrl) {
      return of({ success: false });
    }

    return this.http.post<{ success: boolean }>(
      '/TuneIn?handler=SaveHistory',
      {
        profileId,
        title: item.title,
        imageUrl: item.imageUrl,
        actionUrl
      }
    ).pipe(
      catchError(() => of({ success: false }))
    );
  }
}
