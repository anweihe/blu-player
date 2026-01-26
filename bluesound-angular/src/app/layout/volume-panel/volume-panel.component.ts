import { Component, inject, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerStateService } from '../../core/services/player-state.service';
import { PlaybackService } from '../../core/services/playback.service';

@Component({
  selector: 'app-volume-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (playerState.isVolumePanelVisible()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/40 z-[80]"
        (click)="close()"
      ></div>

      <!-- Volume Panel -->
      <div
        class="fixed bottom-0 left-0 right-0 bg-bg-primary rounded-t-2xl z-[81] p-6 safe-area-bottom animate-slide-up"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold">Lautstärke</h3>
          <button
            class="w-8 h-8 rounded-full hover:bg-bg-card flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
            (click)="close()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        @if (playerState.isFixedVolume()) {
          <!-- Fixed Volume Message -->
          <div class="text-center py-8 text-text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            <p class="font-medium">Fixed Volume</p>
            <p class="text-sm mt-1">Die Lautstärke wird extern gesteuert</p>
          </div>
        } @else {
          <!-- Volume Slider -->
          <div class="mb-6">
            <!-- Current Volume Display -->
            <div class="flex items-center justify-center gap-4 mb-4">
              <button
                class="w-10 h-10 rounded-full bg-bg-card flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
                (click)="toggleMute()"
              >
                @if (playerState.isMuted() || playerState.volume() === 0) {
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                } @else {
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                }
              </button>
              <span class="text-4xl font-bold tabular-nums min-w-[80px] text-center">
                {{ playerState.isMuted() ? 0 : playerState.volume() }}
              </span>
              <span class="text-text-muted">%</span>
            </div>

            <!-- Slider Track -->
            <div
              #sliderTrack
              class="relative h-12 flex items-center cursor-pointer touch-none"
              (mousedown)="onSliderStart($event)"
              (touchstart)="onTouchStart($event)"
            >
              <!-- Background Track -->
              <div class="absolute inset-x-0 h-2 bg-bg-secondary rounded-full"></div>

              <!-- Filled Track -->
              <div
                class="absolute left-0 h-2 bg-accent-qobuz rounded-full transition-all"
                [style.width.%]="playerState.isMuted() ? 0 : playerState.volume()"
              ></div>

              <!-- Thumb -->
              <div
                class="absolute w-6 h-6 bg-white rounded-full shadow-lg border-2 border-accent-qobuz transition-all -translate-x-1/2"
                [style.left.%]="playerState.isMuted() ? 0 : playerState.volume()"
              ></div>
            </div>
          </div>

          <!-- Preset Buttons -->
          <div class="grid grid-cols-4 gap-3">
            @for (preset of presets; track preset) {
              <button
                class="py-3 rounded-lg text-sm font-medium transition-colors"
                [class.bg-accent-qobuz]="playerState.volume() === preset"
                [class.text-white]="playerState.volume() === preset"
                [class.bg-bg-card]="playerState.volume() !== preset"
                [class.text-text-secondary]="playerState.volume() !== preset"
                [class.hover:bg-bg-card-hover]="playerState.volume() !== preset"
                (click)="setVolume(preset)"
              >
                {{ preset }}%
              </button>
            }
          </div>
        }

        <!-- Player Info -->
        <div class="mt-6 pt-4 border-t border-border-subtle text-center text-sm text-text-muted">
          @if (playerState.playerMode() === 'browser') {
            <span class="flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Browser-Wiedergabe
            </span>
          } @else if (playerState.selectedPlayer()) {
            <span class="flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-accent-qobuz" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              {{ playerState.selectedPlayer()?.name }}
            </span>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .safe-area-bottom {
      padding-bottom: env(safe-area-inset-bottom, 0);
    }

    @keyframes slide-up {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }

    .animate-slide-up {
      animation: slide-up 0.3s ease-out;
    }
  `]
})
export class VolumePanelComponent {
  @ViewChild('sliderTrack') sliderTrack!: ElementRef<HTMLDivElement>;

  readonly playerState = inject(PlayerStateService);
  private readonly playback = inject(PlaybackService);

  readonly presets = [25, 50, 75, 100];

  private isDragging = false;

  close(): void {
    this.playerState.isVolumePanelVisible.set(false);
  }

  toggleMute(): void {
    this.playback.toggleMute();
  }

  setVolume(level: number): void {
    this.playback.setVolume(level);
  }

  // Mouse drag handling
  onSliderStart(event: MouseEvent): void {
    this.isDragging = true;
    this.updateVolumeFromEvent(event);

    const onMouseMove = (e: MouseEvent) => {
      if (this.isDragging) {
        this.updateVolumeFromEvent(e);
      }
    };

    const onMouseUp = () => {
      this.isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // Touch drag handling
  onTouchStart(event: TouchEvent): void {
    this.isDragging = true;
    this.updateVolumeFromTouch(event);

    const onTouchMove = (e: TouchEvent) => {
      if (this.isDragging) {
        e.preventDefault();
        this.updateVolumeFromTouch(e);
      }
    };

    const onTouchEnd = () => {
      this.isDragging = false;
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  }

  private updateVolumeFromEvent(event: MouseEvent): void {
    if (!this.sliderTrack) return;

    const track = this.sliderTrack.nativeElement;
    const rect = track.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const volume = Math.round(percent);

    this.playback.setVolume(volume);
  }

  private updateVolumeFromTouch(event: TouchEvent): void {
    if (!this.sliderTrack || !event.touches[0]) return;

    const track = this.sliderTrack.nativeElement;
    const rect = track.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((event.touches[0].clientX - rect.left) / rect.width) * 100));
    const volume = Math.round(percent);

    this.playback.setVolume(volume);
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.playerState.isVolumePanelVisible()) {
      this.close();
    }
  }
}
