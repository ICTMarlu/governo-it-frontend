import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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
  imports: [ExcelFilter, MatButtonModule, MatIconModule, MatTooltipModule, SavedViews],
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
      <gov-excel-filter
        label="Anno"
        [options]="yearOptions()"
        [selected]="selectedYears()"
        (selectedChange)="setYears($event)"
      />
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
    // Barra su una sola riga, sempre alta uguale: i testi lunghi si troncano invece di andare a capo
    .filters {
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      gap: 0.5rem;
      min-height: 3rem;
      box-sizing: border-box;
      padding: 0.5rem 0.75rem;
      border-radius: 0.75rem;
      background: var(--mat-sys-surface-container);

      &__spacer {
        flex: 1;
      }

      &__sync {
        min-width: 0;
        overflow: hidden;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-body-small);
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      > button,
      > gov-saved-views {
        flex-shrink: 0;
      }
    }

    // Interruttori e pulsanti messi dalle pagine (contenuto proiettato): non vanno a capo né si stringono
    :host ::ng-deep .filters > * {
      flex-shrink: 0;
    }

    :host ::ng-deep .filters > gov-excel-filter {
      flex-shrink: 1;
      min-width: 0;
    }

    :host ::ng-deep .filters > .filters__sync {
      flex-shrink: 1;
    }

    // Su schermi stretti si torna a capo, come prima
    @media (max-width: 1099.98px) {
      .filters {
        flex-wrap: wrap;
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
  protected readonly yearOptions = computed(() =>
    this.store.yearOptions().map((year) => ({ value: String(year), label: String(year) })),
  );
  protected readonly selectedYears = computed(() => this.store.years()?.map(String) ?? null);
  protected readonly selectedMonths = computed(() => this.store.months()?.map(String) ?? null);

  protected readonly filtered = computed(
    () =>
      this.store.areas() !== null ||
      this.store.assignees() !== null ||
      this.store.months() !== null ||
      !this.isCurrentYearOnly(),
  );

  private isCurrentYearOnly(): boolean {
    const years = this.store.years();
    return years?.length === 1 && years[0] === new Date().getFullYear();
  }

  protected setYears(values: readonly string[] | null): void {
    this.store.years.set(values === null ? null : values.map(Number));
  }

  protected setMonths(values: readonly string[] | null): void {
    this.store.months.set(values === null ? null : values.map(Number));
  }
}
