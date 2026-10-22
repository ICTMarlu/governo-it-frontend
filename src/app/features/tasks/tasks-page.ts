import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

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
import { TaskQuickAdd } from './components/task-quick-add/task-quick-add';
import {
  Task,
  TaskBody,
  TaskStatusOption,
  compareTasks,
  groupByProject,
} from './models/task.model';
import { TaskCommands } from './services/task-commands.service';
import { TasksService } from './services/tasks.service';

type TaskView = 'list' | 'board';

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
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    PageHeader,
    RouterLink,
    SavedViews,
    TaskItem,
    TaskQuickAdd,
  ],
  templateUrl: './tasks-page.html',
  styleUrl: './tasks-page.scss',
})
export class TasksPage {
  private readonly service = inject(TasksService);
  private readonly commands = inject(TaskCommands);
  private readonly preferences = inject(UserPreferencesService);
  private readonly currentUser = inject(AuthService).currentUser;

  /** Admin e PM vedono tutti i task; gli altri solo quelli assegnati a loro o creati da loro (D-31). */
  protected readonly seesAll = computed(() => {
    const role = this.currentUser()?.role;
    return role === ROLES.admin || role === ROLES.pm;
  });

  /** Persona da mostrare, dal link "Tutti i task di…" (?resource=id). */
  readonly resource = input<string | undefined>();

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

  protected readonly visible = computed(() => {
    const terms = searchTerms(this.search());
    return (this.tasks() ?? []).filter((task) =>
      matchesTerms(terms, [
        task.title,
        task.description,
        task.projectCode,
        task.projectName,
        task.assigneeName,
      ]),
    );
  });

  protected readonly groups = computed(() => groupByProject(this.visible()));
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

  protected readonly quickDefaults = computed<Partial<TaskBody>>(() => ({
    assigneeId: this.personId() === ALL ? null : this.personId(),
  }));

  protected readonly personName = computed(
    () => this.people().find((person) => person.id === this.personId())?.name ?? null,
  );

  constructor() {
    // Persona iniziale: dal link, altrimenti la propria risorsa, altrimenti tutti
    effect(() => {
      const fromLink = Number(this.resource());
      const mine = this.currentUser()?.resourceId ?? null;
      untracked(() => this.personId.set(fromLink > 0 ? fromLink : (mine ?? ALL)));
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
  }));

  /** Applica una vista salvata; con il link "Tutti i task di…" la persona resta quella del link. */
  protected applyView(state: unknown): void {
    const saved = (state ?? {}) as Partial<{
      person: number;
      includeDone: boolean;
      view: TaskView;
      search: string;
    }>;
    if (!(Number(this.resource()) > 0)) {
      this.personId.set(saved.person ?? this.currentUser()?.resourceId ?? ALL);
    }
    this.includeDone.set(saved.includeDone ?? false);
    this.view.set(saved.view === 'board' ? 'board' : 'list');
    this.search.set(saved.search ?? '');
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
