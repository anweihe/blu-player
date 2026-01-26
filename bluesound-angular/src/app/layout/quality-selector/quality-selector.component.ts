import { Component, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerStateService, StreamingQuality } from '../../core/services/player-state.service';
import { PlaybackService } from '../../core/services/playback.service';

interface QualityOption {
  id: StreamingQuality;
  label: string;
  description: string;
  badge?: string;
}

@Component({
  selector: 'app-quality-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isVisible()) {
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black/50 z-[110]"
        (click)="close()"
      ></div>

      <!-- Panel -->
      <div
        class="fixed bottom-0 left-0 right-0 bg-bg-primary rounded-t-2xl z-[111] safe-area-bottom animate-slide-up"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <div>
            <h2 class="text-lg font-semibold">Streaming-Qualität</h2>
            <p class="text-sm text-text-muted">Änderungen gelten ab dem nächsten Track</p>
          </div>
          <button
            class="w-8 h-8 rounded-full hover:bg-bg-card flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
            (click)="close()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Quality Options -->
        <div class="p-4 space-y-2">
          @for (option of qualityOptions; track option.id) {
            <button
              class="w-full flex items-center gap-4 p-4 rounded-xl transition-colors"
              [class.bg-accent-qobuz/10]="isSelected(option.id)"
              [class.border-accent-qobuz]="isSelected(option.id)"
              [class.border-2]="isSelected(option.id)"
              [class.bg-bg-card]="!isSelected(option.id)"
              [class.hover:bg-bg-card-hover]="!isSelected(option.id)"
              (click)="selectQuality(option.id)"
            >
              <div
                class="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
                [class.bg-accent-qobuz]="isSelected(option.id)"
                [class.text-white]="isSelected(option.id)"
                [class.bg-bg-secondary]="!isSelected(option.id)"
                [class.text-text-muted]="!isSelected(option.id)"
              >
                @switch (option.id) {
                  @case (5) { <span class="text-sm">MP3</span> }
                  @case (6) { <span class="text-sm">CD</span> }
                  @case (7) { <span class="text-xs">24bit</span> }
                  @case (27) { <span class="text-xs">MAX</span> }
                }
              </div>
              <div class="flex-1 text-left">
                <div class="flex items-center gap-2">
                  <p class="font-medium" [class.text-accent-qobuz]="isSelected(option.id)">
                    {{ option.label }}
                  </p>
                  @if (option.badge) {
                    <span class="px-1.5 py-0.5 bg-accent-qobuz/20 text-accent-qobuz text-xs font-medium rounded">
                      {{ option.badge }}
                    </span>
                  }
                </div>
                <p class="text-sm text-text-muted">{{ option.description }}</p>
              </div>
              @if (isSelected(option.id)) {
                <div class="w-6 h-6 rounded-full bg-accent-qobuz text-white flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              }
            </button>
          }
        </div>

        <!-- Info Note -->
        <div class="px-6 pb-6 text-center">
          <p class="text-xs text-text-muted">
            Höhere Qualität benötigt mehr Bandbreite und Speicher
          </p>
        </div>
      </div>
    }
  `,
  styles: [`
    .safe-area-bottom {
      padding-bottom: env(safe-area-inset-bottom, 0);
    }

    @keyframes slide-up {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }

    .animate-slide-up {
      animation: slide-up 0.3s ease-out;
    }
  `]
})
export class QualitySelectorComponent {
  readonly playerState = inject(PlayerStateService);
  private readonly playback = inject(PlaybackService);

  readonly isVisible = signal(false);

  readonly qualityOptions: QualityOption[] = [
    {
      id: 27,
      label: 'Hi-Res Max',
      description: 'FLAC 24-Bit bis 192 kHz',
      badge: 'Beste Qualität'
    },
    {
      id: 7,
      label: 'Hi-Res',
      description: 'FLAC 24-Bit bis 96 kHz'
    },
    {
      id: 6,
      label: 'CD-Qualität',
      description: 'FLAC 16-Bit / 44.1 kHz'
    },
    {
      id: 5,
      label: 'MP3',
      description: '320 kbps'
    }
  ];

  open(): void {
    this.isVisible.set(true);
  }

  close(): void {
    this.isVisible.set(false);
  }

  isSelected(quality: StreamingQuality): boolean {
    return this.playerState.streamingQuality() === quality;
  }

  selectQuality(quality: StreamingQuality): void {
    this.playback.setQuality(quality);
    this.close();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isVisible()) {
      this.close();
    }
  }
}
