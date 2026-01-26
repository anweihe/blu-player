import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-qobuz-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-bg-primary flex items-center justify-center p-4 safe-area-top">
      <div class="login-card">
        <!-- Back Button -->
        <a routerLink="/" class="back-link mb-4 inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          <span class="text-sm">Zurück</span>
        </a>

        <div class="login-header">
          <!-- Qobuz Logo -->
          <div class="qobuz-logo-container">
            <svg class="qobuz-logo" viewBox="0 0 100 100" fill="none">
              <circle cx="50" cy="50" r="45" stroke="currentColor" stroke-width="3"/>
              <path d="M35 65V35L70 50L35 65Z" fill="currentColor"/>
            </svg>
          </div>
          <h2>{{ isAddingAccount() ? 'Weiteres Konto hinzufügen' : 'Bei Qobuz anmelden' }}</h2>
          <p>Hi-Res Audio Streaming</p>
        </div>

        @if (auth.authError()) {
          <div class="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ auth.authError() }}</span>
          </div>
        }

        <form class="login-form" (ngSubmit)="onLogin()">
          <div class="form-group">
            <label for="email">E-Mail</label>
            <div class="input-wrapper">
              <svg xmlns="http://www.w3.org/2000/svg" class="input-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <input
                type="email"
                id="email"
                [(ngModel)]="email"
                name="email"
                placeholder="ihre@email.de"
                required
                autocomplete="email"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="password">Passwort</label>
            <div class="input-wrapper">
              <svg xmlns="http://www.w3.org/2000/svg" class="input-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <input
                [type]="showPassword() ? 'text' : 'password'"
                id="password"
                [(ngModel)]="password"
                name="password"
                placeholder="••••••••"
                required
                autocomplete="current-password"
              />
              <button
                type="button"
                class="password-toggle"
                (click)="togglePasswordVisibility()"
                tabindex="-1"
              >
                @if (showPassword()) {
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                } @else {
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                }
              </button>
            </div>
          </div>

          <button
            type="submit"
            class="btn-login"
            [disabled]="auth.isAuthenticating() || !email || !password"
          >
            @if (auth.isAuthenticating()) {
              <div class="spinner"></div>
              <span>Anmelden...</span>
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span>Anmelden</span>
            }
          </button>
        </form>

        <!-- Info -->
        <div class="login-footer">
          <p>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 inline-block mr-1 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Ihre Anmeldedaten werden sicher übertragen und nicht gespeichert.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-card {
      background: var(--color-bg-card);
      border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-lg);
      padding: 32px;
      width: 100%;
      max-width: 420px;
      box-shadow: var(--shadow-card);
    }

    .safe-area-top {
      padding-top: env(safe-area-inset-top, 0);
    }

    .back-link {
      display: inline-flex;
    }

    .login-header {
      text-align: center;
      margin-bottom: 28px;
    }

    .qobuz-logo-container {
      width: 72px;
      height: 72px;
      margin: 0 auto 16px;
      background: linear-gradient(135deg, var(--color-accent-qobuz), #1ed760);
      border-radius: 50%;
      padding: 2px;
    }

    .qobuz-logo {
      width: 100%;
      height: 100%;
      color: white;
      background: var(--color-bg-card);
      border-radius: 50%;
      padding: 12px;
    }

    .login-header h2 {
      font-size: 1.35rem;
      font-weight: 700;
      margin: 0 0 8px;
      color: var(--color-text-primary);
    }

    .login-header p {
      font-size: 0.875rem;
      color: var(--color-text-secondary);
      margin: 0;
    }

    .alert {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 16px;
      margin-bottom: 20px;
      border-radius: var(--radius-md);
      font-size: 0.875rem;
    }

    .alert-error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: #fca5a5;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-group label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .input-icon {
      position: absolute;
      left: 14px;
      width: 18px;
      height: 18px;
      color: var(--color-text-muted);
      pointer-events: none;
    }

    .form-group input {
      width: 100%;
      padding: 14px 14px 14px 44px;
      background: var(--color-bg-secondary);
      border: 1px solid var(--color-border-accent);
      border-radius: var(--radius-md);
      color: var(--color-text-primary);
      font-size: 0.95rem;
      transition: all 0.15s ease;
    }

    .form-group input:focus {
      outline: none;
      border-color: var(--color-accent-qobuz);
      box-shadow: 0 0 0 3px rgba(29, 185, 84, 0.15);
    }

    .form-group input:focus + .input-icon,
    .input-wrapper:has(input:focus) .input-icon {
      color: var(--color-accent-qobuz);
    }

    .form-group input::placeholder {
      color: var(--color-text-muted);
    }

    .password-toggle {
      position: absolute;
      right: 10px;
      padding: 6px;
      background: none;
      border: none;
      color: var(--color-text-muted);
      cursor: pointer;
      transition: color 0.15s ease;
    }

    .password-toggle:hover {
      color: var(--color-text-primary);
    }

    .btn-login {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 16px;
      background: linear-gradient(135deg, var(--color-accent-qobuz), #1ed760);
      border: none;
      border-radius: var(--radius-md);
      color: white;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 8px;
    }

    .btn-login:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(29, 185, 84, 0.35);
    }

    .btn-login:active:not(:disabled) {
      transform: translateY(0);
    }

    .btn-login:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .login-footer {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid var(--color-border-subtle);
      text-align: center;
    }

    .login-footer p {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      line-height: 1.5;
    }
  `]
})
export class QobuzLoginComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  readonly showPassword = signal(false);
  readonly isAddingAccount = signal(false);

  private returnUrl = '/qobuz/browse';

  ngOnInit(): void {
    // Get return URL from query params
    this.route.queryParams.subscribe(params => {
      if (params['returnUrl']) {
        this.returnUrl = params['returnUrl'];
      }
      if (params['addAccount']) {
        this.isAddingAccount.set(true);
      }
    });

    // If already logged in and not adding account, redirect
    if (this.auth.isLoggedIn() && !this.isAddingAccount()) {
      this.router.navigate([this.returnUrl]);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  onLogin(): void {
    if (!this.email || !this.password) return;

    this.auth.login(this.email, this.password).subscribe(success => {
      if (success) {
        this.router.navigate([this.returnUrl]);
      }
    });
  }
}
