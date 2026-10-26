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

/**
 * Unità in cui si vede e si scrive il piano: giornate o ore. Il piano resta salvato in giornate
 * da {@link HOURS_PER_DAY} ore (come la capacità, D-14): cambia solo come lo si legge e lo si scrive.
 */
export type PlanUnit = 'days' | 'hours';

/** Ore di una giornata del piano: la stessa per tutti, a prescindere dalle ore al giorno della persona. */
export const HOURS_PER_DAY = 7.5;

/** Valore del piano (giornate) nell'unità scelta. */
export function toUnit(days: number, unit: PlanUnit): number {
  return unit === 'hours' ? days * HOURS_PER_DAY : days;
}

/** Arrotonda a quattro decimali: 1 ora = 0,1333 giornate, e le ore tornano esatte. */
export function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Somma senza artefatti dei decimali (0,1 + 0,2 = 0,3), a quattro decimali. */
export function sumDays(values: readonly number[]): number {
  return round4(values.reduce((total, value) => total + value, 0));
}

/**
 * Legge un valore scritto a mano nell'unità scelta ("1,5", "1.5", "" = 0) e lo restituisce in
 * giornate. Giornate da 0 a 7, ore da 0 a 52,5 (7 giornate), al massimo due decimali. Null se non valido.
 */
export function parseQuantity(text: string, unit: PlanUnit): number | null {
  const clean = text.trim().replace(',', '.');
  if (clean === '') {
    return 0;
  }
  const pattern = unit === 'hours' ? /^\d{0,2}(\.\d{0,2})?$/ : /^\d{0,1}(\.\d{0,2})?$/;
  if (!pattern.test(clean) || clean === '.') {
    return null;
  }
  const value = Number(clean);
  const days = unit === 'hours' ? value / HOURS_PER_DAY : value;
  return value >= 0 && days <= 7 + 1e-9 ? round4(Math.min(days, 7)) : null;
}

/** Giornate scritte a mano (compatibilità): come {@link parseQuantity} in giornate. */
export function parseDays(text: string): number | null {
  return parseQuantity(text, 'days');
}

/** Testo per l'errore di inserimento, secondo l'unità. */
export function quantityHint(unit: PlanUnit): string {
  return unit === 'hours'
    ? 'Ore da 0 a 52,5, al massimo due decimali (es. 1,5)'
    : 'Giornate da 0 a 7, al massimo due decimali (es. 0,25)';
}
