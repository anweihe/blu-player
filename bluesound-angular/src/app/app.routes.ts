import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'qobuz',
    loadChildren: () => import('./features/qobuz/qobuz.routes').then(m => m.QOBUZ_ROUTES)
  },
  {
    path: 'tunein',
    loadComponent: () => import('./features/tunein/tunein.component').then(m => m.TuneInComponent)
  },
  {
    path: 'radioparadise',
    loadComponent: () => import('./features/radio-paradise/radio-paradise.component').then(m => m.RadioParadiseComponent)
  },
  {
    path: 'players',
    loadComponent: () => import('./features/players/players.component').then(m => m.PlayersComponent)
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
