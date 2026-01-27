import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NavigationStateService, HeaderRightItem } from '../../core/services/navigation-state.service';
import { ProfileService } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';

/**
 * App Header Component
 *
 * Fixed header that adapts based on page configuration:
 * - Left: Hamburger menu or back button
 * - Center: Page title
 * - Right: Configurable items (search, profile, settings)
 *
 * Each page configures its header via NavigationStateService.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Fixed Header Bar (hidden when page has its own header) -->
    @if (!config().hidden) {
    <header class="fixed top-0 left-0 right-0 z-[100] bg-bg-primary/95 backdrop-blur-lg border-b border-border-subtle safe-area-top">
      <div class="h-14 flex items-center gap-3 px-4 safe-area-left safe-area-right">

        <!-- Left Section: Hamburger + Back (if detail) + optional Play Button -->
        <div class="flex items-center gap-2 flex-shrink-0">
          <!-- Hamburger Button (always shown) -->
          <button
            class="w-10 h-10 rounded-lg bg-bg-card border border-border-subtle flex items-center justify-center hover:bg-bg-card-hover transition-colors"
            (click)="toggleMenu.emit()"
            aria-label="Menü öffnen"
          >
            <svg class="w-5 h-5 text-text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round"/>
            </svg>
          </button>

          @if (config().leftAction === 'back') {
            <!-- Back Button -->
            <button
              class="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
              (click)="goBack()"
              aria-label="Zurück"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <!-- Play Button (optional, for album/playlist pages) -->
            @if (config().showPlayButton) {
              <button
                class="w-10 h-10 rounded-full border-2 border-accent-qobuz flex items-center justify-center text-accent-qobuz hover:bg-accent-qobuz hover:text-white transition-colors"
                (click)="playAll()"
                aria-label="Alle abspielen"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
            }
          }
        </div>

        <!-- Center: Title -->
        <div class="flex-1 min-w-0">
          <span class="font-semibold text-lg text-text-primary truncate block">
            {{ config().title || 'Bluesound' }}
          </span>
        </div>

        <!-- Right Section: Configurable items -->
        <div class="flex items-center gap-2 flex-shrink-0">
          @for (item of config().rightItems ?? []; track item) {
            @switch (item) {
              @case ('search') {
                <button
                  class="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
                  (click)="openSearch()"
                  aria-label="Suche"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              }
              @case ('settings') {
                <button
                  class="w-10 h-10 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
                  (click)="openSettings()"
                  aria-label="Einstellungen"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              }
              @case ('profile') {
                <button
                  class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                  [style.background-color]="profileColor()"
                  (click)="toggleMenu.emit()"
                  aria-label="Profil"
                >
                  {{ profileInitial() }}
                </button>
              }
              @case ('hamburger') {
                <button
                  class="w-10 h-10 rounded-lg bg-bg-card border border-border-subtle flex items-center justify-center hover:bg-bg-card-hover transition-colors"
                  (click)="toggleMenu.emit()"
                  aria-label="Menü"
                >
                  <div class="hamburger-lines w-5 h-4 relative flex flex-col justify-between">
                    <span class="block h-0.5 w-full bg-text-primary rounded transition-all duration-300"></span>
                    <span class="block h-0.5 w-full bg-text-primary rounded transition-all duration-300"></span>
                    <span class="block h-0.5 w-full bg-text-primary rounded transition-all duration-300"></span>
                  </div>
                </button>
              }
            }
          }
        </div>

      </div>
    </header>
    }
  `,
  styles: [`
    .safe-area-top {
      padding-top: env(safe-area-inset-top, 0);
    }

    .safe-area-left {
      padding-left: env(safe-area-inset-left, 0);
    }

    .safe-area-right {
      padding-right: env(safe-area-inset-right, 0);
    }
  `]
})
export class AppHeaderComponent {
  private readonly navState = inject(NavigationStateService);
  private readonly router = inject(Router);
  private readonly profileService = inject(ProfileService);
  private readonly auth = inject(AuthService);

  /** Event emitted when hamburger menu button is clicked */
  readonly toggleMenu = output<void>();

  /** Current header configuration */
  readonly config = this.navState.headerConfig;

  /**
   * Get profile color for avatar
   */
  profileColor(): string {
    const profile = this.profileService.activeProfile();
    if (profile) {
      return this.profileService.getProfileColor(profile.id);
    }
    // Fallback to Qobuz accent green
    return '#1db954';
  }

  /**
   * Get profile initial for avatar
   */
  profileInitial(): string {
    const profile = this.profileService.activeProfile();
    if (profile) {
      return this.profileService.getProfileInitial(profile.name);
    }
    // Fallback to user initial or Q
    const user = this.auth.user();
    if (user?.display_name) {
      return user.display_name.charAt(0).toUpperCase();
    }
    return 'Q';
  }

  /**
   * Navigate back
   */
  goBack(): void {
    const cfg = this.config();
    if (cfg.backRoute) {
      this.router.navigate([cfg.backRoute]);
    } else {
      window.history.back();
    }
  }

  /**
   * Trigger play all callback
   */
  playAll(): void {
    const cfg = this.config();
    if (cfg.onPlayAll) {
      cfg.onPlayAll();
    }
  }

  /**
   * Navigate to search page
   */
  openSearch(): void {
    this.router.navigate(['/qobuz/search']);
  }

  /**
   * Navigate to settings page
   */
  openSettings(): void {
    this.router.navigate(['/settings']);
  }
}
