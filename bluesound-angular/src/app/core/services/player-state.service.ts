import { Injectable, computed, signal } from '@angular/core';
import {
  BluesoundPlayer,
  PlaybackStatus,
  QueueItem,
  formatDuration,
  getProgressPercent,
  isPlaying,
  isPaused,
  isStopped
} from '../models';
import { QobuzTrack } from '../models';

/**
 * Player mode: browser (Web Audio) or bluesound (hardware player)
 */
export type PlayerMode = 'browser' | 'bluesound';

/**
 * Streaming quality format IDs
 * 5 = MP3 320kbps
 * 6 = FLAC 16-bit/44.1kHz (CD Quality)
 * 7 = FLAC 24-bit up to 96kHz
 * 27 = FLAC 24-bit up to 192kHz (Hi-Res)
 */
export type StreamingQuality = 5 | 6 | 7 | 27;

/**
 * Centralized state management for playback using Angular Signals
 */
@Injectable({ providedIn: 'root' })
export class PlayerStateService {
  // ==================== Player Selection ====================
  /**
   * Currently selected Bluesound player
   */
  readonly selectedPlayer = signal<BluesoundPlayer | null>(null);

  /**
   * All discovered Bluesound players
   */
  readonly players = signal<BluesoundPlayer[]>([]);

  /**
   * Player mode: browser or bluesound
   */
  readonly playerMode = signal<PlayerMode>('browser');

  // ==================== Playback State ====================
  /**
   * Current playback status from Bluesound player
   */
  readonly playbackStatus = signal<PlaybackStatus | null>(null);

  /**
   * Currently playing track (for browser playback)
   */
  readonly currentTrack = signal<QobuzTrack | null>(null);

  /**
   * Currently playing Qobuz track ID (works for both browser and Bluesound)
   */
  readonly currentPlayingTrackId = signal<number | null>(null);

  /**
   * Is currently playing
   */
  readonly isPlaying = computed(() => {
    const status = this.playbackStatus();
    return status ? isPlaying(status) : false;
  });

  /**
   * Is currently paused
   */
  readonly isPaused = computed(() => {
    const status = this.playbackStatus();
    return status ? isPaused(status) : false;
  });

  /**
   * Is currently stopped
   */
  readonly isStopped = computed(() => {
    const status = this.playbackStatus();
    return status ? isStopped(status) : true;
  });

  // ==================== Progress ====================
  /**
   * Current playback position in seconds
   */
  readonly progress = signal(0);

  /**
   * Total duration in seconds
   */
  readonly duration = signal(0);

  /**
   * Progress percentage (0-100)
   */
  readonly progressPercent = computed(() => {
    const dur = this.duration();
    const prog = this.progress();
    return dur > 0 ? (prog / dur) * 100 : 0;
  });

  /**
   * Formatted current position (mm:ss)
   */
  readonly formattedPosition = computed(() => {
    return formatDuration(this.progress()) ?? '0:00';
  });

  /**
   * Formatted total duration (mm:ss)
   */
  readonly formattedDuration = computed(() => {
    return formatDuration(this.duration()) ?? '0:00';
  });

  // ==================== Volume ====================
  /**
   * Current volume (0-100)
   */
  readonly volume = signal(50);

  /**
   * Is muted
   */
  readonly isMuted = signal(false);

  /**
   * Is fixed volume (external amp control)
   */
  readonly isFixedVolume = computed(() => {
    const player = this.selectedPlayer();
    return player?.isFixedVolume ?? false;
  });

  // ==================== Quality ====================
  /**
   * Current streaming quality format ID
   */
  readonly streamingQuality = signal<StreamingQuality>(27);

  /**
   * Get quality label for display
   */
  readonly qualityLabel = computed(() => {
    switch (this.streamingQuality()) {
      case 5: return 'MP3 320';
      case 6: return 'CD (16-Bit)';
      case 7: return 'Hi-Res (24-Bit/96kHz)';
      case 27: return 'Hi-Res Max';
      default: return 'Unknown';
    }
  });

  // ==================== Queue ====================
  /**
   * Current queue
   */
  readonly queue = signal<QueueItem[]>([]);

  /**
   * Current queue index
   */
  readonly queueIndex = signal(0);

  /**
   * Is queue visible
   */
  readonly isQueueVisible = signal(false);

  // ==================== UI State ====================
  /**
   * Is now playing popup visible
   */
  readonly isNowPlayingVisible = signal(false);

  /**
   * Is volume panel visible
   */
  readonly isVolumePanelVisible = signal(false);

  // ==================== Methods ====================

  /**
   * Select a Bluesound player
   */
  selectPlayer(player: BluesoundPlayer | null): void {
    this.selectedPlayer.set(player);
    if (player) {
      this.playerMode.set('bluesound');
      this.volume.set(player.isFixedVolume ? 100 : player.volume);
    }
  }

  /**
   * Switch to browser playback mode
   */
  useBrowserPlayback(): void {
    this.selectedPlayer.set(null);
    this.playerMode.set('browser');
  }

  /**
   * Update playback status from polling
   */
  updatePlaybackStatus(status: PlaybackStatus): void {
    this.playbackStatus.set(status);
    if (status.currentSeconds !== undefined) {
      this.progress.set(status.currentSeconds);
    }
    if (status.totalSeconds !== undefined) {
      this.duration.set(status.totalSeconds);
    }
  }

  /**
   * Update progress (for local tracking)
   */
  updateProgress(seconds: number): void {
    this.progress.set(seconds);
  }

  /**
   * Set volume
   */
  setVolume(level: number): void {
    this.volume.set(Math.max(0, Math.min(100, level)));
    if (level > 0) {
      this.isMuted.set(false);
    }
  }

  /**
   * Toggle mute
   */
  toggleMute(): void {
    this.isMuted.update(muted => !muted);
  }

  /**
   * Set streaming quality
   */
  setStreamingQuality(quality: StreamingQuality): void {
    this.streamingQuality.set(quality);
  }

  /**
   * Toggle now playing popup
   */
  toggleNowPlaying(): void {
    this.isNowPlayingVisible.update(visible => !visible);
  }

  /**
   * Show now playing popup
   */
  showNowPlaying(): void {
    this.isNowPlayingVisible.set(true);
  }

  /**
   * Hide now playing popup
   */
  hideNowPlaying(): void {
    this.isNowPlayingVisible.set(false);
  }

  /**
   * Toggle queue visibility
   */
  toggleQueue(): void {
    this.isQueueVisible.update(visible => !visible);
  }

  /**
   * Set queue
   */
  setQueue(items: QueueItem[], currentIndex = 0): void {
    this.queue.set(items);
    this.queueIndex.set(currentIndex);
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.queue.set([]);
    this.queueIndex.set(0);
  }

  /**
   * Set the currently playing track ID
   */
  setCurrentPlayingTrackId(trackId: number | null): void {
    this.currentPlayingTrackId.set(trackId);
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.playbackStatus.set(null);
    this.currentTrack.set(null);
    this.currentPlayingTrackId.set(null);
    this.progress.set(0);
    this.duration.set(0);
    this.queue.set([]);
    this.queueIndex.set(0);
  }
}
