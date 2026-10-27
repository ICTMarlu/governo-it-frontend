import { HomeScope } from './home.model';

/** Dashboard dei progetti di tipo Project nella home (D-34). */
export interface StatusCount {
  readonly statusId: number;
  readonly code: string;
  readonly label: string;
  readonly count: number;
  /** Progetti in questo stato tra quelli visibili (per aprirli nell'elenco). */
  readonly projectIds: readonly number[];
}

export interface ProjectRef {
  readonly id: number;
  readonly code: string | null;
  readonly name: string;
  readonly status: string;
}

export interface Parallel {
  readonly resourceId: number;
  readonly name: string;
  readonly count: number;
  readonly projects: readonly ProjectRef[];
}

export interface MovementWeek {
  readonly weekStart: string;
  readonly opened: number;
  readonly started: number;
  readonly closed: number;
  readonly pending: number;
  readonly aborted: number;
  readonly inProgressAtEnd: number;
}

export interface Portfolio {
  readonly scope: HomeScope;
  readonly total: number;
  readonly statuses: readonly StatusCount[];
  readonly coherence: {
    readonly aheadWeeks: number;
    readonly inProgressWithoutPlan: readonly ProjectRef[];
    readonly startedNotInProgress: readonly ProjectRef[];
    readonly closedWithPlan: readonly ProjectRef[];
  };
  readonly wipLimit: number;
  readonly parallel: readonly Parallel[];
  readonly historySince: string;
  readonly movement: readonly MovementWeek[];
}

export type MovementKey = 'opened' | 'started' | 'closed' | 'pending' | 'aborted';

/** Serie del grafico in ordine fisso: il colore segue la serie, mai la posizione. */
export const MOVEMENT_SERIES: readonly { readonly key: MovementKey; readonly label: string }[] = [
  { key: 'opened', label: 'Aperti' },
  { key: 'started', label: 'Avviati' },
  { key: 'closed', label: 'Chiusi' },
  { key: 'pending', label: 'In pending' },
  { key: 'aborted', label: 'Abortiti o respinti' },
];

export type MovementPeriod = 'week' | 'month';

export interface MovementPoint extends Omit<MovementWeek, 'weekStart'> {
  readonly label: string;
  readonly title: string;
}

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function date(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/**
 * Punti del grafico per settimana o per mese. Un mese somma le sue settimane (la settimana conta
 * nel mese del suo lunedì); gli in corso sono quelli a fine dell'ultima settimana del mese.
 */
export function movementPoints(
  weeks: readonly MovementWeek[],
  period: MovementPeriod,
): MovementPoint[] {
  if (period === 'week') {
    return weeks.map((week) => {
      const day = date(week.weekStart);
      const label = `${String(day.getDate()).padStart(2, '0')}/${String(day.getMonth() + 1).padStart(2, '0')}`;
      return { ...week, label, title: `settimana del ${label}/${day.getFullYear()}` };
    });
  }
  const months = new Map<string, MovementWeek[]>();
  for (const week of weeks) {
    const day = date(week.weekStart);
    const key = `${day.getFullYear()}-${day.getMonth()}`;
    months.set(key, [...(months.get(key) ?? []), week]);
  }
  return [...months.values()].map((list) => {
    const day = date(list[0].weekStart);
    const sum = (key: MovementKey): number => list.reduce((acc, week) => acc + week[key], 0);
    return {
      label: `${MONTHS[day.getMonth()]}-${String(day.getFullYear()).slice(2)}`,
      title: `${MONTHS[day.getMonth()]} ${day.getFullYear()}`,
      opened: sum('opened'),
      started: sum('started'),
      closed: sum('closed'),
      pending: sum('pending'),
      aborted: sum('aborted'),
      inProgressAtEnd: list[list.length - 1].inProgressAtEnd,
    };
  });
}

/** Totali del periodo mostrato, per i numeri sopra il grafico. */
export function movementTotals(weeks: readonly MovementWeek[]): Record<MovementKey, number> {
  const sum = (key: MovementKey): number => weeks.reduce((acc, week) => acc + week[key], 0);
  return {
    opened: sum('opened'),
    started: sum('started'),
    closed: sum('closed'),
    pending: sum('pending'),
    aborted: sum('aborted'),
  };
}
