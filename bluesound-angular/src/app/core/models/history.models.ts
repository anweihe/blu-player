/**
 * Listening History Models
 */

/**
 * TuneIn history item
 */
export interface TuneInHistoryItem {
  id: string;
  title: string;
  imageUrl?: string;
  actionUrl: string;
  type: 'tunein';
}

/**
 * Radio Paradise history item
 */
export interface RadioParadiseHistoryItem {
  id: string;
  title: string;
  imageUrl?: string;
  actionUrl: string;
  quality?: string;
  type: 'radioparadise';
}

/**
 * Qobuz album history item
 */
export interface QobuzAlbumHistoryItem {
  id: string;
  albumId: string;
  albumName: string;
  artist: string;
  coverUrl?: string;
  type: 'album';
}

/**
 * Qobuz playlist history item
 */
export interface QobuzPlaylistHistoryItem {
  id: string;
  playlistId: number;
  playlistName: string;
  coverUrl?: string;
  type: 'playlist';
}

/**
 * Combined listening history response
 */
export interface ListeningHistoryResponse {
  success: boolean;
  tuneIn: TuneInHistoryItem[];
  radioParadise: RadioParadiseHistoryItem[];
  qobuzAlbums: QobuzAlbumHistoryItem[];
  qobuzPlaylists: QobuzPlaylistHistoryItem[];
}

/**
 * Generic history item for display
 */
export interface HistoryDisplayItem {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  type: 'tunein' | 'radioparadise' | 'album' | 'playlist';
  actionId?: string | number;
  actionUrl?: string;
}

/**
 * History section for grouped display
 */
export interface HistorySection {
  title: string;
  iconType: 'tunein' | 'radioparadise' | 'qobuz';
  items: HistoryDisplayItem[];
}
