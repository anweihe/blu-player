import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { PlayerStateService } from './core/services/player-state.service';
import { PollingService } from './core/services/polling.service';
import {
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
    GlobalPlayerComponent,
    NowPlayingPopupComponent,
    HamburgerMenuComponent,
    FabMenuComponent,
    VolumePanelComponent,
    GlobalContextMenuComponent
  ],
  template: `
    <div class="app-container min-h-screen bg-bg-primary">
      <!-- Hamburger Menu -->
      <app-hamburger-menu />

      <!-- Main Content -->
      <main class="flex-1 pb-24 overflow-y-auto">
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
  `]
})
export class App implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly playerState = inject(PlayerStateService);
  private readonly polling = inject(PollingService);

  ngOnInit(): void {
    // Verify existing auth token on startup
    if (this.auth.authToken()) {
      this.auth.verifyToken().subscribe();
    }
  }
}
