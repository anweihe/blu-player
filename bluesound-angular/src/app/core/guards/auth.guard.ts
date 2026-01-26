import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Auth Guard
 * Protects routes that require Qobuz authentication
 */
export const qobuzAuthGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // If already logged in with verified session
  if (auth.isLoggedIn() && auth.user()) {
    return true;
  }

  // If we have a token but no user data, verify the token
  if (auth.authToken() && auth.userId()) {
    return auth.verifyToken().pipe(
      map(isValid => {
        if (isValid) {
          return true;
        }
        // Token invalid, redirect to login
        return router.createUrlTree(['/qobuz/login'], {
          queryParams: { returnUrl: state.url }
        });
      }),
      catchError(() => {
        // Verification failed, redirect to login
        return of(router.createUrlTree(['/qobuz/login'], {
          queryParams: { returnUrl: state.url }
        }));
      })
    );
  }

  // No auth, redirect to Qobuz login
  return router.createUrlTree(['/qobuz/login'], {
    queryParams: { returnUrl: state.url }
  });
};

/**
 * Reverse Auth Guard
 * Redirects away from login if already authenticated
 */
export const qobuzNoAuthGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Allow access to login page if adding account
  if (route.queryParams?.['addAccount']) {
    return true;
  }

  // If logged in, redirect to browse
  if (auth.isLoggedIn()) {
    return router.createUrlTree(['/qobuz/browse']);
  }

  return true;
};
