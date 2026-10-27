import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeIt from '@angular/common/locales/it';
import {
  ApplicationConfig,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { RecordTasksService } from './features/tasks/services/record-tasks.service';
import { RECORD_TASKS } from './shared/crud/record-tasks';
import { provideItalianDates } from './shared/dates/italian-date-adapter';

registerLocaleData(localeIt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    { provide: LOCALE_ID, useValue: 'it-IT' },
    // Calendario dei campi data: gg/mm/aaaa, settimana da lunedì
    provideItalianDates(),
    // Task dei record degli elenchi (D-36): la tabella condivisa li chiede alla parte Task
    { provide: RECORD_TASKS, useExisting: RecordTasksService },
    // Icone Material Symbols (font caricato in index.html)
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
    }),
  ],
};
