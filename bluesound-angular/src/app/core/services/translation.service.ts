import { Injectable, signal } from '@angular/core';

export type AppLanguage = 'de' | 'en';

const STORAGE_KEY = 'bluesound_language';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  readonly currentLang = signal<AppLanguage>('de');
  private translations = signal<Record<string, string>>({});

  async init(): Promise<void> {
    const lang = this.detectLanguage();
    await this.loadTranslations(lang);
  }

  async setLanguage(lang: AppLanguage): Promise<void> {
    if (lang === this.currentLang()) return;
    await this.loadTranslations(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  t(key: string, params?: Record<string, string | number>): string {
    let value = this.translations()[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(`{{${k}}}`, String(v));
      }
    }
    return value;
  }

  private detectLanguage(): AppLanguage {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'de' || stored === 'en') return stored;

    const browserLang = navigator.language || '';
    return browserLang.startsWith('de') ? 'de' : 'en';
  }

  private async loadTranslations(lang: AppLanguage): Promise<void> {
    try {
      const response = await fetch(`/i18n/${lang}.json`);
      const data = await response.json();
      this.translations.set(data);
      this.currentLang.set(lang);
    } catch {
      if (lang !== 'de') {
        await this.loadTranslations('de');
      }
    }
  }
}
