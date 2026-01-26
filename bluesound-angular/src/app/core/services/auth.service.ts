import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { QobuzUser, QobuzLoginResponse, QobuzAppCredentials } from '../models';

const STORAGE_KEYS = {
  USER_ID: 'qobuz_user_id',
  AUTH_TOKEN: 'qobuz_auth_token',
  USER_DATA: 'qobuz_user_data'
} as const;

/**
 * Profile for multi-user support
 */
export interface UserProfile {
  id: string;
  name: string;
  userId: number;
  authToken: string;
  userData?: QobuzUser;
  lastUsed: number;
}

/**
 * Authentication service for Qobuz
 * Handles login, logout, token management, and multi-profile support
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = '/api/qobuz'; // REST API

  // ==================== State ====================
  /**
   * Is user logged in
   */
  readonly isLoggedIn = signal(false);

  /**
   * Current auth token
   */
  readonly authToken = signal<string | null>(null);

  /**
   * Current user ID
   */
  readonly userId = signal<number | null>(null);

  /**
   * Current user data
   */
  readonly user = signal<QobuzUser | null>(null);

  /**
   * All saved profiles
   */
  readonly profiles = signal<UserProfile[]>([]);

  /**
   * Current active profile ID
   */
  readonly activeProfileId = signal<string | null>(null);

  /**
   * Is currently authenticating
   */
  readonly isAuthenticating = signal(false);

  /**
   * Auth error message
   */
  readonly authError = signal<string | null>(null);

  // ==================== Computed ====================
  /**
   * Current user display name
   */
  readonly displayName = computed(() => {
    const userData = this.user();
    if (!userData) return null;
    return userData.display_name ?? userData.login ?? userData.email;
  });

  /**
   * Current user initial for avatar
   */
  readonly userInitial = computed(() => {
    const name = this.displayName();
    return name ? name.charAt(0).toUpperCase() : 'Q';
  });

  /**
   * Subscription label
   */
  readonly subscriptionLabel = computed(() => {
    const userData = this.user();
    return userData?.credential?.label ?? 'Free';
  });

  constructor() {
    this.loadFromStorage();
  }

  // ==================== Public Methods ====================

  /**
   * Login with email and password
   */
  login(email: string, password: string): Observable<boolean> {
    this.isAuthenticating.set(true);
    this.authError.set(null);

    return this.http.post<QobuzLoginResponse>(`${this.apiBaseUrl}/login`, {
      email,
      password
    }).pipe(
      tap(response => {
        if (response.user_auth_token && response.user) {
          this.setAuthState(response.user, response.user_auth_token);
          this.saveProfile(response.user, response.user_auth_token);
        }
      }),
      map(response => !!response.user_auth_token),
      catchError(error => {
        console.error('Login failed:', error);
        this.authError.set(error.error?.message ?? 'Login fehlgeschlagen');
        return of(false);
      }),
      tap(() => this.isAuthenticating.set(false))
    );
  }

  /**
   * Verify existing token
   */
  verifyToken(): Observable<boolean> {
    const token = this.authToken();
    const id = this.userId();

    if (!token || !id) {
      return of(false);
    }

    return this.http.get<QobuzUser>(`${this.apiBaseUrl}/user`, {
      headers: { 'X-Auth-Token': token, 'X-User-Id': id.toString() }
    }).pipe(
      tap(user => {
        if (user) {
          this.user.set(user);
          this.isLoggedIn.set(true);
        }
      }),
      map(user => !!user),
      catchError(() => {
        this.logout();
        return of(false);
      })
    );
  }

  /**
   * Logout current user
   */
  logout(): void {
    this.authToken.set(null);
    this.userId.set(null);
    this.user.set(null);
    this.isLoggedIn.set(false);
    this.clearStorage();
  }

  /**
   * Switch to a different profile
   */
  switchProfile(profileId: string): void {
    const profiles = this.profiles();
    const profile = profiles.find(p => p.id === profileId);

    if (profile) {
      this.setAuthState(
        profile.userData ?? { id: profile.userId } as QobuzUser,
        profile.authToken
      );
      this.activeProfileId.set(profileId);
      this.updateProfileLastUsed(profileId);
    }
  }

  /**
   * Delete a profile
   */
  deleteProfile(profileId: string): void {
    this.profiles.update(profiles =>
      profiles.filter(p => p.id !== profileId)
    );
    this.saveProfilesToStorage();

    // If deleted active profile, logout
    if (this.activeProfileId() === profileId) {
      this.logout();
    }
  }

  /**
   * Get auth headers for API calls
   */
  getAuthHeaders(): Record<string, string> {
    const token = this.authToken();
    const id = this.userId();

    if (!token || !id) {
      return {};
    }

    return {
      'X-Auth-Token': token,
      'X-User-Id': id.toString()
    };
  }

  /**
   * Get current profile ID for history tracking
   */
  getProfileId(): string | null {
    return this.activeProfileId() ?? (this.userId() ? `profile_${this.userId()}` : null);
  }

  // ==================== Private Methods ====================

  private setAuthState(user: QobuzUser, token: string): void {
    this.user.set(user);
    this.userId.set(user.id);
    this.authToken.set(token);
    this.isLoggedIn.set(true);
    this.saveToStorage(user, token);
  }

  private loadFromStorage(): void {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
      const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
      const profilesJson = localStorage.getItem('qobuz_profiles');

      if (token && userId) {
        this.authToken.set(token);
        this.userId.set(parseInt(userId, 10));

        if (userData) {
          try {
            this.user.set(JSON.parse(userData));
          } catch {
            // Invalid JSON, ignore
          }
        }
      }

      if (profilesJson) {
        try {
          this.profiles.set(JSON.parse(profilesJson));
        } catch {
          // Invalid JSON, ignore
        }
      }
    } catch {
      // Storage not available
    }
  }

  private saveToStorage(user: QobuzUser, token: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      localStorage.setItem(STORAGE_KEYS.USER_ID, user.id.toString());
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    } catch {
      // Storage not available
    }
  }

  private clearStorage(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER_ID);
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    } catch {
      // Storage not available
    }
  }

  private saveProfile(user: QobuzUser, token: string): void {
    const profileId = `profile_${user.id}`;
    const profile: UserProfile = {
      id: profileId,
      name: user.display_name ?? user.login ?? user.email ?? 'User',
      userId: user.id,
      authToken: token,
      userData: user,
      lastUsed: Date.now()
    };

    this.profiles.update(profiles => {
      const existing = profiles.findIndex(p => p.userId === user.id);
      if (existing >= 0) {
        const updated = [...profiles];
        updated[existing] = profile;
        return updated;
      }
      return [...profiles, profile];
    });

    this.activeProfileId.set(profileId);
    this.saveProfilesToStorage();
  }

  private updateProfileLastUsed(profileId: string): void {
    this.profiles.update(profiles =>
      profiles.map(p =>
        p.id === profileId ? { ...p, lastUsed: Date.now() } : p
      )
    );
    this.saveProfilesToStorage();
  }

  private saveProfilesToStorage(): void {
    try {
      localStorage.setItem('qobuz_profiles', JSON.stringify(this.profiles()));
    } catch {
      // Storage not available
    }
  }
}
