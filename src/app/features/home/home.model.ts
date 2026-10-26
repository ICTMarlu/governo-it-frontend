/** Home (D-33): il punto di oggi, per il team (Admin e PM) o per sé (gli altri ruoli). */
export type HomeScope = 'TEAM' | 'PERSONAL';
export type InsightSeverity = 'HIGH' | 'MEDIUM' | 'INFO';

export interface HomeInsight {
  readonly kind: string;
  readonly severity: InsightSeverity;
  /** Frase breve per "il punto di oggi". */
  readonly summary: string;
  readonly text: string;
  readonly link: string;
  readonly linkLabel: string;
}

export interface HomeItem {
  readonly kind: 'TASK' | 'TOPIC';
  readonly id: number;
  readonly title: string;
  readonly dueDate: string | null;
  readonly overdue: boolean;
  readonly link: string;
}

export interface Home {
  readonly scope: HomeScope;
  readonly resourceName: string | null;
  readonly tickets: {
    readonly configured: boolean;
    readonly open: number;
    readonly backlogPerWeek: number;
    readonly dueSoon: number;
    readonly dueSoonDays: number;
    readonly noResponse: number;
  };
  readonly plan: {
    readonly weekStart: string;
    readonly saturationPct: number | null;
    readonly plannedPeople: number;
    readonly activePeople: number;
    readonly overloaded: readonly string[];
    readonly unplanned: readonly string[];
  };
  readonly tasks: { readonly overdue: number; readonly dueSoon: number };
  readonly management: {
    readonly open: number;
    readonly overdue: number;
    readonly nextMeeting: string | null;
  };
  readonly insights: readonly HomeInsight[];
  readonly myItems: readonly HomeItem[];
}

/** Giornate pianificate di una persona su un progetto in una settimana (progetti di tipo Project). */
export interface ProjectWork {
  readonly projectId: number;
  readonly code: string | null;
  readonly name: string;
  /** Ranking del progetto: il numero più piccolo è il più importante; può ripetersi. */
  readonly ranking: number | null;
  readonly system: string | null;
  readonly status: string;
  readonly resourceId: number;
  readonly resourceName: string;
  readonly weekStart: string;
  readonly days: number;
}

export interface ProjectsOverview {
  readonly scope: HomeScope;
  /** Lunedì delle settimane considerate: la scorsa, quella in corso e le tre successive. */
  readonly weeks: readonly string[];
  readonly rows: readonly ProjectWork[];
}

export type WorkGrouping = 'project' | 'person' | 'area';

/** Una riga di dettaglio dentro un gruppo (es. una persona dentro un progetto). */
export interface WorkChild {
  readonly key: string;
  readonly label: string;
  readonly link: string | null;
  readonly perWeek: readonly number[];
  readonly total: number;
  /** Ranking (del progetto, o il migliore dei progetti del gruppo); null = senza ranking. */
  readonly ranking: number | null;
}

export interface WorkGroup extends WorkChild {
  readonly hint: string | null;
  readonly children: readonly WorkChild[];
}

function sumWeeks(rows: readonly ProjectWork[], weeks: readonly string[]): number[] {
  return weeks.map(
    (week) =>
      Math.round(
        rows.filter((row) => row.weekStart === week).reduce((acc, row) => acc + row.days, 0) * 100,
      ) / 100,
  );
}

function total(perWeek: readonly number[]): number {
  return Math.round(perWeek.reduce((acc, value) => acc + value, 0) * 100) / 100;
}

/** Il ranking migliore (più basso) tra le righe; null se nessuna ne ha uno. */
function bestRanking(rows: readonly ProjectWork[]): number | null {
  const values = rows.map((row) => row.ranking).filter((value): value is number => value !== null);
  return values.length === 0 ? null : Math.min(...values);
}

function child(
  key: string,
  label: string,
  link: string | null,
  rows: readonly ProjectWork[],
  weeks: readonly string[],
): WorkChild {
  const perWeek = sumWeeks(rows, weeks);
  return { key, label, link, perWeek, total: total(perWeek), ranking: bestRanking(rows) };
}

/** Ranking crescente (il più importante prima), senza ranking in fondo, a parità ordine alfabetico. */
export function byRanking(
  a: { readonly ranking: number | null; readonly label: string },
  b: { readonly ranking: number | null; readonly label: string },
): number {
  if (a.ranking !== b.ranking) {
    if (a.ranking === null) {
      return 1;
    }
    if (b.ranking === null) {
      return -1;
    }
    return a.ranking - b.ranking;
  }
  return a.label.localeCompare(b.label, 'it', { sensitivity: 'base' });
}

function byTotal(a: WorkChild, b: WorkChild): number {
  return b.total - a.total || a.label.localeCompare(b.label, 'it');
}

/**
 * Raggruppa le giornate: per progetto (con le persone sotto), per persona (con i progetti
 * sotto) o per area, cioè il sistema (con i progetti sotto). Gruppi per giornate decrescenti.
 */
export function groupWork(
  rows: readonly ProjectWork[],
  weeks: readonly string[],
  grouping: WorkGrouping,
): WorkGroup[] {
  const key = (row: ProjectWork): string =>
    grouping === 'project'
      ? `p${row.projectId}`
      : grouping === 'person'
        ? `r${row.resourceId}`
        : `a${row.system ?? ''}`;
  const buckets = new Map<string, ProjectWork[]>();
  for (const row of rows) {
    buckets.set(key(row), [...(buckets.get(key(row)) ?? []), row]);
  }
  const groups = [...buckets.entries()].map(([groupKey, items]) => {
    const first = items[0];
    const label =
      grouping === 'project'
        ? first.name
        : grouping === 'person'
          ? first.resourceName
          : (first.system ?? '(senza sistema)');
    const hint =
      grouping === 'project'
        ? [first.code, first.system].filter(Boolean).join(' · ') || null
        : null;
    const link = grouping === 'project' ? `/projects/${first.projectId}` : null;
    const subKey = (row: ProjectWork): string =>
      grouping === 'project' ? `r${row.resourceId}` : `p${row.projectId}`;
    const subs = new Map<string, ProjectWork[]>();
    for (const row of items) {
      subs.set(subKey(row), [...(subs.get(subKey(row)) ?? []), row]);
    }
    const children = [...subs.entries()]
      .map(([subId, subRows]) =>
        grouping === 'project'
          ? child(subId, subRows[0].resourceName, null, subRows, weeks)
          : child(subId, subRows[0].name, `/projects/${subRows[0].projectId}`, subRows, weeks),
      )
      // I progetti sotto una persona o un'area seguono il ranking; le persone sotto un progetto le giornate
      .sort(grouping === 'project' ? byTotal : byRanking);
    return { ...child(groupKey, label, link, items, weeks), hint, children };
  });
  // Progetti e aree per ranking (più importante prima), le persone per giornate pianificate
  return groups.sort(grouping === 'person' ? byTotal : byRanking);
}

/** Icona e nome di ogni gravità: mai solo il colore. */
export const SEVERITIES: Readonly<
  Record<InsightSeverity, { readonly icon: string; readonly label: string }>
> = {
  HIGH: { icon: 'priority_high', label: 'Urgente' },
  MEDIUM: { icon: 'warning', label: 'Da guardare' },
  INFO: { icon: 'lightbulb', label: 'Spunto' },
};

/** "Il punto di oggi": le prime tre intuizioni in una frase. */
export function headline(insights: readonly HomeInsight[]): string {
  const parts = insights.slice(0, 3).map((insight) => insight.summary);
  if (parts.length === 0) {
    return 'Nessun segnale da anticipare: tutto sotto controllo.';
  }
  const sentence =
    parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
}

/** Buongiorno fino alle 13, buon pomeriggio fino alle 18, poi buonasera. */
export function greeting(now: Date): string {
  const hour = now.getHours();
  return hour < 13 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';
}

/** Numero della settimana ISO 8601. */
export function isoWeek(date: Date): number {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  return Math.ceil(((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
