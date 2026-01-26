/**
 * Qobuz API Models
 * Converted from C# QobuzModels.cs
 */

// ==================== User & Auth ====================

/**
 * Qobuz user profile
 */
export interface QobuzUser {
  id: number;
  publicId?: string;
  email?: string;
  login?: string;
  firstname?: string;
  lastname?: string;
  display_name?: string;
  country_code?: string;
  language_code?: string;
  avatar?: string;
  credential?: QobuzCredential;
  subscription?: QobuzSubscription;
}

/**
 * Qobuz user credential/subscription type
 */
export interface QobuzCredential {
  id?: number;
  label?: string;
  description?: string;
}

/**
 * Qobuz subscription info
 */
export interface QobuzSubscription {
  offer?: string;
  end_date?: string;
  is_canceled?: boolean;
}

/**
 * Login response from Qobuz API
 */
export interface QobuzLoginResponse {
  user?: QobuzUser;
  user_auth_token?: string;
}

/**
 * App credentials extracted from Qobuz web player
 */
export interface QobuzAppCredentials {
  appId: string;
  appSecret: string;
  alternativeSecrets?: string[];
}

// ==================== Artist ====================

/**
 * Qobuz artist
 */
export interface QobuzArtist {
  id: number;
  name?: string;
  image?: QobuzImage;
}

/**
 * Extended artist info for favorites
 */
export interface QobuzFavoriteArtist {
  id: number;
  name?: string;
  picture?: string;
  image?: QobuzImage;
  albums_count: number;
}

/**
 * Artist name with display format
 */
export interface QobuzArtistName {
  display?: string;
}

/**
 * Artist biography content
 */
export interface QobuzArtistBiography {
  content?: string;
  language?: string;
  source?: string;
}

/**
 * Artist images including portrait
 */
export interface QobuzArtistImages {
  portrait?: QobuzImageHash;
  small?: string;
  medium?: string;
  large?: string;
}

/**
 * Similar artist info
 */
export interface QobuzSimilarArtist {
  id: number;
  name?: string;
  picture?: string;
  image?: QobuzImage;
}

/**
 * Container for similar artists
 */
export interface QobuzSimilarArtistsContainer {
  items?: QobuzSimilarArtist[];
}

/**
 * Basic artist info from artist/get endpoint
 */
export interface QobuzArtistBasicInfo {
  id: number;
  name?: string;
  picture?: string;
  image?: QobuzImage;
}

/**
 * Response from artist/page endpoint
 */
export interface QobuzArtistPageResponse {
  id: number;
  name?: QobuzArtistName;
  artist_category?: string;
  biography?: QobuzArtistBiography;
  images?: QobuzArtistImages;
  picture?: string;
  image?: QobuzImage;
  similar_artists?: QobuzSimilarArtistsContainer;
  top_tracks?: QobuzTrack[];
  last_release?: QobuzAlbum;
  releases?: QobuzReleaseCategory[];
  tracks_appears_on?: QobuzTrack[];
}

// ==================== Images ====================

/**
 * Qobuz image with multiple sizes
 */
export interface QobuzImage {
  small?: string;
  thumbnail?: string;
  medium?: string;
  large?: string;
  extralarge?: string;
  mega?: string;
}

/**
 * Image with hash and format for building URLs
 */
export interface QobuzImageHash {
  hash?: string;
  format?: string;
  url?: string;
}

// ==================== Album ====================

/**
 * Qobuz album
 */
export interface QobuzAlbum {
  id?: string;
  title?: string;
  artist?: QobuzArtist;
  image?: QobuzImage;
  duration: number;
  tracks_count: number;
  released_at?: number;
  product_type?: string;
  maximum_bit_depth?: number;
  maximum_sampling_rate?: number;
  release_type?: string;
  isHiRes?: boolean;
  hires?: boolean;
  hires_streamable?: boolean;
}

/**
 * Full album response with tracks
 */
export interface QobuzAlbumWithTracks extends QobuzAlbum {
  tracks?: QobuzTracksContainer;
  label?: QobuzLabel;
  genre?: QobuzGenre;
  description?: string;
  hires?: boolean;
  hires_streamable?: boolean;
}

/**
 * Container for albums
 */
export interface QobuzAlbumsContainer {
  items?: QobuzAlbum[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Category of releases (albums, singles, live, etc.)
 */
export interface QobuzReleaseCategory {
  type?: string;
  has_more: boolean;
  items?: QobuzAlbum[];
}

// ==================== Track ====================

/**
 * Qobuz track
 */
export interface QobuzTrack {
  id: number;
  title?: string;
  version?: string;
  duration: number;
  track_number: number;
  media_number: number;
  performer?: QobuzArtist;
  album?: QobuzAlbum;
  hires?: boolean;
  hires_streamable?: boolean;
  streamable?: boolean;
  maximum_bit_depth?: number;
  maximum_sampling_rate?: number;
}

/**
 * Container for tracks
 */
export interface QobuzTracksContainer {
  items?: QobuzTrack[];
  total: number;
  offset: number;
  limit: number;
}

// ==================== Playlist ====================

/**
 * Playlist owner info
 */
export interface QobuzPlaylistOwner {
  id: number;
  name?: string;
}

/**
 * Qobuz playlist
 */
export interface QobuzPlaylist {
  id: number;
  name?: string;
  description?: string;
  tracks_count: number;
  duration: number;
  is_public: boolean;
  is_collaborative: boolean;
  created_at?: number;
  updated_at?: number;
  owner?: QobuzPlaylistOwner;
  images?: string[];
  images150?: string[];
  images300?: string[];
  image_rectangle?: string[];
}

/**
 * Full playlist response with tracks
 */
export interface QobuzPlaylistWithTracks extends QobuzPlaylist {
  tracks?: QobuzTracksContainer;
}

/**
 * Container for playlists
 */
export interface QobuzPlaylistsContainer {
  items?: QobuzPlaylist[];
  total: number;
  offset: number;
  limit: number;
}

// ==================== Genre & Label ====================

/**
 * Qobuz label info
 */
export interface QobuzLabel {
  id: number;
  name?: string;
}

/**
 * Qobuz genre info
 */
export interface QobuzGenre {
  id: number;
  name?: string;
  slug?: string;
}

// ==================== Search ====================

/**
 * Search response from Qobuz API
 */
export interface QobuzSearchResponse {
  albums?: QobuzAlbumsContainer;
  artists?: QobuzArtistsContainer;
  playlists?: QobuzPlaylistsContainer;
  tracks?: QobuzTracksContainer;
}

/**
 * Combined search result
 */
export interface QobuzSearchResult {
  albums: QobuzAlbum[];
  artists: QobuzFavoriteArtist[];
  playlists: QobuzPlaylist[];
  tracks: QobuzTrack[];
}

// ==================== API Responses ====================

/**
 * Root response for getUserPlaylists
 */
export interface QobuzPlaylistsResponse {
  playlists?: QobuzPlaylistsContainer;
}

/**
 * Response for featured albums endpoint
 */
export interface QobuzFeaturedAlbumsResponse {
  albums?: QobuzAlbumsContainer;
}

/**
 * Response for featured playlists endpoint
 */
export interface QobuzFeaturedPlaylistsResponse {
  playlists?: QobuzPlaylistsContainer;
}

/**
 * Response from userRecommendation/get endpoint
 */
export interface QobuzRecommendationsResponse {
  albums?: QobuzAlbumsContainer;
  playlists?: QobuzPlaylistsContainer;
  tracks?: QobuzTracksContainer;
}

/**
 * Response from favorite/getUserFavorites?type=albums
 */
export interface QobuzFavoriteAlbumsResponse {
  albums?: QobuzAlbumsContainer;
}

/**
 * Response from favorite/getUserFavorites?type=tracks
 */
export interface QobuzFavoriteTracksResponse {
  tracks?: QobuzTracksContainer;
}

/**
 * Container for favorite artists
 */
export interface QobuzArtistsContainer {
  items?: QobuzFavoriteArtist[];
  total: number;
  offset: number;
  limit: number;
}

/**
 * Response from favorite/getUserFavorites?type=artists
 */
export interface QobuzFavoriteArtistsResponse {
  artists?: QobuzArtistsContainer;
}

// ==================== Helper Functions ====================

/**
 * Get the best available image URL from QobuzImage
 */
export function getBestImageUrl(image?: QobuzImage): string | undefined {
  if (!image) return undefined;
  return image.large ?? image.extralarge ?? image.mega ?? image.medium ?? image.small ?? image.thumbnail;
}

/**
 * Get the best available cover URL for an album
 */
export function getAlbumCoverUrl(album?: QobuzAlbum): string | undefined {
  if (!album?.image) return undefined;
  return album.image.large ?? album.image.small ?? album.image.thumbnail;
}

/**
 * Get the best available cover URL for a playlist
 */
export function getPlaylistCoverUrl(playlist?: QobuzPlaylist): string | undefined {
  if (!playlist) return undefined;
  return playlist.images300?.[0] ??
    playlist.images150?.[0] ??
    playlist.images?.[0] ??
    playlist.image_rectangle?.[0];
}

/**
 * Get image URL from hash
 */
export function getImageUrlFromHash(hash?: QobuzImageHash, size = 600): string | undefined {
  if (hash?.url) return hash.url;
  if (!hash?.hash) return undefined;
  const format = hash.format ?? 'jpg';
  return `https://static.qobuz.com/images/covers/${hash.hash}_${size}.${format}`;
}

/**
 * Get best artist image URL from artist page response
 */
export function getArtistImageUrl(artist: QobuzArtistPageResponse): string | undefined {
  if (artist.picture) return artist.picture;
  if (artist.image) return getBestImageUrl(artist.image);
  return getImageUrlFromHash(artist.images?.portrait);
}

/**
 * Get favorite artist image URL
 */
export function getFavoriteArtistImageUrl(artist: QobuzFavoriteArtist): string | undefined {
  return artist.picture ?? getBestImageUrl(artist.image);
}

/**
 * Get similar artist image URL
 */
export function getSimilarArtistImageUrl(artist: QobuzSimilarArtist): string | undefined {
  return artist.picture ?? getBestImageUrl(artist.image);
}

/**
 * Format duration in seconds to mm:ss or h:mm:ss
 */
export function formatDuration(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours >= 1) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Determine if album is a single (1-3 tracks)
 */
export function isAlbumSingle(album: QobuzAlbum): boolean {
  return album.product_type?.toLowerCase() === 'single' ||
    (album.tracks_count <= 3 && album.duration < 1200);
}

/**
 * Get album type label
 */
export function getAlbumTypeLabel(album: QobuzAlbum): string {
  if (album.product_type?.toLowerCase() === 'single' || album.tracks_count === 1) {
    return 'Single';
  }
  if (album.product_type?.toLowerCase() === 'ep' ||
    (album.tracks_count >= 2 && album.tracks_count <= 6 && album.duration < 1800)) {
    return 'EP';
  }
  return 'Album';
}

/**
 * Get track quality label (e.g., "24-Bit / 96kHz")
 */
export function getTrackQualityLabel(track: QobuzTrack): string | undefined {
  if (track.maximum_bit_depth && track.maximum_sampling_rate && track.maximum_bit_depth > 16) {
    return `${track.maximum_bit_depth}-Bit / ${track.maximum_sampling_rate}kHz`;
  }
  return undefined;
}

// ==================== Backend Response Interfaces ====================

/**
 * Artist info as returned by backend (flattened structure)
 */
export interface BackendArtistInfo {
  id: number;
  name?: string;
  category?: string;
  biography?: string;
  biographySource?: string;
  portraitUrl?: string;
}

/**
 * Track as returned by backend artist page
 */
export interface BackendArtistTrack {
  id: number;
  title?: string;
  duration: number;
  formattedDuration?: string;
  artistName?: string;
  artistId?: number;
  albumTitle?: string;
  albumId?: string;
  coverUrl?: string;
  isHiRes?: boolean;
  isStreamable?: boolean;
}

/**
 * Album as returned by backend artist releases
 */
export interface BackendReleaseAlbum {
  id?: string;
  title?: string;
  artistName?: string;
  coverUrl?: string;
  releasedAt?: number;
  tracksCount?: number;
  typeLabel?: string;
}

/**
 * Release category as returned by backend
 */
export interface BackendReleaseCategory {
  type?: string;
  hasMore: boolean;
  items?: BackendReleaseAlbum[];
}

/**
 * Similar artist as returned by backend
 */
export interface BackendSimilarArtist {
  id: number;
  name?: string;
  imageUrl?: string;
}

/**
 * Appears on track as returned by backend
 */
export interface BackendAppearsOnTrack {
  id: number;
  title?: string;
  albumTitle?: string;
  albumId?: string;
  coverUrl?: string;
  artistName?: string;
  artistId?: number;
}

/**
 * Full artist page response from backend
 */
export interface BackendArtistPageResponse {
  success: boolean;
  artist?: BackendArtistInfo;
  topTracks?: BackendArtistTrack[];
  releases?: BackendReleaseCategory[];
  similarArtists?: BackendSimilarArtist[];
  appearsOn?: BackendAppearsOnTrack[];
}

/**
 * Backend discography response
 */
export interface BackendDiscographyResponse {
  success: boolean;
  hasMore: boolean;
  offset: number;
  albums?: BackendReleaseAlbum[];
}
