import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';

import { HBarChart } from '../../../shared/charts/hbar-chart';
import { PeriodChart } from '../../../shared/charts/period-chart';
import { HelpButton } from '../../../shared/help/help-button';
import { TICKET_REQUESTERS_HELP } from '../../../shared/help/help-content';
import { BiFilters } from './bi-filters';
import { BiStore } from './bi-store.service';
import { BiTicket, areaOf, countBy, monthly, weekly } from './bi.model';
import {
  QUICK_DAYS,
  RequesterStats,
  closersOf,
  daysToClose,
  reporterName,
  requesterRows,
  requesterStats,
  ticketFacts,
} from './bi-requesters';

/** Ticket mostrati in fondo prima di "Mostra altri". */
const TICKETS_SHOWN = 15;
/** Settimane del grafico per settimana. */
const CHART_WEEKS = 26;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type SortKey = 'created' | 'closed' | 'open' | 'closedPct' | 'avgDays' | 'reopenedTickets';

/**
 * Ticket per richiedente: la vista da portare davanti a un cliente. Si sceglie un richiedente e si
 * vede quanti ticket ha aperto nel periodo, quanti ne abbiamo chiusi, chi li ha chiusi, quanto
 * tempo ci vuole, quante volte si riaprono, come vanno nel tempo e l'elenco dei ticket.
 */
@Component({
  selector: 'gov-bi-requesters-page',
  imports: [
    BiFilters,
    DatePipe,
    HBarChart,
    HelpButton,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PeriodChart,
  ],
  template: `
    <div class="bi-page">
      <gov-bi-filters>
        <gov-help-button
          [help]="help"
          [compact]="true"
          label="Come si legge la pagina Richiedenti"
        />
      </gov-bi-filters>
      @if (store.error(); as error) {
        <p class="bi-state" role="alert">{{ error }}</p>
      } @else if (!store.data()) {
        <p class="bi-state" role="status">
          <mat-progress-spinner diameter="24" mode="indeterminate" aria-hidden="true" /> Caricamento
          dei ticket…
        </p>
      } @else if (rows().length === 0) {
        <p class="bi-state">Nessun ticket per i filtri scelti.</p>
      } @else {
        @if (store.bouncesError(); as error) {
          <p class="bi-state" role="alert">
            Riaperture e attese non disponibili (cronologia non letta): {{ error }}
          </p>
        }
        <div class="split">
          <section class="bi-card" aria-labelledby="req-list">
            <header class="card-head">
              <h2 id="req-list" class="title">Richiedenti</h2>
              <input
                type="search"
                class="search"
                placeholder="Cerca un richiedente"
                aria-label="Cerca un richiedente"
                [value]="search()"
                (input)="search.set($any($event.target).value)"
              />
            </header>
            <div class="scroll scroll--list">
              <table class="table">
                <thead>
                  <tr>
                    <th scope="col">Richiedente</th>
                    @for (column of columns; track column.key) {
                      <th scope="col" [attr.aria-sort]="ariaSort(column.key)">
                        <button
                          type="button"
                          class="sort-btn"
                          [title]="column.hint"
                          (click)="sortBy(column.key)"
                        >
                          {{ column.label }}
                          <mat-icon aria-hidden="true">{{ sortIcon(column.key) }}</mat-icon>
                        </button>
                      </th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of sortedRows(); track row.name) {
                    <tr
                      class="pick"
                      [class.selected]="row.name === chosen()"
                      (click)="choose(row.name)"
                    >
                      <th scope="row">
                        <button
                          type="button"
                          class="link-btn"
                          [attr.aria-pressed]="row.name === chosen()"
                          (click)="choose(row.name); $event.stopPropagation()"
                        >
                          {{ row.name }}
                        </button>
                      </th>
                      <td>
                        <strong>{{ row.created }}</strong>
                      </td>
                      <td>{{ row.closed }}</td>
                      <td>{{ row.open }}</td>
                      <td>{{ pct(row.closedPct) }}</td>
                      <td>{{ days(row.avgDays) }}</td>
                      <td>{{ row.reopenedTickets }}</td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="7" class="empty">Nessun richiedente con questo nome.</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          @if (detail(); as d) {
            <section class="bi-card" aria-labelledby="req-detail">
              <header class="card-head">
                <h2 id="req-detail" class="title">{{ d.name }}</h2>
                <p class="note">
                  Ticket aperti dal richiedente nel periodo scelto (anno e mese di creazione), con
                  area e assegnatario dei filtri in alto.
                </p>
              </header>
              <ul class="gi-kpis" aria-label="Numeri del richiedente">
                <li
                  class="gi-kpi gi-kpi--link gi-kpi--info"
                  role="link"
                  tabindex="0"
                  title="Apre l'elenco dei ticket creati dal richiedente"
                  (click)="openTickets(d.name)"
                  (keydown.enter)="openTickets(d.name)"
                >
                  <span class="gi-kpi__value">{{ d.created }}</span
                  ><span class="gi-kpi__label">ticket aperti</span>
                </li>
                <li
                  class="gi-kpi gi-kpi--ok"
                  title="Ticket creati nel periodo che oggi sono chiusi"
                >
                  <span class="gi-kpi__value">{{ d.closed }}</span
                  ><span class="gi-kpi__label">chiusi</span>
                  <span class="gi-kpi__meta">{{ pct(d.closedPct) }} dei ticket aperti</span>
                </li>
                <li
                  class="gi-kpi"
                  [class.gi-kpi--warning]="d.open > 0"
                  title="Ancora aperti, compresi Pending e in attesa di risposta del cliente"
                >
                  <span class="gi-kpi__value">{{ d.open }}</span
                  ><span class="gi-kpi__label">ancora aperti</span>
                  <span class="gi-kpi__meta">di cui {{ d.openWaiting }} in attesa del cliente</span>
                </li>
                <li
                  class="gi-kpi"
                  title="Giorni di calendario dalla creazione alla chiusura, sui ticket chiusi"
                >
                  <span class="gi-kpi__value">{{ days(d.avgDays) }}</span
                  ><span class="gi-kpi__label">giorni per chiudere (media)</span>
                  <span class="gi-kpi__meta"
                    >mediana {{ days(d.medianDays) }} · entro {{ quick }} gg
                    {{ pct(d.quickPct) }}</span
                  >
                </li>
                <li
                  class="gi-kpi"
                  [class.gi-kpi--critical]="d.reopenedTickets > 0"
                  title="Ticket chiusi e poi tornati aperti almeno una volta (dalla cronologia)"
                >
                  <span class="gi-kpi__value">{{ d.reopenedTickets }}</span
                  ><span class="gi-kpi__label">riaperti dopo la chiusura</span>
                  <span class="gi-kpi__meta"
                    >{{ pct(d.reopenedPct) }} dei chiusi · {{ d.reopenings }} riaperture</span
                  >
                </li>
                <li
                  class="gi-kpi gi-kpi--info"
                  title="Ticket passati almeno una volta da In attesa di risposta dal cliente"
                >
                  <span class="gi-kpi__value">{{ d.waitedTickets }}</span
                  ><span class="gi-kpi__label">messi in attesa del cliente</span>
                  <span class="gi-kpi__meta">{{ pct(d.waitedPct) }} dei ticket aperti</span>
                </li>
              </ul>
            </section>
          }
        </div>

        @if (detail(); as d) {
          <div class="bi-grid bi-grid--2">
            <section class="bi-card" aria-labelledby="req-time">
              <header class="card-head">
                <h2 id="req-time" class="title">{{ d.name }}: aperti e chiusi nel tempo</h2>
                <mat-button-toggle-group
                  aria-label="Periodo del grafico"
                  hideSingleSelectionIndicator
                  [value]="chartMode()"
                  (change)="chartMode.set($event.value)"
                >
                  <mat-button-toggle value="month">Per mese</mat-button-toggle>
                  <mat-button-toggle value="week">Per settimana</mat-button-toggle>
                </mat-button-toggle-group>
              </header>
              <gov-period-chart
                [barsTitle]="
                  chartMode() === 'month'
                    ? 'Ticket aperti e chiusi per mese'
                    : 'Ticket aperti e chiusi per settimana (ultime ' + chartWeeks + ')'
                "
                lineTitle="Ancora aperti a fine periodo"
                [points]="points()"
              />
            </section>
            <section class="bi-card">
              <gov-hbar-chart title="Chi li ha chiusi" [items]="closers()" />
            </section>
          </div>
          <div class="bi-grid bi-grid--2">
            <section class="bi-card">
              <gov-hbar-chart title="Ticket per Progetto Marlù" [items]="byArea()" />
            </section>
            <section class="bi-card">
              <gov-hbar-chart title="Ticket per tipo di richiesta" [items]="byRequestType()" />
            </section>
          </div>

          <section class="bi-card" aria-labelledby="req-tickets">
            <h2 id="req-tickets" class="title">Ticket di {{ d.name }}</h2>
            <div class="scroll">
              <table class="table table--tickets">
                <thead>
                  <tr>
                    <th scope="col">Ticket</th>
                    <th scope="col">Titolo</th>
                    <th scope="col">Creato</th>
                    <th scope="col">Stato</th>
                    <th scope="col">Chiuso da</th>
                    <th scope="col">Giorni per chiudere</th>
                    <th scope="col">Riaperture</th>
                  </tr>
                </thead>
                <tbody>
                  @for (ticket of ticketRows().slice(0, shown()); track ticket.key) {
                    <tr>
                      <th scope="row">
                        @if (jiraUrl(); as base) {
                          <a [href]="base + ticket.key" target="_blank" rel="noopener">{{
                            ticket.key
                          }}</a>
                        } @else {
                          {{ ticket.key }}
                        }
                      </th>
                      <td class="summary" [title]="ticket.summary">{{ ticket.summary }}</td>
                      <td>{{ ticket.created | date: 'dd/MM/yy' }}</td>
                      <td>{{ ticket.status }}</td>
                      <td>{{ closedBy(ticket) }}</td>
                      <td>{{ days(closeDays(ticket)) }}</td>
                      <td>{{ reopenings(ticket) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (ticketRows().length > shown()) {
              <button
                mat-stroked-button
                type="button"
                class="more"
                (click)="shown.set(shown() + pageSize)"
              >
                Mostra altri {{ pageSize }} ({{ ticketRows().length - shown() }} rimasti)
              </button>
            }
          </section>
        }
      }
    </div>
  `,
  styles: `
    .split {
      display: grid;
      gap: 1rem;
      align-items: start;
    }

    @media (min-width: 1200px) {
      .split {
        grid-template-columns: minmax(0, 40rem) minmax(0, 1fr);
      }
    }

    .card-head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem 1rem;
      margin-block-end: 0.5rem;

      .title {
        margin: 0;
      }
    }

    .title {
      margin: 0 0 0.5rem;
      font: var(--mat-sys-title-medium);
    }

    .note {
      flex: 1 1 12rem;
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    .search {
      flex: 1 1 10rem;
      min-width: 0;
      padding: 0.375rem 0.625rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--gi-radius-sm);
      background: transparent;
      color: inherit;
      font: var(--mat-sys-body-medium);
    }

    .scroll {
      overflow-x: auto;
    }

    // Elenco dei richiedenti: scorre dentro il riquadro, l'intestazione resta ferma
    .scroll--list {
      max-height: 24rem;
      overflow-y: auto;

      thead th {
        position: sticky;
        top: 0;
        background: var(--mat-sys-surface);
        z-index: 1;
      }
    }

    // Intestazioni e numeri centrati insieme; richiedente e titolo a sinistra
    .table {
      width: 100%;
      border-collapse: collapse;
      font: var(--mat-sys-body-medium);

      th,
      td {
        padding: 0.3125rem 0.5rem;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        text-align: center;
        white-space: nowrap;
      }

      thead th {
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-label-medium);
        line-height: 1.2;
        padding-block: 0.5rem;
        vertical-align: bottom;
        white-space: normal;
      }

      th:first-child,
      td:first-child {
        text-align: start;
      }

      tbody tr:last-child td,
      tbody tr:last-child th {
        border-bottom: 0;
      }

      .empty {
        color: var(--mat-sys-on-surface-variant);
        text-align: center;
      }
    }

    .table--tickets {
      .summary,
      thead th:nth-child(2) {
        text-align: start;
      }

      .summary {
        max-width: 28rem;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

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
        font-size: 1rem;
        transform: translateY(-50%);
        opacity: 0.6;
      }
    }

    .pick {
      cursor: pointer;

      &:hover {
        background: color-mix(in srgb, var(--mat-sys-primary) 6%, transparent);
      }

      &.selected {
        background: color-mix(in srgb, var(--mat-sys-primary) 14%, transparent);
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

    .more {
      margin-block-start: 0.75rem;
    }
  `,
})
export class BiRequestersPage {
  protected readonly store = inject(BiStore);
  private readonly router = inject(Router);

  protected readonly help = TICKET_REQUESTERS_HELP;
  protected readonly quick = QUICK_DAYS;
  protected readonly chartWeeks = CHART_WEEKS;
  protected readonly pageSize = TICKETS_SHOWN;

  protected readonly columns: readonly {
    readonly key: SortKey;
    readonly label: string;
    readonly hint: string;
  }[] = [
    {
      key: 'created',
      label: 'Aperti',
      hint: 'Ticket aperti dal richiedente nel periodo (creati)',
    },
    { key: 'closed', label: 'Chiusi', hint: 'Tra quelli, i ticket oggi chiusi' },
    { key: 'open', label: 'Ancora aperti', hint: 'Ticket non ancora chiusi' },
    { key: 'closedPct', label: '% chiusi', hint: 'Chiusi ÷ aperti dal richiedente' },
    {
      key: 'avgDays',
      label: 'Giorni medi',
      hint: 'Giorni di calendario dalla creazione alla chiusura, sui ticket chiusi',
    },
    {
      key: 'reopenedTickets',
      label: 'Riaperti',
      hint: 'Ticket chiusi e poi tornati aperti almeno una volta',
    },
  ];

  protected readonly search = signal('');
  protected readonly selected = signal<string | null>(null);
  protected readonly sort = signal<{ key: SortKey; desc: boolean }>({ key: 'created', desc: true });
  protected readonly chartMode = signal<'month' | 'week'>('month');
  protected readonly shown = signal(TICKETS_SHOWN);

  private readonly facts = computed(() => ticketFacts(this.store.bounces() ?? []));

  protected readonly rows = computed(() =>
    requesterRows(this.store.createdInPeriod(), this.facts()),
  );

  protected readonly sortedRows = computed(() => {
    const terms = this.search().trim().toLowerCase();
    const { key, desc } = this.sort();
    const sign = desc ? -1 : 1;
    return this.rows()
      .filter((row) => !terms || row.name.toLowerCase().includes(terms))
      .sort(
        (a, b) => sign * ((a[key] ?? -1) - (b[key] ?? -1)) || a.name.localeCompare(b.name, 'it'),
      );
  });

  /** Richiedente in vista: quello scelto se c'è ancora con i filtri, altrimenti il primo. */
  protected readonly chosen = computed<string | null>(() => {
    const name = this.selected();
    if (name !== null && this.rows().some((row) => row.name === name)) {
      return name;
    }
    return this.rows()[0]?.name ?? null;
  });

  /** Ticket del richiedente creati nel periodo, dal più recente. */
  protected readonly ticketRows = computed<BiTicket[]>(() => {
    const name = this.chosen();
    return this.store
      .createdInPeriod()
      .filter((ticket) => reporterName(ticket) === name)
      .sort((a, b) => b.created.localeCompare(a.created));
  });

  protected readonly detail = computed<RequesterStats | null>(() => {
    const name = this.chosen();
    return name === null ? null : requesterStats(name, this.ticketRows(), this.facts());
  });

  protected readonly closers = computed(() => closersOf(this.ticketRows(), this.facts()));
  protected readonly byArea = computed(() => countBy(this.ticketRows(), areaOf));
  protected readonly byRequestType = computed(() =>
    countBy(this.ticketRows(), (t) => t.requestType ?? '(non indicato)'),
  );

  /** Il grafico segue il richiedente con area e assegnatario dei filtri, su tutto il periodo (anni scelti). */
  protected readonly points = computed(() => {
    const name = this.chosen();
    const tickets = this.store.scoped().filter((ticket) => reporterName(ticket) === name);
    const now = new Date();
    return this.chartMode() === 'month'
      ? monthly(tickets, this.store.years(), now)
      : weekly(tickets, new Date(now.getTime() - (CHART_WEEKS - 1) * WEEK_MS), now, true);
  });

  protected readonly jiraUrl = computed(() => {
    const base = this.store.data()?.sync.jiraBaseUrl;
    return base ? `${base.endsWith('/') ? base : base + '/'}browse/` : null;
  });

  constructor() {
    this.store.load();
    this.store.loadBounces();
  }

  protected pct(value: number | null): string {
    return value === null ? '–' : `${value}%`;
  }

  protected days(value: number | null): string {
    return value === null ? '–' : value.toLocaleString('it-IT', { maximumFractionDigits: 1 });
  }

  protected closeDays(ticket: BiTicket): number | null {
    const value = daysToClose(ticket);
    return value === null ? null : Math.round(value * 10) / 10;
  }

  protected closedBy(ticket: BiTicket): string {
    return ticket.category === 'DONE'
      ? (this.facts().get(ticket.key)?.closedBy ?? ticket.assignee ?? '–')
      : '';
  }

  protected reopenings(ticket: BiTicket): number | string {
    return this.facts().get(ticket.key)?.reopenings || '';
  }

  /** Sceglie il richiedente e riparte dai primi ticket dell'elenco. */
  protected choose(name: string): void {
    this.selected.set(name);
    this.shown.set(TICKETS_SHOWN);
  }

  protected openTickets(name: string): void {
    void this.router.navigate(['/tickets/dettaglio'], {
      queryParams: { scope: 'created', dim: 'reporter', value: name },
    });
  }

  protected sortBy(key: SortKey): void {
    const current = this.sort();
    this.sort.set({ key, desc: current.key === key ? !current.desc : true });
  }

  protected sortIcon(key: SortKey): string {
    const current = this.sort();
    return current.key === key && !current.desc ? 'arrow_upward' : 'arrow_downward';
  }

  protected ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
    const current = this.sort();
    return current.key !== key ? 'none' : current.desc ? 'descending' : 'ascending';
  }
}
