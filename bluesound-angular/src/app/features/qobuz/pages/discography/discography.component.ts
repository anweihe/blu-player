import { Component, Input, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { QobuzApiService } from '../../../../core/services/qobuz-api.service';
import { QobuzAlbum } from '../../../../core/models';
import { AlbumCardComponent } from '../../../../shared/components';

/**
 * Release type filter options - matching Razor implementation
 * Uses valid API release_type values
 */
interface ReleaseFilter {
  value: string | null;
  label: string;
}

const RELEASE_FILTERS: ReleaseFilter[] = [
  { value: null, label: 'Alle' },
  { value: 'album', label: 'Alben' },
  { value: 'epSingle', label: 'EPs & Singles' },
  { value: 'live', label: 'Live' },
  { value: 'compilation', label: 'Compilations' },
  { value: 'other', label: 'Andere' }
];

/**
 * Sort options matching Razor implementation
 */
interface SortOption {
  value: string;
  label: string;
}

const SORT_OPTIONS: SortOption[] = [
  { value: 'release_date', label: 'Erscheinungsdatum' },
  { value: 'relevant', label: 'Beliebtheit' }
];

/**
 * Map various release type variations to valid API parameters
 */
function mapReleaseType(type: string | null): string | null {
  if (!type) return null;
  const typeMap: Record<string, string> = {
    'single': 'epSingle',
    'ep': 'epSingle',
    'ep-single': 'epSingle',
    'ep_single': 'epSingle',
    'epSingle': 'epSingle',
    'album': 'album',
    'live': 'live',
    'compilation': 'compilation',
    'other': 'other'
  };
  return typeMap[type] ?? type;
}

@Component({
  selector: 'app-discography',
  standalone: true,
  imports: [CommonModule, AlbumCardComponent],
  template: `
    <div class="discography-page bg-bg-primary min-h-screen pb-28">
      <!-- Header -->
      <div class="discography-page-header flex items-center gap-4 p-4 pl-16 mb-6">
        <button
          (click)="goBack()"
          class="btn-back flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span>Zurück</span>
        </button>
        <div class="discography-page-title-area flex flex-col gap-0.5">
          <h1 class="text-xl font-bold m-0 leading-tight">Diskografie</h1>
          @if (artistName()) {
            <span class="discography-artist-subtitle text-sm text-text-secondary">{{ artistName() }}</span>
          }
        </div>
      </div>

      <!-- Filter & Sort Controls -->
      <div class="discography-controls flex justify-between items-center mb-5 gap-4 flex-wrap px-4">
        <!-- Filter Buttons -->
        <div class="discography-filters flex gap-2 flex-wrap flex-1 overflow-x-auto scrollbar-hide pb-1">
          @for (filter of filters; track filter.value) {
            <button
              class="discography-filter-btn flex-shrink-0 px-4 py-2 rounded-full border text-sm font-medium whitespace-nowrap transition-colors"
              [class.bg-accent-qobuz]="currentFilter() === filter.value"
              [class.text-white]="currentFilter() === filter.value"
              [class.border-accent-qobuz]="currentFilter() === filter.value"
              [class.bg-transparent]="currentFilter() !== filter.value"
              [class.text-text-secondary]="currentFilter() !== filter.value"
              [class.border-border-accent]="currentFilter() !== filter.value"
              [class.hover:bg-bg-card]="currentFilter() !== filter.value"
              [class.hover:text-text-primary]="currentFilter() !== filter.value"
              (click)="setFilter(filter.value)"
            >
              {{ filter.label }}
            </button>
          }
        </div>

        <!-- Sort Dropdown (native select like Razor) -->
        <div class="discography-sort flex-shrink-0">
          <select
            class="px-3 py-2 rounded-lg bg-bg-card border border-border-accent text-text-primary text-sm cursor-pointer transition-colors hover:border-accent-qobuz focus:outline-none focus:border-accent-qobuz focus:ring-2 focus:ring-accent-qobuz/10"
            [value]="currentSort()"
            (change)="onSortChange($event)"
          >
            @for (option of sortOptions; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </div>
      </div>

      <!-- Content -->
      <div class="px-4">
        @if (loading() && albums().length === 0) {
          <!-- Skeleton Loading -->
          <div class="discography-page-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            @for (i of [1,2,3,4,5,6,7,8,9,10]; track i) {
              <div class="skeleton-card bg-bg-card rounded-lg overflow-hidden">
                <div class="aspect-square bg-bg-secondary animate-pulse"></div>
                <div class="p-3">
                  <div class="h-4 bg-bg-secondary rounded animate-pulse mb-2"></div>
                  <div class="h-3 bg-bg-secondary rounded animate-pulse w-2/3"></div>
                </div>
              </div>
            }
          </div>
        } @else if (albums().length === 0) {
          <!-- Empty State -->
          <div class="empty-state flex flex-col items-center justify-center py-16 text-text-muted">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p class="font-medium mb-1">Keine Veröffentlichungen in dieser Kategorie</p>
          </div>
        } @else {
          <!-- Album Grid -->
          <div class="discography-page-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            @for (album of albums(); track album.id) {
              <app-album-card
                [album]="album"
                [showYear]="true"
                (play)="playAlbum(album)"
              />
            }
          </div>

          <!-- Loading More Indicator -->
          @if (loadingMore()) {
            <div class="discography-loading flex flex-col items-center justify-center gap-3 py-10 text-text-secondary text-sm">
              <div class="loading-spinner-small w-6 h-6 border-2 border-border-accent border-t-accent-qobuz rounded-full animate-spin"></div>
              <span>Lade weitere Alben...</span>
            </div>
          }

          <!-- Scroll Sentinel for Intersection Observer -->
          <div #scrollSentinel class="scroll-sentinel h-px w-full"></div>
        }
      </div>
    </div>
  `,
  styles: [`
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }

    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .animate-spin {
      animation: spin 0.8s linear infinite;
    }

    /* Mobile adjustments */
    @media (max-width: 480px) {
      .discography-page-header {
        flex-direction: row;
        align-items: center;
        gap: 12px;
      }

      .discography-page-title-area h1 {
        font-size: 1.25rem;
      }

      .discography-controls {
        flex-direction: column;
        align-items: stretch;
      }

      .discography-sort {
        width: 100%;
      }

      .discography-sort select {
        width: 100%;
      }

      .discography-page-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }
    }
  `]
})
export class DiscographyComponent implements OnInit, OnDestroy {
  @Input() id!: string;

  private readonly qobuzApi = inject(QobuzApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly albums = signal<QobuzAlbum[]>([]);
  readonly artistName = signal<string | undefined>(undefined);
  readonly artistImage = signal<string | undefined>(undefined);
  readonly hasMore = signal(true);

  // Filter & Sort state
  readonly currentFilter = signal<string | null>(null);
  readonly currentSort = signal('release_date');

  readonly filters = RELEASE_FILTERS;
  readonly sortOptions = SORT_OPTIONS;

  private offset = 0;
  private readonly PAGE_SIZE = 20;
  private scrollObserver: IntersectionObserver | null = null;

  ngOnInit(): void {
    // Check for initial filter from query params
    this.route.queryParams.subscribe(params => {
      if (params['type']) {
        const mappedType = mapReleaseType(params['type']);
        this.currentFilter.set(mappedType);
      }
    });

    if (this.id) {
      this.loadArtistInfo();
      this.loadDiscography(true);
    }

    // Setup scroll observer after view init
    setTimeout(() => this.setupScrollObserver(), 100);
  }

  ngOnDestroy(): void {
    this.cleanupScrollObserver();
  }

  private setupScrollObserver(): void {
    const sentinel = document.querySelector('.scroll-sentinel');
    if (!sentinel) return;

    this.cleanupScrollObserver();

    this.scrollObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && this.hasMore() && !this.loadingMore() && !this.loading()) {
        this.loadMore();
      }
    }, { rootMargin: '200px' });

    this.scrollObserver.observe(sentinel);
  }

  private cleanupScrollObserver(): void {
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
      this.scrollObserver = null;
    }
  }

  private loadArtistInfo(): void {
    const artistId = parseInt(this.id, 10);
    this.qobuzApi.getArtistPage(artistId).subscribe({
      next: response => {
        this.artistName.set(response.artist?.name);
        this.artistImage.set(response.artist?.portraitUrl);
      }
    });
  }

  private loadDiscography(replace = false): void {
    if (this.loadingMore() || (!this.hasMore() && !replace)) return;

    if (replace) {
      this.loading.set(true);
      this.offset = 0;
    } else {
      this.loadingMore.set(true);
    }

    const artistId = parseInt(this.id, 10);
    const releaseType = this.currentFilter() ?? 'all';

    this.qobuzApi.getArtistDiscography(
      artistId,
      releaseType,
      replace ? 0 : this.offset,
      this.PAGE_SIZE,
      this.currentSort()
    ).subscribe({
      next: container => {
        const newAlbums = container.items ?? [];

        if (replace) {
          this.albums.set(newAlbums);
        } else {
          this.albums.update(current => [...current, ...newAlbums]);
        }

        this.hasMore.set(newAlbums.length >= this.PAGE_SIZE);
        this.offset = replace ? this.PAGE_SIZE : this.offset + newAlbums.length;
        this.loading.set(false);
        this.loadingMore.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    });
  }

  loadMore(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadDiscography(false);
  }

  goBack(): void {
    window.history.back();
  }

  setFilter(filter: string | null): void {
    if (this.currentFilter() === filter) return;
    this.currentFilter.set(filter);
    this.hasMore.set(true);
    this.loadDiscography(true);
  }

  onSortChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const sort = select.value;
    if (this.currentSort() === sort) return;
    this.currentSort.set(sort);
    this.hasMore.set(true);
    this.loadDiscography(true);
  }

  getYear(timestamp?: number): string {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).getFullYear().toString();
  }

  playAlbum(album: QobuzAlbum): void {
    if (album.id) {
      this.router.navigate(['/qobuz/album', album.id]);
    }
  }
}
