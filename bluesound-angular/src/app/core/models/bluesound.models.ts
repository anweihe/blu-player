/**
 * Bluesound/BluOS Player Models
 * Converted from C# BluesoundPlayer.cs and PlaybackStatus.cs
 */

/**
 * Represents a Bluesound player discovered on the network
 */
export interface BluesoundPlayer {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  modelName: string;
  model: string;
  brand: string;
  macAddress: string;
  volume: number;
  isFixedVolume: boolean;

  // Group information
  isGrouped: boolean;
  isMaster: boolean;
  groupName?: string;
  masterIp?: string;
  slaveIps: string[];

  // Stereo pair information
  isStereoPaired: boolean;
  channelMode?: string; // "left", "right", "front", etc.

  // Secondary speaker of a stereo pair (should be hidden from main list)
  isSecondaryStereoPairSpeaker: boolean;
}

/**
 * Represents the current playback status of a Bluesound player
 */
export interface PlaybackStatus {
  state: PlaybackState;
  title?: string;
  artist?: string;
  artistId?: number;
  album?: string;
  imageUrl?: string;
  service?: string; // Spotify, TuneIn, Qobuz, etc.
  totalSeconds?: number;
  currentSeconds?: number;
  streamUrl?: string;
}

export type PlaybackState = 'play' | 'pause' | 'stop' | 'stream';

/**
 * Helper functions for PlaybackStatus
 */
export function isPlaying(status: PlaybackStatus): boolean {
  return status.state === 'play' || status.state === 'stream';
}

export function isPaused(status: PlaybackStatus): boolean {
  return status.state === 'pause';
}

export function isStopped(status: PlaybackStatus): boolean {
  return status.state === 'stop';
}

export function getDisplayState(state: PlaybackState): string {
  switch (state) {
    case 'play': return 'Wiedergabe';
    case 'stream': return 'Streaming';
    case 'pause': return 'Pausiert';
    case 'stop': return 'Gestoppt';
    default: return 'Unbekannt';
  }
}

export function getDisplayStatus(player: BluesoundPlayer): string {
  if (player.isStereoPaired) {
    return `Stereopaar (${player.channelMode})`;
  }
  if (player.isGrouped) {
    if (player.isMaster) {
      return `Gruppe: ${player.groupName} (Master)`;
    }
    return `Gruppe: ${player.groupName} (Slave)`;
  }
  return 'Einzeln';
}

export function formatDuration(seconds: number | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function getProgressPercent(status: PlaybackStatus): number {
  if (!status.totalSeconds || status.totalSeconds <= 0 || !status.currentSeconds) {
    return 0;
  }
  return (status.currentSeconds / status.totalSeconds) * 100;
}

/**
 * Player group view model
 */
export interface PlayerGroup {
  master: BluesoundPlayer;
  slaves: BluesoundPlayer[];
  groupName: string;
}

/**
 * Queue item
 */
export interface QueueItem {
  id: number;
  title: string;
  artist: string;
  album?: string;
  imageUrl?: string;
  duration: number;
  isCurrentTrack: boolean;
}
