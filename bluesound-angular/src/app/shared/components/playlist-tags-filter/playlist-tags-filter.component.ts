import { Component, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PlaylistTag {
  value: string;
  label: string;
}

/**
 * Playlist category/tag filter matching Razor implementation
 */
@Component({
  selector: 'app-playlist-tags-filter',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="playlist-tags-filter">
      <div class="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        @for (tag of tags; track tag.value) {
          <button
            class="tag-chip flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap"
            [class.active]="selectedTag() === tag.value"
            (click)="selectTag(tag.value)"
          >
            {{ tag.label }}
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .scrollbar-hide {
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }

    .tag-chip {
      background: var(--color-bg-card);
      border: 1px solid var(--color-border-subtle);
      color: var(--color-text-secondary);
    }

    .tag-chip:hover {
      background: var(--color-bg-secondary);
      border-color: var(--color-border-accent);
      color: var(--color-text-primary);
    }

    .tag-chip.active {
      background: var(--color-accent-qobuz);
      border-color: var(--color-accent-qobuz);
      color: white;
    }
  `]
})
export class PlaylistTagsFilterComponent {
  @Output() tagChange = new EventEmitter<string>();

  readonly selectedTag = signal<string>('all');

  /**
   * Playlist tags matching Qobuz API and Razor implementation
   */
  readonly tags: PlaylistTag[] = [
    { value: 'all', label: 'Alle' },
    { value: 'popular', label: 'Top-Playlists' },
    { value: 'new', label: 'Neuheiten' },
    { value: 'hi-res', label: 'Hi-Res' },
    { value: 'bestof2025', label: 'Best of 2025' },
    { value: 'focus', label: 'Fokus' },
    { value: 'mood', label: 'Moods' },
    { value: 'artist', label: 'KünstlerInnen' },
    { value: 'danslecasque', label: 'Gehört von...' },
    { value: 'label', label: 'Label-Geschichten' },
    { value: 'qobuzdigs', label: 'Geheimtipps' },
    { value: 'event', label: 'Events & Medien' },
    { value: 'partner', label: 'Hi-Fi Partners' }
  ];

  selectTag(tag: string): void {
    this.selectedTag.set(tag);
    // Emit empty string for 'all' to match API expectations
    this.tagChange.emit(tag === 'all' ? '' : tag);
  }
}
