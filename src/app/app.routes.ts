import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { moduleGuard } from './core/auth/module.guard';
import { roleGuard } from './core/auth/role.guard';
import {
  HOLIDAY_CALENDARS_CONFIG,
  LEGAL_ENTITIES_CONFIG,
  LOOKUP_CONFIGS,
  REQUESTERS_CONFIG,
  SITES_CONFIG,
  VENDORS_CONFIG,
} from './features/master-data/master-data.configs';
import { MEETING_ROLES } from './features/management/management.configs';
import { PROJECTS_CONFIG } from './features/projects/projects.configs';
import { RESOURCES_CONFIG } from './features/resources/resources.configs';
import { BackLinkTarget } from './shared/components/back-link/back-link';
import { EntityConfig } from './shared/crud/crud.model';

const crudPage = () => import('./shared/crud/crud-page/crud-page').then((m) => m.CrudPage);

/** Ritorno alla home delle anagrafiche da Risorse, Richiedenti e Liste e tabelle. */
const BACK_TO_ANAGRAFICHE: BackLinkTarget = { link: '/anagrafiche', label: 'Anagrafiche' };

/** Ritorno alla pagina "Anagrafiche e liste" dalle sue sottopagine. */
const BACK_TO_MASTER_DATA: BackLinkTarget = { link: '/master-data', label: 'Anagrafiche e liste' };

/** Pagina di un'anagrafica generata dalla sua configurazione. */
function crudRoute(path: string, config: EntityConfig, back?: BackLinkTarget) {
  return {
    path,
    title: `${config.title} · Governo IT`,
    loadComponent: crudPage,
    canActivate: [moduleGuard],
    data: { config, back },
  };
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
      {
        path: 'projects/:id',
        title: 'Progetto · Governo IT',
        canActivate: [moduleGuard],
        data: { module: 'PROJECTS' },
        loadComponent: () =>
          import('./features/projects/project-detail-page').then((m) => m.ProjectDetailPage),
      },
      {
        path: 'plan',
        title: 'Piano settimanale · Governo IT',
        // Griglia come in Excel: menu nella barra blu e tutta la larghezza dello schermo
        canActivate: [moduleGuard],
        data: { fullWidth: true, module: 'PLAN' },
        loadComponent: () => import('./features/plan/plan-page').then((m) => m.PlanPage),
      },
      {
        path: 'anagrafiche',
        title: 'Anagrafiche · Governo IT',
        canActivate: [moduleGuard],
        data: { anyOf: ['RESOURCES', 'REQUESTERS', 'TECHNOLOGY', 'MASTER_DATA'] },
        loadComponent: () =>
          import('./features/anagrafiche/anagrafiche-page').then((m) => m.AnagrafichePage),
      },
      crudRoute('resources', RESOURCES_CONFIG, BACK_TO_ANAGRAFICHE),
      {
        path: 'resources/:id',
        title: 'Risorsa · Governo IT',
        canActivate: [moduleGuard],
        data: { module: 'RESOURCES' },
        loadComponent: () =>
          import('./features/resources/resource-detail-page').then((m) => m.ResourceDetailPage),
      },
      crudRoute('requesters', REQUESTERS_CONFIG, BACK_TO_ANAGRAFICHE),
      {
        path: 'technologies',
        title: 'Sistemi e tecnologie · Governo IT',
        canActivate: [moduleGuard],
        data: { module: 'TECHNOLOGY' },
        loadComponent: () =>
          import('./features/technologies/technologies-page').then((m) => m.TechnologiesPage),
      },
      {
        path: 'master-data',
        title: 'Anagrafiche e liste · Governo IT',
        canActivate: [moduleGuard],
        data: { module: 'MASTER_DATA' },
        loadComponent: () =>
          import('./features/master-data/master-data-page').then((m) => m.MasterDataPage),
      },
      crudRoute('master-data/legal-entities', LEGAL_ENTITIES_CONFIG, BACK_TO_MASTER_DATA),
      crudRoute('master-data/vendors', VENDORS_CONFIG, BACK_TO_MASTER_DATA),
      crudRoute('master-data/sites', SITES_CONFIG, BACK_TO_MASTER_DATA),
      crudRoute('master-data/holiday-calendars', HOLIDAY_CALENDARS_CONFIG, BACK_TO_MASTER_DATA),
      {
        path: 'master-data/holiday-calendars/:id',
        title: 'Festività · Governo IT',
        canActivate: [moduleGuard],
        data: { module: 'MASTER_DATA' },
        loadComponent: () =>
          import('./features/master-data/holiday-calendar-page').then((m) => m.HolidayCalendarPage),
      },
      {
        path: 'master-data/project-codes',
        title: 'Codici progetto · Governo IT',
        canActivate: [moduleGuard],
        data: { module: 'MASTER_DATA' },
        loadComponent: () =>
          import('./features/master-data/project-codes-page').then((m) => m.ProjectCodesPage),
      },
      {
        // Ticket AMS: pagina operativa e pagine BI navigabili (D-24, D-27)
        path: 'tickets',
        canActivate: [moduleGuard],
        data: { module: 'TICKETS' },
        loadComponent: () =>
          import('./features/tickets/tickets-section').then((m) => m.TicketsSection),
        children: [
          {
            path: '',
            pathMatch: 'full',
            title: 'Ticket AMS · Governo IT',
            loadComponent: () =>
              import('./features/tickets/tickets-page').then((m) => m.TicketsPage),
          },
          {
            path: 'panoramica',
            title: 'Ticket · Panoramica · Governo IT',
            loadComponent: () =>
              import('./features/tickets/bi/bi-overview-page').then((m) => m.BiOverviewPage),
          },
          {
            path: 'trend',
            title: 'Ticket · Trend · Governo IT',
            loadComponent: () =>
              import('./features/tickets/bi/bi-trend-page').then((m) => m.BiTrendPage),
          },
          {
            path: 'persone',
            title: 'Ticket · Persone · Governo IT',
            loadComponent: () =>
              import('./features/tickets/bi/bi-people-page').then((m) => m.BiPeoplePage),
          },
          {
            path: 'aperti',
            title: 'Ticket aperti · Governo IT',
            data: { mode: 'open' },
            loadComponent: () =>
              import('./features/tickets/bi/bi-open-page').then((m) => m.BiOpenPage),
          },
          {
            path: 'pending',
            title: 'Ticket in Pending · Governo IT',
            data: { mode: 'pending' },
            loadComponent: () =>
              import('./features/tickets/bi/bi-open-page').then((m) => m.BiOpenPage),
          },
          {
            path: 'dettaglio',
            title: 'Dettaglio ticket · Governo IT',
            loadComponent: () =>
              import('./features/tickets/bi/bi-detail-page').then((m) => m.BiDetailPage),
          },
          {
            path: 'elenco',
            title: 'Elenco ticket · Governo IT',
            loadComponent: () =>
              import('./features/tickets/bi/bi-list-page').then((m) => m.BiListPage),
          },
        ],
      },
      {
        path: 'tasks',
        title: 'Task · Governo IT',
        canActivate: [moduleGuard],
        data: { module: 'TASKS' },
        loadComponent: () => import('./features/tasks/tasks-page').then((m) => m.TasksPage),
      },
      {
        path: 'master-data/parameters',
        title: 'Parametri generali · Governo IT',
        canActivate: [moduleGuard],
        data: { module: 'MASTER_DATA' },
        loadComponent: () =>
          import('./features/master-data/parameters-page').then((m) => m.ParametersPage),
      },
      {
        path: 'management',
        title: 'Direzione · Governo IT',
        canActivate: [moduleGuard],
        data: { module: 'MANAGEMENT' },
        loadComponent: () =>
          import('./features/management/management-page').then((m) => m.ManagementPage),
      },
      {
        path: 'management/meetings/:id',
        title: 'Riunione · Governo IT',
        canActivate: [moduleGuard, roleGuard],
        data: { module: 'MANAGEMENT', roles: MEETING_ROLES },
        loadComponent: () =>
          import('./features/management/meeting-detail-page').then((m) => m.MeetingDetailPage),
      },
      {
        path: 'users',
        title: 'Utenti e permessi · Governo IT',
        canActivate: [moduleGuard],
        data: { module: 'USERS' },
        loadComponent: () => import('./features/users/users-page').then((m) => m.UsersPage),
      },
      ...LOOKUP_CONFIGS.map((config) =>
        crudRoute(`master-data/lookups/${config.slug}`, config, BACK_TO_MASTER_DATA),
      ),
    ],
  },
  { path: '**', redirectTo: '' },
];
