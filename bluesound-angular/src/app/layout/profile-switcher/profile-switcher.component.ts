import { Component, inject, signal, Output, EventEmitter, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProfileService, Profile } from '../../core/services/profile.service';

@Component({
  selector: 'app-profile-switcher',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Modal Backdrop -->
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity duration-200"
      [class.opacity-0]="isClosing()"
      [class.opacity-100]="!isClosing()"
      (click)="close()"
    ></div>

    <!-- Modal Content -->
    <div
      class="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-bg-primary rounded-2xl z-[101] shadow-2xl overflow-hidden transition-all duration-200"
      [class.scale-95]="isClosing()"
      [class.opacity-0]="isClosing()"
      [class.scale-100]="!isClosing()"
      [class.opacity-100]="!isClosing()"
      (click)="$event.stopPropagation()"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-border-subtle">
        <h2 class="text-lg font-semibold">Profile</h2>
        <button
          class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-bg-card transition-colors"
          (click)="close()"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Profile List -->
      <div class="max-h-80 overflow-y-auto p-2">
        @if (profileService.isLoading()) {
          <div class="p-4 text-center text-text-muted">
            Lade Profile...
          </div>
        } @else if (profileService.profiles().length === 0) {
          <div class="p-4 text-center text-text-muted">
            Keine Profile vorhanden
          </div>
        } @else {
          @for (profile of profileService.profiles(); track profile.id) {
            <div
              class="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors hover:bg-bg-card"
              [class.bg-bg-card]="profile.id === profileService.activeProfileId()"
              (click)="selectProfile(profile)"
            >
              <!-- Avatar -->
              <div
                class="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0"
                [style.background-color]="profileService.getProfileColor(profile.id)"
              >
                {{ profileService.getProfileInitial(profile.name) }}
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium truncate">{{ profile.name }}</span>
                  @if (profile.id === profileService.activeProfileId()) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-green-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                    </svg>
                  }
                </div>
                <div class="text-sm text-text-muted">
                  @if (profile.qobuz?.authToken) {
                    <span class="text-green-600">Qobuz verbunden</span>
                    @if (profile.qobuz?.displayName) {
                      <span class="mx-1">-</span>
                      <span>{{ profile.qobuz!.displayName }}</span>
                    }
                  } @else {
                    <span class="text-text-muted">Nicht bei Qobuz eingeloggt</span>
                  }
                </div>
              </div>

              <!-- Delete Button (if more than one profile) -->
              @if (profileService.profiles().length > 1) {
                <button
                  class="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors flex-shrink-0"
                  (click)="confirmDeleteProfile($event, profile)"
                  title="Profil löschen"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              }
            </div>
          }
        }
      </div>

      <!-- Create New Profile -->
      <div class="p-3 border-t border-border-subtle">
        @if (isCreating()) {
          <!-- Create Form -->
          <div class="flex items-center gap-2">
            <input
              type="text"
              [(ngModel)]="newProfileName"
              placeholder="Profilname"
              class="flex-1 px-3 py-2 bg-bg-card border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-qobuz/50"
              (keydown.enter)="createProfile()"
              (keydown.escape)="cancelCreate()"
              #nameInput
            />
            <button
              class="px-3 py-2 bg-accent-qobuz text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              [disabled]="!newProfileName.trim()"
              (click)="createProfile()"
            >
              Erstellen
            </button>
            <button
              class="px-3 py-2 text-text-muted hover:bg-bg-card rounded-lg text-sm transition-colors"
              (click)="cancelCreate()"
            >
              Abbrechen
            </button>
          </div>
        } @else {
          <!-- Add Button -->
          <button
            class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-accent-qobuz hover:bg-accent-qobuz/10 transition-colors"
            (click)="startCreate()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span class="font-medium">Neues Profil erstellen</span>
          </button>
        }
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    @if (profileToDelete()) {
      <div
        class="fixed inset-0 bg-black/60 z-[102] flex items-center justify-center p-4"
        (click)="cancelDelete()"
      >
        <div
          class="bg-bg-primary rounded-2xl p-6 max-w-sm w-full shadow-2xl"
          (click)="$event.stopPropagation()"
        >
          <h3 class="text-lg font-semibold mb-2">Profil löschen?</h3>
          <p class="text-text-muted mb-4">
            Möchtest du das Profil "{{ profileToDelete()?.name }}" wirklich löschen?
            @if (profileToDelete()?.qobuz) {
              Die Qobuz-Verbindung wird dabei ebenfalls entfernt.
            }
          </p>
          <div class="flex gap-3 justify-end">
            <button
              class="px-4 py-2 rounded-lg text-text-muted hover:bg-bg-card transition-colors"
              (click)="cancelDelete()"
            >
              Abbrechen
            </button>
            <button
              class="px-4 py-2 bg-error text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
              (click)="deleteProfile()"
            >
              Löschen
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }
  `]
})
export class ProfileSwitcherComponent implements OnInit {
  readonly profileService = inject(ProfileService);

  // Outputs
  @Output() closed = new EventEmitter<void>();
  @Output() profileSelected = new EventEmitter<Profile>();

  // Local state
  readonly isClosing = signal(false);
  readonly isCreating = signal(false);
  readonly profileToDelete = signal<Profile | null>(null);
  newProfileName = '';

  ngOnInit(): void {
    // Load profiles if not already loaded
    if (this.profileService.profiles().length === 0) {
      this.profileService.loadProfiles().subscribe();
    }
  }

  selectProfile(profile: Profile): void {
    if (profile.id !== this.profileService.activeProfileId()) {
      this.profileService.setActiveProfileId(profile.id);
      this.profileSelected.emit(profile);
    }
    this.close();
  }

  startCreate(): void {
    this.isCreating.set(true);
    this.newProfileName = '';
    // Focus input after render
    setTimeout(() => {
      const input = document.querySelector('input[placeholder="Profilname"]') as HTMLInputElement;
      input?.focus();
    });
  }

  cancelCreate(): void {
    this.isCreating.set(false);
    this.newProfileName = '';
  }

  createProfile(): void {
    const name = this.newProfileName.trim();
    if (!name) return;

    this.profileService.createProfile(name).subscribe(profile => {
      if (profile) {
        this.isCreating.set(false);
        this.newProfileName = '';
        // Select newly created profile
        this.profileService.setActiveProfileId(profile.id);
        this.profileSelected.emit(profile);
      }
    });
  }

  confirmDeleteProfile(event: Event, profile: Profile): void {
    event.stopPropagation();
    this.profileToDelete.set(profile);
  }

  cancelDelete(): void {
    this.profileToDelete.set(null);
  }

  deleteProfile(): void {
    const profile = this.profileToDelete();
    if (!profile) return;

    this.profileService.deleteProfile(profile.id).subscribe(success => {
      if (success) {
        this.profileToDelete.set(null);
      }
    });
  }

  close(): void {
    this.isClosing.set(true);
    setTimeout(() => {
      this.closed.emit();
    }, 200);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.profileToDelete()) {
      this.cancelDelete();
    } else if (this.isCreating()) {
      this.cancelCreate();
    } else {
      this.close();
    }
  }
}
