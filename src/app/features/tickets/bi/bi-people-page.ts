import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';

import { PeriodChart } from '../../../shared/charts/period-chart';
import { CrudApiService } from '../../../shared/crud/crud-api.service';
import { HelpButton } from '../../../shared/help/help-button';
import { PEOPLE_TREND_HELP } from '../../../shared/help/help-content';
import { KpiDirective } from '../components/kpi.directive';
import { BiFilters } from './bi-filters';
import {
  PERSON_TREND_DAYS,
  PERSON_TREND_PERIODS,
  PersonTrend,
  assigneeOf,
  personTrendPeriod,
  personTrends,
  waitingAsClosed,
  weekly,
} from './bi.model';
import { BiStore } from './bi-store.service';
import { formatNumber } from '../../../shared/util/number-format';

/** Settimane del grafico della persona scelta. */
/** Settimane del grafico e, più indietro, della tabella "Dati" sotto. */
const CHART_WEEKS = 8;
const DATA_WEEKS = 20;

type SortKey = 'openBefore' | 'open' | 'created' | 'resolved';

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
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTooltipModule,
    PeriodChart,
  ],
  template: `
    <div class="bi-page">
      <gov-bi-filters>
        <mat-slide-toggle
          [checked]="store.includePending()"
          (change)="store.includePending.set($event.checked)"
        >
          Includi i Pending negli aperti
        </mat-slide-toggle>
        <mat-slide-toggle
          class="tog"
          [checked]="store.waitingAsClosed()"
          (change)="store.waitingAsClosed.set($event.checked)"
          matTooltip="Acceso: i ticket in attesa di risposta del cliente contano come chiusi (colonna Chiusi e barra arancione, dal giorno in cui sono entrati in quello stato) e non come aperti"
        >
          Considera chiusi i ticket in attesa del cliente
        </mat-slide-toggle>
        <gov-help-button [help]="help" [compact]="true" label="Come si leggono i KPI per persona" />
      </gov-bi-filters>
      @if (store.error(); as error) {
        <p class="bi-state" role="alert">{{ error }}</p>
      } @else if (!store.data()) {
        <p class="bi-state" role="status">
          <mat-progress-spinner diameter="24" mode="indeterminate" aria-hidden="true" /> Caricamento
          dei ticket…
        </p>
      } @else {
        <div class="split">
          <section *govKpi="'people.table'" class="bi-card" aria-labelledby="people-title">
            <header class="card-head">
              <h2 id="people-title" class="title">Backlog per persona</h2>
              <mat-button-toggle-group
                class="period"
                aria-label="Periodo della tabella, in giorni"
                hideSingleSelectionIndicator
                [value]="days()"
                (change)="days.set($event.value)"
              >
                @for (option of periods; track option) {
                  <mat-button-toggle [value]="option">{{ option }} gg</mat-button-toggle>
                }
              </mat-button-toggle-group>
              <p class="note">
                <strong>Dal {{ since() }} a oggi</strong> ({{ days() }} giorni, oggi compreso).
                Saldo = entrati − chiusi: di quanti ticket cresce (+) o cala (−) il backlog; tra
                parentesi la media a settimana (saldo ÷ {{ elapsedWeeks() }} settimane). Il periodo
                vale per la tabella: il grafico mostra sempre le ultime 8 settimane. Anni e mesi del
                filtro qui non contano; le persone non attive sono nascoste.
              </p>
            </header>
            @if (trends().length === 0) {
              <p class="bi-state">Nessun ticket per i filtri scelti.</p>
            } @else {
              <div class="scroll">
                <table class="table table--centered">
                  <thead>
                    <tr>
                      <th scope="col">Persona</th>
                      <th scope="col" [attr.aria-sort]="ariaSort('openBefore')">
                        <button type="button" class="sort-btn" (click)="sortBy('openBefore')">
                          Aperti al {{ since() }}
                          <mat-icon aria-hidden="true">{{ sortIcon('openBefore') }}</mat-icon>
                        </button>
                      </th>
                      <th scope="col" [attr.aria-sort]="ariaSort('open')">
                        <button type="button" class="sort-btn" (click)="sortBy('open')">
                          Aperti ad oggi
                          <mat-icon aria-hidden="true">{{ sortIcon('open') }}</mat-icon>
                        </button>
                      </th>
                      <th scope="col" [attr.aria-sort]="ariaSort('created')">
                        <button type="button" class="sort-btn" (click)="sortBy('created')">
                          Entrati dal {{ since() }}
                          <mat-icon aria-hidden="true">{{ sortIcon('created') }}</mat-icon>
                        </button>
                      </th>
                      <th scope="col" [attr.aria-sort]="ariaSort('resolved')">
                        <button type="button" class="sort-btn" (click)="sortBy('resolved')">
                          Chiusi dal {{ since() }}
                          <mat-icon aria-hidden="true">{{ sortIcon('resolved') }}</mat-icon>
                        </button>
                      </th>
                      <th scope="col">Saldo del periodo</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of sortedTrends(); track row.name) {
                      <tr
                        class="pick"
                        [class.selected]="row.name === selected()"
                        (click)="selection.set(row.name)"
                      >
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
                        <td>
                          <button
                            type="button"
                            class="link-btn"
                            [title]="'Vedi i ticket aperti di ' + row.name"
                            (click)="open(row.name, store.includePending() ? 'open' : 'workable')"
                          >
                            {{ row.open }}
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            class="link-btn"
                            [title]="'Vedi i ticket entrati di ' + row.name"
                            (click)="open(row.name, 'created4w')"
                          >
                            {{ row.created }}
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            class="link-btn"
                            [title]="'Vedi i ticket chiusi di ' + row.name"
                            (click)="open(row.name, 'resolved4w')"
                          >
                            {{ row.resolved }}
                          </button>
                        </td>
                        <td>
                          <span class="trend trend--{{ row.direction }}">
                            <mat-icon aria-hidden="true">{{
                              directions[row.direction].icon
                            }}</mat-icon>
                            {{ signed(row.created - row.resolved) }} ·
                            {{ directions[row.direction].label }}
                            <span class="per-week">({{ signed(row.perWeek) }} a sett.)</span>
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr class="total">
                      <th scope="row">Totale</th>
                      <td>{{ total().openBefore }}</td>
                      <td>{{ total().open }}</td>
                      <td>{{ total().created }}</td>
                      <td>{{ total().resolved }}</td>
                      <td>
                        <span class="trend trend--{{ total().direction }}">
                          <mat-icon aria-hidden="true">{{
                            directions[total().direction].icon
                          }}</mat-icon>
                          {{ signed(total().created - total().resolved) }} ·
                          {{ directions[total().direction].label }}
                          <span class="per-week">({{ signed(total().perWeek) }} a sett.)</span>
                        </span>
                      </td>
                    </tr>
                  </tfoot>
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
                [tall]="true"
                [dataPoints]="dataRows()"
              />
            </section>
          }
        </div>
      }
    </div>
  `,
  styles: `
    // Solo questa etichetta: più piccola e su due righe, per tenere tutta la barra filtri su una riga
    .tog {
      max-width: 13rem;
    }

    .tog ::ng-deep .mdc-label {
      display: block;
      font-size: 0.6875rem;
      line-height: 1.15;
      white-space: normal;
    }

    // Tabella e spiegazione del saldo affiancate: niente riga in più sopra
    // Tabella a sinistra e grafico a destra su schermo largo; impilati su schermo stretto
    .split {
      display: grid;
      gap: 1rem;
      align-items: stretch;
    }

    @media (min-width: 1200px) {
      .split {
        grid-template-columns: minmax(0, 38rem) minmax(0, 1fr);
      }
    }

    .card-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.25rem 1rem;
      margin-block-end: 0.5rem;

      .title {
        margin: 0;
      }
    }

    .period {
      flex: 0 0 auto;
    }

    .note {
      flex: 1 1 12rem;
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

    // Tabella ordinata: intestazioni che vanno a capo, numeri centrati sotto il loro titolo
    .table {
      width: 100%;
      border-collapse: collapse;
      font: var(--mat-sys-body-medium);

      th,
      td {
        padding: 0.3125rem 0.5rem;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        white-space: nowrap;
      }

      thead th {
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-label-medium);
        line-height: 1.2;
        padding-block: 0.5rem;
        text-align: center;
        vertical-align: bottom;
        white-space: normal;
      }

      // Persona e saldo a sinistra, i quattro numeri centrati
      th:first-child,
      td:first-child {
        text-align: start;
      }

      thead th:last-child,
      tbody td:last-child {
        text-align: start;
      }

      tbody td:not(:first-child):not(:last-child) {
        width: 5.5rem;
        text-align: center;
      }

      tbody tr:last-child td,
      tbody tr:last-child th {
        border-bottom: 0;
      }

      // Riga dei totali: separata da una linea e in grassetto
      tfoot td,
      tfoot th {
        border-top: 2px solid var(--mat-sys-outline);
        border-bottom: 0;
        font-weight: 700;
        text-align: center;
      }

      tfoot th {
        text-align: start;
      }

      tfoot td:last-child {
        text-align: start;
      }
    }

    // Come l'intestazione ordinabile di Material: la freccia sta fuori dal testo (non sposta il
    // centro della colonna), si vede al passaggio del mouse e resta sulla colonna ordinata
    .sort-btn {
      position: relative;
      display: inline-block;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      line-height: inherit;
      text-align: center;
      cursor: pointer;

      mat-icon {
        position: absolute;
        inset-inline-start: 100%;
        top: 50%;
        width: 1rem;
        height: 1rem;
        margin-inline-start: 0.125rem;
        font-size: 1rem;
        line-height: 1rem;
        transform: translateY(-50%);
        opacity: 0;
        transition: opacity 120ms;
      }

      &:hover mat-icon,
      &:focus-visible mat-icon {
        opacity: 0.45;
      }

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 2px;
      }
    }

    th[aria-sort='ascending'] .sort-btn,
    th[aria-sort='descending'] .sort-btn {
      color: var(--mat-sys-on-surface);
      font-weight: 700;

      mat-icon {
        color: var(--mat-sys-primary);
        opacity: 1;
      }
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

    .pick {
      cursor: pointer;
    }

    .selected {
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }

    .per-week {
      color: var(--mat-sys-on-surface-variant);
      font-weight: 400;
      font-size: 0.8125rem;
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
        color: var(--gi-ok);
      }
    }
  `,
})
export class BiPeoplePage {
  protected readonly store = inject(BiStore);
  protected readonly help = PEOPLE_TREND_HELP;
  /** Giorni del periodo della tabella, a scelta (15–120). */
  protected readonly days = signal(PERSON_TREND_DAYS);
  protected readonly periods = PERSON_TREND_PERIODS;
  private readonly period = computed(() => personTrendPeriod(new Date(), this.days()));
  /** Primo giorno del periodo scelto (oggi compreso), gg/mm. */
  protected readonly since = computed(() =>
    this.period().start.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
  );
  /** Settimane del periodo (es. 30 giorni = 4,3), per cui si divide il saldo. */
  protected readonly elapsedWeeks = computed(() => formatNumber(this.period().weeks, 1));
  protected readonly directions = DIRECTIONS;

  /** Totale di ogni colonna sulle persone mostrate; il saldo è ricalcolato sui totali. */
  protected readonly total = computed(() => {
    const rows = this.trends();
    const sum = (pick: (row: PersonTrend) => number) =>
      rows.reduce((acc, row) => acc + pick(row), 0);
    const created = sum((row) => row.created);
    const resolved = sum((row) => row.resolved);
    const perWeek = Math.round(((created - resolved) / this.period().weeks) * 10) / 10;
    return {
      openBefore: sum((row) => row.openBefore),
      open: sum((row) => row.open),
      created,
      resolved,
      perWeek,
      direction: (perWeek >= 0.5
        ? 'up'
        : perWeek <= -0.5
          ? 'down'
          : 'flat') as PersonTrend['direction'],
    };
  });

  /** Ticket dei filtri in alto; con l'interruttore, quelli in attesa del cliente contano come chiusi. */
  private readonly base = computed(() =>
    this.store.waitingAsClosed() ? waitingAsClosed(this.store.scoped()) : this.store.scoped(),
  );

  private readonly allTrends = computed(() =>
    personTrends(this.base(), new Date(), this.store.includePending(), this.days()),
  );

  /** Risorse disattivate nell'anagrafica (id): le loro righe non si mostrano. */
  private readonly inactiveResources = signal<ReadonlySet<number>>(new Set());

  private isInactive(row: PersonTrend): boolean {
    return row.resourceId !== null && this.inactiveResources().has(row.resourceId);
  }

  protected readonly trends = computed(() =>
    this.allTrends().filter((row) => !this.isInactive(row)),
  );

  /** Ordine della tabella: di partenza gli aperti alla data iniziale, dal più grande; resta se cambiano i filtri. */
  protected readonly sort = signal<{ key: SortKey; desc: boolean }>({
    key: 'openBefore',
    desc: true,
  });

  protected readonly sortedTrends = computed(() => {
    const { key, desc } = this.sort();
    const sign = desc ? -1 : 1;
    return [...this.trends()].sort(
      (a, b) => sign * (a[key] - b[key]) || a.name.localeCompare(b.name, 'it'),
    );
  });

  /** Clic su una colonna: la ordina dal più grande; un secondo clic inverte. */
  protected sortBy(key: SortKey): void {
    const current = this.sort();
    this.sort.set({ key, desc: current.key === key ? !current.desc : true });
  }

  protected sortIcon(key: SortKey): string {
    const current = this.sort();
    return current.key === key && current.desc ? 'arrow_downward' : 'arrow_upward';
  }

  protected ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    const current = this.sort();
    return current.key !== key ? 'none' : current.desc ? 'descending' : 'ascending';
  }

  /** Persona scelta (filtro in alto o clic nella tabella); di partenza quella con il saldo peggiore. */
  protected readonly selection = signal<string | null>(null);
  protected readonly selected = computed(() => {
    const names = this.trends().map((row) => row.name);
    const chosen = this.selection();
    return chosen !== null && names.includes(chosen) ? chosen : (names[0] ?? null);
  });

  /** Serie delle ultime DATA_WEEKS settimane della persona scelta: il grafico ne usa le ultime. */
  private readonly series = computed(() => {
    const name = this.selected();
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7 * (DATA_WEEKS - 1));
    const tickets = this.base().filter((ticket) => assigneeOf(ticket) === name);
    return weekly(tickets, from, now, this.store.includePending());
  });
  protected readonly chart = computed(() => this.series().slice(-CHART_WEEKS));
  protected readonly dataRows = computed(() => this.series());

  private readonly router = inject(Router);

  /** Clic su un numero della persona: i suoi ticket (aperti, entrati o chiusi). */
  protected open(name: string, scope: string): void {
    void this.router.navigate(['/tickets/dettaglio'], {
      queryParams: {
        scope,
        dim: 'assignee',
        value: name,
        period: this.days(),
        ...(this.store.waitingAsClosed() ? { waiting: '1' } : {}),
      },
    });
  }

  private readonly api = inject(CrudApiService);

  constructor() {
    this.api.list('/resources').subscribe({
      next: (resources) =>
        this.inactiveResources.set(
          new Set(resources.filter((r) => r['active'] === false).map((r) => Number(r.id))),
        ),
      error: () => undefined,
    });
    // Il filtro "Assegnatario" in alto con una sola persona la sceglie; poi vale il clic sulle righe
    effect(() => {
      const filtered = this.store.assignees();
      untracked(() => {
        if (filtered?.length === 1) {
          this.selection.set(filtered[0]);
        }
      });
    });
    this.store.load();
  }

  protected signed(value: number): string {
    const text = formatNumber(value, 1);
    return value > 0 ? `+${text}` : text;
  }
}
