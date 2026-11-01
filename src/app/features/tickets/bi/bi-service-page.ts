import { DecimalPipe, Location, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import { BiStore } from './bi-store.service';
import {
  FLASH_PERIODS,
  FlashPeriod,
  flashWindows,
  isFlashPeriod,
  previousWorkingDay,
  serviceFlash,
  startOfDay,
} from './service-flash.model';

/** Una colonna dei grafici nel tempo: entrati e chiusi nella stessa fascia. */
interface Column {
  readonly label: string;
  readonly title: string;
  readonly created: number;
  readonly resolved: number;
  readonly muted: boolean;
  /** Fascia oraria (0-23) oppure intervallo in millisecondi del giorno o della settimana. */
  readonly hour?: number;
  readonly start?: number;
  readonly end?: number;
}

/**
 * Flash del servizio (D-27): in un periodo, chi ha chiuso i ticket, per chi, a che ora e su cosa.
 * Si arriva dai riquadri "entrati / chiusi" della pagina operativa; per chi vede la propria
 * persona il flash è solo il suo. Si calcola nel browser dai ticket già caricati.
 */
@Component({
  selector: 'gov-bi-service-page',
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    NgTemplateOutlet,
  ],
  template: `
    <div class="bi-page">
      <div class="head">
        <button mat-button type="button" (click)="back()">
          <mat-icon aria-hidden="true">arrow_back</mat-icon>
          Indietro
        </button>
        <h1 class="head__title">
          Servizio erogato
          @if (personName(); as name) {
            <span class="muted">· {{ name }}</span>
          }
        </h1>
        <mat-form-field class="period gi-filter-bar" appearance="outline" subscriptSizing="dynamic">
          <mat-label>Periodo</mat-label>
          <mat-select
            [value]="period()"
            (selectionChange)="chosen.set($event.value)"
            hideSingleSelectionIndicator
            aria-label="Periodo del flash"
          >
            @for (option of options(); track option.value) {
              <mat-option [value]="option.value">{{ option.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <span class="muted head__range">{{ rangeLabel() }}</span>
      </div>

      @if (store.error(); as error) {
        <p class="bi-state" role="alert">{{ error }}</p>
      } @else if (!store.data()) {
        <p class="bi-state" role="status">
          <mat-progress-spinner diameter="24" mode="indeterminate" aria-hidden="true" /> Caricamento
          dei ticket…
        </p>
      } @else {
        @let f = flash();
        @if (f.created === 0 && f.resolved === 0) {
          <p class="bi-state">Nessun ticket entrato o chiuso in questo periodo.</p>
        } @else {
          <p class="headline" [title]="headline()">{{ headline() }}</p>

          <div class="summary">
            <ul class="gi-kpis" aria-label="Numeri del periodo">
              <li
                class="gi-kpi gi-kpi--link"
                role="link"
                tabindex="0"
                title="Vedi i ticket chiusi"
                (click)="open('resolved')"
                (keydown.enter)="open('resolved')"
              >
                <span class="gi-kpi__value">{{ f.resolved }}</span>
                <span class="gi-kpi__label">ticket chiusi</span>
                @if (compare(f.resolved, before()?.resolved); as text) {
                  <span class="gi-kpi__meta">{{ text }}</span>
                }
              </li>
              <li
                class="gi-kpi gi-kpi--link"
                role="link"
                tabindex="0"
                title="Vedi i ticket entrati"
                (click)="open('created')"
                (keydown.enter)="open('created')"
              >
                <span class="gi-kpi__value">{{ f.created }}</span>
                <span class="gi-kpi__label">ticket entrati</span>
                @if (compare(f.created, before()?.created); as text) {
                  <span class="gi-kpi__meta">{{ text }}</span>
                }
              </li>
              <li
                class="gi-kpi gi-kpi--link"
                role="link"
                tabindex="0"
                title="Vedi i ticket entrati e chiusi"
                (click)="open('both')"
                (keydown.enter)="open('both')"
              >
                <span class="gi-kpi__value">{{ balanceText() }}</span>
                <span class="gi-kpi__label">saldo del backlog</span>
                <span class="gi-kpi__meta">{{
                  f.created > f.resolved
                    ? 'il backlog sale'
                    : f.created < f.resolved
                      ? 'il backlog scende'
                      : 'pari'
                }}</span>
              </li>
              @if (f.perWorkingDay !== null && !windows().current.singleDay) {
                <li
                  class="gi-kpi gi-kpi--link"
                  role="link"
                  tabindex="0"
                  title="Vedi i ticket chiusi"
                  (click)="open('resolved')"
                  (keydown.enter)="open('resolved')"
                >
                  <span class="gi-kpi__value">{{ f.perWorkingDay | number: '1.0-1' }}</span>
                  <span class="gi-kpi__label">chiusi al giorno lavorativo</span>
                </li>
              }
              @if (f.medianDays !== null) {
                <li
                  class="gi-kpi gi-kpi--link"
                  role="link"
                  tabindex="0"
                  title="Vedi i ticket chiusi"
                  (click)="open('resolved')"
                  (keydown.enter)="open('resolved')"
                >
                  <span class="gi-kpi__value">{{ durationText(f.medianDays) }}</span>
                  <span class="gi-kpi__label">tempo mediano di chiusura</span>
                  <span class="gi-kpi__meta">dall'apertura del ticket</span>
                </li>
              }
              @if (f.within24h !== null) {
                <li
                  class="gi-kpi gi-kpi--link"
                  role="link"
                  tabindex="0"
                  title="Vedi i ticket chiusi entro 24 ore"
                  (click)="open('resolved', { fast: '1' })"
                  (keydown.enter)="open('resolved', { fast: '1' })"
                >
                  <span class="gi-kpi__value">{{ f.within24h }}%</span>
                  <span class="gi-kpi__label">chiusi entro 24 ore</span>
                </li>
              }
            </ul>

            @if (f.areas.length > 0) {
              <section class="panel" aria-labelledby="area-title">
                <h2 id="area-title" class="panel__title">Su cosa abbiamo lavorato</h2>
                <p class="panel__hint">Ticket chiusi per Progetto Marlù.</p>
                <ul class="vbars">
                  @for (line of topAreas(); track line.label) {
                    <li
                      class="vbar vbar--link"
                      role="link"
                      tabindex="0"
                      [title]="line.label + ': ' + line.value + ' (vedi i ticket)'"
                      (click)="open('resolved', { area: line.label })"
                      (keydown.enter)="open('resolved', { area: line.label })"
                    >
                      <span class="vbar__value">{{ line.value }}</span>
                      <span class="vbar__track" aria-hidden="true">
                        <span
                          class="vbar__bar"
                          [style.height.%]="percent(line.value, f.areas[0].value)"
                        ></span>
                      </span>
                      <span class="vbar__label">{{ line.label }}</span>
                    </li>
                  }
                </ul>
                @if (f.areas.length > topAreas().length) {
                  <p class="muted small">
                    e altri {{ f.areas.length - topAreas().length }} progetti con meno ticket
                  </p>
                }
              </section>
            }
          </div>

          <div class="panels">
            @if (!personName()) {
              <section class="panel" aria-labelledby="who-title">
                <h2 id="who-title" class="panel__title">Chi ha chiuso</h2>
                <p class="panel__hint">Ticket chiusi nel periodo, per assegnatario.</p>
                @if (f.closedBy.length === 0) {
                  <p class="muted">Nessun ticket chiuso.</p>
                } @else {
                  <ul class="rows">
                    @for (line of f.closedBy; track line.label) {
                      <li
                        class="row row--link"
                        role="link"
                        tabindex="0"
                        [title]="'Vedi i ticket chiusi da ' + line.label"
                        (click)="open('resolved', { assignee: line.label })"
                        (keydown.enter)="open('resolved', { assignee: line.label })"
                      >
                        <span class="row__name" [title]="line.label">{{ line.label }}</span>
                        <span class="row__track" aria-hidden="true">
                          <span
                            class="row__bar"
                            [style.width.%]="percent(line.value, f.closedBy[0].value)"
                          ></span>
                        </span>
                        <span class="row__value"
                          >{{ line.value }}
                          <span class="muted">({{ percent(line.value, f.resolved) }}%)</span></span
                        >
                      </li>
                    }
                  </ul>
                }
              </section>
            }

            <section class="panel" aria-labelledby="whom-title">
              <h2 id="whom-title" class="panel__title">A chi abbiamo dato servizio</h2>
              <p class="panel__hint">
                Richiedenti dei ticket chiusi. In grigio, quanti ne hanno aperti nello stesso
                periodo.
              </p>
              @if (f.requesters.length === 0) {
                <p class="muted">Nessun ticket chiuso.</p>
              } @else {
                <ul class="rows">
                  @for (line of topRequesters(); track line.name) {
                    <li
                      class="row row--link"
                      role="link"
                      tabindex="0"
                      [title]="'Vedi i ticket chiusi per ' + line.name"
                      (click)="open('resolved', { reporter: line.name })"
                      (keydown.enter)="open('resolved', { reporter: line.name })"
                    >
                      <span class="row__name" [title]="line.name">{{ line.name }}</span>
                      <span class="row__track" aria-hidden="true">
                        <span
                          class="row__bar"
                          [style.width.%]="percent(line.resolved, f.requesters[0].resolved)"
                        ></span>
                      </span>
                      <span class="row__value"
                        >{{ line.resolved }}
                        <span class="muted" title="Ticket aperti nel periodo"
                          >· {{ line.created }} aperti</span
                        ></span
                      >
                    </li>
                  }
                </ul>
                @if (f.requesters.length > topRequesters().length) {
                  <p class="muted small">
                    e altri {{ f.requesters.length - topRequesters().length }} richiedenti con meno
                    ticket
                  </p>
                }
              }
            </section>
          </div>

          <section class="panel" aria-labelledby="time-title">
            <h2 id="time-title" class="panel__title">Quando arrivano e quando si chiudono</h2>
            <p class="panel__hint">
              Per fascia oraria (ora italiana), su tutto il periodo.
              <span class="legend"
                ><span class="swatch swatch--created" aria-hidden="true"></span>entrati
                <span class="swatch swatch--resolved" aria-hidden="true"></span>chiusi</span
              >
            </p>
            <ng-container
              *ngTemplateOutlet="
                columnsTpl;
                context: { $implicit: hourColumns(), name: 'fascia oraria' }
              "
            />
          </section>

          @if (dayColumns().length > 0) {
            <section class="panel" aria-labelledby="trend-title">
              <h2 id="trend-title" class="panel__title">
                Andamento {{ f.dailyBars ? 'giorno per giorno' : 'settimana per settimana' }}
              </h2>
              <p class="panel__hint">
                Il trend del periodo: quando si è lavorato di più e quando sono arrivate più
                richieste.
              </p>
              <ng-container
                *ngTemplateOutlet="
                  columnsTpl;
                  context: { $implicit: dayColumns(), name: 'periodo' }
                "
              />
            </section>
          }

          @if (!personName() && f.matrix.rows.length > 1) {
            <section class="panel" aria-labelledby="matrix-title">
              <h2 id="matrix-title" class="panel__title">Chi ha servito chi</h2>
              <p class="panel__hint">
                Ticket chiusi da ogni persona (righe) per richiedente (colonne): più il riquadro è
                scuro, più ticket.
              </p>
              <div class="matrix-wrap">
                <table class="matrix">
                  <thead>
                    <tr>
                      <th scope="col">Chi ha chiuso</th>
                      @for (name of f.matrix.requesters; track name) {
                        <th scope="col" [title]="name">{{ name }}</th>
                      }
                      <th scope="col">Totale</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of f.matrix.rows; track row.person) {
                      <tr>
                        <th scope="row">{{ row.person }}</th>
                        @for (cell of row.cells; track $index; let i = $index) {
                          <td
                            class="cell"
                            [class.cell--empty]="cell === 0"
                            [class.cell--link]="cell > 0 && f.matrix.requesters[i] !== 'Altri'"
                            [style.--heat]="cell / f.matrix.max"
                            (click)="openCell(row.person, f.matrix.requesters[i], cell)"
                          >
                            {{ cell === 0 ? '' : cell }}
                          </td>
                        }
                        <td
                          class="strong cell--link"
                          [title]="'Vedi i ticket chiusi da ' + row.person"
                          (click)="open('resolved', { assignee: row.person })"
                        >
                          {{ row.total }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>
          }
        }
      }
    </div>

    <ng-template #columnsTpl let-columns let-name="name">
      <div class="columns" role="group" [attr.aria-label]="'Entrati e chiusi per ' + name">
        @for (column of columns; track $index) {
          <div class="column" [class.column--muted]="column.muted" [title]="titleOf(column)">
            <div class="column__bars">
              <span
                class="column__bar column__bar--created"
                [attr.role]="column.created > 0 ? 'link' : null"
                [attr.tabindex]="column.created > 0 ? 0 : null"
                (click)="openColumn(column, 'created')"
                (keydown.enter)="openColumn(column, 'created')"
                [style.height.%]="height(column.created, columns)"
              >
                @if (column.created > 0) {
                  <span class="column__value">{{ column.created }}</span>
                }
              </span>
              <span
                class="column__bar column__bar--resolved"
                [attr.role]="column.resolved > 0 ? 'link' : null"
                [attr.tabindex]="column.resolved > 0 ? 0 : null"
                (click)="openColumn(column, 'resolved')"
                (keydown.enter)="openColumn(column, 'resolved')"
                [style.height.%]="height(column.resolved, columns)"
              >
                @if (column.resolved > 0) {
                  <span class="column__value">{{ column.resolved }}</span>
                }
              </span>
            </div>
            <span class="column__label">{{ column.label }}</span>
          </div>
        }
      </div>
    </ng-template>
  `,
  styles: `
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;

      &__title {
        margin: 0;
        font: var(--mat-sys-title-large);
      }

      &__range {
        font: var(--mat-sys-body-medium);
      }
    }

    .period {
      width: 14rem;
    }

    .muted {
      color: var(--mat-sys-on-surface-variant);
      font-weight: 400;
    }

    .small {
      font: var(--mat-sys-body-small);
    }

    // La frase di sintesi sta sempre su una riga: se è più lunga dello spazio si tronca
    .headline {
      margin: 0;
      overflow: hidden;
      font: var(--mat-sys-body-large);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .panels {
      display: grid;
      gap: 1rem;
    }

    @media (min-width: 1024px) {
      .panels {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    .panel {
      min-width: 0;
      padding: 1rem 1.25rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--gi-radius-lg);

      &__title {
        margin: 0 0 0.125rem;
        font: var(--mat-sys-title-medium);
      }

      &__hint {
        margin: 0 0 0.75rem;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-body-small);
      }
    }

    .legend {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      margin-inline-start: 0.75rem;
    }

    .swatch {
      display: inline-block;
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 0.125rem;

      &--created {
        background: var(--flash-created);
      }

      &--resolved {
        background: var(--flash-resolved);
      }
    }

    :host {
      --flash-created: color-mix(in srgb, var(--mat-sys-on-surface-variant) 45%, transparent);
      --flash-resolved: var(--mat-sys-primary);
    }

    .rows {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .row--link,
    .vbar--link {
      cursor: pointer;
    }

    .row--link:hover,
    .row--link:focus-visible {
      border-radius: 0.375rem;
      background: var(--mat-sys-surface-container);
    }

    .vbar--link:hover .vbar__bar,
    .vbar--link:focus-visible .vbar__bar,
    .column__bar[role='link']:hover,
    .column__bar[role='link']:focus-visible {
      filter: brightness(0.85);
    }

    .column__bar[role='link'] {
      cursor: pointer;
    }

    .cell--link {
      cursor: pointer;

      &:hover {
        outline: 2px solid var(--mat-sys-primary);
      }
    }

    .row {
      display: grid;
      grid-template-columns: minmax(7rem, 12rem) 1fr auto;
      align-items: center;
      gap: 0.75rem;

      &__name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      &__track {
        height: 0.75rem;
        border-radius: 0.375rem;
        background: var(--mat-sys-surface-container);
      }

      &__bar {
        display: block;
        height: 100%;
        border-radius: 0.375rem;
        background: var(--flash-resolved);
      }

      &__value {
        min-width: 3rem;
        font-weight: 600;
        text-align: end;
        white-space: nowrap;
      }
    }

    // Numeri a sinistra su due righe, progetti a destra: stessa altezza, niente spazi vuoti
    .summary {
      display: flex;
      flex-wrap: wrap;
      align-items: stretch;
      gap: 1rem;

      > .gi-kpis {
        flex: 0 1 30rem;
        grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
        grid-auto-rows: 1fr;
      }

      > .panel {
        flex: 1 1 22rem;
      }
    }

    .vbars {
      display: flex;
      align-items: stretch;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
      overflow-x: auto;
    }

    .vbar {
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      align-items: center;
      min-width: 3.75rem;
      max-width: 8rem;
      gap: 0.25rem;

      &__value {
        font-weight: 600;
      }

      &__track {
        display: flex;
        align-items: flex-end;
        justify-content: center;
        width: 100%;
        height: 5.5rem;
        border-radius: 0.375rem;
        background: var(--mat-sys-surface-container);
      }

      &__bar {
        display: block;
        width: 60%;
        min-height: 3px;
        border-radius: 0.375rem 0.375rem 0 0;
        background: var(--flash-resolved);
      }

      &__label {
        display: -webkit-box;
        overflow: hidden;
        font: var(--mat-sys-body-small);
        text-align: center;
        overflow-wrap: anywhere;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
      }
    }

    .columns {
      display: flex;
      align-items: flex-end;
      gap: 0.25rem;
      height: 11rem;
      overflow-x: auto;
    }

    .column {
      display: flex;
      flex: 1 1 0;
      flex-direction: column;
      align-items: stretch;
      min-width: 1.75rem;
      height: 100%;

      &__bars {
        display: flex;
        flex: 1;
        align-items: flex-end;
        justify-content: center;
        gap: 2px;
      }

      &__bar {
        position: relative;
        flex: 1 1 0;
        max-width: 1.5rem;
        min-height: 2px;
        border-radius: 3px 3px 0 0;

        &--created {
          background: var(--flash-created);
        }

        &--resolved {
          background: var(--flash-resolved);
        }
      }

      &__value {
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        font: var(--mat-sys-label-small);
      }

      &__label {
        margin-top: 0.25rem;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-label-small);
        text-align: center;
        white-space: nowrap;
      }

      &--muted &__label {
        opacity: 0.6;
      }
    }

    .matrix-wrap {
      overflow-x: auto;
    }

    .matrix {
      width: 100%;
      border-collapse: separate;
      border-spacing: 2px;
      font: var(--mat-sys-body-small);

      th {
        padding: 0.25rem 0.5rem;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-label-medium);
        text-align: center;
        max-width: 9rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      tbody th {
        color: var(--mat-sys-on-surface);
        text-align: start;
      }

      td {
        padding: 0.375rem 0.5rem;
        border-radius: 0.375rem;
        text-align: center;
      }
    }

    .cell {
      background: color-mix(
        in srgb,
        var(--mat-sys-primary) calc(var(--heat, 0) * 40%),
        transparent
      );

      &--empty {
        background: var(--mat-sys-surface-container-low);
      }
    }

    .strong {
      font-weight: 600;
    }
  `,
})
export class BiServicePage {
  protected readonly store = inject(BiStore);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  /** Dalla pagina di partenza (query): periodo, persona, giorno di "ieri", nome da mostrare. */
  readonly startPeriod = input<string>('7', { alias: 'period' });
  readonly resource = input<string>('');
  readonly day = input<string>('');
  readonly title = input<string>('');

  /** Periodo scelto dal menu in alto: vince su quello di partenza. */
  protected readonly chosen = signal<FlashPeriod | null>(null);

  protected readonly period = computed<FlashPeriod>(
    () =>
      this.chosen() ??
      (isFlashPeriod(this.startPeriod()) ? (this.startPeriod() as FlashPeriod) : '7'),
  );

  /** Nome della persona se il flash è personale (altrimenti tutto il servizio). */
  protected readonly personName = computed(() => {
    const id = this.resource();
    if (!id) {
      return null;
    }
    return (
      this.title() ||
      this.store.tickets().find((ticket) => String(ticket.resourceId) === id)?.assignee ||
      null
    );
  });

  private readonly now = computed(() => {
    this.store.data();
    return new Date();
  });

  protected readonly windows = computed(() =>
    flashWindows(this.period(), this.now(), this.startPeriod() === 'previous' ? this.day() : null),
  );

  private readonly tickets = computed(() => {
    const id = this.resource();
    const all = this.store.tickets();
    return id ? all.filter((ticket) => String(ticket.resourceId) === id) : all;
  });

  protected readonly flash = computed(() =>
    serviceFlash(this.tickets(), this.windows().current, this.now()),
  );

  protected readonly before = computed(() => {
    const before = this.windows().before;
    return before ? serviceFlash(this.tickets(), before, this.now()) : null;
  });

  protected readonly options = computed(() =>
    FLASH_PERIODS.map((value) => ({ value, label: this.labelOf(value) })),
  );

  protected readonly topRequesters = computed(() => this.flash().requesters.slice(0, 10));
  protected readonly topAreas = computed(() => this.flash().areas.slice(0, 8));

  protected readonly hourColumns = computed<Column[]>(() =>
    this.flash().hours.map((bar) => ({
      label: `${bar.hour}`,
      title: `dalle ${bar.hour} alle ${bar.hour + 1}`,
      created: bar.created,
      resolved: bar.resolved,
      muted: bar.hour < 8 || bar.hour > 19,
      hour: bar.hour,
    })),
  );

  protected readonly dayColumns = computed<Column[]>(() =>
    this.flash().days.map((bar) => ({
      label: bar.label,
      title: bar.title,
      created: bar.created,
      resolved: bar.resolved,
      muted: bar.weekend,
      start: bar.start,
      end: bar.end,
    })),
  );

  protected readonly balanceText = computed(() => {
    const balance = this.flash().created - this.flash().resolved;
    return balance > 0 ? `+${balance}` : balance < 0 ? `−${-balance}` : '0';
  });

  protected readonly rangeLabel = computed(() => {
    const { start, end, singleDay } = this.windows().current;
    const format = (time: number): string =>
      new Date(time).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
    return singleDay ? format(start) : `dal ${format(start)} a oggi`;
  });

  /** Una frase con il succo, pronta da leggere o da dire a voce. */
  protected readonly headline = computed(() => {
    const f = this.flash();
    const name = this.personName();
    const when = this.labelOf(this.period()).toLowerCase();
    const subject = name ?? 'Il team';
    const parts = [`${subject} ha chiuso ${f.resolved} ticket (${when})`];
    if (!name && f.personCount > 0) {
      parts.push(`con ${f.personCount} ${f.personCount === 1 ? 'persona' : 'persone'} al lavoro`);
    }
    if (f.requesterCount > 0) {
      parts.push(
        `per ${f.requesterCount} ${f.requesterCount === 1 ? 'richiedente' : 'richiedenti'}`,
      );
    }
    let text = `${parts.join(' ')}.`;
    if (!name && f.closedBy.length > 0 && f.resolved > 0) {
      text += ` Ha chiuso di più ${f.closedBy[0].label} (${f.closedBy[0].value}).`;
    }
    if (f.requesters.length > 0) {
      text += ` Il richiedente più servito è ${f.requesters[0].name} (${f.requesters[0].resolved}).`;
    }
    const peak = [...f.hours].sort((a, b) => b.resolved - a.resolved)[0];
    if (peak && peak.resolved > 0) {
      text += ` Si chiude di più tra le ${peak.hour} e le ${peak.hour + 1}.`;
    }
    return text;
  });

  constructor() {
    this.store.load();
  }

  /** Apre l'elenco dei ticket dietro il numero o la barra, nello stesso periodo (e persona) del flash. */
  protected open(
    kind: 'created' | 'resolved' | 'both',
    filters: Record<string, string> = {},
    range?: { from: number; to: number },
  ): void {
    const { start, end } = this.windows().current;
    const id = this.resource();
    void this.router.navigate(['/tickets/dettaglio'], {
      queryParams: {
        scope: 'flash',
        kind,
        from: String(range ? Math.max(range.from, start) : start),
        to: String(range ? Math.min(range.to, end) : end),
        ...(id ? { resource: id, title: this.personName() ?? '' } : {}),
        ...filters,
      },
    });
  }

  /** Una barra dei grafici nel tempo: fascia oraria su tutto il periodo, oppure giorno/settimana. */
  protected openColumn(column: Column, kind: 'created' | 'resolved'): void {
    if (kind === 'created' ? column.created === 0 : column.resolved === 0) {
      return;
    }
    if (column.hour !== undefined) {
      this.open(kind, { hour: String(column.hour) });
    } else if (column.start !== undefined && column.end !== undefined) {
      this.open(kind, {}, { from: column.start, to: column.end });
    }
  }

  /** Una cella della matrice: i ticket chiusi da una persona per un richiedente. */
  protected openCell(person: string, requester: string, count: number): void {
    if (count > 0 && requester !== 'Altri') {
      this.open('resolved', { assignee: person, reporter: requester });
    }
  }

  protected back(): void {
    this.location.back();
  }

  protected percent(value: number, max: number): number {
    return max > 0 ? Math.round((value / max) * 100) : 0;
  }

  /** Altezza di una colonna in % dell'area del grafico, lasciando posto al numero sopra. */
  protected height(value: number, columns: readonly Column[]): number {
    const max = Math.max(1, ...columns.map((column) => Math.max(column.created, column.resolved)));
    return value === 0 ? 0 : Math.max(4, Math.round((value / max) * 82));
  }

  protected titleOf(column: Column): string {
    return `${column.title}: entrati ${column.created}, chiusi ${column.resolved}`;
  }

  protected compare(value: number, previous: number | undefined): string | null {
    if (previous === undefined) {
      return null;
    }
    const diff = value - previous;
    const when = this.period() === 'previous' ? 'il giorno prima' : 'al periodo prima';
    return diff === 0
      ? `come ${when}`
      : `${diff > 0 ? '+' : '−'}${Math.abs(diff)} rispetto ${when}`;
  }

  protected durationText(days: number): string {
    return days < 1 ? `${Math.max(1, Math.round(days * 24))} ore` : `${days} gg`.replace('.', ',');
  }

  private labelOf(period: FlashPeriod): string {
    switch (period) {
      case 'today':
        return 'Oggi';
      case 'previous': {
        const day = this.day()
          ? new Date(`${this.day()}T00:00:00`)
          : previousWorkingDay(new Date());
        const yesterday = startOfDay(new Date());
        yesterday.setDate(yesterday.getDate() - 1);
        return day.getTime() === yesterday.getTime()
          ? 'Ieri'
          : day.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'numeric' });
      }
      default:
        return `Ultimi ${period} giorni`;
    }
  }
}
