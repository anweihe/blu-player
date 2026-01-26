import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Auth HTTP Interceptor
 * Automatically adds auth headers to Qobuz API requests
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Only intercept Qobuz API calls
  if (!req.url.includes('/Qobuz') && !req.url.includes('/api/qobuz')) {
    return next(req);
  }

  const auth = inject(AuthService);
  const headers = auth.getAuthHeaders();

  // Skip if no auth headers or headers already present
  if (!headers['X-Auth-Token'] || req.headers.has('X-Auth-Token')) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: headers
  });

  return next(authReq);
};
