import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

/**
 * Request DTO for rating lookup
 */
export interface AlbumRatingRequest {
  albumId: string;
  artist: string;
  title: string;
}

/**
 * Response DTO for ratings
 */
export interface AlbumRating {
  albumId: string;
  userScore: number | null;
  criticsScore: number | null;
}

/**
 * API response wrapper
 */
interface RatingsApiResponse {
  success: boolean;
  data?: AlbumRating[];
  error?: string;
}

/**
 * Service for fetching and caching album ratings
 *
 * Features:
 * - Session-based cache (Map)
 * - 300ms debounce for batch requests
 * - Automatic deduplication
 * - Signal-based reactive updates
 */
@Injectable({
  providedIn: 'root'
})
export class AlbumRatingService {
  private readonly API_URL = '/Api/Ratings';
  private readonly DEBOUNCE_MS = 300;

  // Session cache: albumId -> rating
  private readonly cache = new Map<string, AlbumRating>();

  // Signal to trigger reactive updates in components
  private readonly _ratingsUpdated = signal(0);
  readonly ratingsUpdated = this._ratingsUpdated.asReadonly();

  // Pending requests for batching
  private pendingRequests: AlbumRatingRequest[] = [];
  private readonly requestSubject = new Subject<void>();

  // Track in-flight requests to avoid duplicates
  private inFlightIds = new Set<string>();

  constructor(private readonly http: HttpClient) {
    // Setup debounced batch processing
    this.requestSubject.pipe(
      debounceTime(this.DEBOUNCE_MS)
    ).subscribe(() => this.processBatch());
  }

  /**
   * Queue albums for rating fetch with debouncing
   * Call this after loading albums to fetch their ratings
   */
  fetchRatings(albums: AlbumRatingRequest[]): void {
    if (!albums || albums.length === 0) return;

    // Filter out already cached and in-flight requests
    const newRequests = albums.filter(album => {
      const id = album.albumId;
      return id && !this.cache.has(id) && !this.inFlightIds.has(id);
    });

    if (newRequests.length === 0) return;

    // Mark as in-flight
    newRequests.forEach(r => this.inFlightIds.add(r.albumId));

    // Add to pending batch
    this.pendingRequests.push(...newRequests);

    // Trigger debounced processing
    this.requestSubject.next();
  }

  /**
   * Get rating from cache for a specific album
   * Returns undefined if not cached yet
   */
  getRating(albumId: string): AlbumRating | undefined {
    return this.cache.get(albumId);
  }

  /**
   * Check if a rating exists in cache
   */
  hasRating(albumId: string): boolean {
    return this.cache.has(albumId);
  }

  /**
   * Process the pending batch of requests
   */
  private processBatch(): void {
    if (this.pendingRequests.length === 0) return;

    // Take and clear pending requests
    const requests = [...this.pendingRequests];
    this.pendingRequests = [];

    // Deduplicate by albumId
    const uniqueRequests = this.deduplicateRequests(requests);

    if (uniqueRequests.length === 0) return;

    // Make API request
    this.http.post<RatingsApiResponse>(this.API_URL, {
      albums: uniqueRequests
    }).subscribe({
      next: response => {
        if (response.success && response.data) {
          // Update cache
          response.data.forEach(rating => {
            this.cache.set(rating.albumId, rating);
            this.inFlightIds.delete(rating.albumId);
          });

          // Also mark albums without ratings as "no rating available"
          uniqueRequests.forEach(req => {
            if (!this.cache.has(req.albumId)) {
              this.cache.set(req.albumId, {
                albumId: req.albumId,
                userScore: null,
                criticsScore: null
              });
            }
            this.inFlightIds.delete(req.albumId);
          });

          // Trigger reactive updates
          this._ratingsUpdated.update(v => v + 1);
        } else {
          // Clear in-flight on error
          uniqueRequests.forEach(req => this.inFlightIds.delete(req.albumId));
        }
      },
      error: () => {
        // Clear in-flight on error
        uniqueRequests.forEach(req => this.inFlightIds.delete(req.albumId));
      }
    });
  }

  /**
   * Remove duplicate album IDs from requests
   */
  private deduplicateRequests(requests: AlbumRatingRequest[]): AlbumRatingRequest[] {
    const seen = new Set<string>();
    return requests.filter(req => {
      if (seen.has(req.albumId)) return false;
      seen.add(req.albumId);
      return true;
    });
  }

  /**
   * Clear the cache (useful for testing or logout)
   */
  clearCache(): void {
    this.cache.clear();
    this.inFlightIds.clear();
    this.pendingRequests = [];
    this._ratingsUpdated.update(v => v + 1);
  }
}
