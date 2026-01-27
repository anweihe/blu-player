import { Injectable, signal } from '@angular/core';

export type NavigationMode = 'browse' | 'detail';

/** Right-side header items that can be shown */
export type HeaderRightItem = 'search' | 'profile' | 'settings' | 'hamburger';

export interface HeaderConfig {
  /** Hide the app header completely (for pages with their own header) */
  hidden?: boolean;
  /** Left action: hamburger menu or back button */
  leftAction: 'hamburger' | 'back';
  /** Route to navigate to when back is pressed */
  backRoute?: string;
  /** Title to display in header */
  title?: string;
  /** Show play button (for album/playlist pages) */
  showPlayButton?: boolean;
  /** Callback for play button */
  onPlayAll?: () => void;
  /** Items to show on the right side */
  rightItems?: HeaderRightItem[];
}

/** Default header configs for different sections */
export const HEADER_PRESETS = {
  /** Hidden - for pages with their own header */
  hidden: {
    hidden: true,
    leftAction: 'hamburger' as const,
    title: ''
  },
  /** Qobuz album detail */
  qobuzAlbum: {
    leftAction: 'back' as const,
    backRoute: '/qobuz/browse',
    title: 'Album',
    showPlayButton: true,
    rightItems: ['search'] as HeaderRightItem[]
  },
  /** Qobuz playlist detail */
  qobuzPlaylist: {
    leftAction: 'back' as const,
    backRoute: '/qobuz/browse',
    title: 'Playlist',
    showPlayButton: true,
    rightItems: ['search'] as HeaderRightItem[]
  },
  /** Qobuz artist detail */
  qobuzArtist: {
    leftAction: 'back' as const,
    backRoute: '/qobuz/browse',
    title: 'Künstler',
    rightItems: ['search'] as HeaderRightItem[]
  },
  /** Qobuz discography */
  qobuzDiscography: {
    leftAction: 'back' as const,
    title: 'Diskografie',
    rightItems: ['search'] as HeaderRightItem[]
  },
  /** Qobuz search */
  qobuzSearch: {
    leftAction: 'back' as const,
    backRoute: '/qobuz/browse',
    title: 'Suche',
    rightItems: [] as HeaderRightItem[]
  }
};

/**
 * Service to manage navigation state and header configuration.
 * Each page can configure its own header appearance.
 */
@Injectable({ providedIn: 'root' })
export class NavigationStateService {
  /** Current header configuration */
  readonly headerConfig = signal<HeaderConfig>({
    leftAction: 'hamburger',
    title: 'Bluesound',
    rightItems: ['search']
  });

  /** Hamburger menu open state */
  readonly hamburgerOpen = signal(false);

  /**
   * Open the hamburger menu
   */
  openHamburger(): void {
    this.hamburgerOpen.set(true);
  }

  /**
   * Close the hamburger menu
   */
  closeHamburger(): void {
    this.hamburgerOpen.set(false);
  }

  /**
   * Toggle the hamburger menu
   */
  toggleHamburger(): void {
    this.hamburgerOpen.update(v => !v);
  }

  /** Legacy: Current navigation mode for backward compatibility */
  readonly mode = signal<NavigationMode>('browse');

  /** Legacy: Detail page info for backward compatibility */
  readonly detailInfo = signal<{ backRoute: string; title?: string; showPlayButton?: boolean; onPlayAll?: () => void } | null>(null);

  /**
   * Set header configuration for the current page
   */
  setHeaderConfig(config: HeaderConfig): void {
    this.headerConfig.set(config);

    // Update legacy signals for backward compatibility
    this.mode.set(config.leftAction === 'back' ? 'detail' : 'browse');
    if (config.leftAction === 'back') {
      this.detailInfo.set({
        backRoute: config.backRoute ?? '',
        title: config.title,
        showPlayButton: config.showPlayButton,
        onPlayAll: config.onPlayAll
      });
    } else {
      this.detailInfo.set(null);
    }
  }

  /**
   * Use a preset header configuration
   */
  usePreset(preset: keyof typeof HEADER_PRESETS): void {
    this.setHeaderConfig(HEADER_PRESETS[preset]);
  }

  /**
   * Enter detail mode - shows back button in header
   * @deprecated Use setHeaderConfig instead
   */
  enterDetailMode(backRoute: string, title?: string, options?: { showPlayButton?: boolean; onPlayAll?: () => void }): void {
    this.setHeaderConfig({
      leftAction: 'back',
      backRoute,
      title,
      showPlayButton: options?.showPlayButton,
      onPlayAll: options?.onPlayAll,
      rightItems: ['search']
    });
  }

  /**
   * Update the play callback (useful when data loads after navigation)
   */
  updatePlayCallback(onPlayAll: () => void): void {
    const current = this.headerConfig();
    this.headerConfig.set({ ...current, onPlayAll });
  }

  /**
   * Exit detail mode - shows hamburger menu in header
   * @deprecated Use setHeaderConfig instead
   */
  exitDetailMode(): void {
    // Reset to hidden (pages with own headers will set their config)
    this.usePreset('hidden');
  }

  /**
   * Reset to default header
   */
  reset(): void {
    this.setHeaderConfig({
      leftAction: 'hamburger',
      title: 'Bluesound',
      rightItems: ['search']
    });
  }
}
