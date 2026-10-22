import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { matchesTerms, searchTerms } from '../../../shared/util/text-search';
import { BiFilters } from './bi-filters';
import { BiTicket, ageDays, areaOf, assigneeOf, isOpen } from './bi.model';
import { BiStore } from './bi-store.service';

type ListState = 'open' | 'pending' | 'done' | 'all';
type SortKey = 'created' | 'age' | 'key';

const PAGE_SIZE = 200;

/**
 * Elenco dei ticket creati nel periodo (come le pagine Detail e All Ticket di Power BI), con
 * ricerca dal vivo, stato e link a Jira. Valgono tutti i filtri in alto.
 */
@Component({
  selector: 'gov-bi-list-page',
  imports: [
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
          <label class="inline-search">
            <mat-icon aria-hidden="true">search</mat-icon>
            <input
              class="inline-search__input"
              type="search"
              placeholder="Cerca chiave, titolo, persona, richiedente…"
              aria-label="Cerca nei ticket"
              [value]="search()"
              (input)="search.set($any($event.target).value); shown.set(pageSize)"
            />
          </label>
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
                <th scope="col">
                  <button type="button" class="sort" (click)="sortBy('key')">Ticket</button>
                </th>
                <th scope="col">Titolo</th>
                <th scope="col">Stato</th>
                <th scope="col">Progetto Marlù</th>
                <th scope="col">Assegnatario</th>
                <th scope="col">Richiedente</th>
                <th scope="col">Priorità</th>
                <th scope="col">
                  <button type="button" class="sort" (click)="sortBy('created')">Creato</button>
                </th>
                <th scope="col">Risolto</th>
                <th scope="col">
                  <button type="button" class="sort" (click)="sortBy('age')">Età</button>
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
  protected readonly sort = signal<{ key: SortKey; desc: boolean }>({ key: 'created', desc: true });
  protected readonly shown = signal(PAGE_SIZE);

  protected readonly jiraUrl = computed(() => {
    const base = this.store.data()?.sync.jiraBaseUrl;
    return base ? `${base.endsWith('/') ? base : base + '/'}browse/` : null;
  });

  protected readonly rows = computed(() => {
    const terms = searchTerms(this.search());
    const state = this.state();
    const { key, desc } = this.sort();
    const now = new Date();
    return this.store
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
      )
      .sort((a, b) => {
        const result =
          key === 'key'
            ? keyNumber(a) - keyNumber(b)
            : key === 'age'
              ? ageDays(a, now) - ageDays(b, now)
              : a.created.localeCompare(b.created);
        return desc ? -result : result;
      });
  });

  constructor() {
    this.store.load();
  }

  protected sortBy(key: SortKey): void {
    this.sort.update((current) => ({ key, desc: current.key === key ? !current.desc : true }));
  }

  protected age(ticket: BiTicket): number {
    return ageDays(ticket, ticket.resolved ? new Date(ticket.resolved) : new Date());
  }
}

/** Numero del ticket (MRLIT-2658 → 2658), per ordinare come Jira. */
function keyNumber(ticket: BiTicket): number {
  return Number(ticket.key.split('-').pop()) || 0;
}
