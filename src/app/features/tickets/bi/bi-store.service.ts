import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { API_BASE_URL } from '../../../core/config/api.config';
import { errorMessage } from '../../../shared/crud/crud-api.service';
import { TicketSyncService } from '../services/ticket-sync.service';
import { Bounce, filterBounces } from './bi-bounces';
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
  readonly years = signal<readonly number[] | null>([new Date().getFullYear()]);
  readonly months = signal<readonly number[] | null>(null);
  /** Trend: i Pending contano tra i lavorabili. */
  readonly includePending = signal(true);
  /** Persone: i ticket in attesa di risposta del cliente contano come chiusi. */
  readonly waitingAsClosed = signal(false);

  readonly filters = computed<BiFilters>(() => ({
    areas: this.areas(),
    assignees: this.assignees(),
    years: this.years(),
    months: this.months(),
  }));

  readonly tickets = computed<readonly BiTicket[]>(() => this.data()?.tickets ?? []);

  /** Chiusure, riaperture e attese dalla cronologia (pagina Rimbalzi); null finché non arrivano. */
  readonly bounces = signal<readonly Bounce[] | null>(null);
  readonly bouncesError = signal<string | null>(null);
  private bouncesLoading = false;

  /** Passaggi di area e persona scelte (chi aveva il ticket) e dell'anno e mesi scelti (data del passaggio). */
  readonly filteredBounces = computed(() => filterBounces(this.bounces() ?? [], this.filters()));

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
    years: this.years(),
    months: this.months(),
    includePending: this.includePending(),
    waitingAsClosed: this.waitingAsClosed(),
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
      untracked(() => {
        if (this.data()) {
          this.load(true);
        }
        if (this.bounces()) {
          this.loadBounces(true);
        }
      });
    });
  }

  /** Carica i rimbalzi se non ci sono già (o se richiesto). */
  loadBounces(force = false): void {
    if ((this.bounces() && !force) || this.bouncesLoading) {
      return;
    }
    this.bouncesLoading = true;
    this.http.get<Bounce[]>(`${this.url}/rimbalzi`).subscribe({
      next: (bounces) => {
        this.bounces.set(bounces);
        this.bouncesError.set(null);
        this.bouncesLoading = false;
      },
      error: (error: unknown) => {
        this.bouncesError.set(errorMessage(error));
        this.bouncesLoading = false;
      },
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
      years: readonly number[] | null;
      year: number | null;
      months: readonly number[] | null;
      includePending: boolean;
      waitingAsClosed: boolean;
    }>;
    this.areas.set(view.areas ?? null);
    this.assignees.set(view.assignees ?? null);
    // Le viste salvate prima della scelta multipla hanno un solo anno
    const years =
      view.years !== undefined
        ? view.years
        : view.year === undefined
          ? [new Date().getFullYear()]
          : view.year === null
            ? null
            : [view.year];
    this.years.set(years);
    this.months.set(view.months ?? null);
    this.includePending.set(view.includePending ?? true);
    this.waitingAsClosed.set(view.waitingAsClosed ?? false);
  }

  clear(): void {
    this.applyView(null);
  }
}

function distinct(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'it'));
}
