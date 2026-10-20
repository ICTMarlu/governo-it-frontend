import { Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';

import { BackLink } from '../../shared/components/back-link/back-link';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { CrudApiService } from '../../shared/crud/crud-api.service';
import { CrudSection } from '../../shared/crud/crud-section/crud-section';
import { HOLIDAY_CALENDARS_CONFIG, holidaysConfig } from './master-data.configs';

/** Festività di un calendario (D-14), modificabili dall'Admin. */
@Component({
  selector: 'gov-holiday-calendar-page',
  imports: [BackLink, PageHeader, CrudSection],
  template: `
    <gov-back-link
      [target]="{ link: '/master-data/holiday-calendars', label: 'Calendari festività' }"
    />
    <gov-page-header
      [title]="'Festività · ' + calendarName()"
      [help]="config().help"
      subtitle="Ogni festività che cade da lunedì a venerdì riduce la capacità della settimana per le risorse della sede, in base alle ore giornaliere di ciascuna. Le date vanno verificate."
    />
    <gov-crud-section [config]="config()" />
  `,
})
export class HolidayCalendarPage {
  private readonly api = inject(CrudApiService);

  /** Id del calendario dal percorso /master-data/holiday-calendars/:id. */
  readonly id = input.required<string>();

  protected readonly calendarId = computed(() => Number(this.id()));
  protected readonly config = computed(() => holidaysConfig(this.calendarId()));
  protected readonly calendarName = toSignal(
    toObservable(this.calendarId).pipe(
      switchMap((id) =>
        this.api.list(HOLIDAY_CALENDARS_CONFIG.endpoint).pipe(
          map((rows) => String(rows.find((row) => row.id === id)?.['name'] ?? '')),
          catchError(() => of('')),
        ),
      ),
    ),
    { initialValue: '' },
  );
}
