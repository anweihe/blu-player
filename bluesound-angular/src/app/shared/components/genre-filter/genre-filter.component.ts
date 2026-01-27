import { Component, Input, Output, EventEmitter, signal, computed, OnInit, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QobuzApiService } from '../../../core/services/qobuz-api.service';

export interface Genre {
  id: number;
  name: string;
}

@Component({
  selector: 'app-genre-filter',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="genre-filter">
      <!-- Header with Toggle Button and Clear Button -->
      <div class="genre-filter-header">
        <button
          class="genre-toggle"
          [class.has-selection]="selectedCount() > 0"
          (click)="toggleExpanded()"
        >
          <!-- Music Icon -->
          <svg xmlns="http://www.w3.org/2000/svg" class="music-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <span>Genre</span>
          @if (selectedCount() > 0) {
            <span class="genre-badge">{{ selectedCount() }}</span>
          }
          <!-- Arrow Icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="arrow-icon"
            [class.rotated]="expanded()"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- Clear Button (X) -->
        @if (selectedCount() > 0) {
          <button class="genre-clear-btn" (click)="clearAll($event)" title="Alle Filter löschen">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        }
      </div>

      <!-- Collapsible Genre Chips -->
      @if (expanded()) {
        <div class="genre-chips">
          @for (genre of genres(); track genre.id) {
            <button
              class="genre-chip"
              [class.selected]="isSelected(genre.id)"
              (click)="toggleGenre(genre)"
            >
              @if (isSelected(genre.id)) {
                <svg class="check-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
              }
              {{ genre.name }}
            </button>
          }

          @if (loading()) {
            @for (i of [1,2,3]; track i) {
              <div class="genre-chip-skeleton"></div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .genre-filter {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .genre-filter-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .genre-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: var(--color-bg-card);
      border: 1px solid var(--color-border-subtle);
      border-radius: 20px;
      color: var(--color-text-secondary);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .genre-toggle:hover {
      background: var(--color-bg-secondary);
      border-color: var(--color-border-accent);
      color: var(--color-text-primary);
    }

    .genre-toggle.has-selection {
      border-color: var(--color-accent-qobuz);
      color: var(--color-text-primary);
    }

    .music-icon {
      width: 16px;
      height: 16px;
    }

    .arrow-icon {
      width: 16px;
      height: 16px;
      transition: transform 0.2s ease;
    }

    .arrow-icon.rotated {
      transform: rotate(180deg);
    }

    .genre-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      background: var(--color-accent-qobuz);
      border-radius: 9px;
      color: white;
      font-size: 11px;
      font-weight: 600;
    }

    .genre-clear-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 50%;
      color: #ef4444;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .genre-clear-btn:hover {
      background: rgba(239, 68, 68, 0.25);
      border-color: rgba(239, 68, 68, 0.5);
    }

    .genre-clear-btn svg {
      width: 16px;
      height: 16px;
    }

    .genre-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding-top: 4px;
    }

    .genre-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: var(--color-bg-card);
      border: 1px solid var(--color-border-subtle);
      border-radius: 20px;
      color: var(--color-text-secondary);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .genre-chip:hover {
      background: var(--color-bg-secondary);
      border-color: var(--color-border-accent);
      color: var(--color-text-primary);
    }

    .genre-chip.selected {
      background: rgba(0, 212, 170, 0.12);
      border-color: var(--color-accent-qobuz);
      color: var(--color-accent-qobuz);
    }

    .check-icon {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    .genre-chip-skeleton {
      width: 80px;
      height: 36px;
      background: var(--color-bg-secondary);
      border-radius: 20px;
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `]
})
export class GenreFilterComponent implements OnInit, OnChanges {
  private readonly qobuzApi = inject(QobuzApiService);

  /** Initial genre IDs as strings */
  @Input() initialGenres: string[] = [];

  @Output() genreChange = new EventEmitter<string[]>();

  readonly genres = signal<Genre[]>([]);
  readonly selectedGenres = signal<number[]>([]);
  readonly loading = signal(true);
  readonly expanded = signal(false);

  // Computed count for badge
  readonly selectedCount = computed(() => this.selectedGenres().length);

  ngOnInit(): void {
    this.applyInitialGenres();
    this.loadGenres();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialGenres'] && !changes['initialGenres'].firstChange) {
      this.applyInitialGenres();
    }
  }

  private applyInitialGenres(): void {
    if (this.initialGenres && this.initialGenres.length > 0) {
      const genreIds = this.initialGenres.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      this.selectedGenres.set(genreIds);
      // Auto-expand if genres are selected
      if (genreIds.length > 0) {
        this.expanded.set(true);
      }
    }
  }

  private loadGenres(): void {
    this.qobuzApi.getGenres().subscribe({
      next: genres => {
        this.genres.set(genres);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  toggleExpanded(): void {
    this.expanded.update(v => !v);
  }

  isSelected(genreId: number): boolean {
    return this.selectedGenres().includes(genreId);
  }

  toggleGenre(genre: Genre): void {
    const current = this.selectedGenres();

    // Always multi-select mode
    if (current.includes(genre.id)) {
      this.selectedGenres.set(current.filter(id => id !== genre.id));
    } else {
      this.selectedGenres.set([...current, genre.id]);
    }

    this.emitChange();
  }

  clearAll(event: Event): void {
    event.stopPropagation(); // Prevent toggle from firing
    this.selectedGenres.set([]);
    this.emitChange();
  }

  private emitChange(): void {
    const ids = this.selectedGenres().map(id => id.toString());
    this.genreChange.emit(ids);
  }
}
