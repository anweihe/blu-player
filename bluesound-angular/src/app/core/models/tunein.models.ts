/**
 * TuneIn Radio Models
 */

/**
 * TuneIn browse/menu item
 */
export interface TuneInItem {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  type: string;
  actionUri?: string;
  actionUrl?: string;
  actionType: 'browse' | 'player-link';
  isPlayable: boolean;
  isBrowsable: boolean;
}

/**
 * TuneIn section (list) in browse response
 */
export interface TuneInSection {
  title?: string;
  viewAllUri?: string;
  items: TuneInItem[];
}

/**
 * TuneIn browse response
 */
export interface TuneInBrowseResponse {
  success: boolean;
  title?: string;
  items: TuneInItem[];
  sections: TuneInSection[];
  hasMultipleSections: boolean;
  error?: string;
}

/**
 * TuneIn menu response
 */
export interface TuneInMenuResponse {
  success: boolean;
  items: TuneInItem[];
  error?: string;
}

/**
 * Play station request
 */
export interface PlayTuneInStationRequest {
  ip: string;
  port: number;
  playUrl: string;
  title?: string;
  imageUrl?: string;
}

/**
 * Navigation state for breadcrumb
 */
export interface TuneInNavigationState {
  uri: string;
  title: string;
}
