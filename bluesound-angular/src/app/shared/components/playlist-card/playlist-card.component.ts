import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { QobuzPlaylist } from '../../../core/models';
import { ContextMenuService } from '../../services/context-menu.service';

@Component({
  selector: 'app-playlist-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <a
      [routerLink]="['/qobuz/playlist', playlist.id]"
      class="playlist-card group block bg-bg-card border border-border-subtle overflow-hidden transition-all hover:border-border-accent hover:-translate-y-0.5 hover:shadow-lg"
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

        <!-- Context Menu Button (3-dot) - Top Right, always visible -->
        <button
          type="button"
          class="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center z-10 hover:bg-black/80"
          (click)="onMenuClick($event)"
          title="Mehr Optionen"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="19" r="2"/>
          </svg>
        </button>

        <!-- Duration Badge -->
        @if (playlist.duration) {
          <div class="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-medium rounded">
            {{ formatDuration(playlist.duration) }}
          </div>
        }
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
  private readonly contextMenu = inject(ContextMenuService);

  @Input({ required: true }) playlist!: QobuzPlaylist;
  @Input() showOwner = false;

  @Output() play = new EventEmitter<QobuzPlaylist>();

  getCoverImage(): string | undefined {
    return this.playlist.images300?.[0] ||
           this.playlist.images150?.[0] ||
           this.playlist.images?.[0];
  }

  onMenuClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.openPlaylistMenu(event, this.playlist);
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
