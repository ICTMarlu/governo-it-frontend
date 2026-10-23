import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { LEVEL_LABELS, MODULES } from '../../core/auth/permissions';
import { errorMessage } from '../../shared/crud/crud-api.service';
import { AuditEntry, PermissionsService } from './permissions.service';

/** Storico delle modifiche ai permessi: chi ha cambiato cosa e quando, dalla più recente. */
@Component({
  selector: 'gov-audit-tab',
  imports: [DatePipe, MatProgressSpinnerModule],
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
              <th scope="col">Quando</th>
              <th scope="col">Chi</th>
              <th scope="col">Su</th>
              <th scope="col">Modulo</th>
              <th scope="col">Cambio</th>
            </tr>
          </thead>
          <tbody>
            @for (entry of entries(); track $index) {
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
