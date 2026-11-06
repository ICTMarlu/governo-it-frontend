import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { LEVEL_LABELS, MODULES } from '../../core/auth/permissions';
import { errorMessage } from '../../shared/crud/crud-api.service';
import { AuditEntry, PermissionsService } from './permissions.service';
import { SortHead, ariaSortOf } from '../../shared/components/sort-head/sort-head';
import { TableSort, nextSort, sortRows } from '../../shared/util/table-sort';

/** Storico delle modifiche ai permessi: chi ha cambiato cosa e quando, dalla più recente. */
@Component({
  selector: 'gov-audit-tab',
  imports: [DatePipe, MatProgressSpinnerModule, SortHead],
  template: `
    @if (loading()) {
      <p class="state" role="status">
        <mat-progress-spinner diameter="24" mode="indeterminate" aria-hidden="true" /> Caricamento…
      </p>
    } @else if (error(); as message) {
      <p class="state" role="alert">{{ message }}</p>
    } @else if (entries().length === 0) {
      <p class="state">Nessuna modifica registrata finora.</p>
    } @else {
      <div class="scroll">
        <table class="grid">
          <thead>
            <tr>
              <th scope="col" [attr.aria-sort]="ariaSort('at')">
                <gov-sort-head key="at" [sort]="sort()" (sorted)="sortBy($event)"
                  >Quando</gov-sort-head
                >
              </th>
              <th scope="col" [attr.aria-sort]="ariaSort('by')">
                <gov-sort-head key="by" [sort]="sort()" (sorted)="sortBy($event)"
                  >Chi</gov-sort-head
                >
              </th>
              <th scope="col" [attr.aria-sort]="ariaSort('target')">
                <gov-sort-head key="target" [sort]="sort()" (sorted)="sortBy($event)"
                  >Su</gov-sort-head
                >
              </th>
              <th scope="col" [attr.aria-sort]="ariaSort('module')">
                <gov-sort-head key="module" [sort]="sort()" (sorted)="sortBy($event)"
                  >Modulo</gov-sort-head
                >
              </th>
              <th scope="col" [attr.aria-sort]="ariaSort('change')">
                <gov-sort-head key="change" [sort]="sort()" (sorted)="sortBy($event)"
                  >Cambio</gov-sort-head
                >
              </th>
            </tr>
          </thead>
          <tbody>
            @for (entry of sorted(); track $index) {
              <tr>
                <td>{{ entry.at | date: 'dd/MM/yy HH:mm' }}</td>
                <td>{{ entry.by ?? '—' }}</td>
                <td>
                  {{ entry.targetType === 'ROLE' ? 'Profilo' : 'Utente' }}
                  <strong>{{ entry.target ?? '—' }}</strong>
                </td>
                <td>{{ moduleLabel(entry.module) }}</td>
                <td>
                  @if (entry.note) {
                    {{ entry.note }}
                  } @else {
                    {{ levelLabel(entry.from) }} → <strong>{{ levelLabel(entry.to) }}</strong>
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
    .scroll {
      margin-block-start: 1rem;
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
        white-space: nowrap;
      }

      thead th {
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-label-medium);
      }
    }

    .state {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-block: 1rem;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class AuditTab {
  private readonly service = inject(PermissionsService);

  protected readonly entries = signal<AuditEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  /** Ordine scelto con un clic sul titolo di colonna; null = ordine di partenza (dal più recente). */
  protected readonly sort = signal<TableSort | null>(null);

  protected sortBy(key: string): void {
    this.sort.update((current) => nextSort(current, key, key === 'at'));
  }

  protected ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    const sort = this.sort();
    return ariaSortOf(sort === null ? null : { key: sort.key, desc: sort.desc }, key);
  }

  protected readonly sorted = computed(() =>
    sortRows(this.entries(), this.sort(), (entry, key) => {
      switch (key) {
        case 'at':
          return entry.at;
        case 'by':
          return entry.by;
        case 'target':
          return entry.target;
        case 'module':
          return this.moduleLabel(entry.module);
        default:
          return entry.note ?? this.levelLabel(entry.to);
      }
    }),
  );

  constructor() {
    this.service.audit(200).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  protected moduleLabel(module: string | null): string {
    return MODULES.find((item) => item.key === module)?.label ?? '';
  }

  protected levelLabel(level: string | null): string {
    return level === 'NONE' || level === 'VIEW' || level === 'EDIT'
      ? LEVEL_LABELS[level]
      : 'come il profilo';
  }
}
