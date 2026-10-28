import { DatePipe, Location } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { matchesTerms, searchTerms } from '../../../shared/util/text-search';
import {
  BACKLOG_WEEKS,
  BiTicket,
  DRILL_LABELS,
  PERSON_TREND_DAYS,
  personTrendPeriod,
  DrillDimension,
  ageDays,
  areaOf,
  assigneeOf,
  isAuthorized,
  isAwaitingApproval,
  isOpen,
  resolvedThisYear,
  waitingAsClosed,
  matchesDimension,
} from './bi.model';
import { CONFIRM_IDLE_DAYS, isConfirmStatus } from '../models/ticket.model';
import { BiStore } from './bi-store.service';

/** Quali ticket parte dalla pagina di origine: aperti, pending, creati nel periodo, chiusi di recente… */
type Scope =
  | 'open'
  | 'all-open'
  | 'all-todo'
  | 'all-progress'
  | 'all-waiting'
  | 'workable'
  | 'pending'
  | 'created'
  | 'created-open'
  | 'created-workable'
  | 'created-pending'
  | 'created-resolved'
  | 'resolved3w'
  | 'created4w'
  | 'resolved4w'
  | 'unassigned'
  | 'confirm-idle'
  | 'overdue'
  | 'stale'
  | 'resolved-year'
  | 'prio-high'
  | 'prio-highest'
  | 'prio-high-only'
  | 'impact-high'
  | 'impact-extensive'
  | 'impact-significant'
  | 'awaiting-approval'
  | 'authorized';
type SortKey = 'key' | 'priority' | 'due' | 'created' | 'age' | 'updated';

const SCOPE_LABELS: Readonly<Record<Scope, string>> = {
  open: 'ticket aperti',
  'all-open': 'ticket aperti (compresi quelli in Pending)',
  'all-todo': 'ticket aperti ancora da fare',
  'all-progress': 'ticket aperti in corso (esclusi quelli in attesa del cliente)',
  'all-waiting': 'ticket aperti in attesa del cliente (senza Pending)',
  workable: 'ticket lavorabili (aperti, senza Pending)',
  pending: 'ticket in Pending',
  created: 'ticket creati nel periodo',
  'created-open': 'ticket creati nel periodo, ancora aperti',
  'created-workable': 'ticket creati nel periodo, aperti e lavorabili',
  'created-pending': 'ticket creati nel periodo, in Pending',
  'created-resolved': 'ticket creati nel periodo, risolti',
  resolved3w: `ticket risolti nelle ultime ${BACKLOG_WEEKS} settimane complete`,

  // Entrati e chiusi: l'etichetta dipende dal periodo scelto (vedi scopeLabel)
  created4w: '',
  resolved4w: '',
  unassigned: 'ticket aperti senza assegnatario',
  overdue: 'ticket aperti con la scadenza passata',
  stale:
    'ticket aperti fermi: nessun aggiornamento oltre la soglia (esclusi quelli in attesa del cliente)',
  'resolved-year': 'ticket risolti nell’anno solare in corso',
  'confirm-idle': `ticket in attesa del cliente o in UAT da oltre ${CONFIRM_IDLE_DAYS} giorni`,
  'prio-high': 'ticket aperti con priorità Highest o High',
  'prio-highest': 'ticket aperti con priorità Highest',
  'prio-high-only': 'ticket aperti con priorità High',
  'impact-high': 'ticket aperti con impatto Extensive o Significant',
  'impact-extensive': 'ticket aperti con impatto Extensive / Widespread',
  'impact-significant': 'ticket aperti con impatto Significant / Large',
  'awaiting-approval': 'ticket in attesa di approvazione (Awaiting approval)',
  authorized: 'ticket autorizzati (Authorize)',
};
const PRIORITY_RANK = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

/**
 * Dettaglio dei ticket dietro una barra dei grafici (Aperti, Pending, Panoramica): chiave con
 * link a Jira, titolo, richiedente, assegnatario, priorità, scadenza, Progetto Marlù, stato,
 * date. Si arriva dal clic sulla barra; valgono i filtri in alto della pagina di partenza.
 */
@Component({
  selector: 'gov-bi-detail-page',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="bi-page">
      <div class="head">
        <button mat-button type="button" (click)="back()">
          <mat-icon aria-hidden="true">arrow_back</mat-icon>
          Indietro
        </button>
        <h1 class="head__title">
          @if (title()) {
            <strong>{{ title() }}</strong>
          } @else if (dim()) {
            {{ dimLabel() }}: <strong>{{ value() }}</strong>
          }
          <span class="muted">{{ title() || dim() ? '· ' : '' }}{{ scopeLabel() }}</span>
          @if (aging()) {
            <span class="muted">· anzianità {{ aging() }}</span>
          }
        </h1>
      </div>
      @if (store.error(); as error) {
        <p class="bi-state" role="alert">{{ error }}</p>
      } @else if (!store.data()) {
        <p class="bi-state" role="status">
          <mat-progress-spinner diameter="24" mode="indeterminate" aria-hidden="true" /> Caricamento
          dei ticket…
        </p>
      } @else {
        <div class="tools">
          <label class="inline-search">
            <mat-icon aria-hidden="true">search</mat-icon>
            <input
              class="inline-search__input"
              type="search"
              placeholder="Cerca chiave, titolo, persona…"
              aria-label="Cerca nei ticket"
              [value]="search()"
              (input)="search.set($any($event.target).value)"
            />
          </label>
          <span class="count" role="status">{{ rows().length }} ticket</span>
        </div>
        @if (rows().length === 0) {
          <p class="bi-state">Nessun ticket.</p>
        } @else {
          <div class="wrap">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">
                    <button type="button" class="sort" (click)="sortBy('key')">Ticket</button>
                  </th>
                  <th scope="col">Descrizione</th>
                  <th scope="col">Richiedente</th>
                  <th scope="col">Assegnatario</th>
                  <th scope="col">Stato</th>
                  <th scope="col">
                    <button type="button" class="sort" (click)="sortBy('priority')">
                      Priorità
                    </button>
                  </th>
                  <th scope="col">
                    <button type="button" class="sort" (click)="sortBy('due')">Scadenza</button>
                  </th>
                  <th scope="col">Impatto</th>
                  <th scope="col">Progetto Marlù</th>
                  <th scope="col">Tipo richiesta</th>
                  <th scope="col">
                    <button type="button" class="sort" (click)="sortBy('created')">Creato</button>
                  </th>
                  <th scope="col">Risolto</th>
                  <th scope="col">
                    <button type="button" class="sort" (click)="sortBy('age')">Età</button>
                  </th>
                  <th scope="col">
                    <button type="button" class="sort" (click)="sortBy('updated')">
                      Ultimo agg.
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (ticket of rows(); track ticket.key) {
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
                    <td>{{ ticket.reporter ?? '' }}</td>
                    <td>{{ ticket.assignee ?? '—' }}</td>
                    <td>{{ ticket.status }}</td>
                    <td>{{ ticket.priority ?? '' }}</td>
                    <td [class.late]="overdue(ticket)">
                      {{ ticket.due ? (ticket.due | date: 'dd/MM/yy') : '' }}
                    </td>
                    <td>{{ ticket.impact ?? '' }}</td>
                    <td>{{ ticket.area ?? '' }}</td>
                    <td>{{ ticket.requestType ?? '' }}</td>
                    <td>{{ ticket.created | date: 'dd/MM/yy' }}</td>
                    <td>{{ ticket.resolved ? (ticket.resolved | date: 'dd/MM/yy') : '' }}</td>
                    <td class="num">{{ age(ticket) }} gg</td>
                    <td>{{ ticket.updated | date: 'dd/MM/yy' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
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

      &__title {
        margin: 0;
        font: var(--mat-sys-title-medium);
      }
    }

    .muted,
    .count {
      color: var(--mat-sys-on-surface-variant);
      font-weight: 400;
    }

    .tools {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }

    .wrap {
      overflow-x: auto;
    }

    .table {
      width: 100%;
      border-collapse: collapse;
      font: var(--mat-sys-body-small);

      th,
      td {
        padding: 0.375rem 0.5rem;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        text-align: start;
        white-space: nowrap;
      }

      thead th {
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-label-medium);
      }

      .summary {
        max-width: 26rem;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .num {
        text-align: end;
      }

      .late {
        color: var(--mat-sys-error);
        font-weight: 600;
      }
    }

    .sort {
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
      text-decoration: underline dotted;
    }
  `,
})
export class BiDetailPage {
  protected readonly store = inject(BiStore);
  private readonly location = inject(Location);

  /** Dai parametri dell'indirizzo: da quale pagina (quali ticket), grafico e barra scelta. */
  readonly scope = input<Scope>('open');
  /** Senza grafico di provenienza (es. clic su un numero) non c'è filtro per barra. */
  readonly dim = input<DrillDimension | ''>('');
  readonly value = input('');
  /** Id della risorsa: solo i suoi ticket (più affidabile del nome, che in Jira può essere scritto diversamente). */
  readonly resource = input('');
  /** Titolo libero (es. il nome della persona o del numero cliccato). */
  readonly title = input('');
  /** Fascia di anzianità scelta nella pagina di partenza (es. "8–30 giorni"): restringe l'elenco. */
  readonly aging = input('');
  /** Soglia in giorni dei ticket fermi (la stessa della pagina operativa). */
  readonly days = input('9');
  /** Periodo in giorni scelto nella pagina Persone (entrati e chiusi). */
  readonly period = input('30');
  /** "1" dalla pagina Persone: i ticket in attesa del cliente contano come chiusi. */
  readonly waiting = input('');

  protected readonly search = signal('');
  protected readonly sort = signal<{ key: SortKey; desc: boolean }>({ key: 'age', desc: true });

  protected readonly dimLabel = computed(() => {
    const dim = this.dim();
    return dim ? DRILL_LABELS[dim] : '';
  });
  protected readonly scopeLabel = computed(() => {
    const scope = this.scope();
    if (scope === 'created4w') {
      return `ticket entrati negli ultimi ${this.periodDays()} giorni`;
    }
    if (scope === 'resolved4w') {
      return `ticket chiusi negli ultimi ${this.periodDays()} giorni`;
    }
    return SCOPE_LABELS[scope] ?? '';
  });
  /** Giorni del periodo scelto nella pagina Persone (entrati e chiusi). */
  protected readonly periodDays = computed(() => {
    const days = Number(this.period());
    return days > 0 ? days : PERSON_TREND_DAYS;
  });

  protected readonly jiraUrl = computed(() => {
    const base = this.store.data()?.sync.jiraBaseUrl;
    return base ? `${base.endsWith('/') ? base : base + '/'}browse/` : null;
  });

  protected readonly rows = computed(() => {
    const now = new Date();
    const terms = searchTerms(this.search());
    const { key, desc } = this.sort();
    const dim = this.dim();
    return this.base(now)
      .filter((t) => !dim || matchesDimension(t, dim, this.value(), now))
      .filter((t) => !this.resource() || String(t.resourceId) === this.resource())
      .filter((t) => !this.aging() || matchesDimension(t, 'aging', this.aging(), now))
      .filter((t) =>
        matchesTerms(terms, [
          t.key,
          t.summary,
          t.status,
          areaOf(t),
          assigneeOf(t),
          t.reporter,
          t.requestType,
        ]),
      )
      .sort((a, b) => {
        const result = compare(a, b, key, now);
        return desc ? -result : result;
      });
  });

  constructor() {
    this.store.load();
  }

  private openWhere(test: (ticket: BiTicket) => boolean): readonly BiTicket[] {
    return this.store.tickets().filter((t) => isOpen(t) && !t.pending && test(t));
  }

  /** Ticket di partenza, secondo la pagina e il numero o la barra da cui si arriva. */
  private base(now: Date): readonly BiTicket[] {
    const scoped =
      this.waiting() === '1' ? waitingAsClosed(this.store.scoped()) : this.store.scoped();
    const created = this.store.createdInPeriod();
    switch (this.scope()) {
      case 'open':
        return scoped.filter(isOpen);
      // Numeri del carico per persona: tutti gli aperti, senza i filtri della BI
      case 'all-open':
        return this.store.tickets().filter(isOpen);
      case 'all-todo':
        return this.store.tickets().filter((t) => isOpen(t) && t.category === 'NEW');
      case 'all-progress':
        return this.store
          .tickets()
          .filter((t) => isOpen(t) && t.category === 'INDETERMINATE' && !t.waitingCustomer);
      case 'all-waiting':
        return this.openWhere((t) => t.waitingCustomer);
      case 'workable':
        return scoped.filter((t) => isOpen(t) && !t.pending);
      case 'pending':
        return scoped.filter((t) => isOpen(t) && t.pending);
      case 'created':
        return created;
      case 'created-open':
        return created.filter(isOpen);
      case 'created-workable':
        return created.filter((t) => isOpen(t) && !t.pending);
      case 'created-pending':
        return created.filter((t) => isOpen(t) && t.pending);
      case 'created-resolved':
        return created.filter((t) => !isOpen(t));
      case 'resolved3w':
        return scoped.filter((t) => inWeeks(t.resolved, now, BACKLOG_WEEKS));
      case 'created4w':
        return scoped.filter((t) => sinceStart(t.created, now, this.periodDays()));
      case 'resolved4w':
        return scoped.filter((t) => sinceStart(t.resolved, now, this.periodDays()));
      // Numeri della pagina operativa: tutti gli aperti, senza i filtri della BI
      case 'prio-high':
        return this.openWhere((t) => ['highest', 'high'].includes(priorityOf(t)));
      case 'prio-highest':
        return this.openWhere((t) => priorityOf(t) === 'highest');
      case 'prio-high-only':
        return this.openWhere((t) => priorityOf(t) === 'high');
      case 'impact-high':
        return this.openWhere((t) => impactHas(t, 'extensive') || impactHas(t, 'significant'));
      case 'impact-extensive':
        return this.openWhere((t) => impactHas(t, 'extensive'));
      case 'impact-significant':
        return this.openWhere((t) => impactHas(t, 'significant'));
      case 'awaiting-approval':
        return this.openWhere(isAwaitingApproval);
      case 'authorized':
        return this.openWhere(isAuthorized);
      case 'confirm-idle':
        // Come il numero della pagina operativa: giorni nello stato dal cambio di stato
        return this.openWhere(
          (t) =>
            isConfirmStatus(t.status) &&
            (now.getTime() - new Date(t.statusChanged ?? t.updated).getTime()) / 86_400_000 >
              CONFIRM_IDLE_DAYS,
        );
      case 'overdue':
        return this.openWhere((t) => t.due !== null && new Date(t.due) < startOfToday());
      case 'stale':
        return this.openWhere(
          (t) =>
            !t.waitingCustomer &&
            now.getTime() - new Date(t.updated).getTime() > Number(this.days()) * 86_400_000,
        );
      case 'resolved-year':
        return resolvedThisYear(scoped, now);
      case 'unassigned':
        // Come il numero della pagina operativa: tutti gli aperti, senza i filtri della BI
        return this.store.tickets().filter((t) => isOpen(t) && !t.pending && t.assignee === null);
    }
  }

  protected back(): void {
    this.location.back();
  }

  protected sortBy(key: SortKey): void {
    this.sort.update((current) => ({ key, desc: current.key === key ? !current.desc : true }));
  }

  protected age(ticket: BiTicket): number {
    return ageDays(ticket, ticket.resolved ? new Date(ticket.resolved) : new Date());
  }

  protected overdue(ticket: BiTicket): boolean {
    return isOpen(ticket) && ticket.due !== null && new Date(ticket.due) < startOfToday();
  }
}

/** Data dentro le ultime {@code weeks} settimane complete (da lunedì a domenica, esclusa la corrente). */
function inWeeks(iso: string | null, now: Date, weeks: number): boolean {
  if (iso === null) {
    return false;
  }
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7),
  );
  const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7 * weeks);
  const time = new Date(iso).getTime();
  return time >= start.getTime() && time < monday.getTime();
}

function priorityOf(ticket: BiTicket): string {
  return (ticket.priority ?? '').toLowerCase();
}

function impactHas(ticket: BiTicket, keyword: string): boolean {
  return (ticket.impact ?? '').toLowerCase().includes(keyword);
}

/** Data negli ultimi {@code days} giorni, oggi compreso. */
function sinceStart(iso: string | null, now: Date, days: number): boolean {
  if (iso === null) {
    return false;
  }
  const time = new Date(iso).getTime();
  return time >= personTrendPeriod(now, days).start.getTime() && time <= now.getTime();
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function compare(a: BiTicket, b: BiTicket, key: SortKey, now: Date): number {
  switch (key) {
    case 'key':
      return keyNumber(a) - keyNumber(b);
    case 'priority':
      return rank(a.priority) - rank(b.priority);
    case 'due':
      // Senza scadenza in fondo con l'ordine crescente
      return (a.due ?? '9999').localeCompare(b.due ?? '9999');
    case 'created':
      return a.created.localeCompare(b.created);
    case 'updated':
      return a.updated.localeCompare(b.updated);
    case 'age':
      return ageDays(a, now) - ageDays(b, now);
  }
}

/** Numero del ticket (MRLIT-2658 → 2658), per ordinare come Jira. */
function keyNumber(ticket: BiTicket): number {
  return Number(ticket.key.split('-').pop()) || 0;
}

/** Posizione della priorità (Highest = 0); senza priorità in fondo. */
function rank(priority: string | null): number {
  const index = PRIORITY_RANK.indexOf(priority ?? '');
  return index === -1 ? PRIORITY_RANK.length : index;
}
