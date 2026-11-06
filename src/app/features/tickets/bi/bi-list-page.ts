import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { matchesTerms, searchTerms } from '../../../shared/util/text-search';
import { BiFilters } from './bi-filters';
import { BiTicket, areaOf, assigneeOf, isOpen } from './bi.model';
import {
  TicketSort,
  TicketSortKey,
  nextTicketSort,
  sortTickets,
  ticketAge,
  ticketIdleDays,
} from './bi-ticket-sort';
import { BiStore } from './bi-store.service';
import { SearchField } from '../../../shared/components/search-field/search-field';
import { SortHead, ariaSortOf } from '../../../shared/components/sort-head/sort-head';

type ListState = 'open' | 'pending' | 'done' | 'all';

const PAGE_SIZE = 200;

/**
 * Elenco dei ticket creati nel periodo (come le pagine Detail e All Ticket di Power BI), con
 * ricerca dal vivo, stato e link a Jira. Valgono tutti i filtri in alto.
 */
@Component({
  selector: 'gov-bi-list-page',
  imports: [
    SearchField,
    SortHead,
    BiFilters,
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="bi-page">
      <gov-bi-filters />
      @if (store.error(); as error) {
        <p class="bi-state" role="alert">{{ error }}</p>
      } @else if (!store.data()) {
        <p class="bi-state" role="status">
          <mat-progress-spinner diameter="24" mode="indeterminate" aria-hidden="true" /> Caricamento
          dei ticket…
        </p>
      } @else {
        <div class="tools">
          <gov-search-field
            [value]="search()"
            (valueChange)="search.set($event); shown.set(pageSize)"
            placeholder="Cerca chiave, titolo, persona, richiedente…"
            label="Cerca nei ticket"
            width="24rem"
          />
          <mat-button-toggle-group
            aria-label="Stato"
            hideSingleSelectionIndicator
            [value]="state()"
            (change)="state.set($event.value); shown.set(pageSize)"
          >
            <mat-button-toggle value="open">Aperti</mat-button-toggle>
            <mat-button-toggle value="pending">Pending</mat-button-toggle>
            <mat-button-toggle value="done">Risolti</mat-button-toggle>
            <mat-button-toggle value="all">Tutti</mat-button-toggle>
          </mat-button-toggle-group>
          <span class="count" role="status">{{ rows().length }} ticket</span>
        </div>
        <div class="wrap">
          <table class="table">
            <thead>
              <tr>
                <th scope="col" [attr.aria-sort]="ariaSort('key')">
                  <gov-sort-head key="key" [sort]="sort()" (sorted)="sortBy($event)"
                    >Ticket</gov-sort-head
                  >
                </th>
                <th scope="col" [attr.aria-sort]="ariaSort('summary')">
                  <gov-sort-head key="summary" [sort]="sort()" (sorted)="sortBy($event)"
                    >Titolo</gov-sort-head
                  >
                </th>
                <th scope="col" [attr.aria-sort]="ariaSort('status')">
                  <gov-sort-head key="status" [sort]="sort()" (sorted)="sortBy($event)"
                    >Stato</gov-sort-head
                  >
                </th>
                <th scope="col" [attr.aria-sort]="ariaSort('area')">
                  <gov-sort-head key="area" [sort]="sort()" (sorted)="sortBy($event)"
                    >Progetto Marlù</gov-sort-head
                  >
                </th>
                <th scope="col" [attr.aria-sort]="ariaSort('assignee')">
                  <gov-sort-head key="assignee" [sort]="sort()" (sorted)="sortBy($event)"
                    >Assegnatario</gov-sort-head
                  >
                </th>
                <th scope="col" [attr.aria-sort]="ariaSort('reporter')">
                  <gov-sort-head key="reporter" [sort]="sort()" (sorted)="sortBy($event)"
                    >Richiedente</gov-sort-head
                  >
                </th>
                <th scope="col" [attr.aria-sort]="ariaSort('priority')">
                  <gov-sort-head key="priority" [sort]="sort()" (sorted)="sortBy($event)"
                    >Priorità</gov-sort-head
                  >
                </th>
                <th scope="col" [attr.aria-sort]="ariaSort('created')">
                  <gov-sort-head key="created" [sort]="sort()" (sorted)="sortBy($event)"
                    >Creato</gov-sort-head
                  >
                </th>
                <th scope="col" [attr.aria-sort]="ariaSort('resolved')">
                  <gov-sort-head key="resolved" [sort]="sort()" (sorted)="sortBy($event)"
                    >Risolto</gov-sort-head
                  >
                </th>
                <th scope="col" [attr.aria-sort]="ariaSort('age')">
                  <gov-sort-head key="age" [sort]="sort()" (sorted)="sortBy($event)"
                    >Età</gov-sort-head
                  >
                </th>
                <th
                  scope="col"
                  [attr.aria-sort]="ariaSort('idle')"
                  title="Giorni dall'ultimo movimento di una persona (modifica o commento): le automazioni di Jira non contano. Solo per i ticket aperti."
                >
                  <gov-sort-head key="idle" [sort]="sort()" (sorted)="sortBy($event)"
                    >Fermo da</gov-sort-head
                  >
                </th>
              </tr>
            </thead>
            <tbody>
              @for (ticket of rows().slice(0, shown()); track ticket.key) {
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
                  <td>{{ ticket.status }}</td>
                  <td>{{ ticket.area ?? '' }}</td>
                  <td>{{ ticket.assignee ?? '—' }}</td>
                  <td>{{ ticket.reporter ?? '' }}</td>
                  <td>{{ ticket.priority ?? '' }}</td>
                  <td>{{ ticket.created | date: 'dd/MM/yy' }}</td>
                  <td>{{ ticket.resolved ? (ticket.resolved | date: 'dd/MM/yy') : '' }}</td>
                  <td class="num">{{ age(ticket) }} gg</td>
                  <td class="num">{{ idleLabel(ticket) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (rows().length > shown()) {
          <button
            mat-stroked-button
            type="button"
            class="more"
            (click)="shown.set(shown() + pageSize)"
          >
            Mostra altri {{ pageSize }} ({{ rows().length - shown() }} rimasti)
          </button>
        }
      }
    </div>
  `,
  styles: `
    .tools {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
    }

    .count {
      color: var(--mat-sys-on-surface-variant);
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

    .more {
      align-self: center;
    }
  `,
})
export class BiListPage {
  protected readonly store = inject(BiStore);
  protected readonly pageSize = PAGE_SIZE;

  protected readonly search = signal('');
  protected readonly state = signal<ListState>('open');
  // Di partenza i più recenti in alto; ogni colonna si può ordinare con un clic sul titolo
  protected readonly sort = signal<TicketSort>({ key: 'created', desc: true });
  protected readonly shown = signal(PAGE_SIZE);

  protected readonly jiraUrl = computed(() => {
    const base = this.store.data()?.sync.jiraBaseUrl;
    return base ? `${base.endsWith('/') ? base : base + '/'}browse/` : null;
  });

  protected readonly rows = computed(() => {
    const terms = searchTerms(this.search());
    const state = this.state();
    const rows = this.store
      .createdInPeriod()
      .filter(
        (t) =>
          state === 'all' ||
          (state === 'open' && isOpen(t)) ||
          (state === 'pending' && isOpen(t) && t.pending) ||
          (state === 'done' && !isOpen(t)),
      )
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
      );
    return sortTickets(rows, this.sort());
  });

  constructor() {
    this.store.load();
  }

  protected sortBy(key: string): void {
    this.sort.update((current) => nextTicketSort(current, key as TicketSortKey));
  }

  protected ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    return ariaSortOf(this.sort(), key);
  }

  protected age(ticket: BiTicket): number {
    return ticketAge(ticket);
  }

  protected idleLabel(ticket: BiTicket): string {
    const days = ticketIdleDays(ticket);
    return days === null ? '' : days === 0 ? 'oggi' : `${days} gg`;
  }
}
