import { PlanCell, PlanRow, ResourcePlan, SaturationLevel } from './plan.model';

/** Riga mostrata nella griglia, con le celle per settimana e la posizione per la tastiera. */
export interface GridRow {
  readonly row: PlanRow;
  readonly cells: Readonly<Record<string, PlanCell>>;
  /** Totale della colonna Tot: tutte le settimane per i Project, l'anno solare per gli altri. */
  readonly total: number;
  /** Indice progressivo tra le righe visibili: frecce e Invio si spostano in verticale. */
  readonly nav: number;
}

export interface GridWeekTotal {
  readonly weekStart: string;
  readonly holidays: number;
  readonly holidayNames: readonly string[];
  readonly allocated: number;
  readonly capacity: number;
  readonly level: SaturationLevel;
  readonly percent: number | null;
}

export interface GridGroup {
  readonly resource: ResourcePlan;
  readonly rows: readonly GridRow[];
  readonly totals: readonly GridWeekTotal[];
  /** Giornate della persona nell'anno solare (tutte le righe). */
  readonly yearAllocated: number;
}

/** Riga con la persona a cui appartiene (le azioni sulla cella usano la persona). */
export interface GridEntry {
  readonly group: GridGroup;
  readonly gridRow: GridRow;
}

/** Raggruppamento delle righe: per persona, per persona e poi sistema, oppure per sistema. */
export type PlanGrouping = 'person' | 'personSystem' | 'system';

export const GROUPING_LABELS: Readonly<Record<PlanGrouping, string>> = {
  person: 'Persona',
  personSystem: 'Persona e sistema',
  system: 'Sistema',
};

/** Etichetta dei progetti senza sistema (es. AMS su più sistemi). */
export const NO_SYSTEM_LABEL = 'Più sistemi o nessuno';

/** Gruppo di righe dello stesso sistema, con i totali per settimana (mostrati da chiuso). */
export interface GridSection {
  readonly key: string;
  readonly label: string;
  readonly entries: readonly GridEntry[];
  /** Righe del gruppo (per le festività: una per persona). */
  readonly rowCount: number;
  readonly weekTotals: Readonly<Record<string, number>>;
  readonly total: number;
}

/** Festività di un calendario nazionale per settimana: quante e quali. */
export interface HolidayCalendarRow {
  readonly name: string;
  readonly weeks: Readonly<
    Record<string, { readonly days: number; readonly names: readonly string[] }>
  >;
}

/** Vista per sistema: le festività, una riga per calendario delle persone mostrate. */
export interface HolidaySection extends GridSection {
  readonly calendars: readonly HolidayCalendarRow[];
}

/** Somma per settimana delle giornate delle righe. */
export function weekTotalsOf(entries: readonly GridEntry[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const { gridRow } of entries) {
    for (const [week, cell] of Object.entries(gridRow.cells)) {
      totals[week] = Math.round(((totals[week] ?? 0) + cell.days) * 100) / 100;
    }
  }
  return totals;
}

/** Sistema della riga per raggruppare: senza sistema in fondo. */
export function systemOf(row: PlanRow): string {
  return row.mainSystemLabel ?? NO_SYSTEM_LABEL;
}

/**
 * Confronto per sistema: nell'ordine della lista valori Sistemi (es. Ricorrenti per primo), a
 * parità in ordine alfabetico; i senza sistema in fondo.
 */
export function compareSystems(a: PlanRow, b: PlanRow): number {
  const x = a.mainSystemLabel;
  const y = b.mainSystemLabel;
  if (x === y) {
    return 0;
  }
  if (x === null) {
    return 1;
  }
  if (y === null) {
    return -1;
  }
  return (
    (a.mainSystemSortOrder ?? 0) - (b.mainSystemSortOrder ?? 0) ||
    x.localeCompare(y, 'it', { sensitivity: 'base' })
  );
}

/** Sistema con i progetti ricorrenti (AMS e Continuous): sta sempre in cima al piano. */
const PINNED_SYSTEM = /ricorrent/i;

/** Ranking del progetto: chi non ce l'ha va dopo chi ce l'ha. */
function rankOf(entry: GridEntry): number {
  return entry.gridRow.row.ranking ?? Number.POSITIVE_INFINITY;
}

/**
 * Righe (già ordinate per sistema) divise per sistema, con i totali per settimana. L'ordine lo
 * decide l'ordine ricevuto (ordinamento scelto, poi Ranking, poi alfabetico): i sistemi seguono il
 * loro progetto migliore (ranking più basso) e i ricorrenti (AMS) restano sempre in cima.
 */
export function buildSections(entries: readonly GridEntry[], keyPrefix: string): GridSection[] {
  const sections = new Map<string, GridEntry[]>();
  for (const entry of entries) {
    const label = systemOf(entry.gridRow.row);
    sections.set(label, [...(sections.get(label) ?? []), entry]);
  }
  return [...sections.entries()]
    .map(([label, items], position) => {
      // L'ordine di arrivo vale già: ordinamento scelto, poi ranking, poi alfabetico
      return { label, ordered: items, position, best: Math.min(...items.map(rankOf)) };
    })
    .sort(
      (a, b) =>
        Number(PINNED_SYSTEM.test(b.label)) - Number(PINNED_SYSTEM.test(a.label)) ||
        (a.best === b.best ? 0 : a.best < b.best ? -1 : 1) ||
        a.position - b.position,
    )
    .map(({ label, ordered }) => {
      const weekTotals = weekTotalsOf(ordered);
      const total = ordered.reduce((sum, { gridRow }) => sum + gridRow.total, 0);
      return {
        key: `${keyPrefix}|${label}`,
        label,
        entries: ordered,
        rowCount: ordered.length,
        weekTotals,
        total: Math.round(total * 100) / 100,
      };
    });
}

/** Valore di una cella che cambia, con il campo da riportare indietro se non valido. */
export interface CellChange {
  readonly group: GridGroup;
  readonly gridRow: GridRow;
  readonly weekStart: string;
  readonly input: HTMLInputElement;
}

const NUMBER = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });
const SHORT_DATE = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'numeric' });

/** Giornate in italiano (1,5); vuoto per 0. */
export function formatDays(days: number | undefined | null): string {
  return days ? NUMBER.format(days) : '';
}

/** Giorno e mese di una data ISO (aaaa-mm-gg), senza slittamenti di fuso. */
export function formatDay(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return SHORT_DATE.format(new Date(year, month - 1, day));
}

/** Totale fisso della riga (D-28): i Project contano tutte le settimane, gli altri l'anno solare. */
export function rowTotal(row: PlanRow): number {
  return row.workTypeCode === 'PROJECT' ? row.totalDays : row.yearTotal;
}

/** Codice · nome del progetto della riga. */
export function planRowLabel(row: PlanRow): string {
  return row.projectCode ? `${row.projectCode} · ${row.projectName}` : row.projectName;
}
