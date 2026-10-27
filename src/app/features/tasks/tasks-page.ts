import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { catchError, filter, forkJoin, of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { UserPreferencesService } from '../../core/preferences/user-preferences.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { SavedViews } from '../../shared/views/saved-views';
import { ROLES } from '../../shared/crud/crud.model';
import { TASKS_HELP } from '../../shared/help/help-content';
import { matchesTerms, searchTerms } from '../../shared/util/text-search';
import { MentionCandidate } from '../projects/models/project-comment.model';
import { ProjectCommentsService } from '../projects/services/project-comments.service';
import { TaskItem } from './components/task-item/task-item';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/crud/confirm-dialog/confirm-dialog';
import { errorMessage } from '../../shared/crud/crud-api.service';
import { toIsoDate } from '../../shared/dates/italian-date-adapter';
import {
  TASK_SOURCES,
  Task,
  TaskKind,
  TaskStatusOption,
  compareTasks,
  formatShortDate,
  weekLabel,
} from './models/task.model';
import { TaskCommands } from './services/task-commands.service';
import { TasksService } from './services/tasks.service';

type TaskView = 'list' | 'board';
type SortKey =
  'title' | 'project' | 'week' | 'assignee' | 'status' | 'priority' | 'due' | 'created';

/** Tutte le persone. */
const ALL = 0;
const VIEW_PREFERENCE = 'tasks.view';

/**
 * Task e note per persona (D-23): elenco raggruppato per progetto oppure kanban per stato,
 * con inserimento veloce, ricerca e cambio di stato al volo. Una guida che va oltre il
 * ticket: non si perde nulla tra un allineamento e l'altro.
 */
@Component({
  selector: 'gov-tasks-page',
  imports: [
    DragDropModule,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    PageHeader,
    RouterLink,
    SavedViews,
    TaskItem,
  ],
  templateUrl: './tasks-page.html',
  styleUrl: './tasks-page.scss',
})
export class TasksPage {
  private readonly service = inject(TasksService);
  private readonly commands = inject(TaskCommands);
  private readonly preferences = inject(UserPreferencesService);
  private readonly currentUser = inject(AuthService).currentUser;
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  /** Admin e PM vedono tutti i task; gli altri solo quelli assegnati a loro o creati da loro (D-31). */
  protected readonly seesAll = computed(() => {
    const role = this.currentUser()?.role;
    return role === ROLES.admin || role === ROLES.pm;
  });

  /** Persona da mostrare, dal link "Tutti i task di…" (?resource=id). */
  readonly resource = input<string | undefined>();
  /** Origine dal link "Tutti i task da…" del pannello di un record (?origine=MOBILE_LINE). */
  readonly origine = input<string | undefined>();

  /** Tabelle da cui possono nascere i task (D-36), per il filtro Origine. */
  protected readonly sourceOptions = Object.entries(TASK_SOURCES).map(([type, meta]) => ({
    type,
    label: meta.plural,
  }));
  /** null = tutti; FREE = solo i task nati liberi; altrimenti il tipo di record. */
  protected readonly sourceFilter = signal<string | null>(null);

  protected readonly help = TASKS_HELP;
  protected readonly statuses = toSignal(this.service.statuses$, {
    initialValue: [] as TaskStatusOption[],
  });
  protected readonly people = toSignal(
    inject(ProjectCommentsService)
      .mentionCandidates()
      .pipe(catchError(() => of([] as MentionCandidate[]))),
    { initialValue: [] },
  );

  protected readonly personId = signal<number>(ALL);
  protected readonly includeDone = signal(false);
  protected readonly view = signal<TaskView>('list');
  protected readonly search = signal('');
  protected readonly tasks = signal<Task[] | null>(null);
  protected readonly loadError = signal(false);
  protected readonly ALL = ALL;

  /** Filtri come nella pagina Direzione: stato, priorità, progetto (null = tutti). */
  protected readonly statusFilter = signal<number | null>(null);
  protected readonly priorityFilter = signal<number | null>(null);
  protected readonly projectFilter = signal<number | null>(null);
  protected readonly sort = signal<{ key: SortKey; desc: boolean } | null>(null);

  protected readonly visible = computed(() => {
    const terms = searchTerms(this.search());
    const status = this.statusFilter();
    const priority = this.priorityFilter();
    const project = this.projectFilter();
    const source = this.sourceFilter();
    return (this.tasks() ?? []).filter(
      (task) =>
        (source === null ||
          (source === 'FREE' ? task.sourceType === null : task.sourceType === source)) &&
        (status === null || task.statusId === status) &&
        (priority === null || task.priorityLevel === priority) &&
        (project === null || task.projectId === project) &&
        matchesTerms(terms, [
          task.title,
          task.description,
          task.projectCode,
          task.projectName,
          task.assigneeName,
          task.sourceLabel,
        ]),
    );
  });

  /** Righe dell'elenco: ordine scelto dalle intestazioni, altrimenti aperti, in ritardo, scadenza. */
  protected readonly rows = computed(() => {
    const sort = this.sort();
    const rows = [...this.visible()];
    if (!sort) {
      return rows.sort(compareTasks);
    }
    const value = (task: Task): string | number => {
      switch (sort.key) {
        case 'title':
          return task.title.toLowerCase();
        case 'project':
          return (task.projectCode ?? '').toLowerCase();
        case 'week':
          return task.weekStart ?? '9999';
        case 'assignee':
          return (task.assigneeName ?? '').toLowerCase();
        case 'status':
          return task.statusLabel.toLowerCase();
        case 'priority':
          return task.priorityLevel ?? 99;
        case 'due':
          return task.dueDate ?? '9999';
        case 'created':
          return task.createdAt;
      }
    };
    return rows.sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const result = typeof x === 'number' ? x - (y as number) : x.localeCompare(y as string, 'it');
      return sort.desc ? -result : result;
    });
  });

  /** Selezione per le azioni di gruppo (come in Direzione): solo i task che si possono modificare. */
  protected readonly selection = signal<ReadonlySet<number>>(new Set());
  protected readonly selectedTasks = computed(() =>
    this.rows().filter((task) => this.selection().has(task.id)),
  );
  protected readonly selectable = computed(() => this.rows().filter((task) => task.canEdit));
  protected readonly allSelected = computed(
    () =>
      this.selectable().length > 0 && this.selectable().every((t) => this.selection().has(t.id)),
  );
  protected readonly deleting = signal(false);

  protected readonly projectOptions = computed(() => {
    const seen = new Map<number, string>();
    for (const task of this.tasks() ?? []) {
      if (task.projectId !== null) {
        seen.set(task.projectId, task.projectCode ?? task.projectName ?? String(task.projectId));
      }
    }
    return [...seen]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'it'));
  });
  protected readonly priorityOptions = computed(() =>
    [...new Set((this.tasks() ?? []).map((task) => task.priorityLevel))]
      .filter((level): level is number => level !== null)
      .sort((a, b) => a - b),
  );

  /** Inserimento veloce (come in Direzione): titolo, tipo, assegnatario facoltativo, scadenza. */
  protected readonly quickTitle = signal('');
  protected readonly quickKind = signal<TaskKind>('TASK');
  protected readonly quickAssignee = signal<number | null>(null);
  protected readonly quickDue = signal<Date | null>(null);
  protected readonly adding = signal(false);
  protected readonly openCount = computed(() => this.visible().filter((t) => !t.done).length);
  protected readonly overdueCount = computed(() => this.visible().filter((t) => t.overdue).length);

  /** Colonne del kanban: stati attivi (i finali in fondo), solo task (le note restano nell'elenco). */
  protected readonly columns = computed(() =>
    this.statuses()
      .filter((status) => status.active)
      .map((status) => ({
        status,
        tasks: this.visible()
          .filter((task) => task.kind === 'TASK' && task.statusId === status.id)
          .sort(compareTasks),
      })),
  );

  protected readonly personName = computed(
    () => this.people().find((person) => person.id === this.personId())?.name ?? null,
  );

  constructor() {
    // Persona iniziale: dal link, altrimenti la propria risorsa, altrimenti tutti
    effect(() => {
      const fromLink = Number(this.resource());
      const mine = this.currentUser()?.resourceId ?? null;
      // Dal pannello di un record si vogliono i task di quel tipo di record, di chiunque siano
      const origin = this.origine();
      untracked(() => {
        this.personId.set(fromLink > 0 ? fromLink : origin ? ALL : (mine ?? ALL));
        if (origin && origin in TASK_SOURCES) {
          this.sourceFilter.set(origin);
        }
      });
    });
    // L'assegnatario del nuovo task segue la persona scelta, ma si può cambiare
    effect(() => {
      const personId = this.personId();
      untracked(() => this.quickAssignee.set(personId === ALL ? null : personId));
    });
    effect(() => {
      const personId = this.personId();
      const includeDone = this.includeDone() || this.view() === 'board';
      untracked(() => this.load(personId, includeDone));
    });
    this.preferences.get<TaskView>(VIEW_PREFERENCE).subscribe((view) => {
      if (view === 'list' || view === 'board') {
        this.view.set(view);
      }
    });
  }

  /** Stato salvato nelle viste (D-26). */
  protected readonly viewState = computed(() => ({
    person: this.personId(),
    includeDone: this.includeDone(),
    view: this.view(),
    search: this.search(),
    status: this.statusFilter(),
    priority: this.priorityFilter(),
    project: this.projectFilter(),
    source: this.sourceFilter(),
  }));

  /** Applica una vista salvata; con il link "Tutti i task di…" la persona resta quella del link. */
  protected applyView(state: unknown): void {
    const saved = (state ?? {}) as Partial<{
      person: number;
      includeDone: boolean;
      view: TaskView;
      search: string;
      status: number | null;
      priority: number | null;
      project: number | null;
      source: string | null;
    }>;
    if (!(Number(this.resource()) > 0)) {
      this.personId.set(saved.person ?? this.currentUser()?.resourceId ?? ALL);
    }
    this.includeDone.set(saved.includeDone ?? false);
    this.view.set(saved.view === 'board' ? 'board' : 'list');
    this.search.set(saved.search ?? '');
    this.statusFilter.set(saved.status ?? null);
    this.priorityFilter.set(saved.priority ?? null);
    this.projectFilter.set(saved.project ?? null);
    // Con il link "Tutti i task da…" l'origine resta quella del link
    if (!this.origine()) {
      this.sourceFilter.set(saved.source ?? null);
    }
  }

  protected toggleSelect(task: Task): void {
    this.selection.update((current) => {
      const next = new Set(current);
      if (!next.delete(task.id)) {
        next.add(task.id);
      }
      return next;
    });
  }

  protected toggleAll(): void {
    this.selection.set(
      this.allSelected() ? new Set() : new Set(this.selectable().map((t) => t.id)),
    );
  }

  protected clearSelection(): void {
    this.selection.set(new Set());
  }

  /** Elimina uno o più task dopo conferma; ogni task è una richiesta, l'esito è riassunto. */
  protected confirmDelete(tasks: readonly Task[]): void {
    if (tasks.length === 0 || this.deleting()) {
      return;
    }
    const one = tasks.length === 1;
    const data: ConfirmDialogData = {
      title: one ? `Eliminare “${tasks[0].title}”?` : `Eliminare ${tasks.length} elementi?`,
      message: "L'operazione non si può annullare: sparisce anche lo storico e i commenti.",
      confirmLabel: 'Elimina',
    };
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data })
      .afterClosed()
      .pipe(filter((confirmed) => confirmed === true))
      .subscribe(() => this.runDelete(tasks));
  }

  private runDelete(tasks: readonly Task[]): void {
    this.deleting.set(true);
    forkJoin(
      tasks.map((task) =>
        this.service
          .delete(task.id)
          .pipe(catchError((error: unknown) => of({ failed: errorMessage(error) }))),
      ),
    ).subscribe((results) => {
      const failed = results.filter(
        (result): result is { failed: string } =>
          !!result && typeof result === 'object' && 'failed' in result,
      );
      const done = tasks.length - failed.length;
      this.deleting.set(false);
      this.selection.set(new Set());
      this.snackBar.open(
        failed.length === 0
          ? `Eliminati: ${done}`
          : `Eliminati ${done} su ${tasks.length}. Non riusciti ${failed.length}: ${failed[0].failed}`,
        'OK',
        { duration: failed.length === 0 ? 3000 : 8000 },
      );
      this.reload();
    });
  }

  protected sortBy(key: SortKey): void {
    this.sort.update((current) =>
      current?.key === key ? (current.desc ? null : { key, desc: true }) : { key, desc: false },
    );
  }

  protected sortMark(key: SortKey): string {
    const sort = this.sort();
    return sort?.key === key ? (sort.desc ? 'arrow_downward' : 'arrow_upward') : 'unfold_more';
  }

  protected week(iso: string): string {
    return weekLabel(iso);
  }

  protected shortDate(iso: string): string {
    return formatShortDate(iso);
  }

  protected quickAdd(): void {
    const title = this.quickTitle().trim();
    if (!title || this.adding()) {
      return;
    }
    this.adding.set(true);
    const due = this.quickDue();
    this.service
      .create({
        kind: this.quickKind(),
        title,
        description: null,
        statusId: null,
        priorityLevelId: null,
        assigneeId: this.quickAssignee(),
        projectId: null,
        planRowId: null,
        weekStart: null,
        remindOn: null,
        version: null,
        dueDate: due ? toIsoDate(due) : null,
      })
      .subscribe({
        next: (task) => {
          this.adding.set(false);
          this.quickTitle.set('');
          this.quickDue.set(null);
          this.onCreated(task);
          this.snackBar.open(`Aggiunto: ${title}`, 'OK', { duration: 2500 });
        },
        error: (error: unknown) => {
          this.adding.set(false);
          this.snackBar.open(errorMessage(error), 'Chiudi');
        },
      });
  }

  protected setView(view: TaskView): void {
    this.view.set(view);
    this.preferences.save(VIEW_PREFERENCE, view).subscribe({ error: () => undefined });
  }

  protected onCreated(task: Task): void {
    this.tasks.update((tasks) => [task, ...(tasks ?? [])]);
  }

  protected open(task: Task): void {
    this.commands.openDetail(task.id).subscribe((changed) => changed && this.reload());
  }

  protected toggleDone(task: Task): void {
    this.commands.toggleDone(task).subscribe((updated) => this.replace(updated));
  }

  protected changeStatus(task: Task, statusId: number): void {
    this.commands.changeStatus(task, statusId).subscribe((updated) => this.replace(updated));
  }

  /** Kanban: trascinando una scheda in un'altra colonna cambia lo stato. */
  protected drop(event: CdkDragDrop<TaskStatusOption, TaskStatusOption, Task>): void {
    const task = event.item.data;
    const target = event.container.data;
    if (event.previousContainer === event.container || !task.canEdit) {
      return;
    }
    // Spostamento immediato a video, poi conferma dal server
    this.tasks.update((tasks) =>
      (tasks ?? []).map((t) =>
        t.id === task.id ? { ...t, statusId: target.id, statusLabel: target.label } : t,
      ),
    );
    this.changeStatus(task, target.id);
  }

  protected reload(): void {
    this.load(this.personId(), this.includeDone() || this.view() === 'board');
  }

  private replace(updated: Task | null): void {
    if (!updated) {
      this.reload();
      return;
    }
    this.tasks.update((tasks) =>
      (tasks ?? [])
        .map((task) => (task.id === updated.id ? updated : task))
        // Chiuso con i chiusi nascosti: resta visibile (barrato) fino al prossimo caricamento
        .filter(
          (task) =>
            task.id === updated.id || this.includeDone() || !task.done || this.view() === 'board',
        ),
    );
  }

  private load(personId: number, includeDone: boolean): void {
    this.loadError.set(false);
    this.service
      .search({ resourceId: personId === ALL ? undefined : personId, includeDone })
      .subscribe({
        next: (tasks) => this.tasks.set(tasks),
        error: () => {
          this.tasks.set([]);
          this.loadError.set(true);
        },
      });
  }
}
