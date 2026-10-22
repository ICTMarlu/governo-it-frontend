import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { API_BASE_URL } from '../../../core/config/api.config';
import { errorMessage } from '../../../shared/crud/crud-api.service';
import { TicketSyncService } from '../services/ticket-sync.service';
import {
  BiData,
  BiFilters,
  BiTicket,
  areaOf,
  assigneeOf,
  inPeriod,
  inScope,
  yearsOf,
} from './bi.model';

/**
 * Dati e filtri delle pagine BI dei ticket (D-27). I ticket si caricano una volta; i filtri in
 * alto (area, assegnatario, anno, mesi) valgono per tutte le pagine e restano passando dall'una
 * all'altra, come in Power BI.
 */
@Injectable({ providedIn: 'root' })
export class BiStore {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/tickets/bi`;
  private readonly sync = inject(TicketSyncService);

  readonly data = signal<BiData | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  readonly areas = signal<readonly string[] | null>(null);
  readonly assignees = signal<readonly string[] | null>(null);
  readonly year = signal<number | null>(new Date().getFullYear());
  readonly months = signal<readonly number[] | null>(null);
  /** Trend: i Pending contano tra i lavorabili. */
  readonly includePending = signal(true);

  readonly filters = computed<BiFilters>(() => ({
    areas: this.areas(),
    assignees: this.assignees(),
    year: this.year(),
    months: this.months(),
  }));

  readonly tickets = computed<readonly BiTicket[]>(() => this.data()?.tickets ?? []);

  /** Ticket di area e assegnatario scelti, di qualunque periodo (per trend e aperti di oggi). */
  readonly scoped = computed(() => {
    const filters = this.filters();
    return this.tickets().filter((ticket) => inScope(ticket, filters));
  });

  /** Ticket creati nel periodo scelto (anno e mesi), con area e assegnatario. */
  readonly createdInPeriod = computed(() => {
    const filters = this.filters();
    return this.scoped().filter((ticket) => inPeriod(ticket.created, filters));
  });

  readonly areaOptions = computed(() => distinct(this.tickets().map(areaOf)));
  readonly assigneeOptions = computed(() => distinct(this.tickets().map(assigneeOf)));
  readonly yearOptions = computed(() => yearsOf(this.tickets()));

  /** Stato dei filtri per le viste salvate. */
  readonly viewState = computed(() => ({
    areas: this.areas(),
    assignees: this.assignees(),
    year: this.year(),
    months: this.months(),
    includePending: this.includePending(),
  }));

  constructor() {
    // Dopo un aggiornamento da Jira (da qualunque pagina, o automatico) i dati si ricaricano
    let first = true;
    effect(() => {
      this.sync.version();
      if (first) {
        first = false;
        return;
      }
      untracked(() => this.data() && this.load(true));
    });
  }

  /** Carica i ticket se non ci sono già (o se richiesto). */
  load(force = false): void {
    if ((this.data() && !force) || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.http.get<BiData>(this.url).subscribe({
      next: (data) => {
        this.data.set(data);
        this.sync.known(data.sync);
        this.error.set(null);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  /** Clic su una barra (area o assegnatario): filtra su quel valore; un altro clic lo toglie. */
  toggle(target: 'areas' | 'assignees', value: string): void {
    const filter = this[target];
    const current = filter();
    filter.set(current?.length === 1 && current[0] === value ? null : [value]);
  }

  applyView(state: unknown): void {
    const view = (state ?? {}) as Partial<{
      areas: readonly string[] | null;
      assignees: readonly string[] | null;
      year: number | null;
      months: readonly number[] | null;
      includePending: boolean;
    }>;
    this.areas.set(view.areas ?? null);
    this.assignees.set(view.assignees ?? null);
    this.year.set(view.year === undefined ? new Date().getFullYear() : view.year);
    this.months.set(view.months ?? null);
    this.includePending.set(view.includePending ?? true);
  }

  clear(): void {
    this.applyView(null);
  }
}

function distinct(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'it'));
}
