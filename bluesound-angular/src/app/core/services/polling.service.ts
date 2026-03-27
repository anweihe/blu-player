import { Injectable, inject, OnDestroy, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Subject, Subscription, fromEvent, interval, switchMap, takeUntil, filter, tap } from 'rxjs';
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

  private readonly doc = inject(DOCUMENT);

  private readonly destroy$ = new Subject<void>();
  private pollingSubscription?: Subscription;

  constructor() {
    // Sync immediately when app returns to foreground (iOS suspends JS timers in background)
    fromEvent(this.doc, 'visibilitychange')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (
          this.doc.visibilityState === 'visible' &&
          this.playerState.playerMode() === 'bluesound' &&
          this.playerState.selectedPlayer()
        ) {
          this.pollOnce();
        }
      });

    // Additional handler for iOS PWA back-forward cache / app resume
    fromEvent(this.doc.defaultView ?? window, 'pageshow')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (
          this.playerState.playerMode() === 'bluesound' &&
          this.playerState.selectedPlayer()
        ) {
          this.pollOnce();
        }
      });
  }

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
      if (!status) { this.lastPoll.set(new Date()); return; }

      // If the status has no cover image, try to get it from the queue
      if (!status.imageUrl && status.title) {
        this.bluesoundApi.getQueue(player.ipAddress).subscribe({
          next: queue => {
            const match = queue.find(item => item.title === status.title);
            this.playerState.updatePlaybackStatus(
              match?.imageUrl ? { ...status, imageUrl: match.imageUrl } : status
            );
          },
          error: () => this.playerState.updatePlaybackStatus(status)
        });
      } else {
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
