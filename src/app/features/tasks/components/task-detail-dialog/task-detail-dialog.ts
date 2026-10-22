import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, filter, of, switchMap } from 'rxjs';

import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../../shared/crud/confirm-dialog/confirm-dialog';
import { CrudApiService, errorMessage } from '../../../../shared/crud/crud-api.service';
import { EntityRow } from '../../../../shared/crud/crud.model';
import { fromIsoDate, toIsoDate } from '../../../../shared/dates/italian-date-adapter';
import { CommentComposer } from '../../../projects/components/comment-composer/comment-composer';
import {
  MentionCandidate,
  ProjectComment,
  commentSegments,
} from '../../../projects/models/project-comment.model';
import { ProjectCommentsService } from '../../../projects/services/project-comments.service';
import { EVENT_LABELS, Task, TaskDetail, TaskKind, toBody } from '../../models/task.model';
import { TasksService } from '../../services/tasks.service';

export interface TaskDetailData {
  readonly taskId: number;
}

const projectLabel = (project: EntityRow): string =>
  project['code']
    ? `${String(project['code'])} · ${String(project['name'])}`
    : String(project['name']);

/**
 * Dettaglio di un task o di una nota: campi modificabili (se l'utente può), descrizione,
 * commenti con citazioni @ e storico delle modifiche. Chiudendo restituisce true se qualcosa
 * è cambiato, così chi l'ha aperto ricarica la lista.
 */
@Component({
  selector: 'gov-task-detail-dialog',
  imports: [
    DatePipe,
    FormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    CommentComposer,
  ],
  templateUrl: './task-detail-dialog.html',
  styleUrl: './task-detail-dialog.scss',
})
export class TaskDetailDialog {
  private readonly data = inject<TaskDetailData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<TaskDetailDialog, boolean>>(MatDialogRef);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly service = inject(TasksService);
  private readonly crud = inject(CrudApiService);

  protected readonly statuses = toSignal(this.service.statuses$, { initialValue: [] });
  protected readonly people = toSignal(
    inject(ProjectCommentsService)
      .mentionCandidates()
      .pipe(catchError(() => of([] as MentionCandidate[]))),
    { initialValue: [] },
  );
  private readonly projects = toSignal(
    this.crud.list('/projects').pipe(catchError(() => of([] as EntityRow[]))),
    { initialValue: [] },
  );
  protected readonly priorities = toSignal(
    this.crud.list('/lookups/priority-levels').pipe(catchError(() => of([] as EntityRow[]))),
    { initialValue: [] },
  );

  protected readonly detail = signal<TaskDetail | null>(null);
  protected readonly loadError = signal(false);
  protected readonly busy = signal(false);
  protected readonly editingComment = signal<number | null>(null);
  private changed = false;

  // Campi del modulo
  protected readonly kind = signal<TaskKind>('TASK');
  protected readonly title = signal('');
  protected readonly description = signal('');
  protected readonly statusId = signal<number | null>(null);
  protected readonly assigneeId = signal<number | null>(null);
  protected readonly priorityLevelId = signal<number | null>(null);
  protected readonly dueDate = signal<Date | null>(null);
  protected readonly remindOn = signal<Date | null>(null);
  protected readonly projectId = signal<number | null>(null);
  protected readonly projectText = signal('');

  private readonly newComposer = viewChild<CommentComposer>('newComposer');

  protected readonly task = computed(() => this.detail()?.task ?? null);
  protected readonly readOnly = computed(() => !this.task()?.canEdit);
  protected readonly inCell = computed(() => this.task()?.planRowId != null);
  protected readonly eventLabels = EVENT_LABELS;
  protected readonly segments = (comment: ProjectComment) => commentSegments(comment.body);

  protected readonly projectMatches = computed(() => {
    const text = this.projectText().toLowerCase().trim();
    return this.projects()
      .filter((project) => project['active'] !== false)
      .filter((project) => !text || projectLabel(project).toLowerCase().includes(text))
      .slice(0, 30);
  });

  /** Ci sono modifiche non salvate ai campi. */
  protected readonly dirty = computed(() => {
    const task = this.task();
    if (!task) {
      return false;
    }
    return (
      task.kind !== this.kind() ||
      task.title !== this.title().trim() ||
      (task.description ?? '') !== this.description().trim() ||
      task.statusId !== this.statusId() ||
      task.assigneeId !== this.assigneeId() ||
      task.priorityLevelId !== this.priorityLevelId() ||
      task.dueDate !== this.isoOrNull(this.dueDate()) ||
      task.remindOn !== this.isoOrNull(this.remindOn()) ||
      task.projectId !== this.projectId()
    );
  });

  constructor() {
    // Esc e clic fuori chiudono comunque restituendo se qualcosa è cambiato
    this.dialogRef.disableClose = true;
    this.dialogRef.backdropClick().subscribe(() => this.close());
    this.dialogRef
      .keydownEvents()
      .pipe(filter((event) => event.key === 'Escape'))
      .subscribe(() => this.close());
    this.load();
  }

  protected close(): void {
    this.dialogRef.close(this.changed);
  }

  protected displayProject = (value: number | string | null): string => {
    if (typeof value !== 'number') {
      return value ?? '';
    }
    const project = this.projects().find((candidate) => candidate.id === value);
    return project ? projectLabel(project) : this.projectText();
  };

  protected onProjectInput(value: number | string): void {
    if (typeof value === 'number') {
      this.projectId.set(value);
      this.projectText.set(this.displayProject(value));
    } else {
      this.projectText.set(value);
      if (!value.trim()) {
        this.projectId.set(null);
      }
    }
  }

  protected save(): void {
    const task = this.task();
    if (!task || !this.title().trim()) {
      return;
    }
    this.busy.set(true);
    const body = toBody(task, {
      kind: this.kind(),
      title: this.title().trim(),
      description: this.description().trim() || null,
      statusId: this.statusId(),
      assigneeId: this.assigneeId(),
      priorityLevelId: this.priorityLevelId(),
      dueDate: this.isoOrNull(this.dueDate()),
      remindOn: this.isoOrNull(this.remindOn()),
      projectId: this.projectId(),
    });
    this.service.update(task.id, body).subscribe({
      next: () => {
        this.changed = true;
        this.snackBar.open('Task salvato', undefined, { duration: 2000 });
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  protected remove(): void {
    const task = this.task();
    if (!task) {
      return;
    }
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data: {
          title: task.kind === 'NOTE' ? 'Eliminare la nota?' : 'Eliminare il task?',
          message: `"${task.title}" sparirà con i suoi commenti e lo storico. Se è solo concluso, segnalo come fatto.`,
          confirmLabel: 'Elimina',
        },
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => this.service.delete(task.id)),
      )
      .subscribe({
        next: () => {
          this.changed = true;
          this.close();
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  protected publish(body: string): void {
    const task = this.task();
    if (!task) {
      return;
    }
    this.busy.set(true);
    this.service.addComment(task.id, body).subscribe({
      next: () => {
        this.newComposer()?.clear();
        this.changed = true;
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  protected saveComment(comment: ProjectComment, body: string): void {
    this.busy.set(true);
    this.service.updateComment(this.data.taskId, comment, body).subscribe({
      next: () => {
        this.editingComment.set(null);
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  protected deleteComment(comment: ProjectComment): void {
    this.busy.set(true);
    this.service.deleteComment(this.data.taskId, comment.id).subscribe({
      next: () => {
        this.changed = true;
        this.load();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  protected eventValue(value: string | null, field: string): string {
    if (value === null) {
      return '—';
    }
    if (field === 'KIND') {
      return value === 'NOTE' ? 'Nota' : 'Task';
    }
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : value;
  }

  private load(): void {
    this.service.detail(this.data.taskId).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.fill(detail.task);
        this.busy.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.busy.set(false);
      },
    });
  }

  private fill(task: Task): void {
    this.kind.set(task.kind);
    this.title.set(task.title);
    this.description.set(task.description ?? '');
    this.statusId.set(task.statusId);
    this.assigneeId.set(task.assigneeId);
    this.priorityLevelId.set(task.priorityLevelId);
    this.dueDate.set(fromIsoDate(task.dueDate));
    this.remindOn.set(fromIsoDate(task.remindOn));
    this.projectId.set(task.projectId);
    this.projectText.set(
      task.projectId === null ? '' : `${task.projectCode ?? ''} · ${task.projectName ?? ''}`,
    );
  }

  private fail(error: unknown): void {
    this.busy.set(false);
    this.snackBar.open(errorMessage(error), 'OK', { duration: 6000 });
  }

  private isoOrNull(date: Date | null): string | null {
    return date ? toIsoDate(date) : null;
  }
}
