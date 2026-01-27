import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HistoryService } from '../../core/services/history.service';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { NavigationStateService } from '../../core/services/navigation-state.service';
import { HistorySection, HistoryDisplayItem } from '../../core/models';
import { ProfileSwitcherComponent } from '../../layout';

interface SourceCard {
  id: string;
  name: string;
  description: string;
  route: string;
  colorClass: string;
  bgClass: string;
  hoverBorderClass: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ProfileSwitcherComponent],
  template: `
    <div class="min-h-screen bg-bg-primary">
      <!-- Header -->
      <header class="sticky top-0 z-[60] bg-bg-secondary border-b border-border-subtle safe-area-top">
        <div class="flex items-center justify-between px-4 py-3.5 max-w-5xl mx-auto">
          <!-- Left: Hamburger + Brand -->
          <div class="flex items-center gap-3">
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
            <div class="flex items-center gap-2.5">
              <svg class="w-7 h-7 text-accent-qobuz" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
              </svg>
              <h1 class="text-xl font-semibold tracking-tight">Bluesound</h1>
            </div>
          </div>

          <!-- Right: Profile -->
          @if (auth.isLoggedIn()) {
            <button
              class="w-9 h-9 rounded-full text-white flex items-center justify-center text-sm font-semibold cursor-pointer hover:ring-2 hover:ring-accent-qobuz/50 transition-all"
              [style.background-color]="profileService.activeProfile() ? profileService.getProfileColor(profileService.activeProfile()!.id) : 'var(--color-accent-qobuz)'"
              (click)="openProfileSwitcher()"
            >
              {{ profileInitial() }}
            </button>
          }
        </div>
      </header>

      <!-- Profile Switcher Modal -->
      @if (showProfileSwitcher()) {
        <app-profile-switcher
          (closed)="closeProfileSwitcher()"
          (profileSelected)="onProfileSelected($event)"
        />
      }

      <!-- Main Content -->
      <main class="px-4 py-8 max-w-xl mx-auto pb-28">
        <!-- Title -->
        <div class="text-center mb-6">
          <h2 class="text-2xl font-bold tracking-tight mb-1.5">Musik streamen</h2>
          <p class="text-sm text-text-secondary">Wähle eine Quelle um loszulegen</p>
        </div>

        <!-- Source Grid -->
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-8">
          @for (source of sources; track source.id) {
            <a
              [routerLink]="source.route"
              class="source-card flex flex-col items-center gap-1.5 p-3 bg-bg-card border border-border-accent rounded-xl cursor-pointer transition-all hover:bg-bg-card-hover hover:-translate-y-0.5"
              [class]="'hover:border-' + source.hoverBorderClass"
            >
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center"
                [class]="source.bgClass"
              >
                @switch (source.id) {
                  @case ('qobuz') {
                    <svg class="w-5 h-5" [class]="source.colorClass" viewBox="0 0 100 100" fill="currentColor">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="6"/>
                      <circle cx="50" cy="50" r="20"/>
                    </svg>
                  }
                  @case ('tunein') {
                    <svg class="w-5 h-5" [class]="source.colorClass" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5">
                      <circle cx="50" cy="50" r="45"/>
                      <path d="M30 50a20 20 0 0140 0" stroke-width="4"/>
                      <path d="M20 50a30 30 0 0160 0" stroke-width="4"/>
                      <circle cx="50" cy="50" r="5" fill="currentColor"/>
                    </svg>
                  }
                  @case ('radioparadise') {
                    <svg class="w-5 h-5" [class]="source.colorClass" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="5">
                      <path d="M50 10L10 35l40 25 40-25-40-25z"/>
                      <path d="M10 65l40 25 40-25"/>
                      <path d="M10 50l40 25 40-25"/>
                    </svg>
                  }
                }
              </div>
              <span class="text-xs font-semibold text-text-primary">{{ source.name }}</span>
              <span class="text-[10px] text-text-muted hidden sm:block">{{ source.description }}</span>
            </a>
          }
        </div>

        <!-- Listening History -->
        @if (isLoading()) {
          <div class="space-y-6">
            @for (i of [1, 2]; track i) {
              <div class="animate-pulse">
                <div class="h-4 w-40 bg-bg-secondary rounded mb-3"></div>
                <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                  @for (j of [1, 2, 3, 4]; track j) {
                    <div class="flex flex-col items-center gap-2">
                      <div class="w-14 h-14 sm:w-16 sm:h-16 bg-bg-secondary rounded-lg"></div>
                      <div class="h-3 w-12 bg-bg-secondary rounded"></div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        } @else if (historySections().length > 0) {
          <div class="space-y-6">
            @for (section of historySections(); track section.title; let i = $index) {
              <section class="history-section" [style.animation-delay.ms]="i * 50">
                <h3 class="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
                  {{ section.title }}
                  <span class="flex-1 h-px bg-border-subtle"></span>
                </h3>
                <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                  @for (item of section.items; track item.id) {
                    <button
                      class="history-item flex flex-col items-center p-2.5 bg-bg-card rounded-lg hover:bg-bg-card-hover transition-all hover:scale-102 active:scale-98"
                      (click)="playFromHistory(item)"
                    >
                      @if (item.imageUrl) {
                        <img
                          [src]="item.imageUrl"
                          [alt]="item.title"
                          class="w-14 h-14 sm:w-16 sm:h-16 rounded-md object-cover bg-bg-secondary shadow-sm mb-2"
                          loading="lazy"
                        />
                      } @else {
                        <div
                          class="w-14 h-14 sm:w-16 sm:h-16 rounded-md flex items-center justify-center mb-2"
                          [class]="getPlaceholderClass(section.iconType)"
                        >
                          <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            @switch (section.iconType) {
                              @case ('tunein') {
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M8 12a4 4 0 018 0"/>
                                <circle cx="12" cy="12" r="1" fill="currentColor"/>
                              }
                              @case ('radioparadise') {
                                <path d="M12 3L2 9l10 6 10-6-10-6z"/>
                                <path d="M2 17l10 6 10-6"/>
                                <path d="M2 13l10 6 10-6"/>
                              }
                              @default {
                                <path d="M9 18V5l12-2v13"/>
                                <circle cx="6" cy="18" r="3"/>
                                <circle cx="18" cy="16" r="3"/>
                              }
                            }
                          </svg>
                        </div>
                      }
                      <span class="text-xs font-medium text-text-primary text-center line-clamp-2 leading-tight">
                        {{ item.title }}
                      </span>
                      @if (item.subtitle) {
                        <span class="text-[10px] text-text-muted text-center truncate w-full mt-0.5">
                          {{ item.subtitle }}
                        </span>
                      }
                    </button>
                  }
                </div>
              </section>
            }
          </div>
        }

        <!-- Players Link -->
        <div class="flex justify-center mt-8">
          <a
            routerLink="/players"
            class="inline-flex items-center justify-center gap-2 px-4 py-2 bg-bg-card border border-border-accent rounded-full text-text-secondary text-xs hover:bg-bg-card-hover hover:text-text-primary hover:border-white/20 transition-all"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="4" y="4" width="16" height="16" rx="2"/>
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 9v-2M12 17v-2M9 12H7M17 12h-2"/>
            </svg>
            <span>Bluesound Players verwalten</span>
          </a>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .safe-area-top {
      padding-top: env(safe-area-inset-top, 0);
    }

    .history-section {
      animation: fadeInUp 0.4s ease forwards;
      opacity: 0;
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .hover\\:scale-102:hover {
      transform: scale(1.02);
    }

    .active\\:scale-98:active {
      transform: scale(0.98);
    }
  `]
})
export class HomeComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly historyService = inject(HistoryService);
  private readonly router = inject(Router);
  private readonly navState = inject(NavigationStateService);

  readonly isLoading = signal(true);
  readonly historySections = signal<HistorySection[]>([]);

  readonly sources: SourceCard[] = [
    {
      id: 'qobuz',
      name: 'Qobuz',
      description: 'Hi-Res Streaming',
      route: '/qobuz',
      colorClass: 'text-accent-qobuz',
      bgClass: 'bg-accent-qobuz/15',
      hoverBorderClass: 'accent-qobuz'
    },
    {
      id: 'tunein',
      name: 'TuneIn',
      description: 'Internet Radio',
      route: '/tunein',
      colorClass: 'text-orange-500',
      bgClass: 'bg-orange-500/15',
      hoverBorderClass: 'orange-500'
    },
    {
      id: 'radioparadise',
      name: 'Radio Paradise',
      description: 'Eclectic Mix',
      route: '/radioparadise',
      colorClass: 'text-emerald-500',
      bgClass: 'bg-emerald-500/15',
      hoverBorderClass: 'emerald-500'
    }
  ];

  readonly profileService = inject(ProfileService);

  // Profile switcher
  readonly showProfileSwitcher = signal(false);

  readonly profileInitial = computed(() => {
    const profile = this.profileService.activeProfile();
    if (profile) {
      return this.profileService.getProfileInitial(profile.name);
    }
    return this.auth.userInitial();
  });

  openProfileSwitcher(): void {
    this.showProfileSwitcher.set(true);
  }

  closeProfileSwitcher(): void {
    this.showProfileSwitcher.set(false);
  }

  onProfileSelected(profile: { id: string }): void {
    this.profileService.setActiveProfileId(profile.id);
    this.closeProfileSwitcher();
    this.loadHistory();
  }

  ngOnInit(): void {
    // Hide app header - this page has its own header
    this.navState.usePreset('hidden');
    this.loadHistory();
  }

  loadHistory(): void {
    this.isLoading.set(true);
    this.historyService.getHistory().subscribe({
      next: (sections) => {
        this.historySections.set(sections);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  toggleMenu(): void {
    this.navState.toggleHamburger();
  }

  getPlaceholderClass(iconType: string): string {
    switch (iconType) {
      case 'tunein':
        return 'bg-gradient-to-br from-orange-500/15 to-orange-500/5 text-orange-500';
      case 'radioparadise':
        return 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 text-emerald-500';
      default:
        return 'bg-gradient-to-br from-accent-qobuz/15 to-accent-qobuz/5 text-accent-qobuz';
    }
  }

  playFromHistory(item: HistoryDisplayItem): void {
    switch (item.type) {
      case 'album':
        this.router.navigate(['/qobuz/album', item.actionId]);
        break;
      case 'playlist':
        this.router.navigate(['/qobuz/playlist', item.actionId]);
        break;
      case 'tunein':
        this.router.navigate(['/tunein']);
        // TODO: Auto-play the station
        break;
      case 'radioparadise':
        this.router.navigate(['/radioparadise']);
        // TODO: Auto-play the channel
        break;
    }
  }
}
