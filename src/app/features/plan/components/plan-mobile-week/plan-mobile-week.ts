import { Component, computed, input, model, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import {
  CellChange,
  GridGroup,
  formatDay,
  formatDays,
  planRowLabel,
} from '../../models/plan-grid.model';
import { PlanWeek } from '../../models/plan.model';
import { CellTaskCount, cellKey } from '../../../tasks/models/task.model';

/** Casella di cui aprire task e note. */
export interface CellTasksRequest {
  readonly group: GridGroup;
  readonly gridRow: GridGroup['rows'][number];
  readonly weekStart: string;
}

/**
 * Piano sul telefono (componente di presentazione): una settimana alla volta, una scheda per
 * persona con le sue righe e la saturazione. I valori cambiati vengono emessi al genitore.
 */
@Component({
  selector: 'gov-plan-mobile-week',
  imports: [MatButtonModule, MatIconModule],
  template: `
    @if (week(); as current) {
      <div class="week">
        <button
          mat-icon-button
          type="button"
          aria-label="Settimana precedente"
          [disabled]="index() === 0"
          (click)="index.set(index() - 1)"
        >
          <mat-icon aria-hidden="true">chevron_left</mat-icon>
        </button>
        <span class="week__label">W{{ current.isoWeek }} · dal {{ day(current.weekStart) }}</span>
        <button
          mat-icon-button
          type="button"
          aria-label="Settimana successiva"
          [disabled]="index() >= weeks().length - 1"
          (click)="index.set(index() + 1)"
        >
          <mat-icon aria-hidden="true">chevron_right</mat-icon>
        </button>
      </div>
      @for (group of groups(); track group.resource.resourceId) {
        <section class="card" [attr.aria-label]="group.resource.name">
          <header class="card__head">
            <span class="card__name">{{ group.resource.name }}</span>
            @if (group.totals[index()]; as total) {
              <span class="sat-pill sat-pill--{{ total.level }}">
                {{ format(total.allocated) || '0' }}/{{ format(total.capacity) || '0' }} gg
              </span>
            }
          </header>
          @for (gridRow of group.rows; track gridRow.row.id ?? 'ferie-' + gridRow.row.resourceId) {
            <div class="card__row">
              <span class="card__label">
                {{ gridRow.row.vacation ? 'Ferie' : label(gridRow.row) }}
                @if (gridRow.row.rowNote) {
                  <span class="muted"> · {{ gridRow.row.rowNote }}</span>
                }
              </span>
              @if (canWrite()) {
                <input
                  class="card__input"
                  inputmode="decimal"
                  autocomplete="off"
                  [attr.aria-label]="label(gridRow.row) + ', giornate'"
                  [value]="format(gridRow.cells[current.weekStart]?.days)"
                  (change)="
                    cellChanged.emit({
                      group,
                      gridRow,
                      weekStart: current.weekStart,
                      input: $any($event.target),
                    })
                  "
                />
              } @else {
                <span>{{ format(gridRow.cells[current.weekStart]?.days) }}</span>
              }
              @if (gridRow.row.id !== null) {
                @let tasks = cellTasks().get(key(gridRow.row.id, current.weekStart));
                <button
                  mat-icon-button
                  type="button"
                  class="card__tasks"
                  [attr.aria-label]="
                    (tasks
                      ? tasks.open + ' task aperti su ' + tasks.total
                      : 'Aggiungi task o nota') +
                    ' · ' +
                    label(gridRow.row)
                  "
                  (click)="tasksRequested.emit({ group, gridRow, weekStart: current.weekStart })"
                >
                  <mat-icon aria-hidden="true">{{ tasks ? 'task_alt' : 'add_task' }}</mat-icon>
                  @if (tasks && tasks.open > 0) {
                    <span class="card__count" aria-hidden="true">{{ tasks.open }}</span>
                  }
                </button>
              }
            </div>
          }
          @if (group.totals[index()]?.holidays) {
            <div class="card__row muted">
              <span>Festività: {{ group.totals[index()].holidayNames.join(', ') }}</span>
              <span>{{ format(group.totals[index()].holidays) }}</span>
            </div>
          }
        </section>
      }
    }
  `,
  styles: `
    .week {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-block-end: 0.5rem;

      &__label {
        font: var(--mat-sys-title-small);
      }
    }

    .muted {
      color: var(--mat-sys-on-surface-variant);
    }

    .card {
      margin-block-end: 0.75rem;
      padding: 0.75rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 0.75rem;

      &__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-block-end: 0.5rem;
      }

      &__name {
        font: var(--mat-sys-title-small);
      }

      &__row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        min-height: 2.75rem;
        border-top: 1px solid var(--mat-sys-outline-variant);
      }

      &__label {
        min-width: 0;
        overflow-wrap: anywhere;
      }

      &__tasks {
        position: relative;
        flex-shrink: 0;
        color: var(--mat-sys-on-surface-variant);
      }

      &__count {
        position: absolute;
        top: 0.25rem;
        right: 0.125rem;
        min-width: 1rem;
        border-radius: 0.5rem;
        background: light-dark(#0b57d0, #a8c7fa);
        color: light-dark(#ffffff, #062e6f);
        font:
          600 0.625rem/1rem Roboto,
          sans-serif;
      }

      &__label {
        flex: 1;
      }

      &__input {
        box-sizing: border-box;
        flex: 0 0 4.5rem;
        height: 2.5rem;
        border: 1px solid var(--mat-sys-outline);
        border-radius: 0.25rem;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: center;
      }
    }
  `,
})
export class PlanMobileWeek {
  readonly groups = input.required<readonly GridGroup[]>();
  readonly weeks = input.required<readonly PlanWeek[]>();
  readonly canWrite = input(false);
  /** Task e note per casella (chiave riga + settimana). */
  readonly cellTasks = input<ReadonlyMap<string, CellTaskCount>>(new Map());
  /** Settimana mostrata (indice tra quelle caricate). */
  readonly index = model(0);

  readonly cellChanged = output<CellChange>();
  readonly tasksRequested = output<CellTasksRequest>();

  protected readonly week = computed(() => this.weeks()[this.index()]);
  protected readonly format = formatDays;
  protected readonly day = formatDay;
  protected readonly label = planRowLabel;
  protected readonly key = cellKey;
}
