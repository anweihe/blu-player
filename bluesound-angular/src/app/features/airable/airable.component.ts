import { Component, inject, signal, computed, OnInit, OnDestroy, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, interval } from 'rxjs';
import { AirableApiService } from '../../core/services/airable-api.service';
import { PlayerStateService } from '../../core/services/player-state.service';
import { AuthService } from '../../core/services/auth.service';
import { ProfileService } from '../../core/services/profile.service';
import { NavigationStateService } from '../../core/services/navigation-state.service';
import { AirableItem, AirableSection, AirableNavigationState, AirableSelectorMenu } from '../../core/models';
import { PlayerSelectorComponent, ProfileSwitcherComponent } from '../../layout';

@Component({
  selector: 'app-airable',
  standalone: true,
  imports: [CommonModule, PlayerSelectorComponent, ProfileSwitcherComponent],
  template: `
    <div class="min-h-screen bg-bg-primary">
      <!-- Header -->
      <header class="sticky top-0 z-[60] bg-bg-secondary border-b border-border-subtle safe-area-top">
        <div class="flex items-center justify-between px-4 py-3.5 max-w-5xl mx-auto">
          <div class="flex items-center gap-3">
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
              <svg class="w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M8 22V12h8v10" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <h1 class="text-xl font-semibold tracking-tight">Airable</h1>
            </div>
          </div>

          @if (auth.isLoggedIn()) {
            <button
              class="w-9 h-9 rounded-full text-white flex items-center justify-center text-sm font-semibold cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all"
              [style.background-color]="profileService.activeProfile() ? profileService.getProfileColor(profileService.activeProfile()!.id) : 'rgb(59 130 246)'"
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
      <main class="px-4 py-6 max-w-5xl mx-auto pb-28">
        <!-- No Player State -->
        @if (!hasBluesoundPlayer()) {
          <div class="flex flex-col items-center justify-center py-16 text-center">
            <div class="w-20 h-20 rounded-2xl bg-bg-card flex items-center justify-center mb-6">
              <svg class="w-10 h-10 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="4" y="4" width="16" height="16" rx="2"/>
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 9v-2M12 17v-2M9 12H7M17 12h-2"/>
              </svg>
            </div>
            <h2 class="text-xl font-bold mb-2">Bluesound Player erforderlich</h2>
            <p class="text-text-secondary mb-6 max-w-sm">
              Airable verwendet die integrierte Radio-Funktion deines Bluesound Players. Bitte wähle einen Player aus.
            </p>
            <button
              class="px-5 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
              (click)="openPlayerSelector()"
            >
              Player auswählen
            </button>
          </div>
        } @else {
          <!-- Breadcrumb -->
          <div class="flex items-center gap-2 mb-4 text-sm">
            @if (navigationStack().length > 0) {
              <button
                class="w-8 h-8 rounded-lg bg-bg-card flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-card-hover transition-colors"
                (click)="navigateBack()"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
            }
            <div class="flex items-center gap-1.5 flex-wrap">
              <button
                class="text-text-secondary hover:text-text-primary transition-colors"
                [class.text-text-primary]="navigationStack().length === 0"
                [class.font-medium]="navigationStack().length === 0"
                (click)="loadMainMenu()"
              >
                Airable
              </button>
              @for (nav of navigationStack(); track nav.uri; let i = $index; let last = $last) {
                <span class="text-text-muted">/</span>
                <button
                  class="transition-colors max-w-[100px] sm:max-w-[150px] truncate"
                  [class.text-text-primary]="last"
                  [class.font-medium]="last"
                  [class.text-text-secondary]="!last"
                  [class.hover:text-text-primary]="!last"
                  (click)="!last && navigateToLevel(i)"
                >
                  {{ nav.title }}
                </button>
              }
            </div>
          </div>

          <!-- Selector Menu (region/filter chips) -->
          @if (selectorMenu()) {
            <div class="mb-4 -mx-1">
              <div class="flex gap-2 overflow-x-auto pb-1 px-1 no-scrollbar">
                @for (chip of selectorMenu()!.items; track chip.uri) {
                  <button
                    class="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border"
                    [class.bg-blue-500]="chip.selected"
                    [class.text-white]="chip.selected"
                    [class.border-blue-500]="chip.selected"
                    [class.bg-bg-card]="!chip.selected"
                    [class.text-text-secondary]="!chip.selected"
                    [class.border-border-subtle]="!chip.selected"
                    [class.hover:bg-blue-600]="chip.selected"
                    [class.hover:border-blue-400]="!chip.selected"
                    (click)="applyFilter(chip.uri)"
                    [disabled]="isLoading()"
                  >
                    {{ chip.text }}
                  </button>
                }
              </div>
            </div>
          }

          <!-- Loading State -->
          @if (isLoading()) {
            <div class="flex items-center justify-center py-16">
              <div class="flex flex-col items-center gap-4">
                <div class="w-10 h-10 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                <span class="text-text-secondary">Laden...</span>
              </div>
            </div>
          } @else if (error()) {
            <!-- Error State -->
            <div class="flex flex-col items-center justify-center py-16 text-center">
              <div class="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <svg class="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>
              <p class="text-red-400 mb-4">{{ error() }}</p>
              <button
                class="px-4 py-2 bg-bg-card text-text-primary rounded-lg hover:bg-bg-card-hover transition-colors"
                (click)="loadMainMenu()"
              >
                Erneut versuchen
              </button>
            </div>
          } @else if (showCategoryGrid()) {
            <!-- Category Grid (Main Menu) -->
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              @for (item of currentItems(); track item.title; let i = $index) {
                <button
                  class="flex flex-col items-center gap-3 p-4 bg-bg-card border border-border-accent rounded-xl hover:bg-bg-card-hover hover:border-blue-500/30 transition-all"
                  (click)="handleItemClick(i)"
                >
                  <div class="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 overflow-hidden">
                    @if (item.imageUrl) {
                      <img [src]="item.imageUrl" class="w-full h-full rounded-full object-cover" loading="lazy" />
                    } @else {
                      <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" [innerHTML]="getCategoryIconPath(item.title)"></svg>
                    }
                  </div>
                  <div class="text-center">
                    <h3 class="font-medium text-text-primary text-sm">{{ item.title }}</h3>
                    @if (item.subtitle) {
                      <p class="text-xs text-text-muted mt-0.5">{{ item.subtitle }}</p>
                    }
                  </div>
                </button>
              }
            </div>
          } @else if (showSections()) {
            <!-- Sections View -->
            <div class="space-y-6">
              @for (section of currentSections(); track section.title || $index) {
                <section>
                  @if (section.title) {
                    <div class="flex items-center justify-between mb-3">
                      <h3 class="text-sm font-semibold text-text-muted uppercase tracking-wide">
                        {{ section.title }}
                      </h3>
                      @if (section.viewAllUri) {
                        <button
                          class="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1"
                          (click)="browseCategory(section.viewAllUri!, section.title!)"
                        >
                          Alle anzeigen
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path d="M9 18l6-6-6-6"/>
                          </svg>
                        </button>
                      }
                    </div>
                  }
                  <div class="space-y-1">
                    @for (item of section.items; track item.title; let i = $index) {
                      <button
                        class="w-full flex items-center gap-3 p-3 bg-bg-card rounded-lg hover:bg-bg-card-hover transition-colors group"
                        (click)="handleSectionItemClick(section, item)"
                      >
                        <div class="w-12 h-12 rounded-lg bg-bg-secondary flex-shrink-0 overflow-hidden">
                          @if (item.imageUrl) {
                            <img [src]="item.imageUrl" class="w-full h-full object-cover" loading="lazy" />
                          } @else {
                            <div class="w-full h-full flex items-center justify-center text-blue-500">
                              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                @if (item.isPlayable) {
                                  <circle cx="12" cy="12" r="10"/>
                                  <path d="M8 12a4 4 0 0 1 8 0"/>
                                  <circle cx="12" cy="12" r="1" fill="currentColor"/>
                                } @else {
                                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                                }
                              </svg>
                            </div>
                          }
                        </div>
                        <div class="flex-1 min-w-0 text-left">
                          <h4 class="font-medium text-text-primary truncate">{{ item.title }}</h4>
                          @if (item.subtitle) {
                            <p class="text-xs text-text-muted truncate">{{ item.subtitle }}</p>
                          }
                        </div>
                        <div class="flex-shrink-0">
                          @if (item.isPlayable) {
                            <div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                              </svg>
                            </div>
                          } @else {
                            <svg class="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path d="M9 18l6-6-6-6"/>
                            </svg>
                          }
                        </div>
                      </button>
                    }
                  </div>
                </section>
              }
            </div>
          } @else if (showItemsList()) {
            <!-- Items List (Flat View) -->
            <div class="space-y-1">
              @for (item of currentItems(); track item.title; let i = $index) {
                <button
                  class="w-full flex items-center gap-3 p-3 bg-bg-card rounded-lg hover:bg-bg-card-hover transition-colors group"
                  (click)="handleItemClick(i)"
                >
                  <div class="w-12 h-12 rounded-lg bg-bg-secondary flex-shrink-0 overflow-hidden">
                    @if (item.imageUrl) {
                      <img [src]="item.imageUrl" class="w-full h-full object-cover" loading="lazy" />
                    } @else {
                      <div class="w-full h-full flex items-center justify-center text-blue-500">
                        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                          @if (item.isPlayable) {
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M8 12a4 4 0 0 1 8 0"/>
                            <circle cx="12" cy="12" r="1" fill="currentColor"/>
                          } @else {
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                          }
                        </svg>
                      </div>
                    }
                  </div>
                  <div class="flex-1 min-w-0 text-left">
                    <h4 class="font-medium text-text-primary truncate">{{ item.title }}</h4>
                    @if (item.subtitle) {
                      <p class="text-xs text-text-muted truncate">{{ item.subtitle }}</p>
                    }
                  </div>
                  <div class="flex-shrink-0">
                    @if (item.isPlayable) {
                      <div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    } @else {
                      <svg class="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    }
                  </div>
                </button>
              }
            </div>
          } @else {
            <!-- Empty State -->
            <div class="flex flex-col items-center justify-center py-16 text-center">
              <svg class="w-16 h-16 text-text-muted mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 12a4 4 0 0 1 8 0"/>
                <path d="M6 12a6 6 0 0 1 12 0"/>
              </svg>
              <h3 class="text-lg font-medium mb-2">Keine Einträge</h3>
              <p class="text-text-secondary">Diese Kategorie enthält keine Einträge.</p>
            </div>
          }

          <!-- Load More Button -->
          @if (!isLoading() && nextLink()) {
            <div class="flex justify-center mt-6">
              <button
                class="px-6 py-2.5 bg-bg-card border border-border-subtle text-text-primary rounded-lg hover:bg-bg-card-hover transition-colors flex items-center gap-2"
                (click)="loadMore()"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12l7 7 7-7"/>
                </svg>
                Mehr laden
              </button>
            </div>
          }
        }
      </main>

      <!-- Player Selector -->
      <app-player-selector #playerSelector></app-player-selector>
    </div>
  `,
  styles: [`
    .safe-area-top {
      padding-top: env(safe-area-inset-top, 0);
    }
    .border-3 {
      border-width: 3px;
    }
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `]
})
export class AirableComponent implements OnInit, OnDestroy {
  @ViewChild('playerSelector') playerSelector!: PlayerSelectorComponent;

  readonly auth = inject(AuthService);
  readonly profileService = inject(ProfileService);
  private readonly airableApi = inject(AirableApiService);
  private readonly playerState = inject(PlayerStateService);
  private readonly navState = inject(NavigationStateService);

  readonly showProfileSwitcher = signal(false);

  readonly profileInitial = computed(() => {
    const profile = this.profileService.activeProfile();
    if (profile) {
      return this.profileService.getProfileInitial(profile.name);
    }
    return this.auth.userInitial();
  });

  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly currentItems = signal<AirableItem[]>([]);
  readonly currentSections = signal<AirableSection[]>([]);
  readonly navigationStack = signal<AirableNavigationState[]>([]);
  readonly isPlaying = signal(false);
  readonly selectorMenu = signal<AirableSelectorMenu | null>(null);
  readonly nextLink = signal<string | null>(null);

  // URI of the current browse page (for filter refresh)
  private currentBrowseUri: string | null = null;

  private statusSubscription?: Subscription;
  private previousPlayerId: string | null = null;

  readonly hasBluesoundPlayer = computed(() => {
    const player = this.playerState.selectedPlayer();
    return player !== null && player.ipAddress !== undefined;
  });

  constructor() {
    effect(() => {
      const player = this.playerState.selectedPlayer();
      const currentId = player?.id ?? null;

      if (currentId !== this.previousPlayerId && player?.ipAddress) {
        this.previousPlayerId = currentId;
        this.loadMainMenu();
      }
    });
  }

  readonly showCategoryGrid = computed(() => {
    return this.navigationStack().length === 0 && this.currentItems().length > 0;
  });

  readonly showSections = computed(() => {
    return this.currentSections().length > 0 &&
           (this.currentSections().length > 1 || !!this.currentSections()[0]?.title);
  });

  readonly showItemsList = computed(() => {
    return this.navigationStack().length > 0 &&
           this.currentItems().length > 0 &&
           !this.showSections();
  });

  ngOnInit(): void {
    this.navState.usePreset('hidden');
    if (this.hasBluesoundPlayer()) {
      this.loadMainMenu();
    }
  }

  ngOnDestroy(): void {
    this.stopStatusPolling();
  }

  openPlayerSelector(): void {
    this.playerSelector?.open();
  }

  openProfileSwitcher(): void {
    this.showProfileSwitcher.set(true);
  }

  closeProfileSwitcher(): void {
    this.showProfileSwitcher.set(false);
  }

  onProfileSelected(profile: { id: string }): void {
    this.profileService.setActiveProfileId(profile.id);
    this.closeProfileSwitcher();
  }

  toggleMenu(): void {
    this.navState.toggleHamburger();
  }

  loadMainMenu(): void {
    const player = this.playerState.selectedPlayer();
    if (!player) return;

    this.isLoading.set(true);
    this.error.set(null);
    this.navigationStack.set([]);
    this.currentSections.set([]);
    this.selectorMenu.set(null);
    this.nextLink.set(null);
    this.currentBrowseUri = null;

    this.airableApi.getMenu(player).subscribe({
      next: (response) => {
        if (response.success) {
          this.currentItems.set(response.items);
        } else {
          this.error.set(response.error || 'Airable-Menu konnte nicht geladen werden');
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Airable-Menu konnte nicht geladen werden');
        this.isLoading.set(false);
      }
    });
  }

  browseCategory(uri: string, title: string): void {
    const player = this.playerState.selectedPlayer();
    if (!player) return;

    this.isLoading.set(true);
    this.error.set(null);
    this.selectorMenu.set(null);
    this.nextLink.set(null);

    this.navigationStack.update(stack => [...stack, { uri, title }]);
    this.currentBrowseUri = uri;

    this.airableApi.browse(player, uri).subscribe({
      next: (response) => {
        if (response.success) {
          this.selectorMenu.set(response.selectorMenu ?? null);
          this.nextLink.set(response.nextLink ?? null);

          if (response.hasMultipleSections && response.sections.length > 0) {
            this.currentSections.set(response.sections);
            this.currentItems.set([]);
          } else {
            this.currentItems.set(response.items);
            this.currentSections.set([]);
          }
        } else {
          this.error.set(response.error || 'Kategorie konnte nicht geladen werden');
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Kategorie konnte nicht geladen werden');
        this.isLoading.set(false);
      }
    });
  }

  applyFilter(uri: string): void {
    const player = this.playerState.selectedPlayer();
    if (!player || !this.currentBrowseUri) return;

    this.isLoading.set(true);

    this.airableApi.executePlayerLink(player, uri).subscribe({
      next: () => {
        // Reload current browse page after filter is applied
        const currentUri = this.currentBrowseUri!;
        this.nextLink.set(null);

        this.airableApi.browse(player, currentUri).subscribe({
          next: (response) => {
            if (response.success) {
              this.selectorMenu.set(response.selectorMenu ?? null);
              this.nextLink.set(response.nextLink ?? null);

              if (response.hasMultipleSections && response.sections.length > 0) {
                this.currentSections.set(response.sections);
                this.currentItems.set([]);
              } else {
                this.currentItems.set(response.items);
                this.currentSections.set([]);
              }
            } else {
              this.error.set(response.error || 'Fehler beim Aktualisieren');
            }
            this.isLoading.set(false);
          },
          error: () => {
            this.error.set('Fehler beim Aktualisieren');
            this.isLoading.set(false);
          }
        });
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  loadMore(): void {
    const player = this.playerState.selectedPlayer();
    const uri = this.nextLink();
    if (!player || !uri) return;

    this.isLoading.set(true);
    this.nextLink.set(null);

    this.airableApi.browse(player, uri).subscribe({
      next: (response) => {
        if (response.success) {
          this.nextLink.set(response.nextLink ?? null);

          if (response.hasMultipleSections && response.sections.length > 0) {
            this.currentSections.update(s => [...s, ...response.sections]);
          } else {
            this.currentItems.update(items => [...items, ...response.items]);
          }
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  navigateBack(): void {
    const stack = this.navigationStack();
    if (stack.length === 0) return;

    const newStack = stack.slice(0, -1);
    this.navigationStack.set(newStack);

    if (newStack.length === 0) {
      this.loadMainMenu();
    } else {
      const previous = newStack[newStack.length - 1];
      this.navigationStack.set(newStack.slice(0, -1));
      this.browseCategory(previous.uri, previous.title);
    }
  }

  navigateToLevel(level: number): void {
    const stack = this.navigationStack();
    if (level >= stack.length - 1) return;

    const target = stack[level];
    this.navigationStack.set(stack.slice(0, level));
    this.browseCategory(target.uri, target.title);
  }

  handleItemClick(index: number): void {
    const item = this.currentItems()[index];
    if (!item) return;

    if (item.isPlayable) {
      this.playStation(item);
    } else if (item.isBrowsable && item.actionUri) {
      this.browseCategory(item.actionUri, item.title);
    }
  }

  handleSectionItemClick(section: AirableSection, item: AirableItem): void {
    if (item.isPlayable) {
      this.playStation(item);
    } else if (item.isBrowsable && item.actionUri) {
      this.browseCategory(item.actionUri, item.title);
    }
  }

  playStation(item: AirableItem): void {
    const player = this.playerState.selectedPlayer();
    if (!player) return;

    this.airableApi.playStation(player, item).subscribe({
      next: (response) => {
        if (response.success) {
          this.isPlaying.set(true);
          this.startStatusPolling();

          const profileId = this.auth.getProfileId();
          if (profileId) {
            this.airableApi.saveToHistory(profileId, item).subscribe();
          }
        } else {
          this.error.set(response.error || 'Station konnte nicht abgespielt werden');
        }
      }
    });
  }

  private startStatusPolling(): void {
    this.stopStatusPolling();
    const player = this.playerState.selectedPlayer();
    if (!player) return;

    this.statusSubscription = interval(5000).subscribe(() => {
      const currentPlayer = this.playerState.selectedPlayer();
      if (!currentPlayer) {
        this.stopStatusPolling();
        return;
      }

      this.airableApi.getBluesoundStatus(currentPlayer).subscribe({
        next: (response) => {
          if (response.success && response.status) {
            this.isPlaying.set(
              response.status.state === 'play' || response.status.state === 'stream'
            );
          }
        }
      });
    });
  }

  private stopStatusPolling(): void {
    this.statusSubscription?.unsubscribe();
    this.statusSubscription = undefined;
  }

  getCategoryIconPath(title: string): string {
    const lowerTitle = (title || '').toLowerCase();

    if (lowerTitle.includes('favourites') || lowerTitle.includes('favorite')) {
      return '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>';
    }
    if (lowerTitle.includes('popular') || lowerTitle.includes('chart') || lowerTitle.includes('most')) {
      return '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>';
    }
    if (lowerTitle.includes('local') || lowerTitle.includes('lokal')) {
      return '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>';
    }
    if (lowerTitle.includes('podcast')) {
      return '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>';
    }
    if (lowerTitle.includes('genre')) {
      return '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>';
    }
    if (lowerTitle.includes('location') || lowerTitle.includes('place') || lowerTitle.includes('country') || lowerTitle.includes('region')) {
      return '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>';
    }
    if (lowerTitle.includes('germany') || lowerTitle.includes('deutschland')) {
      return '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>';
    }

    // Default radio icon
    return '<circle cx="12" cy="12" r="10"/><path d="M8 12a4 4 0 0 1 8 0"/><path d="M6 12a6 6 0 0 1 12 0"/><circle cx="12" cy="12" r="1" fill="currentColor"/>';
  }
}
