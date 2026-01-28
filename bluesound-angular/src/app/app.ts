import { Component, inject, OnInit, isDevMode } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { AuthService } from './core/services/auth.service';
import { PlayerStateService } from './core/services/player-state.service';
import { PollingService } from './core/services/polling.service';
import { NavigationStateService } from './core/services/navigation-state.service';
import {
  AppHeaderComponent,
  GlobalPlayerComponent,
  NowPlayingPopupComponent,
  HamburgerMenuComponent,
  FabMenuComponent,
  VolumePanelComponent
} from './layout';
import { GlobalContextMenuComponent } from './shared/components';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    AppHeaderComponent,
    GlobalPlayerComponent,
    NowPlayingPopupComponent,
    HamburgerMenuComponent,
    FabMenuComponent,
    VolumePanelComponent,
    GlobalContextMenuComponent
  ],
  template: `
    <div class="app-container min-h-screen bg-bg-primary">
      <!-- App Header (replaces floating hamburger) -->
      <app-header (toggleMenu)="toggleHamburger()" />

      <!-- Hamburger Menu (side panel only) -->
      <app-hamburger-menu [externalOpen]="navState.hamburgerOpen()" (closed)="navState.closeHamburger()" />

      <!-- Main Content with top padding for fixed header (only when header visible) -->
      <main
        class="flex-1 pb-24 overflow-y-auto"
        [class.pt-14]="!navState.headerConfig().hidden"
        [class.header-padding]="!navState.headerConfig().hidden"
      >
        <router-outlet />
      </main>

      <!-- Global Player (bottom bar) -->
      <app-global-player />

      <!-- Now Playing Popup (fullscreen overlay) -->
      <app-now-playing-popup />

      <!-- FAB Menu -->
      <app-fab-menu />

      <!-- Volume Panel (bottom sheet) -->
      <app-volume-panel />

      <!-- Global Context Menu -->
      <app-global-context-menu />
    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      height: 100dvh;
      overflow: hidden;
    }

    main {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    /* Additional top padding for safe area when header is visible */
    main.header-padding {
      padding-top: calc(3.5rem + env(safe-area-inset-top, 0));
    }
  `]
})
export class App implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly playerState = inject(PlayerStateService);
  private readonly polling = inject(PollingService);
  private readonly swUpdate = inject(SwUpdate);
  readonly navState = inject(NavigationStateService);

  ngOnInit(): void {
    // Verify existing auth token on startup
    if (this.auth.authToken()) {
      this.auth.verifyToken().subscribe();
    }

    // Handle PWA updates - auto reload when new version is available
    this.setupServiceWorkerUpdates();
  }

  private setupServiceWorkerUpdates(): void {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    // Check for updates immediately and every 30 seconds
    this.swUpdate.checkForUpdate().catch(() => {});
    setInterval(() => {
      this.swUpdate.checkForUpdate().catch(() => {});
    }, 30000);

    // When a new version is ready, reload the page
    this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(() => {
        console.log('New version available, reloading...');
        document.location.reload();
      });
  }

  toggleHamburger(): void {
    this.navState.toggleHamburger();
  }
}
