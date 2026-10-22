import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { filter } from 'rxjs';

import { Task, TaskBody, compareTasks } from '../../models/task.model';
import { TaskCommands } from '../../services/task-commands.service';
import { TasksService } from '../../services/tasks.service';
import { TaskItem } from '../task-item/task-item';
import { TaskQuickAdd } from '../task-quick-add/task-quick-add';

export interface CellTasksData {
  readonly planRowId: number;
  readonly weekStart: string;
  readonly resourceId: number;
  readonly resourceName: string;
  readonly rowLabel: string;
  readonly weekLabel: string;
}

/**
 * Pannello laterale dei task e delle note di una casella del piano (risorsa + progetto +
 * settimana). Si apre dal pallino della casella o con Alt+T: il cursore è già nel campo di
 * inserimento veloce. Chiudendo restituisce true se qualcosa è cambiato.
 */
@Component({
  selector: 'gov-cell-tasks-panel',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
    TaskItem,
    TaskQuickAdd,
  ],
  template: `
    <div class="head">
      <h2 mat-dialog-title class="head__title">
        Task e note
        <small class="head__meta">
          {{ data.resourceName }} · {{ data.rowLabel }} · {{ data.weekLabel }}
        </small>
      </h2>
      <button mat-icon-button type="button" aria-label="Chiudi" (click)="close()">
        <mat-icon aria-hidden="true">close</mat-icon>
      </button>
    </div>
    <mat-dialog-content class="body">
      <gov-task-quick-add #quickAdd [defaults]="defaults" (created)="onCreated($event)" />

      @if (tasks() === null) {
        <div class="state" role="status">
          <mat-progress-spinner diameter="24" mode="indeterminate" aria-hidden="true" />
          Caricamento…
        </div>
      } @else if (tasks()!.length === 0) {
        <p class="state">
          Nessun task o nota in questa casella. Scrivi sopra e premi Invio: il task è assegnato a
          {{ data.resourceName }}.
        </p>
      } @else {
        <ul class="list" aria-label="Task e note della casella">
          @for (task of sorted(); track task.id) {
            <li>
              <gov-task-item
                [task]="task"
                [statuses]="statuses()"
                [showProject]="false"
                [showAssignee]="task.assigneeId !== data.resourceId"
                (opened)="open(task)"
                (toggleDone)="toggleDone(task)"
                (statusChange)="changeStatus(task, $event)"
              />
            </li>
          }
        </ul>
      }
    </mat-dialog-content>
    <mat-dialog-actions class="actions">
      <a
        mat-button
        [routerLink]="['/tasks']"
        [queryParams]="{ resource: data.resourceId }"
        (click)="close()"
      >
        Tutti i task di {{ data.resourceName }}
      </a>
      <span class="spacer"></span>
      <button mat-button type="button" (click)="close()">Chiudi</button>
    </mat-dialog-actions>
  `,
  styles: `
    .head {
      display: flex;
      align-items: flex-start;
      padding-inline-end: 0.75rem;
      padding-top: 0.5rem;

      &__title {
        flex: 1;
      }

      &__meta {
        display: block;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-body-small);
      }
    }

    .body {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .list {
      margin: 0;
      padding: 0;
      list-style: none;

      li + li {
        border-top: 1px solid var(--mat-sys-outline-variant);
      }
    }

    .state {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .spacer {
      flex: 1;
    }
  `,
})
export class CellTasksPanel {
  protected readonly data = inject<CellTasksData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CellTasksPanel, boolean>>(MatDialogRef);
  private readonly service = inject(TasksService);
  private readonly commands = inject(TaskCommands);

  protected readonly statuses = toSignal(this.service.statuses$, { initialValue: [] });
  protected readonly tasks = signal<Task[] | null>(null);
  protected readonly sorted = computed(() => [...(this.tasks() ?? [])].sort(compareTasks));
  protected readonly defaults: Partial<TaskBody> = {
    planRowId: this.data.planRowId,
    weekStart: this.data.weekStart,
    assigneeId: this.data.resourceId,
  };
  private readonly quickAdd = viewChild.required<TaskQuickAdd>('quickAdd');
  private changed = false;

  constructor() {
    this.dialogRef.disableClose = true;
    this.dialogRef.backdropClick().subscribe(() => this.close());
    this.dialogRef
      .keydownEvents()
      .pipe(filter((event) => event.key === 'Escape'))
      .subscribe(() => this.close());
    this.dialogRef.afterOpened().subscribe(() => this.quickAdd().focus());
    this.load();
  }

  protected close(): void {
    this.dialogRef.close(this.changed);
  }

  protected onCreated(task: Task): void {
    this.changed = true;
    this.tasks.update((tasks) => [task, ...(tasks ?? [])]);
  }

  protected open(task: Task): void {
    this.commands.openDetail(task.id).subscribe((changed) => {
      if (changed) {
        this.changed = true;
        this.load();
      }
    });
  }

  protected toggleDone(task: Task): void {
    this.commands.toggleDone(task).subscribe((updated) => this.replace(updated));
  }

  protected changeStatus(task: Task, statusId: number): void {
    this.commands.changeStatus(task, statusId).subscribe((updated) => this.replace(updated));
  }

  private replace(updated: Task | null): void {
    if (updated) {
      this.changed = true;
      this.tasks.update((tasks) => (tasks ?? []).map((t) => (t.id === updated.id ? updated : t)));
    } else {
      this.load();
    }
  }

  private load(): void {
    this.service
      .search({ planRowId: this.data.planRowId, weekStart: this.data.weekStart, includeDone: true })
      .subscribe({
        next: (tasks) => this.tasks.set(tasks),
        error: () => this.tasks.set([]),
      });
  }
}
