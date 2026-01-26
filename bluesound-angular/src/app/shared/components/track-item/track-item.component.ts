import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { QobuzTrack, formatDuration } from '../../../core/models';

@Component({
  selector: 'app-track-item',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div
      class="track-item flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer"
      [class.hover:bg-bg-card]="!isPlaying"
      [class.bg-accent-qobuz/10]="isPlaying"
      (click)="onTrackClick()"
    >
      <!-- Track Number or Playing Indicator -->
      @if (showNumber) {
        <div class="w-6 flex-shrink-0 text-center">
          @if (isPlaying) {
            <div class="playing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          } @else {
            <span class="text-sm text-text-muted">{{ trackNumber }}</span>
          }
        </div>
      }

      <!-- Album Art -->
      @if (showArt) {
        <div class="w-10 h-10 rounded bg-bg-secondary overflow-hidden flex-shrink-0">
          @if (track.album?.image?.small || track.album?.image?.thumbnail) {
            <img
              [src]="track.album?.image?.small || track.album?.image?.thumbnail"
              [alt]="track.album?.title"
              class="w-full h-full object-cover"
            />
          }
        </div>
      }

      <!-- Track Info -->
      <div class="flex-1 min-w-0">
        <p
          class="text-sm font-medium truncate"
          [class.text-accent-qobuz]="isPlaying"
        >
          {{ track.title }}
          @if (track.version) {
            <span class="text-text-muted font-normal"> ({{ track.version }})</span>
          }
        </p>
        <p class="text-xs text-text-muted truncate">
          @if (showArtist && track.performer?.name) {
            <a
              [routerLink]="['/qobuz/artist', track.performer?.id]"
              class="hover:text-accent-qobuz hover:underline"
              (click)="$event.stopPropagation()"
            >
              {{ track.performer?.name }}
            </a>
          }
          @if (showArtist && showAlbum && track.performer?.name && track.album?.title) {
            <span> · </span>
          }
          @if (showAlbum && track.album?.title) {
            <a
              [routerLink]="['/qobuz/album', track.album?.id]"
              class="hover:text-accent-qobuz hover:underline"
              (click)="$event.stopPropagation()"
            >
              {{ track.album?.title }}
            </a>
          }
        </p>
      </div>

      <!-- Quality Badge -->
      @if (showQuality && (track.hires_streamable || track.hires || (track.maximum_bit_depth && track.maximum_bit_depth > 16))) {
        <span class="px-1.5 py-0.5 bg-accent-qobuz/10 text-accent-qobuz text-[10px] font-semibold rounded">
          Hi-Res
        </span>
      }

      <!-- Duration -->
      <span class="text-sm text-text-muted tabular-nums">
        {{ formatDuration(track.duration) }}
      </span>

      <!-- Menu Button -->
      @if (showMenu) {
        <button
          class="w-8 h-8 rounded-full text-text-muted hover:text-text-primary hover:bg-bg-secondary flex items-center justify-center transition-colors"
          (click)="onMenuClick($event)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      }
    </div>
  `,
  styles: [`
    .playing-indicator {
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 2px;
      height: 14px;
    }

    .playing-indicator span {
      width: 3px;
      background: var(--color-accent-qobuz);
      border-radius: 1px;
      animation: equalizer 0.8s ease-in-out infinite;
    }

    .playing-indicator span:nth-child(1) {
      height: 60%;
      animation-delay: 0s;
    }

    .playing-indicator span:nth-child(2) {
      height: 100%;
      animation-delay: 0.2s;
    }

    .playing-indicator span:nth-child(3) {
      height: 40%;
      animation-delay: 0.4s;
    }

    @keyframes equalizer {
      0%, 100% {
        transform: scaleY(0.5);
      }
      50% {
        transform: scaleY(1);
      }
    }
  `]
})
export class TrackItemComponent {
  @Input({ required: true }) track!: QobuzTrack;
  @Input() trackNumber?: number;
  @Input() showNumber = true;
  @Input() showArt = true;
  @Input() showArtist = true;
  @Input() showAlbum = false;
  @Input() showQuality = false;
  @Input() showMenu = true;
  @Input() isPlaying = false;

  @Output() play = new EventEmitter<QobuzTrack>();
  @Output() menu = new EventEmitter<{ track: QobuzTrack; event: MouseEvent }>();

  formatDuration = formatDuration;

  onTrackClick(): void {
    this.play.emit(this.track);
  }

  onMenuClick(event: MouseEvent): void {
    event.stopPropagation();
    this.menu.emit({ track: this.track, event });
  }
}
