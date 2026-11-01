import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, of } from 'rxjs';

import { CrudApiService, errorMessage } from '../../../../shared/crud/crud-api.service';
import { EntityRow } from '../../../../shared/crud/crud.model';
import { toIsoDate } from '../../../../shared/dates/italian-date-adapter';
import { MentionCandidate } from '../../../projects/models/project-comment.model';
import { ProjectCommentsService } from '../../../projects/services/project-comments.service';
import { Task, TaskKind } from '../../models/task.model';
import { TasksService } from '../../services/tasks.service';

/** Quello che c'è già nella barra di inserimento veloce, da portare nel modulo completo. */
export interface TaskCreateData {
  readonly kind: TaskKind;
  readonly title: string;
  readonly assigneeId: number | null;
  readonly due: Date | null;
}

const projectLabel = (project: EntityRow): string =>
  project['code']
    ? `${String(project['code'])} · ${String(project['name'])}`
    : String(project['name']);

/**
 * Nuovo task con tutti i campi in una volta: titolo, descrizione, assegnatario, priorità, scadenza,
 * promemoria e progetto. Per l'inserimento di un attimo resta la barra veloce della pagina.
 * Alla creazione si chiude restituendo il task.
 */
@Component({
  selector: 'gov-task-create-dialog',
  imports: [
    FormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ kind() === 'NOTE' ? 'Nuova nota' : 'Nuovo task' }}</h2>
    <mat-dialog-content>
      <form id="task-create" class="form" (ngSubmit)="create()">
        <mat-button-toggle-group
          class="form__kind"
          name="kind"
          aria-label="Tipo"
          hideSingleSelectionIndicator
          [ngModel]="kind()"
          (ngModelChange)="kind.set($event)"
        >
          <mat-button-toggle value="TASK">Task</mat-button-toggle>
          <mat-button-toggle value="NOTE">Nota</mat-button-toggle>
        </mat-button-toggle-group>

        <mat-form-field appearance="outline" class="form__wide">
          <mat-label>Titolo</mat-label>
          <input
            matInput
            name="title"
            required
            cdkFocusInitial
            maxlength="200"
            autocomplete="off"
            [ngModel]="title()"
            (ngModelChange)="title.set($event)"
          />
        </mat-form-field>

        <mat-form-field appearance="outline" class="form__wide">
          <mat-label>Descrizione</mat-label>
          <textarea
            matInput
            name="description"
            rows="4"
            maxlength="20000"
            placeholder="Contesto, passi, link utili…"
            [ngModel]="description()"
            (ngModelChange)="description.set($event)"
          ></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Assegnato a</mat-label>
          <mat-select
            name="assignee"
            [ngModel]="assigneeId()"
            (ngModelChange)="assigneeId.set($event)"
          >
            <mat-option [value]="null">Nessuno</mat-option>
            @for (person of people(); track person.id) {
              <mat-option [value]="person.id">{{ person.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Priorità</mat-label>
          <mat-select
            name="priority"
            [ngModel]="priorityLevelId()"
            (ngModelChange)="priorityLevelId.set($event)"
          >
            <mat-option [value]="null">—</mat-option>
            @for (priority of priorities(); track priority.id) {
              <mat-option [value]="priority.id">{{ priority['label'] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Scadenza</mat-label>
          <input
            matInput
            name="due"
            placeholder="gg/mm/aaaa"
            autocomplete="off"
            [matDatepicker]="duePicker"
            [ngModel]="dueDate()"
            (ngModelChange)="dueDate.set($event)"
          />
          <mat-datepicker-toggle matIconSuffix [for]="duePicker" />
          <mat-datepicker #duePicker />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Promemoria il</mat-label>
          <input
            matInput
            name="remind"
            placeholder="gg/mm/aaaa"
            autocomplete="off"
            [matDatepicker]="remindPicker"
            [ngModel]="remindOn()"
            (ngModelChange)="remindOn.set($event)"
          />
          <mat-datepicker-toggle matIconSuffix [for]="remindPicker" />
          <mat-datepicker #remindPicker />
          <mat-hint>Compare nella campanella e nell'e-mail</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="form__wide">
          <mat-label>Progetto</mat-label>
          <input
            matInput
            name="project"
            placeholder="Cerca per codice o nome"
            autocomplete="off"
            [matAutocomplete]="projectAuto"
            [ngModel]="projectText()"
            (ngModelChange)="onProjectInput($event)"
          />
          <mat-autocomplete #projectAuto="matAutocomplete" [displayWith]="displayProject">
            @for (project of projectMatches(); track project.id) {
              <mat-option [value]="project.id">{{ displayProject(project.id!) }}</mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Annulla</button>
      <button
        mat-flat-button
        type="submit"
        form="task-create"
        [disabled]="busy() || !title().trim()"
      >
        {{ kind() === 'NOTE' ? 'Crea la nota' : 'Crea il task' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    // Mobile first: una colonna; da tablet due colonne, con titolo, descrizione e progetto a tutta larghezza
    .form {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0 1rem;
      padding-top: 0.5rem;
    }

    .form__wide,
    .form__kind {
      grid-column: 1 / -1;
    }

    .form__kind {
      justify-self: start;
      margin-bottom: 1rem;
    }

    @media (min-width: 40rem) {
      .form {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
})
export class TaskCreateDialog {
  private readonly data = inject<TaskCreateData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<TaskCreateDialog, Task>>(MatDialogRef);
  private readonly service = inject(TasksService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly crud = inject(CrudApiService);

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

  protected readonly busy = signal(false);
  protected readonly kind = signal<TaskKind>(this.data.kind);
  protected readonly title = signal(this.data.title);
  protected readonly description = signal('');
  protected readonly assigneeId = signal<number | null>(this.data.assigneeId);
  protected readonly priorityLevelId = signal<number | null>(null);
  protected readonly dueDate = signal<Date | null>(this.data.due);
  protected readonly remindOn = signal<Date | null>(null);
  protected readonly projectId = signal<number | null>(null);
  protected readonly projectText = signal('');

  protected readonly projectMatches = computed(() => {
    const text = this.projectText().toLowerCase().trim();
    return this.projects()
      .filter((project) => project['active'] !== false)
      .filter((project) => !text || projectLabel(project).toLowerCase().includes(text))
      .slice(0, 30);
  });

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

  protected create(): void {
    const title = this.title().trim();
    if (!title || this.busy()) {
      return;
    }
    this.busy.set(true);
    const due = this.dueDate();
    const remind = this.remindOn();
    this.service
      .create({
        kind: this.kind(),
        title,
        description: this.description().trim() || null,
        statusId: null,
        priorityLevelId: this.priorityLevelId(),
        assigneeId: this.assigneeId(),
        projectId: this.projectId(),
        planRowId: null,
        weekStart: null,
        remindOn: remind ? toIsoDate(remind) : null,
        dueDate: due ? toIsoDate(due) : null,
        version: null,
      })
      .subscribe({
        next: (task) => this.dialogRef.close(task),
        error: (error: unknown) => {
          this.busy.set(false);
          this.snackBar.open(errorMessage(error), 'OK', { duration: 6000 });
        },
      });
  }
}
