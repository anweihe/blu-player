import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { QobuzFavoriteArtist, getFavoriteArtistImageUrl } from '../../../core/models';

@Component({
  selector: 'app-artist-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <a
      [routerLink]="['/qobuz/artist', artist.id]"
      class="artist-card group block text-center p-4 rounded-xl bg-bg-card border border-border-subtle transition-all hover:border-border-accent hover:-translate-y-0.5 hover:shadow-lg"
    >
      <!-- Avatar -->
      <div class="w-24 h-24 mx-auto mb-3 rounded-full overflow-hidden bg-bg-secondary ring-2 ring-transparent group-hover:ring-accent-qobuz/30 transition-all">
        @if (getArtistImage()) {
          <img
            [src]="getArtistImage()"
            [alt]="artist.name"
            class="w-full h-full object-cover"
            loading="lazy"
          />
        } @else {
          <div class="w-full h-full flex items-center justify-center text-text-muted bg-gradient-to-br from-bg-secondary to-bg-card">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        }
      </div>

      <!-- Name -->
      <h3 class="text-sm font-semibold truncate">
        {{ artist.name }}
      </h3>

      <!-- Albums Count -->
      @if (artist.albums_count) {
        <p class="text-xs text-text-muted mt-1">
          {{ artist.albums_count }} {{ artist.albums_count === 1 ? 'Album' : 'Alben' }}
        </p>
      }
    </a>
  `
})
export class ArtistCardComponent {
  @Input({ required: true }) artist!: QobuzFavoriteArtist;

  getArtistImage(): string | undefined {
    return getFavoriteArtistImageUrl(this.artist);
  }
}
