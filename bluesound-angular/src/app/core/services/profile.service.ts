import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';

/**
 * Profile from backend API
 */
export interface Profile {
  id: string;
  name: string;
  createdAt: string;
  qobuz?: QobuzCredentials;
  settings?: ProfileSettings;
}

export interface QobuzCredentials {
  userId: number;
  authToken: string;
  displayName?: string;
  avatar?: string;
}

export interface ProfileSettings {
  streamingQualityFormatId: number;
  selectedPlayerType?: string;
  selectedPlayerName?: string;
  selectedPlayerIp?: string;
  selectedPlayerPort?: number;
  selectedPlayerModel?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const STORAGE_KEYS = {
  ACTIVE_PROFILE_ID: 'bluesound_active_profile_id'
} as const;

/**
 * Service for managing user profiles
 * Interacts with backend /Api/Settings endpoints
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = '/Api/Settings';

  // ==================== State ====================
  /**
   * All profiles loaded from backend
   */
  readonly profiles = signal<Profile[]>([]);

  /**
   * Currently active profile ID (stored in localStorage per device)
   */
  readonly activeProfileId = signal<string | null>(null);

  /**
   * Loading state
   */
  readonly isLoading = signal(false);

  /**
   * Error message
   */
  readonly error = signal<string | null>(null);

  // ==================== Computed ====================
  /**
   * Currently active profile
   */
  readonly activeProfile = computed<Profile | null>(() => {
    const id = this.activeProfileId();
    const profiles = this.profiles();
    return profiles.find(p => p.id === id) ?? profiles[0] ?? null;
  });

  /**
   * Whether current profile has Qobuz connected
   */
  readonly hasQobuzConnected = computed(() => {
    const profile = this.activeProfile();
    return !!profile?.qobuz?.authToken;
  });

  constructor() {
    this.loadActiveProfileIdFromStorage();
  }

  // ==================== Public Methods ====================

  /**
   * Load all profiles from backend
   */
  loadProfiles(): Observable<Profile[]> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http.get<ApiResponse<Profile[]>>(`${this.apiBaseUrl}?handler=profiles`).pipe(
      map(response => {
        if (response.success && response.data) {
          this.profiles.set(response.data);

          // If no active profile set and profiles exist, use first one
          if (!this.activeProfileId() && response.data.length > 0) {
            this.setActiveProfileId(response.data[0].id);
          }

          return response.data;
        }
        throw new Error(response.error ?? 'Failed to load profiles');
      }),
      catchError(error => {
        console.error('Failed to load profiles:', error);
        this.error.set('Profile konnten nicht geladen werden');
        return of([]);
      }),
      tap(() => this.isLoading.set(false))
    );
  }

  /**
   * Create a new profile
   */
  createProfile(name: string): Observable<Profile | null> {
    return this.http.post<ApiResponse<Profile>>(`${this.apiBaseUrl}?handler=profile`, { name }).pipe(
      map(response => {
        if (response.success && response.data) {
          this.profiles.update(profiles => [...profiles, response.data!]);
          return response.data;
        }
        throw new Error(response.error ?? 'Failed to create profile');
      }),
      catchError(error => {
        console.error('Failed to create profile:', error);
        this.error.set('Profil konnte nicht erstellt werden');
        return of(null);
      })
    );
  }

  /**
   * Delete a profile
   */
  deleteProfile(id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<void>>(`${this.apiBaseUrl}?handler=profile&id=${id}`).pipe(
      map(response => {
        if (response.success) {
          this.profiles.update(profiles => profiles.filter(p => p.id !== id));

          // If deleted active profile, switch to first available
          if (this.activeProfileId() === id) {
            const remaining = this.profiles();
            if (remaining.length > 0) {
              this.setActiveProfileId(remaining[0].id);
            } else {
              this.activeProfileId.set(null);
            }
          }

          return true;
        }
        throw new Error(response.error ?? 'Failed to delete profile');
      }),
      catchError(error => {
        console.error('Failed to delete profile:', error);
        this.error.set('Profil konnte nicht gelöscht werden');
        return of(false);
      })
    );
  }

  /**
   * Update Qobuz credentials for a profile
   */
  updateQobuzCredentials(profileId: string, credentials: QobuzCredentials): Observable<Profile | null> {
    return this.http.put<ApiResponse<Profile>>(
      `${this.apiBaseUrl}?handler=qobuz&id=${profileId}`,
      credentials
    ).pipe(
      map(response => {
        if (response.success && response.data) {
          this.profiles.update(profiles =>
            profiles.map(p => p.id === profileId ? response.data! : p)
          );
          return response.data;
        }
        throw new Error(response.error ?? 'Failed to update Qobuz credentials');
      }),
      catchError(error => {
        console.error('Failed to update Qobuz credentials:', error);
        this.error.set('Qobuz-Daten konnten nicht gespeichert werden');
        return of(null);
      })
    );
  }

  /**
   * Delete Qobuz credentials for a profile (logout from Qobuz)
   */
  deleteQobuzCredentials(profileId: string): Observable<boolean> {
    return this.http.delete<ApiResponse<void>>(`${this.apiBaseUrl}?handler=qobuz&id=${profileId}`).pipe(
      map(response => {
        if (response.success) {
          this.profiles.update(profiles =>
            profiles.map(p => p.id === profileId ? { ...p, qobuz: undefined } : p)
          );
          return true;
        }
        throw new Error(response.error ?? 'Failed to delete Qobuz credentials');
      }),
      catchError(error => {
        console.error('Failed to delete Qobuz credentials:', error);
        return of(false);
      })
    );
  }

  /**
   * Set the active profile ID (stored in localStorage)
   */
  setActiveProfileId(id: string): void {
    this.activeProfileId.set(id);
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE_ID, id);
    } catch {
      // Storage not available
    }
  }

  /**
   * Get profile color based on ID hash
   */
  getProfileColor(id: string): string {
    // Generate consistent hue from ID
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 65%, 45%)`;
  }

  /**
   * Get profile initial from name
   */
  getProfileInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : 'P';
  }

  /**
   * Ensure at least one profile exists (creates default if none)
   */
  ensureDefaultProfile(): Observable<Profile | null> {
    const profiles = this.profiles();
    if (profiles.length === 0) {
      return this.createProfile('Standard');
    }
    return of(profiles[0]);
  }

  // ==================== Private Methods ====================

  private loadActiveProfileIdFromStorage(): void {
    try {
      const id = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE_ID);
      if (id) {
        this.activeProfileId.set(id);
      }
    } catch {
      // Storage not available
    }
  }
}
