import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import {
  HOLIDAY_CALENDARS_CONFIG,
  LEGAL_ENTITIES_CONFIG,
  LOOKUP_CONFIGS,
  REQUESTERS_CONFIG,
  SITES_CONFIG,
  VENDORS_CONFIG,
} from './features/master-data/master-data.configs';
import { PROJECTS_CONFIG } from './features/projects/projects.configs';
import { RESOURCES_CONFIG } from './features/resources/resources.configs';
import { EntityConfig } from './shared/crud/crud.model';

const crudPage = () => import('./shared/crud/crud-page/crud-page').then((m) => m.CrudPage);

/** Pagina di un'anagrafica generata dalla sua configurazione. */
function crudRoute(path: string, config: EntityConfig) {
  return { path, title: `${config.title} · Governo IT`, loadComponent: crudPage, data: { config } };
}

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
      crudRoute('projects', PROJECTS_CONFIG),
      crudRoute('resources', RESOURCES_CONFIG),
      {
        path: 'resources/:id',
        title: 'Risorsa · Governo IT',
        loadComponent: () =>
          import('./features/resources/resource-detail-page').then((m) => m.ResourceDetailPage),
      },
      crudRoute('requesters', REQUESTERS_CONFIG),
      {
        path: 'master-data',
        title: 'Anagrafiche e liste · Governo IT',
        loadComponent: () =>
          import('./features/master-data/master-data-page').then((m) => m.MasterDataPage),
      },
      crudRoute('master-data/legal-entities', LEGAL_ENTITIES_CONFIG),
      crudRoute('master-data/vendors', VENDORS_CONFIG),
      crudRoute('master-data/sites', SITES_CONFIG),
      crudRoute('master-data/holiday-calendars', HOLIDAY_CALENDARS_CONFIG),
      {
        path: 'master-data/holiday-calendars/:id',
        title: 'Festività · Governo IT',
        loadComponent: () =>
          import('./features/master-data/holiday-calendar-page').then((m) => m.HolidayCalendarPage),
      },
      {
        path: 'master-data/project-codes',
        title: 'Codici progetto · Governo IT',
        loadComponent: () =>
          import('./features/master-data/project-codes-page').then((m) => m.ProjectCodesPage),
      },
      ...LOOKUP_CONFIGS.map((config) => crudRoute(`master-data/lookups/${config.slug}`, config)),
    ],
  },
  { path: '**', redirectTo: '' },
];
