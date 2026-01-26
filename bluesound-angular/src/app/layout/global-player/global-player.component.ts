import { Component, inject, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerStateService } from '../../core/services/player-state.service';
import { PlaybackService } from '../../core/services/playback.service';
import { PlayerSelectorComponent } from '../player-selector/player-selector.component';

@Component({
  selector: 'app-global-player',
  standalone: true,
  imports: [CommonModule, PlayerSelectorComponent],
  template: `
    <!-- Mobile Mini Player Bar -->
    <div
      class="global-player fixed bottom-0 left-0 right-0 bg-bg-card border-t border-border-subtle z-50 safe-area-bottom"
      [class.hidden]="!hasContent()"
    >
      <!-- Progress Bar (thin line at top) -->
      <div class="progress-line h-0.5 bg-bg-secondary">
        <div
          class="h-full bg-accent-qobuz transition-all duration-200"
          [style.width.%]="playerState.progressPercent()"
        ></div>
      </div>

      <!-- Main Content -->
      <div
        class="flex items-center gap-3 p-3 cursor-pointer"
        (click)="openNowPlaying()"
      >
        <!-- Cover Art -->
        <div class="w-12 h-12 rounded-md bg-bg-secondary overflow-hidden flex-shrink-0">
          @if (coverImage()) {
            <img [src]="coverImage()" [alt]="trackTitle()" class="w-full h-full object-cover" />
          } @else {
            <div class="w-full h-full flex items-center justify-center text-text-muted">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
          }
        </div>

        <!-- Track Info -->
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate text-text-primary">{{ trackTitle() || 'Kein Titel' }}</p>
          <p class="text-xs text-text-muted truncate">{{ artistName() || 'Unbekannter Künstler' }}</p>
        </div>

        <!-- Play/Pause Button -->
        <button
          class="w-10 h-10 rounded-full bg-accent-qobuz text-white flex items-center justify-center hover:opacity-90 transition-opacity"
          (click)="togglePlayPause($event)"
        >
          @if (playerState.isPlaying()) {
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          }
        </button>

        <!-- Skip Button (mobile) -->
        <button
          class="w-10 h-10 rounded-full text-text-secondary hover:text-text-primary flex items-center justify-center transition-colors md:hidden"
          (click)="skipNext($event)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>

      <!-- Desktop Extended Controls (hidden on mobile) -->
      <div class="hidden md:flex items-center gap-4 px-4 pb-3 -mt-1">
        <!-- Time Display -->
        <span class="text-xs text-text-muted w-12 text-right">{{ playerState.formattedPosition() }}</span>

        <!-- Progress Bar (clickable) -->
        <div
          class="flex-1 h-1 bg-bg-secondary rounded-full cursor-pointer group"
          (click)="seekTo($event)"
        >
          <div
            class="h-full bg-accent-qobuz rounded-full relative group-hover:bg-accent-qobuz-hover transition-colors"
            [style.width.%]="playerState.progressPercent()"
          >
            <div class="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
        </div>

        <!-- Duration -->
        <span class="text-xs text-text-muted w-12">{{ playerState.formattedDuration() }}</span>

        <!-- Volume Button -->
        <button
          class="w-8 h-8 text-text-secondary hover:text-text-primary flex items-center justify-center"
          (click)="toggleVolumePanel()"
        >
          @if (playerState.isMuted() || playerState.volume() === 0) {
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          } @else if (playerState.volume() < 50) {
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072M12 6.253v11.494m0 0c-.891 0-1.337-1.077-.707-1.707l4.707-4.707a1 1 0 000-1.414l-4.707-4.707c-.63-.63-1.077-.184-1.077.707" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          }
        </button>

        <!-- Player Selector -->
        <button
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-secondary hover:bg-bg-card-hover text-sm transition-colors"
          (click)="togglePlayerSelector()"
        >
          @if (playerState.playerMode() === 'browser') {
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span class="hidden lg:inline">Browser</span>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-accent-qobuz" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <span class="hidden lg:inline truncate max-w-[100px]">{{ playerState.selectedPlayer()?.name }}</span>
          }
        </button>

        <!-- Quality Badge -->
        <div class="hidden xl:flex items-center gap-1.5 px-2 py-1 bg-accent-qobuz/10 rounded text-xs text-accent-qobuz font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          {{ playerState.qualityLabel() }}
        </div>
      </div>
    </div>

    <!-- Player Selector Panel -->
    <app-player-selector #playerSelector></app-player-selector>
  `,
  styles: [`
    .safe-area-bottom {
      padding-bottom: env(safe-area-inset-bottom, 0);
    }

    .global-player {
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
    }
  `]
})
export class GlobalPlayerComponent {
  @ViewChild('playerSelector') playerSelector!: PlayerSelectorComponent;

  readonly playerState = inject(PlayerStateService);
  private readonly playback = inject(PlaybackService);

  // Computed values for display
  readonly hasContent = computed(() => {
    // Footer immer sichtbar für Player-Auswahl
    return true;
  });

  readonly coverImage = computed(() => {
    const track = this.playerState.currentTrack();
    const status = this.playerState.playbackStatus();
    // Prefer Qobuz track info over status (status might show "Analog Input" etc.)
    if (track?.album?.image?.large) {
      return track.album.image.large;
    }
    if (track?.album?.image?.small) {
      return track.album.image.small;
    }
    return status?.imageUrl;
  });

  readonly trackTitle = computed(() => {
    const track = this.playerState.currentTrack();
    const status = this.playerState.playbackStatus();
    // Prefer Qobuz track info over status
    return track?.title || status?.title;
  });

  readonly artistName = computed(() => {
    const track = this.playerState.currentTrack();
    const status = this.playerState.playbackStatus();
    // Prefer Qobuz track info over status
    return track?.performer?.name || status?.artist;
  });

  openNowPlaying(): void {
    this.playerState.showNowPlaying();
  }

  togglePlayPause(event: Event): void {
    event.stopPropagation();
    this.playback.togglePlayPause();
  }

  skipNext(event: Event): void {
    event.stopPropagation();
    this.playback.skipNext();
  }

  async seekTo(event: MouseEvent): Promise<void> {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const percent = ((event.clientX - rect.left) / rect.width) * 100;
    await this.playback.seekToPercent(percent);
  }

  toggleVolumePanel(): void {
    this.playerState.isVolumePanelVisible.update(v => !v);
  }

  togglePlayerSelector(): void {
    this.playerSelector.open();
  }
}
