import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { API_BASE_URL } from '../../core/config/api.config';
import { errorMessage } from '../../shared/crud/crud-api.service';
import { matchesTerms, searchTerms } from '../../shared/util/text-search';

type Outcome = 'OK' | 'ERROR';

interface McpAction {
  readonly id: number;
  readonly at: string;
  readonly userName: string | null;
  readonly username: string | null;
  readonly tool: string;
  readonly outcome: Outcome;
  readonly parameters: string | null;
  readonly message: string | null;
}

const OUTCOMES: readonly { readonly value: Outcome | ''; readonly label: string }[] = [
  { value: '', label: 'Tutte' },
  { value: 'OK', label: 'Riuscite' },
  { value: 'ERROR', label: 'Non riuscite' },
];

const PERIODS: readonly { readonly days: number; readonly label: string }[] = [
  { days: 7, label: '7 giorni' },
  { days: 30, label: '30 giorni' },
  { days: 90, label: '90 giorni' },
];

/** Nomi leggibili degli strumenti MCP che scrivono (le letture non si registrano). */
const TOOL_LABELS: Readonly<Record<string, string>> = {
  crea_task: 'Task creato',
  aggiorna_task: 'Task modificato',
  cambia_stato_task: 'Stato del task',
  commenta_task: 'Commento al task',
  crea_punto_direzione: 'Punto direzione creato',
  aggiorna_punto_direzione: 'Punto direzione modificato',
  cambia_stato_punto_direzione: 'Stato del punto direzione',
  crea_progetto: 'Progetto creato',
  aggiorna_progetto: 'Progetto modificato',
  disattiva_risorsa: 'Risorsa disattivata',
  riattiva_risorsa: 'Risorsa riattivata',
  aggiungi_capacita_extra: 'Capacità extra',
  imposta_giornate: 'Giornate impostate',
  riempi_periodo: 'Periodo riempito',
  sposta_giornate: 'Giornate spostate',
  segna_ferie: 'Ferie segnate',
  pianifica_progetto: 'Pianificazione su progetto',
  aggiungi_riga_piano: 'Riga del piano aggiunta',
  archivia_riga_piano: 'Riga del piano archiviata',
};

/**
 * Azioni da Claude (D-MCP): le scritture fatte tramite il server MCP, con chi, quale strumento, i parametri
 * e l'esito. Serve a controllare cosa è stato fatto via Claude senza aprire il database.
 */
@Component({
  selector: 'gov-mcp-actions-tab',
  imports: [DatePipe, MatButtonToggleModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <p class="intro">
      Le modifiche fatte tramite Claude (connettore MCP), anche quelle non riuscite. Le letture e le
      anteprime non si registrano.
    </p>
    <div class="bar">
      <mat-button-toggle-group
        aria-label="Esito"
        hideSingleSelectionIndicator
        [value]="outcome()"
        (change)="outcome.set($event.value)"
      >
        @for (option of outcomes; track option.value) {
          <mat-button-toggle [value]="option.value">{{ option.label }}</mat-button-toggle>
        }
      </mat-button-toggle-group>
      <mat-button-toggle-group
        aria-label="Periodo"
        hideSingleSelectionIndicator
        [value]="days()"
        (change)="days.set($event.value)"
      >
        @for (period of periods; track period.days) {
          <mat-button-toggle [value]="period.days">{{ period.label }}</mat-button-toggle>
        }
      </mat-button-toggle-group>
      <select
        class="bar__select"
        aria-label="Utente"
        [value]="user()"
        (change)="user.set($any($event.target).value)"
      >
        <option value="">Tutti gli utenti</option>
        @for (name of userOptions(); track name) {
          <option [value]="name">{{ name }}</option>
        }
      </select>
      <select
        class="bar__select"
        aria-label="Azione"
        [value]="tool()"
        (change)="tool.set($any($event.target).value)"
      >
        <option value="">Tutte le azioni</option>
        @for (option of toolOptions(); track option) {
          <option [value]="option">{{ label(option) }}</option>
        }
      </select>
      <label class="inline-search">
        <mat-icon aria-hidden="true">search</mat-icon>
        <input
          class="inline-search__input"
          type="search"
          placeholder="Cerca nei parametri e negli errori"
          aria-label="Cerca nelle azioni da Claude"
          [value]="search()"
          (input)="search.set($any($event.target).value)"
        />
      </label>
      <span class="bar__count" role="status">{{ visible().length }} azioni</span>
    </div>

    @if (loading()) {
      <p class="state" role="status">
        <mat-progress-spinner diameter="24" mode="indeterminate" aria-hidden="true" /> Caricamento…
      </p>
    } @else if (error(); as message) {
      <p class="state state--error" role="alert">{{ message }}</p>
    } @else if (visible().length === 0) {
      <p class="state">Nessuna azione da Claude nel periodo con questi filtri.</p>
    } @else {
      <div class="scroll">
        <table class="grid">
          <thead>
            <tr>
              <th scope="col">Quando</th>
              <th scope="col">Chi</th>
              <th scope="col">Azione</th>
              <th scope="col">Esito</th>
              <th scope="col">Dettaglio</th>
            </tr>
          </thead>
          <tbody>
            @for (row of visible(); track row.id) {
              <tr>
                <td class="nowrap">{{ row.at | date: 'dd/MM/yy HH:mm:ss' }}</td>
                <td class="nowrap">
                  {{ who(row) }}
                  @if (row.userName && row.username) {
                    <span class="muted">· {{ row.username }}</span>
                  }
                </td>
                <td class="nowrap">
                  {{ label(row.tool) }}
                  <span class="muted code">{{ row.tool }}</span>
                </td>
                <td class="nowrap">
                  @if (row.outcome === 'OK') {
                    <span class="badge badge--ok">
                      <mat-icon aria-hidden="true">check_circle</mat-icon> Riuscita
                    </span>
                  } @else {
                    <span class="badge badge--error">
                      <mat-icon aria-hidden="true">error</mat-icon> Non riuscita
                    </span>
                  }
                </td>
                <td class="detail">
                  @if (row.message) {
                    <span class="error-text">{{ row.message }}</span>
                  }
                  <span class="params">{{ readable(row.parameters) }}</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    .intro {
      margin-block: 1rem 0;
      color: var(--mat-sys-on-surface-variant);
    }

    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      margin-block: 1rem 0.5rem;

      &__select {
        height: 2rem;
        padding: 0 0.5rem;
        border: 1px solid var(--mat-sys-outline);
        border-radius: 0.5rem;
        background: var(--mat-sys-surface);
        color: inherit;
        font: inherit;
      }

      &__count {
        margin-inline-start: auto;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-body-small);
      }
    }

    .scroll {
      overflow-x: auto;
    }

    .grid {
      width: 100%;
      border-collapse: collapse;
      font: var(--mat-sys-body-small);

      th,
      td {
        padding: 0.375rem 0.5rem;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        // Intestazioni e valori centrati insieme; il dettaglio, testo lungo, resta a sinistra in entrambi
        text-align: center;
        vertical-align: top;
      }

      th:last-child,
      td:last-child {
        text-align: start;
      }

      thead th {
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-label-medium);
        white-space: nowrap;
      }
    }

    .nowrap {
      white-space: nowrap;
    }

    .detail {
      overflow-wrap: anywhere;

      // La cella resta una cella di tabella: errore e parametri vanno a capo come blocchi
      .error-text,
      .params {
        display: block;
      }
    }

    .muted {
      color: var(--mat-sys-on-surface-variant);
    }

    .code {
      display: block;
      font-family: monospace;
    }

    .error-text {
      color: var(--mat-sys-error);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0 0.5rem;
      border-radius: 1rem;
      font: var(--mat-sys-label-small);

      mat-icon {
        width: 1rem;
        height: 1rem;
        font-size: 1rem;
      }

      &--ok {
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
      }

      &--error {
        background: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
      }
    }

    .state {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-block: 1rem;
      color: var(--mat-sys-on-surface-variant);

      &--error {
        color: var(--mat-sys-error);
      }
    }
  `,
})
export class McpActionsTab {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  protected readonly outcomes = OUTCOMES;
  protected readonly periods = PERIODS;

  protected readonly outcome = signal<Outcome | ''>('');
  protected readonly days = signal(30);
  protected readonly user = signal('');
  protected readonly tool = signal('');
  protected readonly search = signal('');

  protected readonly rows = signal<readonly McpAction[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly userOptions = computed(() =>
    [...new Set(this.rows().map((row) => this.who(row)))].sort((a, b) => a.localeCompare(b, 'it')),
  );

  protected readonly toolOptions = computed(() =>
    [...new Set(this.rows().map((row) => row.tool))].sort((a, b) =>
      this.label(a).localeCompare(this.label(b), 'it'),
    ),
  );

  protected readonly visible = computed(() => {
    const terms = searchTerms(this.search());
    const outcome = this.outcome();
    const user = this.user();
    const tool = this.tool();
    return this.rows().filter(
      (row) =>
        (outcome === '' || row.outcome === outcome) &&
        (user === '' || this.who(row) === user) &&
        (tool === '' || row.tool === tool) &&
        matchesTerms(terms, [
          this.who(row),
          row.tool,
          this.label(row.tool),
          row.parameters,
          row.message,
        ]),
    );
  });

  constructor() {
    // Il periodo si chiede al server; esito, utente, azione e ricerca filtrano quello che è già arrivato
    effect(() => this.load(this.days()));
  }

  protected label(tool: string): string {
    return TOOL_LABELS[tool] ?? tool;
  }

  protected who(row: McpAction): string {
    return row.userName ?? row.username ?? 'Sconosciuto';
  }

  /** Parametri in forma leggibile ("risorsaId: 2 · giornate: 1"), senza quelli vuoti. */
  protected readable(parameters: string | null): string {
    if (!parameters) {
      return '';
    }
    try {
      const values = JSON.parse(parameters) as Record<string, unknown>;
      return Object.entries(values)
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
        .join(' · ');
    } catch {
      return parameters;
    }
  }

  private load(days: number): void {
    this.loading.set(true);
    this.http
      .get<McpAction[]>(`${this.apiBase}/users/mcp-actions`, { params: { days, limit: 5000 } })
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.error.set(null);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(errorMessage(error));
          this.loading.set(false);
        },
      });
  }
}
