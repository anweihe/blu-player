import { Component, Input, Output, EventEmitter, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { QobuzAlbum } from '../../../core/models';
import { ContextMenuService } from '../../services/context-menu.service';

@Component({
  selector: 'app-album-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <a
      [routerLink]="['/qobuz/album', album.id]"
      class="album-card group block bg-bg-card border border-border-subtle rounded-lg overflow-hidden transition-all hover:border-border-accent hover:-translate-y-0.5 hover:shadow-lg"
      [class.compact]="compact"
    >
      <!-- Cover -->
      <div class="album-cover relative aspect-square bg-bg-secondary overflow-hidden">
        @if (album.image?.large || album.image?.small) {
          <img
            [src]="album.image?.large || album.image?.small"
            [alt]="album.title"
            class="w-full h-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        } @else {
          <div class="w-full h-full flex items-center justify-center text-text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        }

        <!-- Context Menu Button (3-dot) - Top Right -->
        <button
          type="button"
          class="context-menu-btn absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          (click)="onMenuClick($event)"
          title="Mehr Optionen"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="19" r="2"/>
          </svg>
        </button>

        <!-- Badges (moved to left) -->
        <div class="absolute top-2 left-2 flex flex-col gap-1">
          @if (album.hires_streamable || album.hires || (album.maximum_bit_depth && album.maximum_bit_depth > 16)) {
            <span class="px-1.5 py-0.5 bg-accent-qobuz/90 text-white text-[10px] font-bold rounded">
              Hi-Res
            </span>
          }
          @if (showRank && rank) {
            <span class="px-1.5 py-0.5 bg-black/70 text-white text-[10px] font-bold rounded">
              #{{ rank }}
            </span>
          }
        </div>

        <!-- Play Overlay -->
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <button
            class="w-12 h-12 rounded-full bg-accent-qobuz text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform pointer-events-auto"
            (click)="onPlayClick($event)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Info -->
      <div class="p-3" [class.p-2]="compact">
        <h3 class="text-sm font-semibold truncate" [class.text-xs]="compact">
          {{ album.title }}
        </h3>
        @if (album.artist?.name) {
          <p class="text-xs text-text-muted truncate mt-0.5">
            {{ album.artist?.name }}
          </p>
        }
        @if (showYear && album.released_at) {
          <p class="text-[10px] text-text-muted mt-1">
            {{ getYear(album.released_at) }}
          </p>
        }
      </div>
    </a>
  `,
  styles: [`
    .album-card.compact .album-cover {
      border-radius: 6px;
    }
    .context-menu-btn:hover {
      background: rgba(0, 0, 0, 0.8);
    }
  `]
})
export class AlbumCardComponent {
  private readonly contextMenu = inject(ContextMenuService);

  @Input({ required: true }) album!: QobuzAlbum;
  @Input() compact = false;
  @Input() showRank = false;
  @Input() rank?: number;
  @Input() showYear = false;

  @Output() play = new EventEmitter<QobuzAlbum>();

  onPlayClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.play.emit(this.album);
  }

  onMenuClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenu.openAlbumMenu(event, this.album);
  }

  getYear(timestamp: number): string {
    return new Date(timestamp * 1000).getFullYear().toString();
  }
}
