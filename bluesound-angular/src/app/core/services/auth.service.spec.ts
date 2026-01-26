import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService, UserProfile } from './auth.service';
import { QobuzUser, QobuzLoginResponse } from '../models';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  const mockUser: QobuzUser = {
    id: 12345,
    login: 'testuser',
    email: 'test@example.com',
    display_name: 'Test User',
    credential: {
      id: 1,
      label: 'Studio Premier',
      description: 'Hi-Res Streaming'
    },
    zone: 'DE',
    language: 'de'
  };

  const mockLoginResponse: QobuzLoginResponse = {
    user: mockUser,
    user_auth_token: 'test-auth-token-123'
  };

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    jest.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Initial State', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should start with logged out state', () => {
      expect(service.isLoggedIn()).toBe(false);
      expect(service.authToken()).toBeNull();
      expect(service.userId()).toBeNull();
      expect(service.user()).toBeNull();
    });

    it('should have empty profiles initially', () => {
      expect(service.profiles()).toEqual([]);
    });

    it('should not be authenticating initially', () => {
      expect(service.isAuthenticating()).toBe(false);
    });
  });

  describe('login', () => {
    it('should login successfully and update state', (done) => {
      service.login('test@example.com', 'password123').subscribe(success => {
        expect(success).toBe(true);
        expect(service.isLoggedIn()).toBe(true);
        expect(service.authToken()).toBe('test-auth-token-123');
        expect(service.userId()).toBe(12345);
        expect(service.user()).toEqual(mockUser);
        done();
      });

      const req = httpMock.expectOne('/api/qobuz/login');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'test@example.com', password: 'password123' });
      req.flush(mockLoginResponse);
    });

    it('should set isAuthenticating during login', (done) => {
      expect(service.isAuthenticating()).toBe(false);

      const subscription = service.login('test@example.com', 'password').subscribe(() => {
        // After completion, should be false again
        expect(service.isAuthenticating()).toBe(false);
        done();
      });

      // During request, should be true
      expect(service.isAuthenticating()).toBe(true);

      const req = httpMock.expectOne('/api/qobuz/login');
      req.flush(mockLoginResponse);
    });

    it('should handle login failure', (done) => {
      service.login('test@example.com', 'wrongpassword').subscribe(success => {
        expect(success).toBe(false);
        expect(service.isLoggedIn()).toBe(false);
        expect(service.authError()).toBeTruthy();
        done();
      });

      const req = httpMock.expectOne('/api/qobuz/login');
      req.flush({ message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    });

    it('should save profile after successful login', (done) => {
      service.login('test@example.com', 'password123').subscribe(() => {
        const profiles = service.profiles();
        expect(profiles.length).toBe(1);
        expect(profiles[0].userId).toBe(12345);
        expect(profiles[0].authToken).toBe('test-auth-token-123');
        expect(profiles[0].name).toBe('Test User');
        done();
      });

      const req = httpMock.expectOne('/api/qobuz/login');
      req.flush(mockLoginResponse);
    });
  });

  describe('logout', () => {
    it('should clear all auth state on logout', (done) => {
      // First login
      service.login('test@example.com', 'password').subscribe(() => {
        expect(service.isLoggedIn()).toBe(true);

        // Then logout
        service.logout();

        expect(service.isLoggedIn()).toBe(false);
        expect(service.authToken()).toBeNull();
        expect(service.userId()).toBeNull();
        expect(service.user()).toBeNull();
        done();
      });

      const req = httpMock.expectOne('/api/qobuz/login');
      req.flush(mockLoginResponse);
    });

    it('should call removeItem on localStorage during logout', (done) => {
      service.login('test@example.com', 'password').subscribe(() => {
        // Clear any previous calls from login
        (localStorage.removeItem as jest.Mock).mockClear();

        service.logout();

        // Verify removeItem was called for auth data
        expect(localStorage.removeItem).toHaveBeenCalledWith('qobuz_auth_token');
        expect(localStorage.removeItem).toHaveBeenCalledWith('qobuz_user_id');
        expect(localStorage.removeItem).toHaveBeenCalledWith('qobuz_user_data');
        done();
      });

      const req = httpMock.expectOne('/api/qobuz/login');
      req.flush(mockLoginResponse);
    });
  });

  describe('computed properties', () => {
    it('should compute displayName from user data', (done) => {
      service.login('test@example.com', 'password').subscribe(() => {
        expect(service.displayName()).toBe('Test User');
        done();
      });

      const req = httpMock.expectOne('/api/qobuz/login');
      req.flush(mockLoginResponse);
    });

    it('should compute userInitial from displayName', (done) => {
      service.login('test@example.com', 'password').subscribe(() => {
        expect(service.userInitial()).toBe('T');
        done();
      });

      const req = httpMock.expectOne('/api/qobuz/login');
      req.flush(mockLoginResponse);
    });

    it('should return Q as default initial when not logged in', () => {
      expect(service.userInitial()).toBe('Q');
    });

    it('should compute subscriptionLabel', (done) => {
      service.login('test@example.com', 'password').subscribe(() => {
        expect(service.subscriptionLabel()).toBe('Studio Premier');
        done();
      });

      const req = httpMock.expectOne('/api/qobuz/login');
      req.flush(mockLoginResponse);
    });
  });

  describe('getAuthHeaders', () => {
    it('should return empty object when not logged in', () => {
      expect(service.getAuthHeaders()).toEqual({});
    });

    it('should return auth headers when logged in', (done) => {
      service.login('test@example.com', 'password').subscribe(() => {
        const headers = service.getAuthHeaders();
        expect(headers['X-Auth-Token']).toBe('test-auth-token-123');
        expect(headers['X-User-Id']).toBe('12345');
        done();
      });

      const req = httpMock.expectOne('/api/qobuz/login');
      req.flush(mockLoginResponse);
    });
  });

  describe('getProfileId', () => {
    it('should return null when not logged in', () => {
      expect(service.getProfileId()).toBeNull();
    });

    it('should return profile ID when logged in', (done) => {
      service.login('test@example.com', 'password').subscribe(() => {
        expect(service.getProfileId()).toBe('profile_12345');
        done();
      });

      const req = httpMock.expectOne('/api/qobuz/login');
      req.flush(mockLoginResponse);
    });
  });

  describe('Profile Management', () => {
    it('should switch to a different profile', (done) => {
      // Login first to create a profile
      service.login('test@example.com', 'password').subscribe(() => {
        const profileId = 'profile_12345';

        // Simulate logout and then switch back
        service.logout();
        expect(service.isLoggedIn()).toBe(false);

        // Profiles should still exist
        expect(service.profiles().length).toBe(1);

        // Switch back to profile
        service.switchProfile(profileId);
        expect(service.isLoggedIn()).toBe(true);
        expect(service.authToken()).toBe('test-auth-token-123');
        done();
      });

      const req = httpMock.expectOne('/api/qobuz/login');
      req.flush(mockLoginResponse);
    });

    it('should delete a profile', (done) => {
      service.login('test@example.com', 'password').subscribe(() => {
        expect(service.profiles().length).toBe(1);

        service.deleteProfile('profile_12345');

        expect(service.profiles().length).toBe(0);
        expect(service.isLoggedIn()).toBe(false);
        done();
      });

      const req = httpMock.expectOne('/api/qobuz/login');
      req.flush(mockLoginResponse);
    });
  });

  describe('verifyToken', () => {
    it('should return false when no token exists', (done) => {
      service.verifyToken().subscribe(valid => {
        expect(valid).toBe(false);
        done();
      });
    });

    it('should verify token and update user data', (done) => {
      // Set initial state manually
      (service as any).authToken.set('test-token');
      (service as any).userId.set(12345);

      service.verifyToken().subscribe(valid => {
        expect(valid).toBe(true);
        expect(service.isLoggedIn()).toBe(true);
        expect(service.user()).toEqual(mockUser);
        done();
      });

      const req = httpMock.expectOne('/api/qobuz/user');
      expect(req.request.headers.get('X-Auth-Token')).toBe('test-token');
      expect(req.request.headers.get('X-User-Id')).toBe('12345');
      req.flush(mockUser);
    });

    it('should logout on token verification failure', (done) => {
      // Set initial state manually
      (service as any).authToken.set('invalid-token');
      (service as any).userId.set(12345);

      service.verifyToken().subscribe(valid => {
        expect(valid).toBe(false);
        expect(service.isLoggedIn()).toBe(false);
        expect(service.authToken()).toBeNull();
        done();
      });

      const req = httpMock.expectOne('/api/qobuz/user');
      req.flush({ error: 'Invalid token' }, { status: 401, statusText: 'Unauthorized' });
    });
  });
});
