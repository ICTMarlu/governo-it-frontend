import { ProjectComment } from '../../projects/models/project-comment.model';

/** Task (da fare, con stato e promemoria) o semplice nota da non perdere. */
export type TaskKind = 'TASK' | 'NOTE';

/** Task come arriva dal backend: già pronto per liste, kanban e pannello della casella. */
export interface Task {
  readonly id: number;
  readonly kind: TaskKind;
  readonly title: string;
  readonly description: string | null;
  readonly statusId: number;
  readonly statusCode: string;
  readonly statusLabel: string;
  readonly statusColor: string | null;
  readonly done: boolean;
  readonly priorityLevelId: number | null;
  readonly priorityLevel: number | null;
  readonly assigneeId: number | null;
  readonly assigneeName: string | null;
  readonly projectId: number | null;
  readonly projectCode: string | null;
  readonly projectName: string | null;
  readonly planRowId: number | null;
  readonly weekStart: string | null;
  readonly dueDate: string | null;
  readonly remindOn: string | null;
  readonly completedOn: string | null;
  readonly overdue: boolean;
  readonly createdByName: string | null;
  readonly createdAt: string;
  readonly updatedAt: string | null;
  readonly commentCount: number;
  readonly canEdit: boolean;
  readonly version: string;
}

export interface TaskEvent {
  readonly field: string;
  readonly oldValue: string | null;
  readonly newValue: string | null;
  readonly userName: string | null;
  readonly occurredAt: string;
}

export interface TaskDetail {
  readonly task: Task;
  readonly comments: readonly ProjectComment[];
  readonly events: readonly TaskEvent[];
}

export interface CellTaskCount {
  readonly planRowId: number;
  readonly weekStart: string;
  readonly open: number;
  readonly total: number;
  /** Testo delle note della casella (fumetto al passaggio del mouse). */
  readonly notes: readonly string[];
}

export interface ReminderSummary {
  readonly overdue: number;
  readonly dueSoon: number;
  readonly tasks: readonly Task[];
}

/** Stato configurabile (lista valori "Stati dei task"); done = stato finale. */
export interface TaskStatusOption {
  readonly id: number;
  readonly code: string;
  readonly label: string;
  readonly color: string | null;
  readonly active: boolean;
  readonly done: boolean;
}

/** Corpo di creazione e modifica: per l'inserimento veloce basta il titolo. */
export interface TaskBody {
  readonly kind: TaskKind;
  readonly title: string;
  readonly description: string | null;
  readonly statusId: number | null;
  readonly priorityLevelId: number | null;
  readonly assigneeId: number | null;
  readonly projectId: number | null;
  readonly planRowId: number | null;
  readonly weekStart: string | null;
  readonly dueDate: string | null;
  readonly remindOn: string | null;
  readonly version: string | null;
}

/** Filtri della ricerca: ogni filtro assente non si applica. */
export interface TaskQuery {
  readonly resourceId?: number;
  readonly projectId?: number;
  readonly planRowId?: number;
  readonly weekStart?: string;
  readonly includeDone?: boolean;
}

/** Chiave di una casella del piano (riga + settimana). */
export function cellKey(planRowId: number, weekStart: string): string {
  return `${planRowId}|${weekStart}`;
}

/** Corpo per salvare il task con alcune modifiche, mantenendo il resto com'è. */
export function toBody(task: Task, changes: Partial<TaskBody> = {}): TaskBody {
  return {
    kind: task.kind,
    title: task.title,
    description: task.description,
    statusId: task.statusId,
    priorityLevelId: task.priorityLevelId,
    assigneeId: task.assigneeId,
    projectId: task.projectId,
    planRowId: task.planRowId,
    weekStart: task.weekStart,
    dueDate: task.dueDate,
    remindOn: task.remindOn,
    version: task.version,
    ...changes,
  };
}

/** Primo stato finale "fatto" (codice DONE se c'è), per la spunta veloce. */
export function doneStatus(statuses: readonly TaskStatusOption[]): TaskStatusOption | undefined {
  const finals = statuses.filter((status) => status.active && status.done);
  return finals.find((status) => status.code === 'DONE') ?? finals[0];
}

/** Primo stato aperto: quello dei task nuovi e di quelli riaperti. */
export function firstOpenStatus(
  statuses: readonly TaskStatusOption[],
): TaskStatusOption | undefined {
  return statuses.find((status) => status.active && !status.done);
}

/** Scadenza in parole: "scaduto il …", "oggi", "domani", "entro il …". */
export function dueLabel(task: Pick<Task, 'dueDate' | 'done' | 'overdue'>, today: string): string {
  if (!task.dueDate) {
    return '';
  }
  const date = formatShortDate(task.dueDate);
  if (task.overdue) {
    return `scaduto il ${date}`;
  }
  if (task.done) {
    return `scadenza ${date}`;
  }
  if (task.dueDate === today) {
    return 'scade oggi';
  }
  return `entro il ${date}`;
}

/** "2026-10-21" → "21/10". */
/** Settimana di riferimento di un task nato da una casella del piano: "W44 · 26/10". */
export function weekLabel(weekStart: string): string {
  const [year, month, day] = weekStart.split('-').map(Number);
  // Numero della settimana ISO 8601 (si calcola sul giovedì della settimana)
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `W${week} · ${formatShortDate(weekStart)}`;
}

export function formatShortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
}

/** Etichette dello storico. */
export const EVENT_LABELS: Readonly<Record<string, string>> = {
  CREATED: 'Creato',
  TITLE: 'Titolo',
  KIND: 'Tipo',
  STATUS: 'Stato',
  ASSIGNEE: 'Assegnato a',
  PROJECT: 'Progetto',
  CELL: 'Casella del piano',
  DUE_DATE: 'Scadenza',
  REMIND_ON: 'Promemoria',
  PRIORITY: 'Priorità',
};

export interface TaskGroup {
  readonly key: string;
  readonly label: string;
  readonly tasks: readonly Task[];
  readonly open: number;
}

/** Task raggruppati per progetto (i senza progetto in fondo); dentro, aperti prima e per scadenza. */
export function groupByProject(tasks: readonly Task[]): TaskGroup[] {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = task.projectId === null ? 'none' : String(task.projectId);
    groups.set(key, [...(groups.get(key) ?? []), task]);
  }
  return [...groups.entries()]
    .map(([key, items]) => ({
      key,
      label:
        key === 'none'
          ? 'Senza progetto'
          : `${items[0].projectCode ?? ''} ${items[0].projectName ?? ''}`.trim(),
      tasks: [...items].sort(compareTasks),
      open: items.filter((task) => !task.done).length,
    }))
    .sort((a, b) =>
      a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.label.localeCompare(b.label, 'it'),
    );
}

/** Aperti prima, poi in ritardo, poi per scadenza (senza scadenza in fondo), poi i più recenti. */
export function compareTasks(a: Task, b: Task): number {
  if (a.done !== b.done) {
    return a.done ? 1 : -1;
  }
  if (a.overdue !== b.overdue) {
    return a.overdue ? -1 : 1;
  }
  if (a.dueDate !== b.dueDate) {
    return a.dueDate === null ? 1 : b.dueDate === null ? -1 : a.dueDate.localeCompare(b.dueDate);
  }
  return b.id - a.id;
}
