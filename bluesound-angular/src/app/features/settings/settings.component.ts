import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NavigationStateService } from '../../core/services/navigation-state.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { TranslationService } from '../../core/services/translation.service';
import { ProfileService } from '../../core/services/profile.service';

interface AiProviderStatus {
  provider: string;
  name: string;
  isConfigured: boolean;
  isActive: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ProviderUi extends AiProviderStatus {
  color: string;
  bgColor: string;
  hintKey: string;
  apiKeyInput: string;
  showKey: boolean;
  saving: boolean;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="settings-page min-h-screen bg-bg-primary pb-24">
      <!-- Header -->
      <header class="sticky z-[60] bg-bg-primary/95 backdrop-blur border-b border-border-subtle" style="top: env(safe-area-inset-top, 0); padding-top: env(safe-area-inset-top, 0);">
        <div class="flex items-center gap-3 px-4 py-4">
          <button
            class="w-10 h-10 rounded-lg bg-bg-card border border-border-subtle flex items-center justify-center hover:bg-bg-card-hover transition-colors"
            (click)="toggleMenu()"
            [attr.aria-label]="'nav.menu' | translate"
          >
            <svg class="w-5 h-5 text-text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 6h16M4 12h16M4 18h16" stroke-linecap="round"/>
            </svg>
          </button>
          <svg class="w-6 h-6 text-accent-qobuz" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
          <h1 class="text-xl font-bold">{{ 'settings.title' | translate }}</h1>
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
              <h2 class="text-lg font-semibold">{{ 'settings.aiIntegration' | translate }}</h2>
              <p class="text-sm text-text-muted">{{ 'settings.aiIntegrationDescription' | translate }}</p>
            </div>
          </div>

          <!-- Provider Cards -->
          <div class="space-y-3">
            @for (p of providers(); track p.provider) {
              <div
                class="bg-bg-card border rounded-xl overflow-hidden transition-colors"
                [style.border-color]="p.isActive ? p.color : ''"
                [class.border-border-subtle]="!p.isActive"
              >
                <!-- Card Header -->
                <div class="flex items-center justify-between p-4">
                  <div class="flex items-center gap-3">
                    <!-- Provider Logo -->
                    <div
                      class="w-10 h-10 rounded-lg flex items-center justify-center"
                      [style.background-color]="p.bgColor"
                      [style.color]="p.color"
                    >
                      @if (p.provider === 'mistral') {
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
                      } @else if (p.provider === 'anthropic') {
                        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M13.827 3.52l5.51 16.96H22L14.314 3.52h-0.487zm-3.654 0L3.51 20.48h2.663l1.37-4.342h6.375l1.37 4.342h2.663L11.29 3.52h-1.117zm-.193 10.478L12 7.903l2.02 6.095H9.98z"/>
                        </svg>
                      } @else {
                        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
                        </svg>
                      }
                    </div>
                    <div>
                      <span class="font-medium">{{ p.name }}</span>
                      <span class="block text-xs text-text-muted">Large Language Model</span>
                    </div>
                  </div>

                  <div class="flex items-center gap-3">
                    <!-- Status dot -->
                    <div class="flex items-center gap-2 text-sm" [style.color]="p.isConfigured ? p.color : ''">
                      <span
                        class="w-2 h-2 rounded-full"
                        [style.background-color]="p.isConfigured ? p.color : ''"
                        [class.bg-text-muted]="!p.isConfigured"
                      ></span>
                      <span [class.text-text-muted]="!p.isConfigured">
                        {{ p.isConfigured ? ('settings.configured' | translate) : ('settings.notConfigured' | translate) }}
                      </span>
                    </div>

                    <!-- Active toggle (only if configured) -->
                    @if (p.isConfigured) {
                      <button
                        type="button"
                        class="relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none"
                        [style.background-color]="p.isActive ? p.color : ''"
                        [class.bg-bg-secondary]="!p.isActive"
                        (click)="setActiveProvider(p)"
                      >
                        <span
                          class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                          [class.translate-x-5]="p.isActive"
                        ></span>
                      </button>
                    }
                  </div>
                </div>

                <!-- Card Body -->
                <div class="px-4 pb-4">
                  @if (!p.isConfigured) {
                    <!-- Unconfigured: API Key Input -->
                    <div class="space-y-3">
                      <div>
                        <label class="block text-sm font-medium mb-2">API Key</label>
                        <div class="relative">
                          <input
                            [type]="p.showKey ? 'text' : 'password'"
                            [ngModel]="p.apiKeyInput"
                            (ngModelChange)="onKeyInput(p, $event)"
                            class="w-full px-4 py-3 bg-bg-secondary border border-border-subtle rounded-lg text-sm focus:outline-none transition-colors pr-12"
                            [style.border-color]="p.apiKeyInput ? p.color : ''"
                            placeholder="sk-..."
                            autocomplete="off"
                            spellcheck="false"
                          />
                          <button
                            type="button"
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                            (click)="p.showKey = !p.showKey"
                          >
                            @if (p.showKey) {
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
                          {{ p.hintKey | translate }}
                        </p>
                      </div>

                      <button
                        type="button"
                        class="w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        [style.background-color]="p.color"
                        [disabled]="p.saving || !p.apiKeyInput.trim()"
                        (click)="saveApiKey(p)"
                      >
                        @if (p.saving) {
                          <div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        } @else {
                          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                            <polyline points="17 21 17 13 7 13 7 21"/>
                            <polyline points="7 3 7 8 15 8"/>
                          </svg>
                        }
                        <span>{{ 'common.save' | translate }}</span>
                      </button>
                    </div>
                  } @else {
                    <!-- Configured State -->
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <div class="flex items-center gap-2" [style.color]="p.color">
                          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                          </svg>
                          <span class="text-sm font-medium">{{ 'settings.apiKeyConfigured' | translate }}</span>
                        </div>
                        <span class="text-text-muted text-sm tracking-widest">::::::::::::::::::</span>
                      </div>

                      <button
                        type="button"
                        class="flex items-center gap-2 px-4 py-2 text-danger hover:bg-danger/10 rounded-lg transition-colors text-sm"
                        (click)="deleteApiKey(p)"
                      >
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                          <line x1="10" y1="11" x2="10" y2="17"/>
                          <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                        <span>{{ 'common.delete' | translate }}</span>
                      </button>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </section>

        <!-- Language Section -->
        <section class="mb-8">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-lg bg-accent-qobuz/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent-qobuz" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M2 12h20"/>
                <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
              </svg>
            </div>
            <div>
              <h2 class="text-lg font-semibold">{{ 'settings.language' | translate }}</h2>
              <p class="text-sm text-text-muted">{{ 'settings.languageDescription' | translate }}</p>
            </div>
          </div>

          <div class="bg-bg-card border border-border-subtle rounded-xl p-4">
            <div class="flex gap-3">
              <button
                class="flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all"
                [class.bg-accent-qobuz]="translationService.currentLang() === 'de'"
                [class.text-white]="translationService.currentLang() === 'de'"
                [class.bg-bg-secondary]="translationService.currentLang() !== 'de'"
                [class.text-text-secondary]="translationService.currentLang() !== 'de'"
                [class.hover:bg-bg-card-hover]="translationService.currentLang() !== 'de'"
                (click)="setLanguage('de')"
              >
                Deutsch
              </button>
              <button
                class="flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all"
                [class.bg-accent-qobuz]="translationService.currentLang() === 'en'"
                [class.text-white]="translationService.currentLang() === 'en'"
                [class.bg-bg-secondary]="translationService.currentLang() !== 'en'"
                [class.text-text-secondary]="translationService.currentLang() !== 'en'"
                [class.hover:bg-bg-card-hover]="translationService.currentLang() !== 'en'"
                (click)="setLanguage('en')"
              >
                English
              </button>
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
  readonly translationService = inject(TranslationService);
  private readonly t = this.translationService;
  private readonly profileService = inject(ProfileService);

  readonly providers = signal<ProviderUi[]>([]);
  readonly toastMessage = signal<string | null>(null);
  readonly toastType = signal<'success' | 'error'>('success');

  private readonly providerDefaults: Record<string, { color: string; bgColor: string; hintKey: string }> = {
    mistral:   { color: '#FF7000', bgColor: 'rgba(255, 112, 0, 0.1)',  hintKey: 'settings.mistralHint' },
    anthropic: { color: '#D4A574', bgColor: 'rgba(212, 165, 116, 0.1)', hintKey: 'settings.anthropicHint' },
    openai:    { color: '#10A37F', bgColor: 'rgba(16, 163, 127, 0.1)',  hintKey: 'settings.openaiHint' },
  };

  ngOnInit(): void {
    this.navState.usePreset('hidden');
    this.loadProviders();
  }

  toggleMenu(): void {
    this.navState.toggleHamburger();
  }

  private loadProviders(): void {
    this.http.get<ApiResponse<AiProviderStatus[]>>('/api/settings?handler=aiProviders')
      .subscribe({
        next: response => {
          if (response.success && response.data) {
            const uiProviders = response.data.map(p => ({
              ...p,
              ...this.providerDefaults[p.provider],
              apiKeyInput: '',
              showKey: false,
              saving: false,
            }));
            this.providers.set(uiProviders);
          }
        },
        error: () => this.showToast(this.t.t('settings.loadStatusError'), 'error')
      });
  }

  onKeyInput(provider: ProviderUi, value: string): void {
    provider.apiKeyInput = value;
  }

  saveApiKey(provider: ProviderUi): void {
    const apiKey = provider.apiKeyInput.trim();
    if (!apiKey) return;

    provider.saving = true;

    this.http.put<ApiResponse<void>>(`/api/settings?handler=aiApiKey&provider=${provider.provider}`, { apiKey })
      .subscribe({
        next: response => {
          provider.saving = false;
          if (response.success) {
            provider.apiKeyInput = '';
            provider.isConfigured = true;
            // If no other provider is active, auto-activate this one
            const anyActive = this.providers().some(p => p.isActive);
            if (!anyActive) {
              this.setActiveProvider(provider);
            }
            this.showToast(this.t.t('settings.saveSuccess'), 'success');
          } else {
            this.showToast(response.error || this.t.t('settings.saveError'), 'error');
          }
        },
        error: () => {
          provider.saving = false;
          this.showToast(this.t.t('settings.connectionError'), 'error');
        }
      });
  }

  deleteApiKey(provider: ProviderUi): void {
    if (!confirm(this.t.t('settings.deleteConfirm'))) return;

    this.http.delete<ApiResponse<void>>(`/api/settings?handler=aiApiKey&provider=${provider.provider}`)
      .subscribe({
        next: response => {
          if (response.success) {
            provider.isConfigured = false;
            provider.isActive = false;
            // Reload to get updated active state
            this.loadProviders();
            this.showToast(this.t.t('settings.deleteSuccess'), 'success');
          } else {
            this.showToast(response.error || this.t.t('settings.deleteError'), 'error');
          }
        },
        error: () => this.showToast(this.t.t('settings.connectionError'), 'error')
      });
  }

  setActiveProvider(provider: ProviderUi): void {
    if (!provider.isConfigured) {
      this.showToast(this.t.t('settings.providerNotConfigured'), 'error');
      return;
    }

    this.http.put<ApiResponse<void>>('/api/settings?handler=activeAiProvider', { provider: provider.provider })
      .subscribe({
        next: response => {
          if (response.success) {
            // Update UI: deactivate all, activate selected
            this.providers.update(providers =>
              providers.map(p => ({ ...p, isActive: p.provider === provider.provider }))
            );
            this.showToast(this.t.t('settings.providerActivated', { provider: provider.name }), 'success');
          } else {
            this.showToast(response.error || this.t.t('settings.saveError'), 'error');
          }
        },
        error: () => this.showToast(this.t.t('settings.connectionError'), 'error')
      });
  }

  setLanguage(lang: 'de' | 'en'): void {
    this.translationService.setLanguage(lang);
    const profileId = this.profileService.activeProfile()?.id;
    if (profileId) {
      this.http.put(`/api/settings?handler=language&id=${profileId}`, { language: lang })
        .subscribe();
    }
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toastMessage.set(message);
    this.toastType.set(type);
    setTimeout(() => this.toastMessage.set(null), 3000);
  }
}
