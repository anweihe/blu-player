import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { QobuzPlaylist } from '../../../core/models';

@Component({
  selector: 'app-playlist-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <a
      [routerLink]="['/qobuz/playlist', playlist.id]"
      class="playlist-card group block bg-bg-card border border-border-subtle rounded-lg overflow-hidden transition-all hover:border-border-accent hover:-translate-y-0.5 hover:shadow-lg"
    >
      <!-- Cover -->
      <div class="playlist-cover relative aspect-square bg-bg-secondary overflow-hidden">
        @if (getCoverImage()) {
          <img
            [src]="getCoverImage()"
            [alt]="playlist.name"
            class="w-full h-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        } @else {
          <div class="w-full h-full flex items-center justify-center text-text-muted bg-gradient-to-br from-bg-secondary to-bg-card">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </div>
        }

        <!-- Duration Badge -->
        @if (playlist.duration) {
          <div class="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-medium rounded">
            {{ formatDuration(playlist.duration) }}
          </div>
        }

        <!-- Play Overlay -->
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <button
            class="w-12 h-12 rounded-full bg-accent-qobuz text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform"
            (click)="onPlayClick($event)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Info -->
      <div class="p-3">
        <h3 class="text-sm font-semibold truncate">
          {{ playlist.name }}
        </h3>
        <p class="text-xs text-text-muted mt-0.5">
          {{ playlist.tracks_count }} Tracks
        </p>
        @if (playlist.owner?.name && showOwner) {
          <p class="text-[10px] text-text-muted mt-1 truncate">
            von {{ playlist.owner?.name }}
          </p>
        }
      </div>
    </a>
  `
})
export class PlaylistCardComponent {
  @Input({ required: true }) playlist!: QobuzPlaylist;
  @Input() showOwner = false;

  @Output() play = new EventEmitter<QobuzPlaylist>();

  getCoverImage(): string | undefined {
    return this.playlist.images300?.[0] ||
           this.playlist.images150?.[0] ||
           this.playlist.images?.[0];
  }

  onPlayClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.play.emit(this.playlist);
  }

  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} Min`;
  }
}
