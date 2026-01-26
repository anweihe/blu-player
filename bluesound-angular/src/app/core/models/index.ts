/**
 * Core Models - Barrel Export
 */

// Bluesound types (exclude formatDuration to avoid conflict with qobuz.models)
export type {
  BluesoundPlayer,
  PlaybackStatus,
  PlaybackState,
  PlayerGroup,
  QueueItem
} from './bluesound.models';

// Bluesound functions
export {
  isPlaying,
  isPaused,
  isStopped,
  getDisplayState,
  getDisplayStatus,
  getProgressPercent
} from './bluesound.models';

// Qobuz models (all exports including formatDuration)
export * from './qobuz.models';

// History models
export * from './history.models';

// TuneIn models
export * from './tunein.models';

// Radio Paradise models
export * from './radioparadise.models';
