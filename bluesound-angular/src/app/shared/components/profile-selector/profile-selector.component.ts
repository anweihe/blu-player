import { Component, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService, Profile } from '../../../core/services/profile.service';

@Component({
  selector: 'app-profile-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (auth.isLoggedIn()) {
      <div class="relative">
        <!-- Trigger Button -->
        <button
          class="profile-btn flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-card transition-colors"
          (click)="toggle()"
        >
          <div class="w-8 h-8 rounded-full bg-accent-qobuz/20 flex items-center justify-center text-accent-qobuz font-semibold text-sm">
            {{ auth.userInitial() }}
          </div>
          <div class="text-left hidden sm:block">
            <p class="text-sm font-medium truncate max-w-[120px]">{{ auth.displayName() }}</p>
            <p class="text-xs text-text-muted">{{ auth.subscriptionLabel() }}</p>
          </div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4 text-text-muted transition-transform"
            [class.rotate-180]="isOpen()"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- Dropdown Menu -->
        @if (isOpen()) {
          <div class="absolute right-0 top-full mt-2 w-72 bg-bg-card border border-border-subtle rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
            <!-- Current Profile -->
            <div class="p-4 border-b border-border-subtle">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-full bg-accent-qobuz/20 flex items-center justify-center text-accent-qobuz font-bold text-lg">
                  {{ auth.userInitial() }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold truncate">{{ auth.displayName() }}</p>
                  <p class="text-sm text-text-muted truncate">{{ auth.user()?.email }}</p>
                </div>
              </div>
              <div class="mt-3 flex items-center gap-2">
                <span class="px-2 py-1 bg-accent-qobuz/10 text-accent-qobuz text-xs font-medium rounded-full">
                  {{ auth.subscriptionLabel() }}
                </span>
              </div>
            </div>

            <!-- Other Profiles -->
            @if (otherProfiles().length > 0) {
              <div class="p-2 border-b border-border-subtle">
                <p class="px-2 py-1 text-xs text-text-muted uppercase tracking-wide">Andere Profile</p>
                @for (profile of otherProfiles(); track profile.id) {
                  <button
                    class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-secondary transition-colors text-left"
                    (click)="switchProfile(profile)"
                  >
                    <div
                      class="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm"
                      [style.background-color]="profileService.getProfileColor(profile.id)"
                    >
                      {{ profileService.getProfileInitial(profile.name) }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium truncate">{{ profile.name }}</p>
                      @if (profile.qobuz?.displayName) {
                        <p class="text-xs text-text-muted truncate">{{ profile.qobuz!.displayName }}</p>
                      }
                    </div>
                    @if (confirmDelete() === profile.id) {
                      <button
                        class="px-2 py-1 text-xs bg-error text-white rounded hover:bg-red-600"
                        (click)="deleteProfile(profile, $event)"
                      >
                        Löschen
                      </button>
                    } @else if (profileService.profiles().length > 1) {
                      <button
                        class="p-1 text-text-muted hover:text-error rounded transition-colors"
                        (click)="confirmDeleteProfile(profile, $event)"
                        title="Profil entfernen"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    }
                  </button>
                }
              </div>
            }

            <!-- Actions -->
            <div class="p-2">
              <button
                class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-secondary transition-colors text-left"
                (click)="addAccount()"
              >
                <div class="w-8 h-8 rounded-full bg-bg-secondary flex items-center justify-center text-text-secondary">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span class="text-sm font-medium">Weiteres Konto hinzufügen</span>
              </button>

              <button
                class="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-error/10 text-error transition-colors text-left"
                (click)="logout()"
              >
                <div class="w-8 h-8 rounded-full bg-error/10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
                <span class="text-sm font-medium">Abmelden</span>
              </button>
            </div>
          </div>
        }
      </div>
    } @else {
      <!-- Login Button -->
      <button
        class="flex items-center gap-2 px-4 py-2 bg-accent-qobuz text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
        (click)="goToLogin()"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
        <span>Anmelden</span>
      </button>
    }
  `,
  styles: [`
    @keyframes fade-in {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .animate-fade-in {
      animation: fade-in 0.15s ease-out;
    }
  `]
})
export class ProfileSelectorComponent {
  readonly auth = inject(AuthService);
  readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);

  readonly isOpen = signal(false);
  readonly confirmDelete = signal<string | null>(null);

  readonly otherProfiles = () => {
    const profiles = this.profileService.profiles();
    const activeId = this.profileService.activeProfileId();
    return profiles.filter(p => p.id !== activeId);
  };

  toggle(): void {
    this.isOpen.update(v => !v);
    if (!this.isOpen()) {
      this.confirmDelete.set(null);
    }
  }

  close(): void {
    this.isOpen.set(false);
    this.confirmDelete.set(null);
  }

  switchProfile(profile: Profile): void {
    this.profileService.setActiveProfileId(profile.id);
    // Load credentials if available
    if (profile.qobuz?.authToken) {
      this.auth.loadFromProfileCredentials(profile.qobuz);
    } else {
      this.auth.logout();
      this.router.navigate(['/qobuz/login']);
    }
    this.close();
  }

  confirmDeleteProfile(profile: Profile, event: Event): void {
    event.stopPropagation();
    this.confirmDelete.set(profile.id);
  }

  deleteProfile(profile: Profile, event: Event): void {
    event.stopPropagation();
    this.profileService.deleteProfile(profile.id).subscribe();
    this.confirmDelete.set(null);
  }

  addAccount(): void {
    this.close();
    // Create a new profile and navigate to login
    this.profileService.createProfile('Neues Profil').subscribe(newProfile => {
      if (newProfile) {
        this.profileService.setActiveProfileId(newProfile.id);
        this.router.navigate(['/qobuz/login']);
      }
    });
  }

  logout(): void {
    this.close();
    this.auth.logout();
    this.router.navigate(['/']);
  }

  goToLogin(): void {
    this.router.navigate(['/qobuz/login']);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('app-profile-selector')) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.close();
  }
}
