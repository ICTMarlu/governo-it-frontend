import { HttpClient } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { API_BASE_URL } from '../../core/config/api.config';
import { errorMessage } from '../../shared/crud/crud-api.service';
import { matchesTerms, searchTerms } from '../../shared/util/text-search';

type Kind = 'LOGIN' | 'LOGIN_FAILED' | 'CREATE' | 'DELETE';

interface Activity {
  readonly id: number;
  readonly at: string;
  readonly kind: Kind;
  readonly userName: string | null;
  readonly username: string | null;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly description: string | null;
}

const KINDS: readonly { readonly value: Kind | ''; readonly label: string }[] = [
  { value: '', label: 'Tutto' },
  { value: 'LOGIN', label: 'Accessi' },
  { value: 'LOGIN_FAILED', label: 'Accessi falliti' },
  { value: 'CREATE', label: 'Creazioni' },
  { value: 'DELETE', label: 'Eliminazioni' },
];

const KIND_LABELS: Readonly<Record<Kind, { label: string; icon: string }>> = {
  LOGIN: { label: 'Accesso', icon: 'login' },
  LOGIN_FAILED: { label: 'Accesso fallito', icon: 'gpp_bad' },
  CREATE: { label: 'Creato', icon: 'add_circle' },
  DELETE: { label: 'Eliminato', icon: 'delete' },
};

const PERIODS: readonly { readonly days: number; readonly label: string }[] = [
  { days: 1, label: '24 ore' },
  { days: 7, label: '7 giorni' },
  { days: 30, label: '30 giorni' },
];

/**
 * Registro delle attività: accessi (anche falliti) e creazione / eliminazione dei record in tutta
 * l'applicazione, con chi li ha fatti. Di norma gli ultimi 7 giorni; si conservano 30.
 */
@Component({
  selector: 'gov-activity-tab',
  imports: [DatePipe, MatButtonToggleModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="bar">
      <mat-button-toggle-group
        aria-label="Tipo di evento"
        hideSingleSelectionIndicator
        [value]="kind()"
        (change)="kind.set($event.value)"
      >
        @for (option of kinds; track option.value) {
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
      <label class="inline-search">
        <mat-icon aria-hidden="true">search</mat-icon>
        <input
          class="inline-search__input"
          type="search"
          placeholder="Cerca (progetto, task, utente…)"
          aria-label="Cerca nel registro"
          [value]="search()"
          (input)="search.set($any($event.target).value)"
        />
      </label>
      <span class="bar__count" role="status">{{ visible().length }} eventi</span>
    </div>

    @if (loading()) {
      <p class="state" role="status">
        <mat-progress-spinner diameter="24" mode="indeterminate" aria-hidden="true" /> Caricamento…
      </p>
    } @else if (error(); as message) {
      <p class="state state--error" role="alert">{{ message }}</p>
    } @else if (visible().length === 0) {
      <p class="state">Nessun evento nel periodo con questi filtri.</p>
    } @else {
      <div class="scroll">
        <table class="grid">
          <thead>
            <tr>
              <th scope="col">Quando</th>
              <th scope="col">Chi</th>
              <th scope="col">Cosa è successo</th>
              <th scope="col">Dove</th>
              <th scope="col">Dettaglio</th>
            </tr>
          </thead>
          <tbody>
            @for (row of visible(); track row.id) {
              <tr [class]="'row row--' + row.kind.toLowerCase()">
                <td class="nowrap">{{ row.at | date: 'dd/MM/yy HH:mm:ss' }}</td>
                <td class="nowrap">
                  {{ row.userName ?? row.username ?? 'Sistema' }}
                  @if (row.userName && row.username) {
                    <span class="muted">· {{ row.username }}</span>
                  }
                </td>
                <td class="nowrap">
                  <span class="badge badge--{{ row.kind.toLowerCase() }}">
                    <mat-icon aria-hidden="true">{{ meta(row.kind).icon }}</mat-icon>
                    {{ meta(row.kind).label }}
                  </span>
                </td>
                <td class="nowrap">{{ row.entityType ?? '' }}</td>
                <td class="detail">
                  {{ row.description ?? '' }}
                  @if (row.entityId) {
                    <span class="muted"> #{{ row.entityId }}</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
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
        text-align: start;
        vertical-align: top;
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
    }

    .muted {
      color: var(--mat-sys-on-surface-variant);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0 0.5rem;
      border-radius: 1rem;
      background: var(--mat-sys-surface-container-high);
      font: var(--mat-sys-label-small);

      mat-icon {
        width: 1rem;
        height: 1rem;
        font-size: 1rem;
      }

      &--create {
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
      }

      &--delete,
      &--login_failed {
        background: var(--mat-sys-error-container);
        color: var(--mat-sys-on-error-container);
      }

      &--login {
        background: var(--mat-sys-primary-container);
        color: var(--mat-sys-on-primary-container);
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
export class ActivityTab {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_BASE_URL);

  protected readonly kinds = KINDS;
  protected readonly periods = PERIODS;

  protected readonly kind = signal<Kind | ''>('');
  protected readonly days = signal(7);
  protected readonly user = signal('');
  protected readonly search = signal('');

  protected readonly rows = signal<readonly Activity[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly userOptions = computed(() =>
    [...new Set(this.rows().map((row) => this.who(row)))].sort((a, b) => a.localeCompare(b, 'it')),
  );

  protected readonly visible = computed(() => {
    const terms = searchTerms(this.search());
    const user = this.user();
    const kind = this.kind();
    return this.rows().filter(
      (row) =>
        (kind === '' || row.kind === kind) &&
        (user === '' || this.who(row) === user) &&
        matchesTerms(terms, [
          this.who(row),
          row.username,
          row.entityType,
          row.description,
          row.entityId,
          KIND_LABELS[row.kind].label,
        ]),
    );
  });

  constructor() {
    // Il periodo si chiede al server; tipo, utente e ricerca filtrano quello che è già arrivato
    effect(() => this.load(this.days()));
  }

  protected meta(kind: Kind): { label: string; icon: string } {
    return KIND_LABELS[kind];
  }

  private who(row: Activity): string {
    return row.userName ?? row.username ?? 'Sistema';
  }

  private load(days: number): void {
    this.loading.set(true);
    this.http
      .get<Activity[]>(`${this.apiBase}/users/activity`, { params: { days, limit: 5000 } })
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
