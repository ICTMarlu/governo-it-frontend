/** Piano settimanale come arriva dalle API (PLN-01). Quantità in giornate da 7,5 ore. */

export interface PlanWeek {
  readonly weekStart: string;
  readonly isoWeek: number;
  readonly isoYear: number;
  readonly current: boolean;
}

export interface PlanCell {
  readonly weekStart: string;
  readonly days: number;
  readonly note: string | null;
}

export interface PlanRow {
  /** Null per la riga Ferie non ancora creata: nasce alla prima giornata. */
  readonly id: number | null;
  readonly resourceId: number;
  readonly projectId: number;
  readonly projectCode: string | null;
  readonly projectName: string;
  readonly workTypeCode: string;
  readonly workTypeLabel: string;
  readonly mainSystemLabel: string | null;
  /** Ordine del sistema nella lista valori Sistemi. */
  readonly mainSystemSortOrder: number | null;
  /** Ranking del progetto: decide l'ordine dei progetti nel piano (1 il primo). */
  readonly ranking: number | null;
  readonly statusCode: string | null;
  readonly statusLabel: string | null;
  readonly statusSortOrder: number;
  readonly statusColor: string | null;
  readonly statusTerminal: boolean;
  /** Priorità IT del progetto (1 la più importante). */
  readonly itPriorityLevel: number | null;
  readonly businessPriorityLevel: number | null;
  /** Owner del progetto (il principale per primo) e richiedenti. */
  readonly ownerNames: readonly string[];
  readonly requesterNames: readonly string[];
  readonly rowNote: string | null;
  readonly sortOrder: number;
  readonly archived: boolean;
  readonly vacation: boolean;
  readonly cells: readonly PlanCell[];
  /** Giornate dell'anno solare in corso. */
  readonly yearTotal: number;
  /** Giornate di tutte le settimane della riga. */
  readonly totalDays: number;
  readonly version: string | null;
}

export interface ResourceWeek {
  readonly weekStart: string;
  readonly theoretical: number;
  readonly extra: number;
  readonly capacity: number;
  readonly holidays: number;
  readonly holidayNames: readonly string[];
}

export interface ResourcePlan {
  readonly resourceId: number;
  readonly name: string;
  readonly siteName: string | null;
  /** Calendario delle festività della sede (es. San Marino). */
  readonly holidayCalendarName: string | null;
  readonly hoursPerDay: number | null;
  readonly workingDaysPerWeek: number | null;
  readonly active: boolean;
  readonly rows: readonly PlanRow[];
  readonly weeks: readonly ResourceWeek[];
}

export interface Plan {
  readonly weeks: readonly PlanWeek[];
  readonly year: number;
  readonly vacationProjectId: number | null;
  readonly holidayProjectId: number | null;
  readonly resources: readonly ResourcePlan[];
}

export interface CellsResult {
  readonly rowId: number;
  readonly rowVersion: string;
  readonly cells: readonly PlanCell[];
}

/** Stati esclusi per default oltre a quelli finali (Completed, Rejected, Aborted): non sono lavoro aperto. */
export const NOT_OPEN_STATUSES: readonly string[] = ['PENDING'];

/** Stato aperto: né finale né tra quelli esclusi (es. To Start, Approved, In Progress). */
export function isOpenStatus(code: string | null, terminal: boolean): boolean {
  return !terminal && (code === null || !NOT_OPEN_STATUSES.includes(code));
}

/** Soglie della saturazione (allocato ÷ capacità): verde sotto, giallo fino a 100%, rosso oltre. */
export const SATURATION_WARNING = 0.9;

export type SaturationLevel = 'free' | 'full' | 'over' | 'none';

export function saturationLevel(allocated: number, capacity: number): SaturationLevel {
  if (capacity <= 0) {
    return allocated > 0 ? 'over' : 'none';
  }
  const ratio = allocated / capacity;
  return ratio > 1.0001 ? 'over' : ratio >= SATURATION_WARNING ? 'full' : 'free';
}

/** Somma senza artefatti dei decimali (0,1 + 0,2 = 0,3). */
export function sumDays(values: readonly number[]): number {
  return Math.round(values.reduce((total, value) => total + value * 100, 0)) / 100;
}

/** Legge un valore scritto a mano: "1,5", "1.5", "" (= 0). Null se non valido. */
export function parseDays(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (clean === '') {
    return 0;
  }
  if (!/^\d{0,1}(\.\d{0,2})?$/.test(clean) || clean === '.') {
    return null;
  }
  const value = Number(clean);
  return value >= 0 && value <= 7 ? value : null;
}
