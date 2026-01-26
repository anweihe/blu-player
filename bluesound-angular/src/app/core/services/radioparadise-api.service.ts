import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import {
  RadioParadiseMenuResponse,
  RadioParadiseItem,
  PlayRadioParadiseRequest
} from '../models/radioparadise.models';
import { BluesoundPlayer } from '../models/bluesound.models';

/**
 * Service for Radio Paradise API interactions
 * Radio Paradise uses the Bluesound player's built-in integration
 */
@Injectable({ providedIn: 'root' })
export class RadioParadiseApiService {
  private readonly http = inject(HttpClient);

  /**
   * Get Radio Paradise channels menu from a Bluesound player
   */
  getMenu(player: BluesoundPlayer): Observable<RadioParadiseMenuResponse> {
    return this.http.get<RadioParadiseMenuResponse>(
      `/api/RadioParadise?handler=Menu&playerIp=${encodeURIComponent(player.ipAddress)}&port=${player.port || 11000}`
    ).pipe(
      catchError(error => {
        console.error('Failed to get Radio Paradise menu:', error);
        return of({
          success: false,
          sections: [],
          hasMultipleSections: false,
          error: 'Radio Paradise konnte nicht geladen werden'
        });
      })
    );
  }

  /**
   * Play a Radio Paradise channel on a Bluesound player
   */
  playChannel(player: BluesoundPlayer, item: RadioParadiseItem): Observable<{ success: boolean; error?: string }> {
    const playUrl = item.actionUrl || item.actionUri;
    if (!playUrl) {
      return of({ success: false, error: 'Keine Play-URL vorhanden' });
    }

    const request: PlayRadioParadiseRequest = {
      ip: player.ipAddress,
      port: player.port || 11000,
      playUrl,
      title: item.title,
      imageUrl: item.imageUrl
    };

    return this.http.post<{ success: boolean; error?: string }>(
      '/api/RadioParadise?handler=PlayStation',
      request
    ).pipe(
      catchError(error => {
        console.error('Failed to play Radio Paradise channel:', error);
        return of({ success: false, error: 'Kanal konnte nicht abgespielt werden' });
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
      `/api/RadioParadise?handler=BluesoundStatus&ip=${player.ipAddress}&port=${player.port || 11000}`
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
      '/api/RadioParadise?handler=BluesoundControl',
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
   * Save channel to listening history
   */
  saveToHistory(profileId: string, item: RadioParadiseItem): Observable<{ success: boolean }> {
    const actionUrl = item.actionUrl || item.actionUri;
    if (!actionUrl) {
      return of({ success: false });
    }

    return this.http.post<{ success: boolean }>(
      '/api/RadioParadise?handler=SaveHistory',
      {
        profileId,
        title: item.title,
        imageUrl: item.imageUrl,
        actionUrl,
        quality: item.subtitle
      }
    ).pipe(
      catchError(() => of({ success: false }))
    );
  }
}
