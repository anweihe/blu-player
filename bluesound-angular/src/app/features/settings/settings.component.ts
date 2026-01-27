import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NavigationStateService } from '../../core/services/navigation-state.service';

interface ApiKeyStatus {
  isConfigured: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="settings-page min-h-screen bg-bg-primary pb-24">
      <!-- Header -->
      <header class="sticky top-0 z-[60] bg-bg-primary/95 backdrop-blur border-b border-border-subtle safe-area-top">
        <div class="flex items-center gap-3 px-4 py-4">
          <!-- Hamburger Menu Button -->
          <button
            class="w-10 h-10 rounded-lg bg-bg-card border border-border-subtle flex items-center justify-center hover:bg-bg-card-hover transition-colors"
            (click)="toggleMenu()"
            aria-label="Menü"
          >
            <svg class="w-5 h-5 text-text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round"/>
            </svg>
          </button>
          <svg class="w-6 h-6 text-accent-qobuz" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
          <h1 class="text-xl font-bold">Einstellungen</h1>
        </div>
      </header>

      <!-- Content -->
      <main class="p-4 md:p-6 max-w-2xl mx-auto">
        <!-- KI Integration Section -->
        <section class="mb-8">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-accent-qobuz/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-qobuz" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div>
              <h2 class="text-lg font-semibold">KI-Integration</h2>
              <p class="text-sm text-text-muted">Verbinde externe KI-Dienste</p>
            </div>
          </div>

          <!-- Mistral AI Card -->
          <div class="bg-bg-card border border-border-subtle rounded-xl overflow-hidden" [class.border-accent-qobuz]="isConfigured()">
            <!-- Card Header -->
            <div class="flex items-center justify-between p-4 border-b border-border-subtle">
              <div class="flex items-center gap-3">
                <!-- Mistral Logo -->
                <div class="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                  <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="2" y="2" width="6" height="6" rx="1"/>
                    <rect x="9" y="2" width="6" height="6" rx="1"/>
                    <rect x="16" y="2" width="6" height="6" rx="1"/>
                    <rect x="2" y="9" width="6" height="6" rx="1"/>
                    <rect x="16" y="9" width="6" height="6" rx="1"/>
                    <rect x="2" y="16" width="6" height="6" rx="1"/>
                    <rect x="9" y="16" width="6" height="6" rx="1"/>
                    <rect x="16" y="16" width="6" height="6" rx="1"/>
                  </svg>
                </div>
                <div>
                  <span class="font-medium">Mistral AI</span>
                  <span class="block text-xs text-text-muted">Large Language Model</span>
                </div>
              </div>
              <!-- Status -->
              <div class="flex items-center gap-2 text-sm" [class.text-accent-qobuz]="isConfigured()" [class.text-text-muted]="!isConfigured()">
                <span class="w-2 h-2 rounded-full" [class.bg-accent-qobuz]="isConfigured()" [class.bg-text-muted]="!isConfigured()"></span>
                <span>{{ isConfigured() ? 'Konfiguriert' : 'Nicht konfiguriert' }}</span>
              </div>
            </div>

            <!-- Card Body -->
            <div class="p-4">
              @if (!isConfigured()) {
                <!-- Unconfigured State: Show Form -->
                <div class="space-y-4">
                  <div>
                    <label class="block text-sm font-medium mb-2">API Key</label>
                    <div class="relative">
                      <input
                        [type]="showApiKey() ? 'text' : 'password'"
                        [(ngModel)]="apiKeyInput"
                        class="w-full px-4 py-3 bg-bg-secondary border border-border-subtle rounded-lg text-sm focus:outline-none focus:border-accent-qobuz transition-colors pr-12"
                        placeholder="xxxxxxxxxxxxxxxx"
                        autocomplete="off"
                        spellcheck="false"
                      />
                      <button
                        type="button"
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                        (click)="showApiKey.set(!showApiKey())"
                      >
                        @if (showApiKey()) {
                          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                          </svg>
                        } @else {
                          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        }
                      </button>
                    </div>
                    <p class="mt-2 text-xs text-text-muted">
                      Der Key wird verschlüsselt gespeichert und ist danach nicht mehr einsehbar.
                    </p>
                  </div>

                  <button
                    type="button"
                    class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent-qobuz text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    [disabled]="saving() || !apiKeyInput.trim()"
                    (click)="saveApiKey()"
                  >
                    @if (saving()) {
                      <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    } @else {
                      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                      </svg>
                    }
                    <span>Speichern</span>
                  </button>
                </div>
              } @else {
                <!-- Configured State -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="flex items-center gap-2 text-accent-qobuz">
                      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      <span class="text-sm font-medium">API Key konfiguriert</span>
                    </div>
                    <span class="text-text-muted text-sm tracking-widest">::::::::::::::::::</span>
                  </div>

                  <button
                    type="button"
                    class="flex items-center gap-2 px-4 py-2 text-danger hover:bg-danger/10 rounded-lg transition-colors text-sm"
                    (click)="deleteApiKey()"
                  >
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      <line x1="10" y1="11" x2="10" y2="17"/>
                      <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                    <span>Löschen</span>
                  </button>
                </div>
              }
            </div>
          </div>
        </section>

        <!-- Future Section Placeholder -->
        <section class="opacity-50">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-bg-card border border-border-subtle flex items-center justify-center">
              <svg class="w-5 h-5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
            </div>
            <div>
              <h2 class="text-lg font-semibold">Weitere Einstellungen</h2>
              <p class="text-sm text-text-muted">Demnächst verfügbar</p>
            </div>
          </div>
        </section>
      </main>

      <!-- Toast -->
      @if (toastMessage()) {
        <div
          class="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm z-50 animate-fade-in"
          [class.bg-accent-qobuz]="toastType() === 'success'"
          [class.bg-danger]="toastType() === 'error'"
          [class.text-white]="true"
        >
          @if (toastType() === 'success') {
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          } @else {
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          }
          <span>{{ toastMessage() }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes fade-in {
      from { opacity: 0; transform: translate(-50%, 10px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
    .animate-fade-in {
      animation: fade-in 0.2s ease-out;
    }
  `]
})
export class SettingsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly navState = inject(NavigationStateService);

  readonly isConfigured = signal(false);
  readonly saving = signal(false);
  readonly showApiKey = signal(false);
  readonly toastMessage = signal<string | null>(null);
  readonly toastType = signal<'success' | 'error'>('success');

  apiKeyInput = '';

  ngOnInit(): void {
    // Hide app header - this page has its own header
    this.navState.usePreset('hidden');
    this.checkApiKeyStatus();
  }

  toggleMenu(): void {
    this.navState.toggleHamburger();
  }

  private checkApiKeyStatus(): void {
    this.http.get<ApiResponse<ApiKeyStatus>>('/api/settings?handler=mistralApiKey')
      .subscribe({
        next: response => {
          if (response.success && response.data) {
            this.isConfigured.set(response.data.isConfigured);
          }
        },
        error: () => this.showToast('Fehler beim Laden des Status', 'error')
      });
  }

  saveApiKey(): void {
    const apiKey = this.apiKeyInput.trim();
    if (!apiKey) return;

    this.saving.set(true);

    this.http.put<ApiResponse<void>>('/api/settings?handler=mistralApiKey', { apiKey })
      .subscribe({
        next: response => {
          this.saving.set(false);
          if (response.success) {
            this.apiKeyInput = '';
            this.isConfigured.set(true);
            this.showToast('API Key erfolgreich gespeichert', 'success');
          } else {
            this.showToast(response.error || 'Fehler beim Speichern', 'error');
          }
        },
        error: () => {
          this.saving.set(false);
          this.showToast('Verbindungsfehler', 'error');
        }
      });
  }

  deleteApiKey(): void {
    if (!confirm('API Key wirklich löschen?')) return;

    this.http.delete<ApiResponse<void>>('/api/settings?handler=mistralApiKey')
      .subscribe({
        next: response => {
          if (response.success) {
            this.isConfigured.set(false);
            this.showToast('API Key gelöscht', 'success');
          } else {
            this.showToast(response.error || 'Fehler beim Löschen', 'error');
          }
        },
        error: () => this.showToast('Verbindungsfehler', 'error')
      });
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage.set(message);
    this.toastType.set(type);

    setTimeout(() => this.toastMessage.set(null), 3000);
  }
}
