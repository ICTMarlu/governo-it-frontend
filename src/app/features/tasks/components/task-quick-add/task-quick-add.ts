import { Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { errorMessage } from '../../../../shared/crud/crud-api.service';
import { toIsoDate } from '../../../../shared/dates/italian-date-adapter';
import { Task, TaskBody, TaskKind, formatShortDate } from '../../models/task.model';
import { TasksService } from '../../services/tasks.service';

/**
 * Inserimento veloce: scrivi il titolo e premi Invio. Accanto si sceglie se è un task o una
 * nota e, volendo, la scadenza dal calendario. Il resto (assegnatario, casella del piano,
 * progetto) arriva da {@code defaults}; i dettagli si completano aprendo il task.
 */
@Component({
  selector: 'gov-task-quick-add',
  imports: [FormsModule, MatButtonModule, MatDatepickerModule, MatIconModule, MatTooltipModule],
  template: `
    <form class="quick" (ngSubmit)="submit()">
      <button
        mat-icon-button
        type="button"
        class="quick__kind"
        [matTooltip]="
          kind() === 'TASK' ? 'Task · clic per scrivere una nota' : 'Nota · clic per un task'
        "
        [attr.aria-label]="
          kind() === 'TASK' ? 'Tipo: task. Passa a nota' : 'Tipo: nota. Passa a task'
        "
        (click)="kind.set(kind() === 'TASK' ? 'NOTE' : 'TASK')"
      >
        <mat-icon aria-hidden="true">{{
          kind() === 'TASK' ? 'task_alt' : 'sticky_note_2'
        }}</mat-icon>
      </button>
      <input
        #titleInput
        class="quick__input"
        name="title"
        maxlength="200"
        autocomplete="off"
        [placeholder]="kind() === 'TASK' ? placeholder() : 'Nuova nota… (Invio)'"
        [attr.aria-label]="kind() === 'TASK' ? 'Titolo del nuovo task' : 'Testo della nuova nota'"
        [(ngModel)]="title"
      />
      <input
        class="visually-hidden"
        name="due"
        tabindex="-1"
        aria-hidden="true"
        [matDatepicker]="picker"
        [(ngModel)]="due"
      />
      <mat-datepicker #picker />
      <button
        mat-button
        type="button"
        class="quick__due"
        [attr.aria-label]="due ? 'Scadenza ' + dueText() + '. Cambia' : 'Aggiungi una scadenza'"
        (click)="picker.open()"
      >
        <mat-icon aria-hidden="true">event</mat-icon>
        {{ due ? dueText() : '' }}
      </button>
      <button mat-flat-button type="submit" [disabled]="busy() || !title.trim()">Aggiungi</button>
    </form>
  `,
  styles: `
    .quick {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.25rem 0.25rem 0;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 0.75rem;
      background: var(--mat-sys-surface-container-low);

      &:focus-within {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: -1px;
      }
    }

    .quick__input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: none;
      background: transparent;
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-body-large);
    }

    .quick__due {
      min-width: 0;
      padding-inline: 0.5rem;
    }
  `,
})
export class TaskQuickAdd {
  private readonly service = inject(TasksService);
  private readonly snackBar = inject(MatSnackBar);

  /** Valori del nuovo task (assegnatario, casella, progetto...). */
  readonly defaults = input<Partial<TaskBody>>({});
  readonly placeholder = input('Nuovo task… (Invio)');
  readonly created = output<Task>();

  private readonly titleInput = viewChild.required<ElementRef<HTMLInputElement>>('titleInput');

  protected readonly kind = signal<TaskKind>('TASK');
  protected readonly busy = signal(false);
  protected title = '';
  protected due: Date | null = null;

  focus(): void {
    this.titleInput().nativeElement.focus();
  }

  protected dueText(): string {
    return this.due ? formatShortDate(toIsoDate(this.due)) : '';
  }

  protected submit(): void {
    const title = this.title.trim();
    if (!title || this.busy()) {
      return;
    }
    this.busy.set(true);
    const body: TaskBody = {
      kind: this.kind(),
      title,
      description: null,
      statusId: null,
      priorityLevelId: null,
      assigneeId: null,
      projectId: null,
      planRowId: null,
      weekStart: null,
      remindOn: null,
      version: null,
      ...this.defaults(),
      dueDate: this.due ? toIsoDate(this.due) : null,
    };
    this.service.create(body).subscribe({
      next: (task) => {
        this.busy.set(false);
        this.title = '';
        this.due = null;
        this.created.emit(task);
        this.focus();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.snackBar.open(errorMessage(error), 'OK', { duration: 6000 });
      },
    });
  }
}
