import { Component, inject, signal, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { ProfileSwitcherComponent } from '../profile-switcher/profile-switcher.component';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  requiresAuth?: boolean;
}

@Component({
  selector: 'app-hamburger-menu',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ProfileSwitcherComponent],
  template: `
    <!-- Hamburger Button -->
    <button
      class="hamburger-btn fixed top-4 left-4 z-[110] w-10 h-10 rounded-lg bg-bg-card border border-border-subtle flex items-center justify-center hover:bg-bg-card-hover transition-colors"
      [class.is-open]="isOpen()"
      (click)="toggle()"
    >
      <div class="hamburger-lines w-5 h-4 relative flex flex-col justify-between">
        <span class="block h-0.5 w-full bg-text-primary rounded transition-all duration-300" [class.rotate-45]="isOpen()" [class.translate-y-[7px]]="isOpen()"></span>
        <span class="block h-0.5 w-full bg-text-primary rounded transition-all duration-300" [class.opacity-0]="isOpen()"></span>
        <span class="block h-0.5 w-full bg-text-primary rounded transition-all duration-300" [class.-rotate-45]="isOpen()" [class.-translate-y-[7px]]="isOpen()"></span>
      </div>
    </button>

    <!-- Backdrop -->
    @if (isOpen()) {
      <div
        class="fixed inset-0 bg-black/50 z-[55] transition-opacity duration-300"
        [class.opacity-100]="!isClosing()"
        [class.opacity-0]="isClosing()"
        (click)="close()"
      ></div>
    }

    <!-- Side Panel -->
    @if (isOpen()) {
      <nav
        class="fixed top-0 left-0 bottom-0 w-72 max-w-[80vw] bg-bg-primary z-[56] shadow-2xl transition-transform duration-300 ease-out flex flex-col safe-area-left"
        [class.translate-x-0]="!isClosing()"
        [class.-translate-x-full]="isClosing()"
      >
        <!-- Header -->
        <div class="p-6 pt-20 border-b border-border-subtle">
          <h1 class="text-xl font-bold text-text-primary">Bluesound</h1>
          <p class="text-sm text-text-muted mt-1">Web Controller</p>
        </div>

        <!-- Navigation Items -->
        <div class="flex-1 overflow-y-auto py-4">
          @for (item of menuItems; track item.route) {
            @if (!item.requiresAuth || auth.isLoggedIn()) {
              <a
                [routerLink]="item.route"
                routerLinkActive="bg-accent-qobuz/10 text-accent-qobuz border-r-2 border-accent-qobuz"
                [routerLinkActiveOptions]="{ exact: item.route === '/' }"
                class="flex items-center gap-4 px-6 py-3 text-text-secondary hover:bg-bg-card transition-colors"
                (click)="close()"
              >
                <span class="w-6 h-6" [innerHTML]="item.icon"></span>
                <span>{{ item.label }}</span>
              </a>
            }
          }
        </div>

        <!-- Profile Section -->
        <div class="border-t border-border-subtle p-4">
          <!-- Clickable Profile Area -->
          <button
            class="w-full flex items-center gap-3 p-2 -m-2 rounded-xl hover:bg-bg-card transition-colors text-left"
            (click)="openProfileSwitcher()"
          >
            <!-- Avatar with profile color -->
            <div
              class="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0"
              [style.background-color]="activeProfileColor()"
            >
              {{ activeProfileInitial() }}
            </div>

            <!-- Profile Info -->
            <div class="flex-1 min-w-0">
              @if (auth.isLoggedIn()) {
                <p class="font-medium truncate">{{ profileService.activeProfile()?.name ?? auth.user()?.display_name ?? 'Profil' }}</p>
                <p class="text-xs text-text-muted truncate">{{ auth.user()?.email }}</p>
              } @else {
                <p class="font-medium truncate">{{ profileService.activeProfile()?.name ?? 'Kein Profil' }}</p>
                <p class="text-xs text-text-muted">Nicht eingeloggt</p>
              }
              <p class="text-xs text-accent-qobuz mt-0.5">Profil wechseln</p>
            </div>

            <!-- Chevron -->
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-text-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <!-- Logout Button -->
          @if (auth.isLoggedIn()) {
            <button
              class="w-full mt-3 px-4 py-2 text-sm text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors flex items-center justify-center gap-2"
              (click)="logout()"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Von Qobuz abmelden
            </button>
          } @else {
            <a
              routerLink="/qobuz/login"
              class="block w-full mt-3 px-4 py-3 bg-accent-qobuz text-white text-center rounded-lg font-medium hover:opacity-90 transition-opacity"
              (click)="close()"
            >
              Bei Qobuz anmelden
            </a>
          }
        </div>
      </nav>
    }

    <!-- Profile Switcher Modal -->
    @if (showProfileSwitcher()) {
      <app-profile-switcher
        (closed)="closeProfileSwitcher()"
        (profileSelected)="onProfileSelected($event)"
      />
    }
  `,
  styles: [`
    .safe-area-left {
      padding-left: env(safe-area-inset-left, 0);
    }
  `]
})
export class HamburgerMenuComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);

  readonly isOpen = signal(false);
  readonly isClosing = signal(false);
  readonly showProfileSwitcher = signal(false);

  readonly menuItems: MenuItem[] = [
    {
      label: 'Home',
      route: '/',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>`
    },
    {
      label: 'Qobuz',
      route: '/qobuz/browse',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>`,
      requiresAuth: true
    },
    {
      label: 'TuneIn',
      route: '/tunein',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" /></svg>`
    },
    {
      label: 'Radio Paradise',
      route: '/radioparadise',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>`
    },
    {
      label: 'Geräte',
      route: '/players',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>`
    },
    {
      label: 'Einstellungen',
      route: '/settings',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="3" stroke-width="2"/><path stroke-width="2" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`
    }
  ];

  ngOnInit(): void {
    // Load profiles on init
    this.profileService.loadProfiles().subscribe();
  }

  // Computed-style getters for template
  activeProfileColor(): string {
    const profile = this.profileService.activeProfile();
    if (profile) {
      return this.profileService.getProfileColor(profile.id);
    }
    // Fallback to Qobuz accent color
    return 'hsl(200, 65%, 45%)';
  }

  activeProfileInitial(): string {
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

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.isOpen.set(true);
    }
  }

  close(): void {
    this.isClosing.set(true);
    setTimeout(() => {
      this.isOpen.set(false);
      this.isClosing.set(false);
    }, 300);
  }

  openProfileSwitcher(): void {
    this.showProfileSwitcher.set(true);
  }

  closeProfileSwitcher(): void {
    this.showProfileSwitcher.set(false);
  }

  onProfileSelected(profile: any): void {
    // Check if new profile has Qobuz credentials
    if (profile.qobuz?.authToken) {
      // Load Qobuz credentials into AuthService
      this.auth.loadFromProfileCredentials(profile.qobuz);
    } else {
      // Logout from Qobuz, redirect to login
      this.auth.logout();
      this.close();
      this.router.navigate(['/qobuz/login']);
    }
  }

  logout(): void {
    // Only logout from Qobuz, keep profile
    this.auth.logout();
    this.close();
    this.router.navigate(['/']);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.showProfileSwitcher()) {
      // ProfileSwitcher handles its own escape
      return;
    }
    if (this.isOpen()) {
      this.close();
    }
  }
}
