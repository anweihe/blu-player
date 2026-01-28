import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { Subject, Subscription, interval, firstValueFrom } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { PlayerStateService, StreamingQuality } from './player-state.service';
import { BluesoundApiService } from './bluesound-api.service';
import { QobuzApiService } from './qobuz-api.service';
import { QobuzTrack, QobuzAlbum, QobuzPlaylist, BluesoundPlayer } from '../models';

/**
 * Playback context for queueing
 */
export interface PlaybackContext {
  type: 'track' | 'album' | 'playlist';
  id: string | number;
  tracks: QobuzTrack[];
  startIndex: number;
}

/**
 * Unified playback service that handles both browser and Bluesound playback
 */
@Injectable({ providedIn: 'root' })
export class PlaybackService implements OnDestroy {
  private readonly playerState = inject(PlayerStateService);
  private readonly bluesoundApi = inject(BluesoundApiService);
  private readonly qobuzApi = inject(QobuzApiService);

  // Browser audio element
  private audioElement: HTMLAudioElement | null = null;

  // Animation frame for smooth progress updates
  private animationFrameId: number | null = null;
  private lastProgressUpdate = 0;

  // Playback context
  private currentContext: PlaybackContext | null = null;

  // Cleanup
  private readonly destroy$ = new Subject<void>();
  private pollingSubscription: Subscription | null = null;

  // Loading state
  readonly isLoading = signal(false);
  readonly loadingTrackId = signal<number | null>(null);

  // Browser playback state (for when we're in browser mode)
  readonly isBrowserPlaying = signal(false);

  constructor() {
    this.initAudioElement();
    this.setupModeWatcher();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopProgressAnimation();
    this.disposeAudioElement();
    this.stopPolling();
  }

  // ==================== Initialization ====================

  private initAudioElement(): void {
    if (typeof window !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.preload = 'metadata';

      // Event listeners
      this.audioElement.addEventListener('play', () => this.onAudioPlay());
      this.audioElement.addEventListener('pause', () => this.onAudioPause());
      this.audioElement.addEventListener('ended', () => this.onAudioEnded());
      this.audioElement.addEventListener('timeupdate', () => this.onTimeUpdate());
      this.audioElement.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
      this.audioElement.addEventListener('error', (e) => this.onAudioError(e));
    }
  }

  private disposeAudioElement(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }
  }

  private setupModeWatcher(): void {
    // Watch for player mode changes to handle handoff
    // When switching from browser to bluesound, stop browser audio
    // When switching from bluesound to browser, stop polling
  }

  // ==================== Play Commands ====================

  /**
   * Play a single track
   * For Bluesound playback, a context (album or playlist) is required for native playback
   */
  async playTrack(track: QobuzTrack, context?: PlaybackContext): Promise<void> {
    this.isLoading.set(true);
    this.loadingTrackId.set(track.id);

    try {
      // Set current track in state (for both browser and Bluesound)
      this.playerState.currentTrack.set(track);
      this.playerState.setCurrentPlayingTrackId(track.id);
      this.playerState.duration.set(track.duration || 0);
      this.playerState.progress.set(0);

      // Store context for queue navigation
      if (context) {
        this.currentContext = context;
      }

      const mode = this.playerState.playerMode();

      if (mode === 'browser') {
        await this.playTrackInBrowser(track);
      } else {
        await this.playTrackOnBluesound(track, context);
      }
    } catch (error) {
      console.error('Failed to play track:', error);
    } finally {
      this.isLoading.set(false);
      this.loadingTrackId.set(null);
    }
  }

  /**
   * Play an album starting from a specific track index
   * Uses native BluOS /ui/prf endpoint for Bluesound players
   */
  async playAlbum(album: QobuzAlbum, tracks: QobuzTrack[], startIndex = 0): Promise<void> {
    if (!album.id) {
      console.error('Album has no ID');
      return;
    }

    const startTrack = tracks[startIndex];
    if (!startTrack) {
      console.error('Invalid start index');
      return;
    }

    const context: PlaybackContext = {
      type: 'album',
      id: album.id,
      tracks,
      startIndex
    };

    const mode = this.playerState.playerMode();
    const player = this.playerState.selectedPlayer();

    if (mode === 'bluesound' && player) {
      // Use native Bluesound album playback via /ui/prf
      this.isLoading.set(true);
      try {
        // Set the starting track as current
        this.playerState.currentTrack.set(startTrack);
        this.playerState.setCurrentPlayingTrackId(startTrack.id);

        await firstValueFrom(
          this.bluesoundApi.playQobuzAlbum(player.ipAddress, album.id, startIndex, startTrack.id)
        );
        this.currentContext = context;
        this.startPolling();
      } finally {
        this.isLoading.set(false);
      }
    } else {
      // Browser playback - play first track and set context
      await this.playTrack(startTrack, context);
    }
  }

  /**
   * Play a playlist starting from a specific track index
   * Uses native BluOS /ui/prf endpoint for Bluesound players
   */
  async playPlaylist(playlist: QobuzPlaylist, tracks: QobuzTrack[], startIndex = 0): Promise<void> {
    const startTrack = tracks[startIndex];
    if (!startTrack) {
      console.error('Invalid start index');
      return;
    }

    const context: PlaybackContext = {
      type: 'playlist',
      id: playlist.id,
      tracks,
      startIndex
    };

    const mode = this.playerState.playerMode();
    const player = this.playerState.selectedPlayer();

    if (mode === 'bluesound' && player) {
      // Use native Bluesound playlist playback via /ui/prf
      this.isLoading.set(true);
      try {
        // Set the starting track as current
        this.playerState.currentTrack.set(startTrack);
        this.playerState.setCurrentPlayingTrackId(startTrack.id);

        await firstValueFrom(
          this.bluesoundApi.playQobuzPlaylist(player.ipAddress, playlist.id, startIndex, startTrack.id)
        );
        this.currentContext = context;
        this.startPolling();
      } finally {
        this.isLoading.set(false);
      }
    } else {
      // Browser playback - play first track and set context
      await this.playTrack(startTrack, context);
    }
  }

  // ==================== Browser Playback ====================

  private async playTrackInBrowser(track: QobuzTrack): Promise<void> {
    if (!this.audioElement) return;

    try {
      // Get stream URL from Qobuz
      const quality = this.playerState.streamingQuality();
      const streamUrl = await firstValueFrom(
        this.qobuzApi.getTrackStreamUrl(track.id, quality)
      );

      // Stop any existing playback
      this.audioElement.pause();

      // Set source and play
      this.audioElement.src = streamUrl;
      this.audioElement.volume = this.playerState.isMuted()
        ? 0
        : this.playerState.volume() / 100;

      await this.audioElement.play();

      // Start progress animation
      this.startProgressAnimation();
    } catch (error) {
      console.error('Failed to play track in browser:', error);
      throw error;
    }
  }

  // ==================== Bluesound Playback ====================

  private async playTrackOnBluesound(track: QobuzTrack, context?: PlaybackContext): Promise<void> {
    const player = this.playerState.selectedPlayer();
    if (!player) {
      console.error('No Bluesound player selected');
      return;
    }

    if (!context) {
      console.error('No playback context provided - Bluesound native playback requires album/playlist context');
      return;
    }

    try {
      // Build the native playback context
      const nativeContext = context.type === 'album'
        ? { type: 'album' as const, albumId: String(context.id) }
        : { type: 'playlist' as const, playlistId: Number(context.id) };

      const success = await firstValueFrom(
        this.bluesoundApi.playQobuzTrackNative(
          player.ipAddress,
          track.id,
          context.startIndex,
          nativeContext
        )
      );

      if (!success) {
        console.error('Bluesound native playback returned false');
      }

      // Start polling for status updates
      this.startPolling();
    } catch (error) {
      console.error('Failed to play track on Bluesound:', error);
      throw error;
    }
  }

  // ==================== Transport Controls ====================

  /**
   * Toggle play/pause
   */
  async togglePlayPause(): Promise<void> {
    const mode = this.playerState.playerMode();
    const isPlaying = this.playerState.isPlaying();

    if (mode === 'browser') {
      if (this.audioElement) {
        if (isPlaying || !this.audioElement.paused) {
          this.audioElement.pause();
        } else {
          await this.audioElement.play();
          this.startProgressAnimation();
        }
      }
    } else {
      const player = this.playerState.selectedPlayer();
      if (player) {
        if (isPlaying) {
          await firstValueFrom(this.bluesoundApi.pause(player.ipAddress));
        } else {
          await firstValueFrom(this.bluesoundApi.play(player.ipAddress));
        }
      }
    }
  }

  /**
   * Play (resume)
   */
  async play(): Promise<void> {
    const mode = this.playerState.playerMode();

    if (mode === 'browser') {
      if (this.audioElement && this.audioElement.paused) {
        await this.audioElement.play();
        this.startProgressAnimation();
      }
    } else {
      const player = this.playerState.selectedPlayer();
      if (player) {
        await firstValueFrom(this.bluesoundApi.play(player.ipAddress));
      }
    }
  }

  /**
   * Pause
   */
  async pause(): Promise<void> {
    const mode = this.playerState.playerMode();

    if (mode === 'browser') {
      this.audioElement?.pause();
    } else {
      const player = this.playerState.selectedPlayer();
      if (player) {
        await firstValueFrom(this.bluesoundApi.pause(player.ipAddress));
      }
    }
  }

  /**
   * Stop playback
   */
  async stop(): Promise<void> {
    const mode = this.playerState.playerMode();

    if (mode === 'browser') {
      if (this.audioElement) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      }
      this.stopProgressAnimation();
      this.playerState.reset();
    } else {
      const player = this.playerState.selectedPlayer();
      if (player) {
        await firstValueFrom(this.bluesoundApi.stop(player.ipAddress));
      }
    }
  }

  /**
   * Skip to next track
   */
  async skipNext(): Promise<void> {
    const mode = this.playerState.playerMode();

    if (mode === 'browser') {
      // Check context for next track
      if (this.currentContext) {
        const nextIndex = this.currentContext.startIndex + 1;
        if (nextIndex < this.currentContext.tracks.length) {
          this.currentContext.startIndex = nextIndex;
          await this.playTrack(this.currentContext.tracks[nextIndex], this.currentContext);
        }
      }
    } else {
      const player = this.playerState.selectedPlayer();
      if (player) {
        await firstValueFrom(this.bluesoundApi.skip(player.ipAddress));
      }
    }
  }

  /**
   * Skip to previous track
   */
  async skipPrevious(): Promise<void> {
    const mode = this.playerState.playerMode();

    if (mode === 'browser') {
      // If more than 3 seconds into track, restart it
      if (this.audioElement && this.audioElement.currentTime > 3) {
        this.audioElement.currentTime = 0;
        return;
      }

      // Check context for previous track
      if (this.currentContext) {
        const prevIndex = this.currentContext.startIndex - 1;
        if (prevIndex >= 0) {
          this.currentContext.startIndex = prevIndex;
          await this.playTrack(this.currentContext.tracks[prevIndex], this.currentContext);
        }
      }
    } else {
      const player = this.playerState.selectedPlayer();
      if (player) {
        await firstValueFrom(this.bluesoundApi.back(player.ipAddress));
      }
    }
  }

  /**
   * Seek to position (in seconds)
   */
  async seek(seconds: number): Promise<void> {
    const mode = this.playerState.playerMode();

    if (mode === 'browser') {
      if (this.audioElement) {
        this.audioElement.currentTime = seconds;
        this.playerState.updateProgress(seconds);
      }
    } else {
      const player = this.playerState.selectedPlayer();
      if (player) {
        await firstValueFrom(this.bluesoundApi.seek(player.ipAddress, seconds));
      }
    }
  }

  /**
   * Seek to percentage (0-100)
   */
  async seekToPercent(percent: number): Promise<void> {
    const duration = this.playerState.duration();
    if (duration > 0) {
      const seconds = (percent / 100) * duration;
      await this.seek(seconds);
    }
  }

  // ==================== Volume Control ====================

  /**
   * Set volume (0-100)
   */
  async setVolume(level: number): Promise<void> {
    const clampedLevel = Math.max(0, Math.min(100, level));
    this.playerState.setVolume(clampedLevel);

    const mode = this.playerState.playerMode();

    if (mode === 'browser') {
      if (this.audioElement) {
        this.audioElement.volume = clampedLevel / 100;
      }
    } else {
      const player = this.playerState.selectedPlayer();
      if (player && !player.isFixedVolume) {
        await firstValueFrom(this.bluesoundApi.setVolume(player.ipAddress, clampedLevel));
      }
    }
  }

  /**
   * Toggle mute
   */
  async toggleMute(): Promise<void> {
    const wasMuted = this.playerState.isMuted();
    this.playerState.toggleMute();

    const mode = this.playerState.playerMode();

    if (mode === 'browser') {
      if (this.audioElement) {
        this.audioElement.volume = wasMuted ? this.playerState.volume() / 100 : 0;
      }
    } else {
      const player = this.playerState.selectedPlayer();
      if (player) {
        await firstValueFrom(this.bluesoundApi.setMute(player.ipAddress, !wasMuted));
      }
    }
  }

  // ==================== Quality Control ====================

  /**
   * Set streaming quality
   * For Bluesound mode, also updates the player's quality setting
   */
  async setQuality(quality: StreamingQuality): Promise<void> {
    // Update local state
    this.playerState.setStreamingQuality(quality);

    // If we're in Bluesound mode, also update the player
    const player = this.playerState.selectedPlayer();
    if (player && this.playerState.playerMode() === 'bluesound') {
      try {
        await firstValueFrom(this.bluesoundApi.setQobuzQuality(player.ipAddress, quality));
      } catch (error) {
        console.error('Failed to set quality on Bluesound player:', error);
      }
    }
  }

  /**
   * Load quality setting from Bluesound player
   */
  async loadQualityFromPlayer(): Promise<void> {
    const player = this.playerState.selectedPlayer();
    if (player && this.playerState.playerMode() === 'bluesound') {
      try {
        const result = await firstValueFrom(this.bluesoundApi.getQobuzQuality(player.ipAddress));
        if (result) {
          this.playerState.setStreamingQuality(result.formatId as StreamingQuality);
        }
      } catch (error) {
        console.error('Failed to load quality from Bluesound player:', error);
      }
    }
  }

  // ==================== Player Mode ====================

  /**
   * Switch to browser playback
   * If a track is currently playing on Bluesound, it will be handed off to the browser
   */
  async switchToBrowser(): Promise<void> {
    // Check if we have a track playing on Bluesound to hand off
    const wasPlaying = this.playerState.isPlaying();
    const currentTrack = this.playerState.currentTrack();
    const context = this.currentContext;

    // Stop Bluesound playback first
    const player = this.playerState.selectedPlayer();
    if (player) {
      try {
        await firstValueFrom(this.bluesoundApi.stop(player.ipAddress));
      } catch {
        // Ignore errors when stopping
      }
    }

    this.stopPolling();
    this.playerState.useBrowserPlayback();

    // Hand off playback to browser if we were playing
    if (wasPlaying && currentTrack && context) {
      await this.playTrackInBrowser(currentTrack);
    }
  }

  /**
   * Switch to Bluesound player
   * If a track is currently playing (browser or another Bluesound), it will be handed off
   */
  async switchToBluesound(player: BluesoundPlayer): Promise<void> {
    // Check if we have a track playing to hand off
    const wasPlayingBrowser = this.isBrowserPlaying();
    const wasPlayingBluesound = this.playerState.playerMode() === 'bluesound' && this.playerState.isPlaying();
    const wasPlaying = wasPlayingBrowser || wasPlayingBluesound;
    const currentTrack = this.playerState.currentTrack();
    const context = this.currentContext;

    // Stop previous Bluesound player if switching between players
    const previousPlayer = this.playerState.selectedPlayer();
    if (previousPlayer && previousPlayer.ipAddress !== player.ipAddress) {
      try {
        await firstValueFrom(this.bluesoundApi.stop(previousPlayer.ipAddress));
      } catch {
        // Ignore errors when stopping
      }
    }

    // Stop browser playback
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
    }
    this.stopProgressAnimation();

    // Update state
    this.playerState.selectPlayer(player);

    // Start polling for status
    this.startPolling();

    // Load quality setting from player
    await this.loadQualityFromPlayer();

    // Hand off playback to Bluesound if we were playing
    if (wasPlaying && currentTrack && context) {
      // Find the current track index in the context
      const trackIndex = context.tracks.findIndex(t => t.id === currentTrack.id);
      const startIndex = trackIndex >= 0 ? trackIndex : context.startIndex;

      if (context.type === 'album') {
        await firstValueFrom(
          this.bluesoundApi.playQobuzAlbum(player.ipAddress, context.id as string, startIndex, currentTrack.id)
        );
      } else if (context.type === 'playlist') {
        await firstValueFrom(
          this.bluesoundApi.playQobuzPlaylist(player.ipAddress, context.id as number, startIndex, currentTrack.id)
        );
      } else {
        // Single track - play via native track endpoint if available
        await this.playTrackOnBluesound(currentTrack, context);
      }
    }
  }

  // ==================== Audio Element Events ====================

  private onAudioPlay(): void {
    this.isBrowserPlaying.set(true);
    // Update playback status to reflect playing state
    const currentStatus = this.playerState.playbackStatus();
    if (currentStatus) {
      this.playerState.updatePlaybackStatus({
        ...currentStatus,
        state: 'play'
      });
    } else {
      const track = this.playerState.currentTrack();
      if (track) {
        this.playerState.updatePlaybackStatus({
          state: 'play',
          title: track.title,
          artist: track.performer?.name,
          album: track.album?.title,
          imageUrl: track.album?.image?.large,
          totalSeconds: track.duration,
          currentSeconds: 0,
          artistId: track.performer?.id
        });
      }
    }
  }

  private onAudioPause(): void {
    this.isBrowserPlaying.set(false);
    this.stopProgressAnimation();
    const currentStatus = this.playerState.playbackStatus();
    if (currentStatus) {
      this.playerState.updatePlaybackStatus({
        ...currentStatus,
        state: 'pause'
      });
    }
  }

  private onAudioEnded(): void {
    this.isBrowserPlaying.set(false);
    this.stopProgressAnimation();

    // Auto-play next track if in context
    if (this.currentContext) {
      this.skipNext();
    }
  }

  private onTimeUpdate(): void {
    if (this.audioElement) {
      this.playerState.updateProgress(this.audioElement.currentTime);
    }
  }

  private onLoadedMetadata(): void {
    if (this.audioElement) {
      this.playerState.duration.set(this.audioElement.duration);
    }
  }

  private onAudioError(event: Event): void {
    // This is expected for TuneIn/Radio Paradise - they play on Bluesound, not in browser
    console.debug('Audio element error (expected for device playback):', event);
    this.isBrowserPlaying.set(false);
    this.stopProgressAnimation();
  }

  // ==================== Progress Animation ====================

  private startProgressAnimation(): void {
    this.stopProgressAnimation();
    this.lastProgressUpdate = performance.now();
    this.animateProgress();
  }

  private stopProgressAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private animateProgress = (): void => {
    if (!this.audioElement || this.audioElement.paused) {
      return;
    }

    const now = performance.now();
    const elapsed = (now - this.lastProgressUpdate) / 1000;
    this.lastProgressUpdate = now;

    // Update progress smoothly
    const currentProgress = this.playerState.progress();
    const newProgress = currentProgress + elapsed;

    if (newProgress <= this.playerState.duration()) {
      this.playerState.updateProgress(newProgress);
    }

    this.animationFrameId = requestAnimationFrame(this.animateProgress);
  };

  // ==================== Polling for Bluesound ====================

  private startPolling(): void {
    this.stopPolling();

    const player = this.playerState.selectedPlayer();
    if (!player) return;

    // Poll every second for status updates
    this.pollingSubscription = interval(1000)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => this.bluesoundApi.getStatus(player.ipAddress))
      )
      .subscribe(status => {
        if (status) {
          this.playerState.updatePlaybackStatus(status);
        }
      });
  }

  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  // ==================== Queue Management ====================

  /**
   * Add track to queue
   */
  async addToQueue(track: QobuzTrack): Promise<void> {
    const mode = this.playerState.playerMode();
    const player = this.playerState.selectedPlayer();

    if (mode === 'bluesound' && player) {
      await firstValueFrom(this.bluesoundApi.addToQueue(player.ipAddress, track.id));
    } else {
      // For browser mode, add to local context
      if (this.currentContext) {
        this.currentContext.tracks.push(track);
      }
    }
  }

  /**
   * Clear queue
   */
  async clearQueue(): Promise<void> {
    const mode = this.playerState.playerMode();
    const player = this.playerState.selectedPlayer();

    if (mode === 'bluesound' && player) {
      await firstValueFrom(this.bluesoundApi.clearQueue(player.ipAddress));
    }

    this.playerState.clearQueue();
    this.currentContext = null;
  }

  /**
   * Load queue from Bluesound player
   */
  async loadQueue(): Promise<void> {
    const player = this.playerState.selectedPlayer();
    if (!player) return;

    const queue = await firstValueFrom(this.bluesoundApi.getQueue(player.ipAddress));
    this.playerState.setQueue(queue);
  }
}
