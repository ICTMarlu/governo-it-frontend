import { Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';

import { PageHeader } from '../../shared/components/page-header/page-header';
import { CrudApiService } from '../../shared/crud/crud-api.service';
import { CrudSection } from '../../shared/crud/crud-section/crud-section';
import { HOLIDAY_CALENDARS_CONFIG, holidaysConfig } from './master-data.configs';

/** Festività di un calendario (D-14), modificabili dall'Admin. */
@Component({
  selector: 'gov-holiday-calendar-page',
  imports: [RouterLink, PageHeader, CrudSection, MatButtonModule, MatIconModule],
  template: `
    <a mat-button routerLink="/master-data/holiday-calendars" class="back">
      <mat-icon aria-hidden="true">arrow_back</mat-icon>
      Tutti i calendari
    </a>
    <gov-page-header
      [title]="'Festività · ' + calendarName()"
      subtitle="Ogni festività che cade da lunedì a venerdì riduce la capacità della settimana per le risorse della sede, in base alle ore giornaliere di ciascuna. Le date vanno verificate."
    />
    <gov-crud-section [config]="config()" />
  `,
  styles: `
    .back {
      margin-block-end: 0.5rem;
    }
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
