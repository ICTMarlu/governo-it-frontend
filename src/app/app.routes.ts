import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';

/** Ogni area funzionale è caricata solo quando serve (lazy loading). */
export const routes: Routes = [
  {
    path: 'login',
    title: 'Accesso · Governo IT',
    loadComponent: () => import('./features/auth/login/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        title: 'Home · Governo IT',
        loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
      },
      {
        path: 'project-statuses',
        title: 'Stati progetto · Governo IT',
        loadComponent: () =>
          import('./features/project-statuses/pages/project-statuses-page').then(
            (m) => m.ProjectStatusesPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
