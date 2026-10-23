import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  ExcelFilter,
  ExcelFilterOption,
} from '../../../shared/components/excel-filter/excel-filter';
import { SavedViews } from '../../../shared/views/saved-views';
import { MONTHS } from './bi.model';
import { BiStore } from './bi-store.service';
import { TicketSyncService } from '../services/ticket-sync.service';

/**
 * Filtri in alto delle pagine BI (come i filtri di Power BI): area ("Progetto Marlù"),
 * assegnatario, anno e mesi di creazione. Valgono per tutte le pagine; si salvano nelle viste.
 */
@Component({
  selector: 'gov-bi-filters',
  imports: [
    ExcelFilter,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatTooltipModule,
    SavedViews,
  ],
  template: `
    <div class="filters" role="search" aria-label="Filtri dei ticket">
      <gov-excel-filter
        label="Progetto Marlù"
        [options]="areaOptions()"
        [selected]="store.areas()"
        (selectedChange)="store.areas.set($event)"
      />
      <gov-excel-filter
        label="Assegnatario"
        [options]="assigneeOptions()"
        [selected]="store.assignees()"
        (selectedChange)="store.assignees.set($event)"
      />
      <mat-select
        class="filters__year"
        aria-label="Anno di creazione"
        [value]="store.year()"
        (valueChange)="store.year.set($event)"
      >
        <mat-option [value]="null">Tutti gli anni</mat-option>
        @for (year of store.yearOptions(); track year) {
          <mat-option [value]="year">{{ year }}</mat-option>
        }
      </mat-select>
      <gov-excel-filter
        label="Mese"
        [options]="monthOptions"
        [selected]="selectedMonths()"
        (selectedChange)="setMonths($event)"
      />
      @if (filtered()) {
        <button mat-button type="button" (click)="store.clear()">
          <mat-icon aria-hidden="true">filter_alt_off</mat-icon>
          Togli filtri
        </button>
      }
      <ng-content />
      <span class="filters__spacer"></span>
      <gov-saved-views
        page="tickets.bi"
        [state]="store.viewState()"
        (apply)="store.applyView($event)"
      />
      <span class="filters__sync" role="status" [matTooltip]="sync.status()?.lastMessage ?? ''">
        @if (sync.syncing()) {
          Aggiornamento da Jira in corso…
        } @else {
          Aggiornato da Jira {{ sync.sinceText() }}
        }
      </span>
      <button
        mat-icon-button
        type="button"
        [class.spin]="sync.syncing() || store.loading()"
        [attr.aria-label]="sync.canSync() ? 'Aggiorna ora da Jira' : 'Ricarica i dati'"
        [matTooltip]="
          sync.canSync()
            ? 'Aggiorna ora da Jira (ticket cambiati); tutte le pagine si aggiornano'
            : 'Ricarica i dati'
        "
        [disabled]="sync.syncing() || store.loading()"
        (click)="sync.refresh()"
      >
        <mat-icon aria-hidden="true">{{ sync.canSync() ? 'sync' : 'refresh' }}</mat-icon>
      </button>
    </div>
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      border-radius: 0.75rem;
      background: var(--mat-sys-surface-container);

      &__year {
        box-sizing: border-box;
        width: 9rem;
        height: 2rem;
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--mat-sys-outline);
        border-radius: 0.5rem;
        background: var(--mat-sys-surface);
      }

      &__spacer {
        flex: 1;
      }

      &__sync {
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-body-small);
      }
    }

    // Icona che gira mentre si aggiorna
    .spin mat-icon {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class BiFilters {
  protected readonly store = inject(BiStore);
  protected readonly sync = inject(TicketSyncService);

  protected readonly monthOptions: readonly ExcelFilterOption[] = MONTHS.map((label, index) => ({
    value: String(index + 1),
    label,
  }));

  protected readonly areaOptions = computed(() =>
    this.store.areaOptions().map((value) => ({ value, label: value })),
  );
  protected readonly assigneeOptions = computed(() =>
    this.store.assigneeOptions().map((value) => ({ value, label: value })),
  );
  protected readonly selectedMonths = computed(() => this.store.months()?.map(String) ?? null);

  protected readonly filtered = computed(
    () =>
      this.store.areas() !== null ||
      this.store.assignees() !== null ||
      this.store.months() !== null ||
      this.store.year() !== new Date().getFullYear(),
  );

  protected setMonths(values: readonly string[] | null): void {
    this.store.months.set(values === null ? null : values.map(Number));
  }
}
