import { Routes } from '@angular/router';
import { qobuzAuthGuard, qobuzNoAuthGuard } from '../../core/guards/auth.guard';

export const QOBUZ_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'browse',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/qobuz-login.component').then(m => m.QobuzLoginComponent),
    canActivate: [qobuzNoAuthGuard]
  },
  {
    path: 'browse',
    loadComponent: () => import('./pages/browse/qobuz-browse.component').then(m => m.QobuzBrowseComponent),
    canActivate: [qobuzAuthGuard]
  },
  {
    path: 'album/:id',
    loadComponent: () => import('./pages/album-detail/album-detail.component').then(m => m.AlbumDetailComponent),
    canActivate: [qobuzAuthGuard]
  },
  {
    path: 'playlist/:id',
    loadComponent: () => import('./pages/playlist-detail/playlist-detail.component').then(m => m.PlaylistDetailComponent),
    canActivate: [qobuzAuthGuard]
  },
  {
    path: 'artist/:id',
    loadComponent: () => import('./pages/artist/artist.component').then(m => m.ArtistComponent),
    canActivate: [qobuzAuthGuard]
  },
  {
    path: 'artist/:id/discography',
    loadComponent: () => import('./pages/discography/discography.component').then(m => m.DiscographyComponent),
    canActivate: [qobuzAuthGuard]
  },
  {
    path: 'search',
    loadComponent: () => import('./pages/search/search.component').then(m => m.SearchComponent),
    canActivate: [qobuzAuthGuard]
  }
];
