import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap, switchMap } from 'rxjs';
import { QobuzUser, QobuzLoginResponse, QobuzAppCredentials } from '../models';
import { ProfileService, QobuzCredentials } from './profile.service';

const STORAGE_KEYS = {
  USER_ID: 'qobuz_user_id',
  AUTH_TOKEN: 'qobuz_auth_token',
  USER_DATA: 'qobuz_user_data'
} as const;

/**
 * Authentication service for Qobuz
 * Handles login, logout, token management, and profile integration
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly profileService = inject(ProfileService);
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
   * Also saves credentials to the active profile
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
        }
      }),
      switchMap(response => {
        if (response.user_auth_token && response.user) {
          // Save credentials to active profile
          return this.saveCredentialsToProfile(response.user, response.user_auth_token).pipe(
            map(() => true)
          );
        }
        return of(false);
      }),
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
   * Load credentials from profile (when switching profiles)
   */
  loadFromProfileCredentials(credentials: QobuzCredentials): void {
    this.authToken.set(credentials.authToken);
    this.userId.set(credentials.userId);
    this.isLoggedIn.set(true);

    // Create minimal user data from credentials
    const userData: Partial<QobuzUser> = {
      id: credentials.userId,
      display_name: credentials.displayName
    };
    this.user.set(userData as QobuzUser);

    // Save to localStorage for persistence
    this.saveToStorage(userData as QobuzUser, credentials.authToken);

    // Verify token and get full user data
    this.verifyToken().subscribe();
  }

  /**
   * Logout current user (only from Qobuz, profile remains)
   */
  logout(): void {
    this.authToken.set(null);
    this.userId.set(null);
    this.user.set(null);
    this.isLoggedIn.set(false);
    this.clearStorage();
  }

  /**
   * Logout and also clear credentials from profile
   */
  logoutAndClearProfile(): Observable<boolean> {
    const profileId = this.profileService.activeProfileId();
    this.logout();

    if (profileId) {
      return this.profileService.deleteQobuzCredentials(profileId);
    }
    return of(true);
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
    return this.profileService.activeProfileId() ?? (this.userId() ? `profile_${this.userId()}` : null);
  }

  // ==================== Private Methods ====================

  private setAuthState(user: QobuzUser, token: string): void {
    this.user.set(user);
    this.userId.set(user.id);
    this.authToken.set(token);
    this.isLoggedIn.set(true);
    this.saveToStorage(user, token);
  }

  /**
   * Save Qobuz credentials to the active profile via backend
   */
  private saveCredentialsToProfile(user: QobuzUser, token: string): Observable<any> {
    const profileId = this.profileService.activeProfileId();
    if (!profileId) {
      console.warn('No active profile to save credentials to');
      return of(null);
    }

    const credentials: QobuzCredentials = {
      userId: user.id,
      authToken: token,
      displayName: user.display_name ?? user.login ?? user.email,
      avatar: user.avatar
    };

    return this.profileService.updateQobuzCredentials(profileId, credentials);
  }

  private loadFromStorage(): void {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const userId = localStorage.getItem(STORAGE_KEYS.USER_ID);
      const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);

      if (token && userId) {
        this.authToken.set(token);
        this.userId.set(parseInt(userId, 10));
        this.isLoggedIn.set(true);

        if (userData) {
          try {
            this.user.set(JSON.parse(userData));
          } catch {
            // Invalid JSON, ignore
          }
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
}
