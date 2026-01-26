import { Component, inject, signal, computed, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { PlayerStateService } from '../../core/services/player-state.service';
import { PlaybackService } from '../../core/services/playback.service';
import { formatDuration } from '../../core/models';
import { QualitySelectorComponent } from '../quality-selector/quality-selector.component';
import { PlayerSelectorComponent } from '../player-selector/player-selector.component';

type PopupTab = 'player' | 'queue';

@Component({
  selector: 'app-now-playing-popup',
  standalone: true,
  imports: [CommonModule, RouterLink, QualitySelectorComponent, PlayerSelectorComponent],
  template: `
    <!-- Backdrop -->
    @if (playerState.isNowPlayingVisible()) {
      <div
        class="fixed inset-0 bg-black/60 z-[100] transition-opacity duration-300"
        [class.opacity-100]="!isClosing()"
        [class.opacity-0]="isClosing()"
        (click)="close()"
      ></div>
    }

    <!-- Popup Panel -->
    @if (playerState.isNowPlayingVisible()) {
      <div
        #popupPanel
        class="fixed left-0 right-0 bottom-0 bg-bg-primary rounded-t-3xl z-[101] max-h-[90vh] overflow-hidden flex flex-col transition-transform duration-300 ease-out safe-area-bottom"
        [style.transform]="popupTransform()"
        (touchstart)="onTouchStart($event)"
        (touchmove)="onTouchMove($event)"
        (touchend)="onTouchEnd()"
      >
        <!-- Drag Handle -->
        <div class="flex justify-center py-3 cursor-grab" (mousedown)="onDragStart($event)">
          <div class="w-10 h-1 bg-text-muted/30 rounded-full"></div>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-border-subtle px-4">
          <button
            class="flex-1 py-3 text-sm font-medium transition-colors relative"
            [class.text-accent-qobuz]="activeTab() === 'player'"
            [class.text-text-muted]="activeTab() !== 'player'"
            (click)="setTab('player')"
          >
            Aktueller Titel
            @if (activeTab() === 'player') {
              <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-qobuz"></div>
            }
          </button>
          <button
            class="flex-1 py-3 text-sm font-medium transition-colors relative"
            [class.text-accent-qobuz]="activeTab() === 'queue'"
            [class.text-text-muted]="activeTab() !== 'queue'"
            (click)="setTab('queue')"
          >
            Warteschlange
            @if (playerState.queue().length > 0) {
              <span class="ml-1 px-1.5 py-0.5 bg-accent-qobuz/10 text-accent-qobuz text-xs rounded">
                {{ playerState.queue().length }}
              </span>
            }
            @if (activeTab() === 'queue') {
              <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-qobuz"></div>
            }
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto">
          @if (activeTab() === 'player') {
            <!-- Player View -->
            <div class="p-6 flex flex-col items-center">
              <!-- Large Cover Art -->
              <div class="w-64 h-64 md:w-80 md:h-80 rounded-xl overflow-hidden bg-bg-secondary shadow-2xl mb-6">
                @if (coverImage()) {
                  <img [src]="coverImage()" [alt]="trackTitle()" class="w-full h-full object-cover" />
                } @else {
                  <div class="w-full h-full flex items-center justify-center text-text-muted">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                }
              </div>

              <!-- Track Info -->
              <div class="text-center mb-6 w-full max-w-md">
                <h2 class="text-xl font-bold truncate mb-1">{{ trackTitle() || 'Kein Titel' }}</h2>
                @if (artistId()) {
                  <a
                    [routerLink]="['/qobuz/artist', artistId()]"
                    class="text-text-secondary hover:text-accent-qobuz transition-colors"
                    (click)="close()"
                  >
                    {{ artistName() || 'Unbekannter Künstler' }}
                  </a>
                } @else {
                  <p class="text-text-secondary">{{ artistName() || 'Unbekannter Künstler' }}</p>
                }
                @if (albumTitle()) {
                  <p class="text-sm text-text-muted mt-1 truncate">{{ albumTitle() }}</p>
                }
              </div>

              <!-- Progress Bar -->
              <div class="w-full max-w-md mb-4">
                <div
                  class="h-1.5 bg-bg-secondary rounded-full cursor-pointer group"
                  (click)="seekTo($event)"
                >
                  <div
                    class="h-full bg-accent-qobuz rounded-full relative transition-all"
                    [style.width.%]="playerState.progressPercent()"
                  >
                    <div class="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                </div>
                <div class="flex justify-between mt-2 text-xs text-text-muted">
                  <span>{{ playerState.formattedPosition() }}</span>
                  <span>{{ playerState.formattedDuration() }}</span>
                </div>
              </div>

              <!-- Playback Controls -->
              <div class="flex items-center justify-center gap-6 mb-6">
                <!-- Shuffle -->
                <button class="w-10 h-10 text-text-muted hover:text-text-primary transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>

                <!-- Previous -->
                <button
                  class="w-12 h-12 text-text-primary hover:text-accent-qobuz transition-colors"
                  (click)="skipPrevious()"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z"/>
                  </svg>
                </button>

                <!-- Play/Pause -->
                <button
                  class="w-16 h-16 rounded-full bg-accent-qobuz text-white flex items-center justify-center hover:opacity-90 transition-opacity shadow-lg"
                  (click)="togglePlayPause()"
                >
                  @if (playerState.isPlaying()) {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                    </svg>
                  } @else {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  }
                </button>

                <!-- Next -->
                <button
                  class="w-12 h-12 text-text-primary hover:text-accent-qobuz transition-colors"
                  (click)="skipNext()"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                  </svg>
                </button>

                <!-- Repeat -->
                <button class="w-10 h-10 text-text-muted hover:text-text-primary transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              <!-- Quality & Player Info -->
              <div class="flex items-center gap-4 text-sm">
                <button
                  class="flex items-center gap-2 px-3 py-1.5 bg-accent-qobuz/10 text-accent-qobuz rounded-lg hover:bg-accent-qobuz/20 transition-colors"
                  (click)="openQualitySelector()"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  {{ playerState.qualityLabel() }}
                </button>
                <button
                  class="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors"
                  (click)="openPlayerSelector()"
                >
                  @if (playerState.playerMode() === 'browser') {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Browser
                  } @else {
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    {{ playerState.selectedPlayer()?.name }}
                  }
                </button>
              </div>
            </div>
          } @else {
            <!-- Queue View -->
            <div class="p-4">
              @if (playerState.queue().length === 0) {
                <div class="text-center py-12 text-text-muted">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <p>Warteschlange ist leer</p>
                </div>
              } @else {
                <div class="space-y-1">
                  @for (item of playerState.queue(); track item.id; let i = $index) {
                    <div
                      class="flex items-center gap-3 p-3 rounded-lg transition-colors"
                      [class.bg-accent-qobuz/10]="i === playerState.queueIndex()"
                      [class.hover:bg-bg-card]="i !== playerState.queueIndex()"
                    >
                      <span class="w-6 text-center text-sm text-text-muted">{{ i + 1 }}</span>
                      <div class="w-10 h-10 rounded bg-bg-secondary overflow-hidden flex-shrink-0">
                        @if (item.imageUrl) {
                          <img [src]="item.imageUrl" [alt]="item.title" class="w-full h-full object-cover" />
                        }
                      </div>
                      <div class="flex-1 min-w-0">
                        <p
                          class="text-sm font-medium truncate"
                          [class.text-accent-qobuz]="i === playerState.queueIndex()"
                        >
                          {{ item.title }}
                        </p>
                        <p class="text-xs text-text-muted truncate">{{ item.artist }}</p>
                      </div>
                      <span class="text-sm text-text-muted">{{ formatDuration(item.duration) }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    }

    <!-- Selectors -->
    <app-quality-selector #qualitySelector></app-quality-selector>
    <app-player-selector #playerSelector></app-player-selector>
  `,
  styles: [`
    .safe-area-bottom {
      padding-bottom: env(safe-area-inset-bottom, 0);
    }
  `]
})
export class NowPlayingPopupComponent {
  @ViewChild('popupPanel') popupPanel!: ElementRef<HTMLDivElement>;
  @ViewChild('qualitySelector') qualitySelector!: QualitySelectorComponent;
  @ViewChild('playerSelector') playerSelector!: PlayerSelectorComponent;

  readonly playerState = inject(PlayerStateService);
  private readonly playback = inject(PlaybackService);
  private readonly router = inject(Router);

  readonly activeTab = signal<PopupTab>('player');
  readonly isClosing = signal(false);

  // Touch/drag state
  private touchStartY = 0;
  private currentDragY = 0;
  readonly dragOffset = signal(0);

  // Computed values
  readonly coverImage = computed(() => {
    const status = this.playerState.playbackStatus();
    const track = this.playerState.currentTrack();
    return status?.imageUrl || track?.album?.image?.large;
  });

  readonly trackTitle = computed(() => {
    const status = this.playerState.playbackStatus();
    const track = this.playerState.currentTrack();
    return status?.title || track?.title;
  });

  readonly artistName = computed(() => {
    const status = this.playerState.playbackStatus();
    const track = this.playerState.currentTrack();
    return status?.artist || track?.performer?.name;
  });

  readonly artistId = computed(() => {
    const status = this.playerState.playbackStatus();
    const track = this.playerState.currentTrack();
    return status?.artistId || track?.performer?.id;
  });

  readonly albumTitle = computed(() => {
    const status = this.playerState.playbackStatus();
    const track = this.playerState.currentTrack();
    return status?.album || track?.album?.title;
  });

  readonly popupTransform = computed(() => {
    if (this.isClosing()) {
      return 'translateY(100%)';
    }
    const offset = this.dragOffset();
    return offset > 0 ? `translateY(${offset}px)` : 'translateY(0)';
  });

  setTab(tab: PopupTab): void {
    this.activeTab.set(tab);
  }

  close(): void {
    this.isClosing.set(true);
    setTimeout(() => {
      this.playerState.hideNowPlaying();
      this.isClosing.set(false);
      this.dragOffset.set(0);
    }, 300);
  }

  // Touch handlers for swipe-to-close
  onTouchStart(event: TouchEvent): void {
    this.touchStartY = event.touches[0].clientY;
    this.currentDragY = 0;
  }

  onTouchMove(event: TouchEvent): void {
    const currentY = event.touches[0].clientY;
    const diff = currentY - this.touchStartY;

    // Only allow dragging down
    if (diff > 0) {
      this.currentDragY = diff;
      this.dragOffset.set(diff);
    }
  }

  onTouchEnd(): void {
    // Close if dragged more than 100px or 25% of popup height
    if (this.currentDragY > 100) {
      this.close();
    } else {
      // Snap back
      this.dragOffset.set(0);
    }
    this.currentDragY = 0;
  }

  // Mouse drag handlers (for desktop)
  onDragStart(event: MouseEvent): void {
    event.preventDefault();
    this.touchStartY = event.clientY;

    const onMouseMove = (e: MouseEvent) => {
      const diff = e.clientY - this.touchStartY;
      if (diff > 0) {
        this.currentDragY = diff;
        this.dragOffset.set(diff);
      }
    };

    const onMouseUp = () => {
      if (this.currentDragY > 100) {
        this.close();
      } else {
        this.dragOffset.set(0);
      }
      this.currentDragY = 0;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // Playback controls
  togglePlayPause(): void {
    this.playback.togglePlayPause();
  }

  skipPrevious(): void {
    this.playback.skipPrevious();
  }

  skipNext(): void {
    this.playback.skipNext();
  }

  async seekTo(event: MouseEvent): Promise<void> {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const percent = ((event.clientX - rect.left) / rect.width) * 100;
    await this.playback.seekToPercent(percent);
  }

  formatDuration = formatDuration;

  openQualitySelector(): void {
    this.qualitySelector.open();
  }

  openPlayerSelector(): void {
    this.playerSelector.open();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.playerState.isNowPlayingVisible()) {
      this.close();
    }
  }
}
