import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PeriodChart } from '../../../shared/charts/period-chart';
import { KpiDirective } from '../components/kpi.directive';
import { BiFilters } from './bi-filters';
import {
  BACKLOG_WEEKS,
  resolvedPerDayYear,
  backlogDays,
  backlogPeriod,
  isOpen,
  resolvedPerDay,
  waitingAsClosed,
  weekly,
} from './bi.model';
import { BiStore } from './bi-store.service';

/**
 * Trend dei ticket lavorabili (come la pagina Trend di Power BI): per settimana creati, risolti
 * e lavorabili a fine settimana, con o senza i Pending; in alto i giorni di backlog.
 */
@Component({
  selector: 'gov-bi-trend-page',
  imports: [
    BiFilters,
    KpiDirective,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTooltipModule,
    PeriodChart,
  ],
  template: `
    <div class="bi-page">
      <gov-bi-filters />
      @if (store.error(); as error) {
        <p class="bi-state" role="alert">{{ error }}</p>
      } @else if (!store.data()) {
        <p class="bi-state" role="status">
          <mat-progress-spinner diameter="24" mode="indeterminate" aria-hidden="true" /> Caricamento
          dei ticket…
        </p>
      } @else {
        <div class="head">
          <ul class="bi-kpis" aria-label="Numeri di oggi">
            <li
              *govKpi="'trend.backlogDays'"
              class="bi-kpi bi-kpi--link bi-kpi--info"
              role="link"
              tabindex="0"
              (click)="openWorkable()"
              (keydown.enter)="openWorkable()"
            >
              <span class="bi-kpi__value">{{ backlog() ?? '—' }}</span>
              <span class="bi-kpi__label">giorni lavorativi di backlog</span>
            </li>
            <li
              *govKpi="'trend.workable'"
              class="bi-kpi bi-kpi--link bi-kpi--alert"
              role="link"
              tabindex="0"
              (click)="openWorkable()"
              (keydown.enter)="openWorkable()"
            >
              <span class="bi-kpi__value">{{ workable() }}</span>
              <span class="bi-kpi__label">lavorabili oggi</span>
            </li>
            <li
              class="bi-kpi bi-kpi--link"
              role="link"
              tabindex="0"
              (click)="open('resolved3w')"
              (keydown.enter)="open('resolved3w')"
            >
              <span class="bi-kpi__value">{{ closeRate() }}</span>
              <span class="bi-kpi__label">chiusi al giorno (media)</span>
              <span class="period">ultime {{ weeksCount }} settimane: {{ closePeriod() }}</span>
            </li>
            <li
              class="bi-kpi bi-kpi--link"
              role="link"
              tabindex="0"
              (click)="open('resolved-year')"
              (keydown.enter)="open('resolved-year')"
            >
              <span class="bi-kpi__value">{{ closeRateYear() }}</span>
              <span class="bi-kpi__label">chiusi al giorno (anno)</span>
              <span class="period">dal 1/1 a ieri</span>
            </li>
          </ul>
          <mat-slide-toggle
            [checked]="store.includePending()"
            (change)="store.includePending.set($event.checked)"
          >
            Includi i Pending tra i lavorabili
          </mat-slide-toggle>
          <mat-slide-toggle
            class="tog"
            [checked]="store.waitingAsClosed()"
            (change)="store.waitingAsClosed.set($event.checked)"
            matTooltip="Acceso: i ticket in attesa di risposta del cliente contano come chiusi (nei chiusi al giorno, nella barra arancione e non tra i lavorabili), dal giorno in cui sono entrati in quello stato"
          >
            Considera chiusi i ticket in attesa del cliente
          </mat-slide-toggle>
          <p class="note">
            Giorni di backlog (come in Power BI) = lavorabili di oggi ÷ chiusi al giorno (media dei
            ticket risolti per giorno lavorativo nelle ultime 3 settimane complete: risolti ÷ 3 ÷ 5;
            la settimana in corso non conta). "Pending" è lo stato di oggi (stati:
            {{ pendingStatuses() }}).
          </p>
        </div>
        <section class="bi-card">
          <gov-period-chart
            barsTitle="Ticket creati e risolti per settimana"
            [lineTitle]="
              store.includePending()
                ? 'Lavorabili a fine settimana (con i Pending)'
                : 'Lavorabili a fine settimana (senza Pending)'
            "
            [points]="weeks()"
          />
        </section>
      }
    </div>
  `,
  styles: `
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1rem;

      .bi-kpis {
        flex: 0 1 46rem;
      }

      .bi-kpi {
        justify-content: center;
      }
    }

    // Etichetta piccola su due righe, come nella pagina Persone
    .tog {
      max-width: 13rem;
    }

    .tog ::ng-deep .mdc-label {
      display: block;
      font-size: 0.6875rem;
      line-height: 1.15;
      white-space: normal;
    }

    .period {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.6875rem;
      line-height: 1.2;
    }

    .note {
      flex: 1 1 20rem;
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
  `,
})
export class BiTrendPage {
  protected readonly store = inject(BiStore);

  /** Dal 1° gennaio dell'anno scelto (o del primo mese scelto); senza anno le ultime 52 settimane. */
  private readonly from = computed(() => {
    const years = this.store.years();
    const now = new Date();
    if (years === null || years.length === 0) {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7 * 51);
    }
    const year = Math.min(...years);
    const months = this.store.months();
    return new Date(year, months && months.length > 0 ? Math.min(...months) - 1 : 0, 1);
  });

  /** Fino a oggi, oppure alla fine dell'anno (o dell'ultimo mese) scelto se è passato. */
  private readonly to = computed(() => {
    const years = this.store.years();
    const now = new Date();
    if (years === null || years.length === 0) {
      return now;
    }
    const year = Math.max(...years);
    const months = this.store.months();
    const end = new Date(year, months && months.length > 0 ? Math.max(...months) : 12, 0);
    return end < now ? end : now;
  });

  /** Ticket dei filtri in alto; con l'interruttore, quelli in attesa del cliente contano come chiusi. */
  private readonly base = computed(() =>
    this.store.waitingAsClosed() ? waitingAsClosed(this.store.scoped()) : this.store.scoped(),
  );

  protected readonly weeks = computed(() =>
    weekly(this.base(), this.from(), this.to(), this.store.includePending()),
  );
  protected readonly backlog = computed(() =>
    backlogDays(this.base(), new Date(), this.store.includePending()),
  );
  protected readonly closeRate = computed(() =>
    resolvedPerDay(this.base(), new Date()).toLocaleString('it-IT', {
      maximumFractionDigits: 1,
    }),
  );
  protected readonly closeRateYear = computed(() =>
    resolvedPerDayYear(this.base(), new Date()).toLocaleString('it-IT', {
      maximumFractionDigits: 1,
    }),
  );
  protected readonly weeksCount = BACKLOG_WEEKS;
  protected readonly closePeriod = computed(() => {
    const { from, to } = backlogPeriod(new Date());
    const fmt = (d: Date) => d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    return `${fmt(from)}–${fmt(to)}`;
  });
  protected readonly workable = computed(
    () =>
      this.base().filter((t) => isOpen(t) && (this.store.includePending() || !t.pending)).length,
  );
  protected readonly pendingStatuses = computed(() =>
    (this.store.data()?.pendingStatuses ?? []).join(', '),
  );

  private readonly router = inject(Router);

  constructor() {
    this.store.load();
  }

  /** Lavorabili di oggi: con o senza i Pending, come il numero mostrato. */
  protected openWorkable(): void {
    this.open(this.store.includePending() ? 'open' : 'workable');
  }

  protected open(scope: string): void {
    void this.router.navigate(['/tickets/dettaglio'], {
      queryParams: { scope, ...(this.store.waitingAsClosed() ? { waiting: '1' } : {}) },
    });
  }
}
