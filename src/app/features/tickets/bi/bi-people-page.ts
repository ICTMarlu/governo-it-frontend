import { Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { PeriodChart } from '../../../shared/charts/period-chart';
import { HelpButton } from '../../../shared/help/help-button';
import { PEOPLE_TREND_HELP } from '../../../shared/help/help-content';
import { KpiDirective } from '../components/kpi.directive';
import { BiFilters } from './bi-filters';
import { PERSON_TREND_WEEKS, PersonTrend, assigneeOf, personTrends, weekly } from './bi.model';
import { BiStore } from './bi-store.service';

/** Settimane del grafico della persona scelta. */
const CHART_WEEKS = 12;

const DIRECTIONS: Readonly<
  Record<PersonTrend['direction'], { readonly icon: string; readonly label: string }>
> = {
  up: { icon: 'trending_up', label: 'cresce' },
  down: { icon: 'trending_down', label: 'cala' },
  flat: { icon: 'trending_flat', label: 'stabile' },
};

/**
 * KPI per persona: di quanto cresce o cala il backlog di ognuno (saldo delle ultime 4 settimane
 * complete) e, per la persona scelta, il trend settimanale di entrati, chiusi e aperti.
 */
@Component({
  selector: 'gov-bi-people-page',
  imports: [
    BiFilters,
    HelpButton,
    KpiDirective,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
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
          <p class="note">
            Saldo = (entrati − chiusi) delle ultime {{ weeks }} settimane complete ÷ {{ weeks }}: di
            quanti ticket cresce o cala il backlog di ognuno a settimana. Gli anni e i mesi del
            filtro qui non contano.
          </p>
          <mat-slide-toggle
            [checked]="store.includePending()"
            (change)="store.includePending.set($event.checked)"
          >
            Includi i Pending negli aperti
          </mat-slide-toggle>
          <gov-help-button
            [help]="help"
            [compact]="true"
            label="Come si leggono i KPI per persona"
          />
        </div>

        <section *govKpi="'people.table'" class="bi-card" aria-labelledby="people-title">
          <h2 id="people-title" class="title">Backlog per persona</h2>
          @if (trends().length === 0) {
            <p class="bi-state">Nessun ticket per i filtri scelti.</p>
          } @else {
            <div class="scroll">
              <table class="table table--centered">
                <thead>
                  <tr>
                    <th scope="col">Persona</th>
                    <th scope="col">Aperti {{ weeks }} sett. fa</th>
                    <th scope="col">Aperti oggi</th>
                    <th scope="col">Entrati</th>
                    <th scope="col">Chiusi</th>
                    <th scope="col">Saldo a settimana</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of trends(); track row.name) {
                    <tr [class.selected]="row.name === selected()">
                      <th scope="row">
                        <button
                          type="button"
                          class="link-btn"
                          [attr.aria-pressed]="row.name === selected()"
                          (click)="selection.set(row.name)"
                        >
                          {{ row.name }}
                        </button>
                      </th>
                      <td>{{ row.openBefore }}</td>
                      <td>{{ row.open }}</td>
                      <td>{{ row.created }}</td>
                      <td>{{ row.resolved }}</td>
                      <td>
                        <span class="trend trend--{{ row.direction }}">
                          <mat-icon aria-hidden="true">{{
                            directions[row.direction].icon
                          }}</mat-icon>
                          {{ signed(row.perWeek) }} · {{ directions[row.direction].label }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        @if (selected(); as name) {
          <section *govKpi="'people.chart'" class="bi-card">
            <gov-period-chart
              [barsTitle]="name + ': entrati e chiusi per settimana'"
              [lineTitle]="
                store.includePending()
                  ? 'Aperti a fine settimana (con i Pending)'
                  : 'Aperti a fine settimana (senza Pending)'
              "
              [points]="chart()"
            />
          </section>
        }
      }
    </div>
  `,
  styles: `
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;
    }

    .note {
      flex: 1 1 24rem;
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    .title {
      margin: 0 0 0.5rem;
      font: var(--mat-sys-title-medium);
    }

    .scroll {
      overflow-x: auto;
    }

    .link-btn {
      padding: 0;
      border: 0;
      background: none;
      color: var(--mat-sys-primary);
      font: inherit;
      text-align: start;
      cursor: pointer;
    }

    .selected {
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }

    // Direzione con icona ed etichetta, mai solo colore
    .trend {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      white-space: nowrap;

      &--up {
        color: var(--mat-sys-error);
      }

      &--down {
        color: light-dark(#2e7d32, #7cc683);
      }
    }
  `,
})
export class BiPeoplePage {
  protected readonly store = inject(BiStore);
  protected readonly help = PEOPLE_TREND_HELP;
  protected readonly weeks = PERSON_TREND_WEEKS;
  protected readonly directions = DIRECTIONS;

  protected readonly trends = computed(() =>
    personTrends(this.store.scoped(), new Date(), this.store.includePending()),
  );

  /** Persona scelta; di partenza quella con il saldo peggiore. */
  protected readonly selection = signal<string | null>(null);
  protected readonly selected = computed(() => {
    const names = this.trends().map((row) => row.name);
    const chosen = this.selection();
    return chosen !== null && names.includes(chosen) ? chosen : (names[0] ?? null);
  });

  protected readonly chart = computed(() => {
    const name = this.selected();
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7 * (CHART_WEEKS - 1));
    const tickets = this.store.scoped().filter((ticket) => assigneeOf(ticket) === name);
    return weekly(tickets, from, now, this.store.includePending());
  });

  constructor() {
    this.store.load();
  }

  protected signed(value: number): string {
    const text = value.toLocaleString('it-IT', { maximumFractionDigits: 1 });
    return value > 0 ? `+${text}` : text;
  }
}
