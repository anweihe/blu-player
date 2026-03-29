import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import {
  AirableMenuResponse,
  AirableBrowseResponse,
  AirableItem,
  PlayAirableStationRequest
} from '../models/airable.models';
import { BluesoundPlayer } from '../models/bluesound.models';

@Injectable({ providedIn: 'root' })
export class AirableApiService {
  private readonly http = inject(HttpClient);

  getMenu(player: BluesoundPlayer): Observable<AirableMenuResponse> {
    return this.http.get<AirableMenuResponse>(
      `/api/Airable?handler=Menu&playerIp=${encodeURIComponent(player.ipAddress)}&port=${player.port || 11000}`
    ).pipe(
      catchError(error => {
        console.error('Failed to get Airable menu:', error);
        return of({ success: false, items: [], error: 'Airable-Menu konnte nicht geladen werden' });
      })
    );
  }

  browse(player: BluesoundPlayer, uri: string): Observable<AirableBrowseResponse> {
    return this.http.get<AirableBrowseResponse>(
      `/api/Airable?handler=Browse&playerIp=${encodeURIComponent(player.ipAddress)}&port=${player.port || 11000}&uri=${encodeURIComponent(uri)}`
    ).pipe(
      catchError(error => {
        console.error('Failed to browse Airable:', error);
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

  playStation(player: BluesoundPlayer, item: AirableItem): Observable<{ success: boolean; error?: string }> {
    const playUrl = item.actionUrl || item.actionUri;
    if (!playUrl) {
      return of({ success: false, error: 'Keine Play-URL vorhanden' });
    }

    const request: PlayAirableStationRequest = {
      ip: player.ipAddress,
      port: player.port || 11000,
      playUrl,
      title: item.title,
      imageUrl: item.imageUrl
    };

    return this.http.post<{ success: boolean; error?: string }>(
      '/api/Airable?handler=PlayStation',
      request
    ).pipe(
      catchError(error => {
        console.error('Failed to play Airable station:', error);
        return of({ success: false, error: 'Station konnte nicht abgespielt werden' });
      })
    );
  }

  executePlayerLink(player: BluesoundPlayer, uri: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      '/api/Airable?handler=PlayerLink',
      { ip: player.ipAddress, port: player.port || 11000, uri }
    ).pipe(
      catchError(() => of({ success: false }))
    );
  }

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
      `/api/Airable?handler=BluesoundStatus&ip=${player.ipAddress}&port=${player.port || 11000}`
    ).pipe(
      catchError(error => {
        console.error('Failed to get Bluesound status:', error);
        return of({ success: false, error: 'Status konnte nicht abgerufen werden' });
      })
    );
  }

  saveToHistory(profileId: string, item: AirableItem): Observable<{ success: boolean }> {
    const actionUrl = item.actionUrl || item.actionUri;
    if (!actionUrl) {
      return of({ success: false });
    }

    return this.http.post<{ success: boolean }>(
      '/api/Airable?handler=SaveHistory',
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
