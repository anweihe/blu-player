import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { QobuzTrack, QobuzAlbum } from '../../core/models';

/**
 * Menu item definition
 */
export interface MenuItem {
  label: string;
  icon?: 'album' | 'artist' | 'play' | 'queue' | 'favorite';
  action: () => void;
  disabled?: boolean;
  divider?: boolean;
}

/**
 * Service for managing context menus across the application
 */
@Injectable({ providedIn: 'root' })
export class ContextMenuService {
  readonly isOpen = signal(false);
  readonly position = signal({ x: 0, y: 0 });
  readonly items = signal<MenuItem[]>([]);

  constructor(private router: Router) {}

  /**
   * Open context menu for a track
   */
  openTrackMenu(
    event: MouseEvent,
    track: QobuzTrack,
    options?: {
      onPlay?: () => void;
      onAddToQueue?: () => void;
      onAddToFavorites?: () => void;
    }
  ): void {
    event.preventDefault();
    event.stopPropagation();

    const menuItems: MenuItem[] = [];

    // Play option
    if (options?.onPlay) {
      menuItems.push({
        label: 'Jetzt abspielen',
        icon: 'play',
        action: options.onPlay
      });
    }

    // Add to queue
    if (options?.onAddToQueue) {
      menuItems.push({
        label: 'Zur Warteschlange',
        icon: 'queue',
        action: options.onAddToQueue
      });
    }

    // Divider before navigation
    if (menuItems.length > 0 && (track.album?.id || track.performer?.id)) {
      menuItems.push({ label: '', action: () => {}, divider: true });
    }

    // Go to album
    if (track.album?.id) {
      menuItems.push({
        label: 'Zum Album',
        icon: 'album',
        action: () => this.router.navigate(['/qobuz/album', track.album!.id])
      });
    }

    // Go to artist
    if (track.performer?.id) {
      menuItems.push({
        label: 'Zur Künstlerseite',
        icon: 'artist',
        action: () => this.router.navigate(['/qobuz/artist', track.performer!.id])
      });
    }

    // Add to favorites
    if (options?.onAddToFavorites) {
      menuItems.push({ label: '', action: () => {}, divider: true });
      menuItems.push({
        label: 'Zu Favoriten',
        icon: 'favorite',
        action: options.onAddToFavorites
      });
    }

    this.openAt(event.clientX, event.clientY, menuItems);
  }

  /**
   * Open context menu for an album
   */
  openAlbumMenu(
    event: MouseEvent,
    album: QobuzAlbum
  ): void {
    event.preventDefault();
    event.stopPropagation();

    const menuItems: MenuItem[] = [];

    // Go to album
    if (album.id) {
      menuItems.push({
        label: 'Zum Album',
        icon: 'album',
        action: () => this.router.navigate(['/qobuz/album', album.id])
      });
    }

    // Go to artist
    if (album.artist?.id) {
      menuItems.push({
        label: 'Zur Künstlerseite',
        icon: 'artist',
        action: () => this.router.navigate(['/qobuz/artist', album.artist!.id])
      });
    }

    this.openAt(event.clientX, event.clientY, menuItems);
  }

  /**
   * Open menu at specific position with custom items
   */
  openAt(x: number, y: number, items: MenuItem[]): void {
    // Adjust position for viewport bounds
    const menuWidth = 200;
    const menuHeight = items.filter(i => !i.divider).length * 44 + items.filter(i => i.divider).length * 9;
    const padding = 10;
    const bottomOffset = 100;

    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }
    if (x < padding) x = padding;

    if (y + menuHeight > window.innerHeight - bottomOffset) {
      y = y - menuHeight - 8;
    }
    if (y < padding) y = padding;

    this.position.set({ x, y });
    this.items.set(items);
    this.isOpen.set(true);
  }

  /**
   * Close the context menu
   */
  close(): void {
    this.isOpen.set(false);
    this.items.set([]);
  }
}
