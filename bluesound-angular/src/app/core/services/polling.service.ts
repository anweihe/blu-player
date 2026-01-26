import { Injectable, inject, OnDestroy, signal } from '@angular/core';
import { Subject, Subscription, interval, switchMap, takeUntil, filter, tap } from 'rxjs';
import { BluesoundApiService } from './bluesound-api.service';
import { PlayerStateService } from './player-state.service';

/**
 * Polling Service
 * Handles automatic polling of Bluesound player status
 */
@Injectable({ providedIn: 'root' })
export class PollingService implements OnDestroy {
  private readonly bluesoundApi = inject(BluesoundApiService);
  private readonly playerState = inject(PlayerStateService);

  private readonly destroy$ = new Subject<void>();
  private pollingSubscription?: Subscription;

  /**
   * Polling interval in milliseconds
   */
  private readonly POLLING_INTERVAL = 1000;

  /**
   * Is polling active
   */
  readonly isPolling = signal(false);

  /**
   * Last poll timestamp
   */
  readonly lastPoll = signal<Date | null>(null);

  /**
   * Start polling the selected player's status
   */
  startPolling(): void {
    this.stopPolling();

    this.isPolling.set(true);

    this.pollingSubscription = interval(this.POLLING_INTERVAL).pipe(
      takeUntil(this.destroy$),
      filter(() => this.playerState.playerMode() === 'bluesound'),
      filter(() => !!this.playerState.selectedPlayer()),
      switchMap(() => {
        const player = this.playerState.selectedPlayer();
        if (!player) return [];
        return this.bluesoundApi.getStatus(player.ipAddress);
      }),
      tap(() => this.lastPoll.set(new Date()))
    ).subscribe(status => {
      if (status) {
        this.playerState.updatePlaybackStatus(status);
      }
    });
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = undefined;
    }
    this.isPolling.set(false);
  }

  /**
   * Poll once (manual refresh)
   */
  pollOnce(): void {
    const player = this.playerState.selectedPlayer();
    if (!player) return;

    this.bluesoundApi.getStatus(player.ipAddress).subscribe(status => {
      if (status) {
        this.playerState.updatePlaybackStatus(status);
      }
      this.lastPoll.set(new Date());
    });
  }

  /**
   * Refresh player list
   */
  refreshPlayers(): void {
    this.bluesoundApi.refreshPlayers().subscribe(players => {
      this.playerState.players.set(players);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopPolling();
  }
}
