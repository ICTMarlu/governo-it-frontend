/**
 * Panoramica della pagina Progetti: i dati arrivano per progetto (GET /projects/overview), i conteggi
 * si fanno qui, così i filtri della pagina (tipo, tutti/i miei) li ricalcolano senza nuove chiamate.
 */

export interface OverviewProject {
  readonly id: number;
  readonly code: string | null;
  readonly name: string;
  readonly workTypeCode: string;
  readonly workTypeLabel: string;
  readonly statusId: number;
  readonly statusCode: string;
  readonly statusLabel: string;
  readonly statusColor: string | null;
  /** Stato finale (Completed, Rejected, Aborted…). */
  readonly closed: boolean;
  /** Priorità IT: 1 = la più importante; null = non indicata. */
  readonly priorityLevel: number | null;
  readonly priorityLabel: string | null;
  readonly priorityColor: string | null;
  readonly businessPriorityLevel: number | null;
  readonly systemLabel: string | null;
  readonly owners: string | null;
  readonly ranking: number | null;
  /** Chi guarda ne è owner o ci ha righe del piano. */
  readonly mine: boolean;
  readonly daysPast: number;
  readonly daysThisWeek: number;
  /** Giornate dalla settimana corrente per `aheadWeeks` settimane. */
  readonly daysAhead: number;
  /** Giornate dopo l'orizzonte. */
  readonly daysLater: number;
  readonly peopleAhead: number;
  readonly lastPlannedWeek: string | null;
  /** Quando è stato chiuso (aaaa-mm-gg), se noto: data di completamento o passaggio nello storico. */
  readonly closedOn: string | null;
  /** Giornate nell'orizzonte della persona in vista (tutte, senza persona). */
  readonly focusDaysAhead: number;
}

export interface OverviewStatus {
  readonly id: number;
  readonly code: string;
  readonly label: string;
  readonly color: string | null;
  readonly closed: boolean;
}

export interface OverviewPriority {
  readonly level: number;
  readonly label: string;
  readonly color: string | null;
}

export interface ProjectOverview {
  readonly weekStart: string;
  readonly aheadWeeks: number;
  /** Persona di cui si vedono i progetti (null = tutti). */
  readonly focusResourceId: number | null;
  /** Chi guarda può scegliere la persona (Admin e PM). */
  readonly canChoose: boolean;
  /** Capacità nell'orizzonte al netto delle festività: della persona in vista o di tutte le pianificabili. */
  readonly capacityAhead: number;
  readonly statuses: readonly OverviewStatus[];
  readonly priorities: readonly OverviewPriority[];
  readonly projects: readonly OverviewProject[];
}

/** Tipo di lavoro dei progetti veri e propri (gli altri: AMS, Continuous, Admin). */
export const PROJECT_TYPE = 'PROJECT';
const IN_PROGRESS = 'IN_PROGRESS';
const PENDING = 'PENDING';
const COMPLETED = 'COMPLETED';
const NOT_STARTED = new Set(['TO_START', 'APPROVED']);

export interface OverviewFilter {
  /** Codici dei tipi di lavoro da contare; vuoto = tutti. */
  readonly types: ReadonlySet<string>;
  readonly mineOnly: boolean;
}

export function applyFilter(
  projects: readonly OverviewProject[],
  filter: OverviewFilter,
): OverviewProject[] {
  return projects.filter(
    (p) =>
      (filter.types.size === 0 || filter.types.has(p.workTypeCode)) && (!filter.mineOnly || p.mine),
  );
}

/** Aperto e lavorabile: né chiuso né in Pending (in attesa, non si pianifica). */
export function isActive(p: OverviewProject): boolean {
  return !p.closed && p.statusCode !== PENDING;
}

export function isPlanned(p: OverviewProject): boolean {
  return p.daysAhead > 0;
}

export interface OverviewSummary {
  readonly open: number;
  readonly inProgress: number;
  readonly pending: number;
  readonly planned: number;
  readonly toPlan: number;
  readonly toPlanTop: number;
  readonly daysAhead: number;
  readonly mismatches: number;
}

export function summary(projects: readonly OverviewProject[]): OverviewSummary {
  const open = projects.filter((p) => !p.closed);
  const toPlan = toPlanList(projects);
  return {
    open: open.length,
    inProgress: open.filter((p) => p.statusCode === IN_PROGRESS).length,
    // Pending può essere uno stato "finale" nella lista valori (come in Jira): si conta comunque
    pending: projects.filter((p) => p.statusCode === PENDING).length,
    planned: projects.filter((p) => isActive(p) && isPlanned(p)).length,
    toPlan: toPlan.length,
    toPlanTop: toPlan.filter((p) => p.priorityLevel === 1).length,
    // Con una persona in vista, solo le sue giornate (si confrontano con la sua capacità)
    daysAhead: round(open.reduce((sum, p) => sum + p.focusDaysAhead, 0)),
    mismatches: mismatchCount(mismatches(projects)),
  };
}

export interface StatusSlice {
  readonly status: OverviewStatus;
  readonly count: number;
  readonly ids: readonly number[];
}

/** Progetti per stato, nell'ordine della lista valori; gli stati senza progetti restano fuori. */
export function byStatus(
  projects: readonly OverviewProject[],
  statuses: readonly OverviewStatus[],
): StatusSlice[] {
  return statuses
    .map((status) => {
      const ids = projects.filter((p) => p.statusId === status.id).map((p) => p.id);
      return { status, count: ids.length, ids };
    })
    .filter((slice) => slice.count > 0);
}

export interface PriorityRow {
  /** null = senza priorità. */
  readonly level: number | null;
  readonly label: string;
  readonly planned: readonly number[];
  readonly notPlanned: readonly number[];
  /** I da pianificare per stato (To Start è attesa normale, In Progress senza giornate è un problema). */
  readonly notPlannedByStatus: readonly StatusSlice[];
}

/**
 * Priorità × piano sui progetti attivi (né chiusi né in Pending): per ogni livello quanti hanno
 * giornate nell'orizzonte e quanti no, e in che stato sono quelli da pianificare. I livelli senza
 * progetti restano fuori.
 */
export function priorityMatrix(
  projects: readonly OverviewProject[],
  priorities: readonly OverviewPriority[],
  statuses: readonly OverviewStatus[] = [],
): PriorityRow[] {
  const active = projects.filter(isActive);
  const row = (level: number | null, label: string): PriorityRow => {
    const items = active.filter((p) => p.priorityLevel === level);
    const missing = items.filter((p) => !isPlanned(p));
    return {
      level,
      label,
      planned: items.filter(isPlanned).map((p) => p.id),
      notPlanned: missing.map((p) => p.id),
      notPlannedByStatus: byStatus(missing, statuses),
    };
  };
  return [
    ...priorities.map((p) => row(p.level, priorityName(p))),
    row(null, 'Senza priorità'),
  ].filter((r) => r.planned.length + r.notPlanned.length > 0);
}

/** "Priorità 1"; con un nome diverso dal numero, "P1 · Importante". */
export function priorityName(p: OverviewPriority): string {
  const label = p.label.trim();
  return !label || label === String(p.level) ? `Priorità ${p.level}` : `P${p.level} · ${label}`;
}

/**
 * Da pianificare: attivi senza giornate nell'orizzonte, dalla priorità più alta (senza priorità in
 * fondo), poi per ranking e nome.
 */
export function toPlanList(projects: readonly OverviewProject[]): OverviewProject[] {
  return projects
    .filter((p) => isActive(p) && !isPlanned(p))
    .sort(
      (a, b) =>
        (a.priorityLevel ?? 99) - (b.priorityLevel ?? 99) ||
        (a.ranking ?? Number.MAX_SAFE_INTEGER) - (b.ranking ?? Number.MAX_SAFE_INTEGER) ||
        a.name.localeCompare(b.name, 'it'),
    );
}

export type ToPlanSortKey =
  | 'name'
  | 'owner'
  | 'priority'
  | 'business'
  | 'ranking'
  | 'status'
  | 'system'
  | 'type'
  | 'past'
  | 'plan';

export interface ToPlanSort {
  readonly key: ToPlanSortKey;
  readonly desc: boolean;
}

/** Ordinamento di partenza dei da pianificare: dalla priorità più importante. */
export const TO_PLAN_DEFAULT_SORT: ToPlanSort = { key: 'priority', desc: false };

/** Peso di cosa dice il piano: prima i mai pianificati (i più scoperti), poi finiti, poi più avanti. */
function planRank(p: OverviewProject): number {
  return p.daysLater > 0 ? 2 : p.lastPlannedWeek ? 1 : 0;
}

/**
 * Ordina i da pianificare per colonna. A parità, sempre priorità (senza priorità in fondo), ranking
 * e nome, così l'ordine resta stabile.
 */
export function sortToPlan(
  projects: readonly OverviewProject[],
  sort: ToPlanSort,
  statuses: readonly OverviewStatus[] = [],
): OverviewProject[] {
  const statusOrder = new Map(statuses.map((s, i) => [s.id, i]));
  const byKey = (a: OverviewProject, b: OverviewProject): number => {
    switch (sort.key) {
      case 'name':
        return a.name.localeCompare(b.name, 'it');
      case 'priority':
        return (a.priorityLevel ?? 99) - (b.priorityLevel ?? 99);
      case 'status':
        return (statusOrder.get(a.statusId) ?? 99) - (statusOrder.get(b.statusId) ?? 99);
      case 'system':
        return (a.systemLabel ?? '￿').localeCompare(b.systemLabel ?? '￿', 'it');
      case 'owner':
        return (a.owners ?? '￿').localeCompare(b.owners ?? '￿', 'it');
      case 'business':
        return (a.businessPriorityLevel ?? 99) - (b.businessPriorityLevel ?? 99);
      case 'ranking':
        return (a.ranking ?? Number.MAX_SAFE_INTEGER) - (b.ranking ?? Number.MAX_SAFE_INTEGER);
      case 'type':
        return a.workTypeLabel.localeCompare(b.workTypeLabel, 'it');
      case 'past':
        return a.daysPast - b.daysPast;
      case 'plan':
        return planRank(a) - planRank(b);
    }
  };
  const sign = sort.desc ? -1 : 1;
  const base = toPlanList(projects);
  return [...base].sort((a, b) => sign * byKey(a, b) || base.indexOf(a) - base.indexOf(b));
}

export interface WorkItem {
  readonly label: string;
  readonly value: number;
}

/** Dove va il lavoro: giornate nell'orizzonte per progetto (i più carichi) o per sistema. */
export function workByProject(projects: readonly OverviewProject[], limit = 10): WorkItem[] {
  return projects
    .filter((p) => p.daysAhead > 0)
    .sort((a, b) => b.daysAhead - a.daysAhead || a.name.localeCompare(b.name, 'it'))
    .slice(0, limit)
    .map((p) => ({ label: p.name, value: round(p.daysAhead) }));
}

export function workBySystem(projects: readonly OverviewProject[]): WorkItem[] {
  const totals = new Map<string, number>();
  for (const p of projects) {
    if (p.daysAhead > 0) {
      const key = p.systemLabel ?? 'Senza sistema';
      totals.set(key, (totals.get(key) ?? 0) + p.daysAhead);
    }
  }
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value: round(value) }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'it'));
}

export interface Mismatches {
  /** In Progress senza giornate nell'orizzonte. */
  readonly inProgressWithoutPlan: readonly OverviewProject[];
  /** To Start o Approved con giornate già questa settimana: lo stato va aggiornato. */
  readonly startedNotInProgress: readonly OverviewProject[];
  /**
   * In Pending con giornate ancora nel piano (da qui in avanti). I chiusi davvero (Completed, Rejected,
   * Aborted) non generano mai avvisi: contano solo come chiusure.
   */
  readonly pendingWithPlan: readonly OverviewProject[];
}

export function mismatches(projects: readonly OverviewProject[]): Mismatches {
  return {
    inProgressWithoutPlan: projects.filter((p) => p.statusCode === IN_PROGRESS && !isPlanned(p)),
    startedNotInProgress: projects.filter(
      (p) => NOT_STARTED.has(p.statusCode) && p.daysThisWeek > 0,
    ),
    pendingWithPlan: projects.filter(
      (p) => p.statusCode === PENDING && p.daysAhead + p.daysLater > 0,
    ),
  };
}

export function mismatchCount(m: Mismatches): number {
  return m.inProgressWithoutPlan.length + m.startedNotInProgress.length + m.pendingWithPlan.length;
}

/** Cosa dice il piano di un progetto da pianificare: più avanti, finito, mai pianificato. */
export function planHint(p: OverviewProject): string {
  if (p.daysLater > 0) {
    return `più avanti: ${round(p.daysLater)} gg`;
  }
  if (p.lastPlannedWeek) {
    return 'piano finito';
  }
  return 'mai pianificato';
}

/**
 * Colore di uno stato: quello della lista valori o, se manca, uno per famiglia di stato (da
 * avviare azzurri, In Progress blu, in attesa arancio, completati verdi, abortiti/respinti grigi).
 */
export function statusColor(status: OverviewStatus): string {
  if (status.color) {
    return status.color;
  }
  switch (status.code) {
    case 'TO_START':
      return 'color-mix(in srgb, var(--mat-sys-primary) 35%, var(--mat-sys-surface))';
    case 'APPROVED':
      return 'color-mix(in srgb, var(--mat-sys-primary) 65%, var(--mat-sys-surface))';
    case IN_PROGRESS:
      return 'var(--mat-sys-primary)';
    case PENDING:
      return 'var(--gi-warning)';
    case 'COMPLETED':
      return 'var(--gi-ok)';
    default:
      return 'var(--mat-sys-outline)';
  }
}

export interface Completions {
  /** Completati, dal più recente; quelli senza data in fondo. */
  readonly items: readonly OverviewProject[];
  /** Completati con la data di chiusura nota negli ultimi 30 giorni (da `today`). */
  readonly last30: number;
  readonly withDate: number;
}

/**
 * Chiusure: i Completed come statistica (quanti e quando). Non entrano in nessun avviso.
 * `today` in aaaa-mm-gg.
 */
export function completions(projects: readonly OverviewProject[], today: string): Completions {
  const items = projects
    .filter((p) => p.statusCode === COMPLETED)
    .sort(
      (a, b) =>
        (b.closedOn ?? '').localeCompare(a.closedOn ?? '') || a.name.localeCompare(b.name, 'it'),
    );
  const from = new Date(`${today}T00:00:00`);
  from.setDate(from.getDate() - 30);
  const since = from.toISOString().slice(0, 10);
  return {
    items,
    last30: items.filter((p) => p.closedOn !== null && p.closedOn >= since).length,
    withDate: items.filter((p) => p.closedOn !== null).length,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
