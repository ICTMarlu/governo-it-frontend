import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { HelpButton } from '../../../shared/help/help-button';
import { BOUNCES_HELP } from '../../../shared/help/help-content';
import {
  BounceGroup,
  bouncesByPerson,
  bouncesByWeek,
  closedWithoutWaiting,
  filterBounces,
  groupNameOf,
  totalBounces,
  worstTickets,
} from './bi-bounces';
import { BiFilters } from './bi-filters';
import { BiStore } from './bi-store.service';

/** Settimane del grafico (indipendenti da anno e mese dei filtri). */
const CHART_WEEKS = 12;
/** Ticket mostrati in fondo, dal più rimbalzato. */
const WORST_TICKETS = 15;

type SortKey =
  | 'closedTickets'
  | 'bouncedTickets'
  | 'bouncedPct'
  | 'reopenings'
  | 'waitTickets'
  | 'answeredTickets'
  | 'answeredPct';

/**
 * Rimbalzi dei ticket, letti dalla cronologia: quante volte un ticket torna indietro dopo la chiusura
 * (riapertura) o dopo l'attesa del cliente (rientro), per persona che lo aveva in quel momento e nel
 * tempo. Serve a capire chi chiude in fretta e va aiutato a lavorare meglio.
 */
@Component({
  selector: 'gov-bi-bounces-page',
  imports: [BiFilters, HelpButton, MatButtonToggleModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="bi-page">
      <gov-bi-filters>
        <gov-help-button [help]="help" [compact]="true" label="Come si leggono i rimbalzi" />
      </gov-bi-filters>
      @if (store.bouncesError(); as error) {
        <p class="bi-state" role="alert">{{ error }}</p>
      } @else if (!store.bounces()) {
        <p class="bi-state" role="status">
          <mat-progress-spinner diameter="24" mode="indeterminate" aria-hidden="true" /> Caricamento
          della cronologia…
        </p>
      } @else {
        @let t = total();
        <ul class="gi-kpis" aria-label="Numeri del periodo">
          <li
            class="gi-kpi gi-kpi--info"
            title="Ticket chiusi nel periodo che sono stati riaperti almeno una volta"
          >
            <span class="gi-kpi__value">{{ t.bouncedTickets }}</span
            ><span class="gi-kpi__label">ticket chiusi che hanno rimbalzato</span>
            <span class="gi-kpi__meta"
              >{{ pct(t.bouncedPct) }} dei {{ t.closedTickets }} ticket chiusi</span
            >
          </li>
          <li
            class="gi-kpi gi-kpi--info"
            title="Ticket chiusi nel periodo che in tutta la loro storia non sono mai passati da In attesa di risposta dal cliente: chiusi senza aver mai chiesto nulla al cliente"
          >
            <span class="gi-kpi__value">{{ noWait().tickets }}</span
            ><span class="gi-kpi__label"
              >ticket chiusi senza mai passare dall'attesa del cliente</span
            >
            <span class="gi-kpi__meta"
              >{{ pct(noWait().pct) }} dei {{ noWait().closed }} ticket chiusi</span
            >
          </li>
          <li
            class="gi-kpi gi-kpi--info"
            title="Ticket chiusi nel periodo che, in tutta la loro storia, sono passati almeno una volta da In attesa di risposta dal cliente prima di essere chiusi"
          >
            <span class="gi-kpi__value">{{ noWait().withWaiting }}</span
            ><span class="gi-kpi__label">ticket chiusi dopo almeno un'attesa del cliente</span>
            <span class="gi-kpi__meta"
              >{{ pct(noWait().withWaitingPct) }} dei {{ noWait().closed }} ticket chiusi</span
            >
          </li>
          <li
            class="gi-kpi gi-kpi--warning"
            title="Ticket riaperti almeno due volte nel periodo: il ping pong tra chiusura e cliente"
          >
            <span class="gi-kpi__value">{{ t.repeated }}</span
            ><span class="gi-kpi__label">ticket riaperti 2+ volte</span>
          </li>
          <li
            class="gi-kpi gi-kpi--info"
            title="Il cliente risponde e il ticket esce dall'attesa e torna in lavorazione"
          >
            <span class="gi-kpi__value">{{ t.answeredTickets }}</span
            ><span class="gi-kpi__label">ticket in attesa con risposta del cliente</span>
            <span class="gi-kpi__meta"
              >{{ pct(t.answeredPct) }} dei {{ t.waitTickets }} messi in attesa</span
            >
          </li>
        </ul>

        @if (rows().length === 0) {
          <p class="bi-state">Nessun passaggio per i filtri scelti.</p>
        } @else {
          <div class="split">
            <section class="bi-card" aria-labelledby="bounce-people">
              <header class="card-head">
                <h2 id="bounce-people" class="title">
                  Rimbalzi per {{ group() === 'handler' ? 'persona' : 'richiedente' }}
                </h2>
                <mat-button-toggle-group
                  class="group-toggle"
                  aria-label="Raggruppa per"
                  hideSingleSelectionIndicator
                  [value]="group()"
                  (change)="setGroup($event.value)"
                >
                  <mat-button-toggle value="handler">Persona</mat-button-toggle>
                  <mat-button-toggle value="reporter">Richiedente</mat-button-toggle>
                </mat-button-toggle-group>
                <p class="note">
                  <strong>I numeri possono differire dalla Panoramica e dalle altre pagine</strong>:
                  qui ogni passaggio è di chi aveva il ticket in quel momento e anno e mese sono
                  quelli del passaggio (la Panoramica conta i ticket creati nel periodo e assegnati
                  oggi). Serve a dare la responsabilità in modo puntuale. Sulla chiusura i
                  rimbalzati sono il segnale da guardare; sull'attesa le risposte sono il flusso
                  normale. Clic sul nome: il grafico mostra solo quella persona.
                </p>
              </header>
              <div class="scroll">
                <table class="table">
                  <thead>
                    <tr class="group">
                      <td></td>
                      <th scope="colgroup" colspan="4" class="group--closed">
                        Dopo la chiusura (il ticket torna indietro)
                      </th>
                      <th scope="colgroup" colspan="3" class="group--wait">
                        Attesa del cliente (il cliente risponde)
                      </th>
                    </tr>
                    <tr>
                      <th scope="col">{{ group() === 'handler' ? 'Persona' : 'Richiedente' }}</th>
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
                        [class.selected]="row.name === selected()"
                        (click)="toggle(row.name)"
                      >
                        <th scope="row">
                          <button
                            type="button"
                            class="link-btn"
                            [attr.aria-pressed]="row.name === selected()"
                            (click)="toggle(row.name); $event.stopPropagation()"
                          >
                            {{ row.name }}
                          </button>
                        </th>
                        <td>{{ row.closedTickets }}</td>
                        <td>
                          <strong>{{ row.bouncedTickets }}</strong>
                        </td>
                        <td>{{ pct(row.bouncedPct) }}</td>
                        <td>{{ row.reopenings }}</td>
                        <td>{{ row.waitTickets }}</td>
                        <td>
                          <strong>{{ row.answeredTickets }}</strong>
                        </td>
                        <td>{{ pct(row.answeredPct) }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr class="total">
                      <th scope="row">Totale</th>
                      <td>{{ t.closedTickets }}</td>
                      <td>{{ t.bouncedTickets }}</td>
                      <td>{{ pct(t.bouncedPct) }}</td>
                      <td>{{ t.reopenings }}</td>
                      <td>{{ t.waitTickets }}</td>
                      <td>{{ t.answeredTickets }}</td>
                      <td>{{ pct(t.answeredPct) }}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section class="bi-card" aria-labelledby="bounce-weeks">
              <header class="card-head">
                <h2 id="bounce-weeks" class="title">
                  {{
                    selected() ??
                      (group() === 'handler' ? 'Tutte le persone' : 'Tutti i richiedenti')
                  }}: ultime {{ chartWeeks }} settimane
                </h2>
                <ul class="legend" aria-label="Legenda">
                  <li>
                    <span class="swatch swatch--reopened" aria-hidden="true"></span>Riaperture
                  </li>
                  <li>
                    <span class="swatch swatch--returned" aria-hidden="true"></span>Rientri
                    dall'attesa
                  </li>
                  <li class="legend__partial">* settimana in corso</li>
                </ul>
              </header>
              <div class="chart" role="img" [attr.aria-label]="chartLabel()">
                @for (week of weeks(); track week.title) {
                  <div class="col" [title]="weekTitle(week)">
                    <div class="col__bars" [class.col__bars--partial]="week.partial">
                      <span
                        class="bar bar--reopened"
                        [style.height.%]="barHeight(week.reopened)"
                      ></span>
                      <span
                        class="bar bar--returned"
                        [style.height.%]="barHeight(week.waitReturned)"
                      ></span>
                    </div>
                    <span class="col__label">{{ week.label }}{{ week.partial ? '*' : '' }}</span>
                  </div>
                }
              </div>
              <p class="note">
                Passa sopra una settimana per i numeri. Il grafico non cambia con anno e mese.
              </p>
            </section>
          </div>

          <section class="bi-card" aria-labelledby="bounce-tickets">
            <h2 id="bounce-tickets" class="title">
              Ticket più volte riaperti dopo la chiusura{{ selected() ? ' · ' + selected() : '' }}
            </h2>
            <div class="scroll">
              <table class="table table--tickets">
                <thead>
                  <tr>
                    <th scope="col">Ticket</th>
                    <th scope="col">Titolo</th>
                    <th scope="col">Aveva il ticket</th>
                    <th scope="col">Richiedente</th>
                    <th scope="col">Riaperti dopo la chiusura</th>
                  </tr>
                </thead>
                <tbody>
                  @for (ticket of worst(); track ticket.key) {
                    <tr>
                      <th scope="row">{{ ticket.key }}</th>
                      <td class="summary">{{ ticket.summary }}</td>
                      <td>{{ ticket.handler }}</td>
                      <td>{{ ticket.reporter }}</td>
                      <td>{{ ticket.reopened }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
      }
    </div>
  `,
  styles: `
    .split {
      display: grid;
      gap: 1rem;
      align-items: stretch;
      margin-block: 1rem;
    }

    @media (min-width: 1200px) {
      .split {
        grid-template-columns: minmax(0, 46rem) minmax(0, 1fr);
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

    .scroll {
      overflow-x: auto;
    }

    // Intestazioni e numeri centrati insieme; persona e titolo a sinistra
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

      // Riga dei gruppi sopra le intestazioni: i quattro numeri dopo la chiusura e i tre sull'attesa
      thead .group {
        td,
        th {
          padding-block: 0.25rem;
          border-bottom: 0;
          font: var(--mat-sys-label-small);
          letter-spacing: 0.02em;
        }

        th {
          border-radius: var(--gi-radius-sm) var(--gi-radius-sm) 0 0;
        }

        .group--closed {
          background: color-mix(in srgb, var(--gi-critical) 14%, transparent);
        }

        .group--wait {
          background: color-mix(in srgb, var(--gi-info) 14%, transparent);
        }
      }

      tfoot td,
      tfoot th {
        border-top: 2px solid var(--mat-sys-outline);
        border-bottom: 0;
        font-weight: 700;
      }
    }

    .table--tickets {
      .summary,
      thead th:nth-child(2),
      thead th:nth-child(3),
      td:nth-child(3) {
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

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;
      font: var(--mat-sys-body-small);

      &__partial {
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .swatch {
      display: inline-block;
      width: 0.75rem;
      height: 0.75rem;
      margin-inline-end: 0.25rem;
      border-radius: 2px;

      &--reopened {
        background: var(--gi-critical);
      }

      &--returned {
        background: var(--gi-info);
      }
    }

    // Barre affiancate per settimana, altezza proporzionale al massimo; i numeri sono nel riquadro al passaggio
    .chart {
      display: flex;
      align-items: stretch;
      gap: 0.375rem;
      height: 14rem;
      margin-block-end: 0.5rem;
    }

    .col {
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      min-width: 0;

      &__bars {
        display: flex;
        flex: 1 1 auto;
        align-items: flex-end;
        justify-content: center;
        gap: 2px;
        border-bottom: 1px solid var(--mat-sys-outline);

        &--partial {
          opacity: 0.55;
        }
      }

      &__label {
        font: var(--mat-sys-label-small);
        text-align: center;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .bar {
      flex: 1 1 0;
      max-width: 1.25rem;
      min-height: 0;
      border-radius: 3px 3px 0 0;

      &--reopened {
        background: var(--gi-critical);
      }

      &--returned {
        background: var(--gi-info);
      }
    }
  `,
})
export class BiBouncesPage {
  protected readonly store = inject(BiStore);
  protected readonly help = BOUNCES_HELP;
  protected readonly chartWeeks = CHART_WEEKS;
  protected readonly columns: readonly {
    readonly key: SortKey;
    readonly label: string;
    readonly hint: string;
  }[] = [
    {
      key: 'closedTickets',
      label: 'Ticket chiusi',
      hint: 'Ticket distinti portati a Risolta, Chiusa, Done o Declined nel periodo, di chi li aveva in quel momento. Un ticket chiuso più volte conta una volta. Può differire dai risolti della Panoramica (vedi la nota sopra)',
    },
    {
      key: 'bouncedTickets',
      label: 'Ticket rimbalzati',
      hint: 'Tra i ticket chiusi nel periodo, quelli tornati aperti almeno una volta (di solito il cliente risponde): il segnale da guardare',
    },
    {
      key: 'bouncedPct',
      label: '% rimbalzati',
      hint: 'Ticket rimbalzati ÷ ticket chiusi, nello stesso periodo',
    },
    {
      key: 'reopenings',
      label: 'Riaperture (volte)',
      hint: 'Quante volte in tutto i ticket sono tornati aperti dopo la chiusura nel periodo: un ticket riaperto tre volte ne vale tre',
    },
    {
      key: 'waitTickets',
      label: 'Ticket messi in attesa',
      hint: 'Ticket distinti messi in "In attesa di risposta dal cliente" nel periodo',
    },
    {
      key: 'answeredTickets',
      label: 'Cliente ha risposto',
      hint: 'Tra quelli messi in attesa, i ticket in cui il cliente ha risposto e sono tornati in lavorazione. È il flusso normale, non un errore',
    },
    {
      key: 'answeredPct',
      label: '% risposte',
      hint: 'Ticket con risposta ÷ ticket messi in attesa. Gli altri sono stati chiusi, messi in Pending o sono ancora in attesa',
    },
  ];

  /** Persona scelta con un clic sul nome: il grafico e i ticket peggiori riguardano solo lei. */
  protected readonly selected = signal<string | null>(null);
  /** Tabella per chi aveva il ticket o per chi l'ha richiesto. */
  protected readonly group = signal<BounceGroup>('handler');
  protected readonly sort = signal<{ key: SortKey; desc: boolean }>({
    key: 'bouncedTickets',
    desc: true,
  });

  /** Passaggi dei filtri in alto (area, persona, anno, mesi). */
  private readonly filtered = this.store.filteredBounces;

  protected readonly rows = computed(() => bouncesByPerson(this.filtered(), this.group()));
  protected readonly total = computed(() => totalBounces(this.filtered()));
  protected readonly noWait = computed(() =>
    closedWithoutWaiting(this.filtered(), this.store.bounces() ?? []),
  );

  protected readonly sortedRows = computed(() => {
    const { key, desc } = this.sort();
    const sign = desc ? -1 : 1;
    return [...this.rows()].sort(
      (a, b) => sign * ((a[key] ?? -1) - (b[key] ?? -1)) || a.name.localeCompare(b.name, 'it'),
    );
  });

  /** Passaggi della persona scelta (o di tutti) per grafico e ticket peggiori. */
  private readonly scope = computed(() => {
    const name = this.selected();
    return name === null
      ? this.filtered()
      : this.filtered().filter((bounce) => groupNameOf(bounce, this.group()) === name);
  });

  /** Il grafico guarda le ultime settimane a prescindere da anno e mese, ma rispetta area e persona. */
  protected readonly weeks = computed(() => {
    const name = this.selected();
    const all = filterBounces(this.store.bounces() ?? [], {
      ...this.store.filters(),
      years: null,
      months: null,
    });
    const scoped = name === null ? all : all.filter((b) => groupNameOf(b, this.group()) === name);
    return bouncesByWeek(scoped, new Date(), CHART_WEEKS);
  });

  private readonly maxWeek = computed(() =>
    Math.max(1, ...this.weeks().flatMap((week) => [week.reopened, week.waitReturned])),
  );

  protected readonly worst = computed(() => worstTickets(this.scope(), WORST_TICKETS));

  protected readonly chartLabel = computed(
    () =>
      'Riaperture e rientri per settimana: ' +
      this.weeks()
        .map((week) => `${week.title}, ${week.reopened} riaperture, ${week.waitReturned} rientri`)
        .join('; '),
  );

  constructor() {
    this.store.loadBounces();
    // Per i filtri in alto servono anche le opzioni di area e assegnatario dei ticket
    this.store.load();
  }

  protected pct(value: number | null): string {
    return value === null ? '–' : `${value}%`;
  }

  protected barHeight(value: number): number {
    return (value / this.maxWeek()) * 100;
  }

  protected weekTitle(week: { title: string; reopened: number; waitReturned: number }): string {
    return `${week.title}: ${week.reopened} riaperture, ${week.waitReturned} rientri`;
  }

  protected setGroup(group: BounceGroup): void {
    this.group.set(group);
    this.selected.set(null);
  }

  protected toggle(name: string): void {
    this.selected.set(this.selected() === name ? null : name);
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
