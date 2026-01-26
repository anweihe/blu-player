/**
 * Radio Paradise Models
 */

/**
 * Radio Paradise channel item
 */
export interface RadioParadiseItem {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  type: string;
  actionUri?: string;
  actionUrl?: string;
  actionType: string;
  isPlayable: boolean;
  isBrowsable: boolean;
}

/**
 * Radio Paradise section (e.g., MQA, CD Quality)
 */
export interface RadioParadiseSection {
  title?: string;
  items: RadioParadiseItem[];
}

/**
 * Radio Paradise menu response
 */
export interface RadioParadiseMenuResponse {
  success: boolean;
  sections: RadioParadiseSection[];
  hasMultipleSections: boolean;
  error?: string;
}

/**
 * Play channel request
 */
export interface PlayRadioParadiseRequest {
  ip: string;
  port: number;
  playUrl: string;
  title?: string;
  imageUrl?: string;
}
