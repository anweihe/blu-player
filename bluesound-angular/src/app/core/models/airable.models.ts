export interface AirableItem {
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

export interface AirableSection {
  title?: string;
  viewAllUri?: string;
  items: AirableItem[];
}

export interface AirableSelectorItem {
  text: string;
  uri: string;
  selected: boolean;
}

export interface AirableSelectorMenu {
  title: string;
  items: AirableSelectorItem[];
}

export interface AirableBrowseResponse {
  success: boolean;
  title?: string;
  items: AirableItem[];
  sections: AirableSection[];
  hasMultipleSections: boolean;
  selectorMenu?: AirableSelectorMenu;
  nextLink?: string;
  error?: string;
}

export interface AirableMenuResponse {
  success: boolean;
  items: AirableItem[];
  error?: string;
}

export interface PlayAirableStationRequest {
  ip: string;
  port: number;
  playUrl: string;
  title?: string;
  imageUrl?: string;
}

export interface AirableNavigationState {
  uri: string;
  title: string;
}
