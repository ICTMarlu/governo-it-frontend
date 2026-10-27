import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';

import { API_BASE_URL } from '../../core/config/api.config';
import { HBarChart } from '../../shared/charts/hbar-chart';
import {
  DIMENSIONS,
  DimensionKey,
  Filters,
  Measure,
  SimCount,
  applyFilters,
  costParts,
  distinct,
  pivot,
  total,
} from './telephony-dashboard.model';

interface Preset {
  readonly label: string;
  readonly rows: DimensionKey;
  readonly columns: DimensionKey | null;
  readonly filters: Filters;
}

/** Viste pronte: impostano righe, colonne e filtri; poi si può cambiare tutto a mano. */
const PRESETS: readonly Preset[] = [
  { label: 'Società e paese', rows: 'company', columns: 'country', filters: {} },
  { label: 'Profili per paese', rows: 'plan', columns: 'country', filters: {} },
  {
    label: 'Italia: uso e profilo',
    rows: 'plan',
    columns: 'lineUse',
    filters: { country: 'Italia' },
  },
  {
    label: 'Italia: tipo e uso',
    rows: 'assigneeType',
    columns: 'lineUse',
    filters: { country: 'Italia' },
  },
  {
    label: 'Italia: migrazione a TIM',
    rows: 'company',
    columns: 'migrationStatus',
    filters: { country: 'Italia' },
  },
];

const ALL = '';

/**
 * Dashboard BI delle SIM attive: numeri di sintesi, grafico e tabella pivot con righe e colonne
 * scelte tra le dimensioni (paese, società, profilo, uso, tipo, migrazione, operatore).
 */
@Component({
  selector: 'gov-telephony-dashboard',
  imports: [
    HBarChart,
    MatButtonModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  template: `
    <section class="dash" aria-label="Dashboard SIM">
      <h2 class="dash__title">SIM attive</h2>

      @if (error(); as message) {
        <p class="bi-state" role="alert">{{ message }}</p>
      } @else if (!data()) {
        <p class="bi-state" role="status">
          <mat-progress-spinner diameter="24" mode="indeterminate" aria-hidden="true" />
          Caricamento delle SIM…
        </p>
      } @else if (data()!.length === 0) {
        <p class="bi-state" role="status">Nessuna linea attiva da analizzare.</p>
      } @else {
        <ul class="bi-kpis" aria-label="Numeri di sintesi, secondo i filtri scelti">
          <li class="bi-kpi bi-kpi--info">
            <span class="bi-kpi__value">{{ format(totalLines(), 'lines') }}</span>
            <span class="bi-kpi__label">SIM attive</span>
          </li>
          <li class="bi-kpi bi-kpi--good">
            <span class="bi-kpi__value">{{ euros(totalCost()) }}</span>
            <span class="bi-kpi__label">spesa al mese</span>
            <span class="bi-kpi__meta">di cui opzioni {{ euros(parts().options) }}</span>
          </li>
          <li class="bi-kpi bi-kpi--good">
            <span class="bi-kpi__value">{{ euros(totalCost() * 12) }}</span>
            <span class="bi-kpi__label">spesa all’anno</span>
          </li>
          <li class="bi-kpi">
            <span class="bi-kpi__value">{{ euros(averageCost()) }}</span>
            <span class="bi-kpi__label">per SIM al mese</span>
          </li>
          <li class="bi-kpi">
            <span class="bi-kpi__value">{{ companiesInScope() }}</span>
            <span class="bi-kpi__label">società</span>
          </li>
          <li class="bi-kpi">
            <span class="bi-kpi__value">{{ countriesInScope() }}</span>
            <span class="bi-kpi__label">paesi</span>
          </li>
        </ul>

        <div class="presets" role="group" aria-label="Viste pronte">
          @for (preset of presets; track preset.label) {
            <button type="button" mat-stroked-button (click)="apply(preset)">
              {{ preset.label }}
            </button>
          }
        </div>

        <div class="controls">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Righe</mat-label>
            <mat-select [value]="rowKey()" (valueChange)="rowKey.set($event)">
              @for (dimension of dimensions; track dimension.key) {
                <mat-option [value]="dimension.key">{{ dimension.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Colonne</mat-label>
            <mat-select [value]="columnKey()" (valueChange)="columnKey.set($event)">
              <mat-option [value]="null">Nessuna</mat-option>
              @for (dimension of dimensions; track dimension.key) {
                <mat-option [value]="dimension.key">{{ dimension.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Misura</mat-label>
            <mat-select [value]="measure()" (valueChange)="measure.set($event)">
              <mat-option value="lines">Numero di SIM</mat-option>
              <mat-option value="cost">Spesa mensile (profili e opzioni)</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Paese</mat-label>
            <mat-select
              [value]="filters().country ?? ''"
              (valueChange)="setFilter('country', $event)"
            >
              <mat-option value="">Tutti</mat-option>
              @for (value of countries(); track value) {
                <mat-option [value]="value">{{ value }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Società</mat-label>
            <mat-select
              [value]="filters().company ?? ''"
              (valueChange)="setFilter('company', $event)"
            >
              <mat-option value="">Tutte</mat-option>
              @for (value of companies(); track value) {
                <mat-option [value]="value">{{ value }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        @if (table().rows.length === 0) {
          <p class="bi-state" role="status">Nessuna SIM con i filtri scelti.</p>
        } @else {
          <div class="bi-grid bi-grid--2">
            <section class="bi-card">
              <gov-hbar-chart [title]="chartTitle()" [items]="bars()" maxHeight="20rem" />
            </section>
            <section class="bi-card table-card">
              <table class="pivot">
                <caption class="pivot__caption">
                  {{
                    chartTitle()
                  }}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{{ rowLabel() }}</th>
                    @for (column of table().columns; track column) {
                      <th scope="col" class="num">{{ column }}</th>
                    }
                    <th scope="col" class="num">Totale</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of table().rows; track row.label) {
                    <tr>
                      <th scope="row">{{ row.label }}</th>
                      @for (cell of row.cells; track $index) {
                        <td class="num" [class.num--zero]="cell === 0">{{ format(cell) }}</td>
                      }
                      <td class="num num--total">{{ format(row.total) }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Totale</th>
                    @for (sum of table().columnTotals; track $index) {
                      <td class="num">{{ format(sum) }}</td>
                    }
                    <td class="num num--total">{{ format(table().grandTotal) }}</td>
                  </tr>
                </tfoot>
              </table>
            </section>
          </div>
        }
      }
    </section>
  `,
  styles: `
    .dash {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-block-start: 1.5rem;

      &__title {
        margin: 0;
        font: var(--mat-sys-title-large);
      }
    }

    .presets {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .controls {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
      gap: 0.75rem;
    }

    .table-card {
      overflow-x: auto;
    }

    .pivot {
      width: 100%;
      border-collapse: collapse;
      font: var(--mat-sys-body-medium);

      &__caption {
        margin-bottom: 0.5rem;
        font: var(--mat-sys-title-small);
        text-align: start;
      }

      th,
      td {
        padding: 0.25rem 0.75rem;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        white-space: nowrap;
      }

      thead th {
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-label-large);
        text-align: start;
      }

      tbody th,
      tfoot th {
        font-weight: 400;
        text-align: start;
      }

      tfoot th,
      tfoot td {
        border-bottom: 0;
        border-top: 2px solid var(--mat-sys-outline);
        font-weight: 700;
      }

      .num {
        text-align: center;
        font-variant-numeric: tabular-nums;

        &--zero {
          color: var(--mat-sys-outline);
        }

        &--total {
          font-weight: 700;
        }
      }
    }
  `,
})
export class TelephonyDashboard {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/mobile-lines`;

  protected readonly dimensions = DIMENSIONS;
  protected readonly presets = PRESETS;

  protected readonly data = signal<readonly SimCount[] | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly rowKey = signal<DimensionKey>('company');
  protected readonly columnKey = signal<DimensionKey | null>('country');
  protected readonly measure = signal<Measure>('lines');
  protected readonly filters = signal<Filters>({});

  protected readonly countries = computed(() => distinct(this.data() ?? [], 'country'));
  protected readonly companies = computed(() => distinct(this.data() ?? [], 'company'));

  private readonly scoped = computed(() => applyFilters(this.data() ?? [], this.filters()));
  // I numeri di sintesi seguono i filtri scelti, così si vede la spesa di ogni paese o società
  protected readonly totalLines = computed(() => total(this.scoped(), 'lines'));
  protected readonly totalCost = computed(() => total(this.scoped(), 'cost'));
  protected readonly parts = computed(() => costParts(this.scoped()));
  protected readonly averageCost = computed(() =>
    this.totalLines() === 0 ? 0 : this.totalCost() / this.totalLines(),
  );
  protected readonly companiesInScope = computed(() => distinct(this.scoped(), 'company').length);
  protected readonly countriesInScope = computed(() => distinct(this.scoped(), 'country').length);

  protected readonly table = computed(() =>
    pivot(this.scoped(), this.rowKey(), this.columnKey(), this.measure()),
  );
  protected readonly bars = computed(() =>
    this.table().rows.map((row) => ({ label: row.label, value: row.total })),
  );

  protected readonly rowLabel = computed(() => labelOf(this.rowKey()));
  protected readonly chartTitle = computed(() => {
    const what = this.measure() === 'lines' ? 'SIM' : 'Spesa mensile';
    const column = this.columnKey();
    return `${what} per ${this.rowLabel().toLowerCase()}${column ? ' e ' + labelOf(column).toLowerCase() : ''}`;
  });

  constructor() {
    this.http.get<SimCount[]>(`${this.base}/summary`).subscribe({
      next: (rows) => this.data.set(rows),
      error: (failure: HttpErrorResponse) =>
        this.error.set(
          failure.status === 403
            ? 'Non hai il permesso di vedere i dati della telefonia.'
            : 'Non riesco a caricare le SIM: il server non ha risposto. Riprova tra poco.',
        ),
    });
  }

  protected apply(preset: Preset): void {
    this.rowKey.set(preset.rows);
    this.columnKey.set(preset.columns);
    this.filters.set(preset.filters);
  }

  protected setFilter(key: DimensionKey, value: string): void {
    this.filters.update((current) => ({ ...current, [key]: value === ALL ? undefined : value }));
  }

  /** Euro senza decimali: i centesimi non servono né nei numeri di sintesi né in tabella. */
  protected euros(value: number): string {
    return value.toLocaleString('it-IT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    });
  }

  /** Numero intero per le SIM, euro per il canone (misura attiva se non indicata). */
  protected format(value: number, measure: Measure = this.measure()): string {
    return measure === 'cost' ? this.euros(value) : value.toLocaleString('it-IT');
  }
}

function labelOf(key: DimensionKey): string {
  return DIMENSIONS.find((dimension) => dimension.key === key)?.label.split(' (')[0] ?? key;
}
