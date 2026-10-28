/** Consuntivo delle ore (D-37): la settimana di una persona come arriva dal backend. */
export type WeekStatus = 'OPEN' | 'CONFIRMED' | 'LOCKED' | 'FUTURE';
export type RowKind = 'PROJECT' | 'VACATION' | 'HOLIDAY';

export interface ActualDay {
  readonly date: string;
  readonly weekend: boolean;
  readonly future: boolean;
  readonly editable: boolean;
  readonly holidayName: string | null;
  readonly theoreticalHours: number;
  readonly loggedHours: number;
  /** Ore di progetto oltre l'orario della persona: si segnala, non si blocca. */
  readonly over: boolean;
}

export interface ActualRow {
  readonly planRowId: number | null;
  readonly kind: RowKind;
  readonly projectId: number | null;
  readonly projectCode: string | null;
  readonly projectName: string;
  readonly workType: string | null;
  readonly rowNote: string | null;
  readonly plannedHours: number;
  readonly hoursByDay: Readonly<Record<string, number>>;
  readonly actualHours: number;
  readonly deltaHours: number;
  /** Ferie e festività: consuntivo = piano, senza inserire nulla. */
  readonly automatic: boolean;
}

export interface ActualWeek {
  readonly resourceId: number;
  readonly resourceName: string;
  readonly weekStart: string;
  readonly isoWeek: number;
  readonly status: WeekStatus;
  readonly statusMessage: string | null;
  readonly canEdit: boolean;
  readonly canConfirm: boolean;
  readonly canReopen: boolean;
  readonly confirmedAt: string | null;
  readonly confirmedByName: string | null;
  readonly days: readonly ActualDay[];
  readonly rows: readonly ActualRow[];
  readonly totals: {
    readonly plannedHours: number;
    readonly actualHours: number;
    readonly deltaHours: number;
    readonly theoreticalHours: number;
  };
}

/** Colonne a scelta della tabella (le tre principali ci sono sempre). */
export type ActualColumn = 'code' | 'workType' | 'note' | 'days' | 'delta';

export const ACTUAL_COLUMNS: readonly { readonly id: ActualColumn; readonly label: string }[] = [
  { id: 'code', label: 'Codice progetto' },
  { id: 'workType', label: 'Tipo' },
  { id: 'note', label: 'Nota della riga' },
  { id: 'delta', label: 'Scarto (consuntivo − piano)' },
  { id: 'days', label: 'Ore giorno per giorno' },
];

export const DEFAULT_COLUMNS: readonly ActualColumn[] = ['code', 'delta'];

export type ActualSortKey = 'project' | 'planned' | 'actual' | 'delta';

const WEEKDAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

/** "mer 28/10" da una data ISO. */
export function dayLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return `${WEEKDAYS[date.getDay()]} ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Lunedì della settimana della data, in ISO. */
export function mondayOf(date: Date): string {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return isoDate(monday);
}

export function addWeeks(iso: string, weeks: number): string {
  return addDays(iso, weeks * 7);
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Giorno proposto per consuntivare: oggi se è nella settimana e modificabile, altrimenti l'ultimo
 * giorno feriale modificabile (es. venerdì della settimana scorsa), altrimenti il primo giorno.
 */
export function defaultDay(week: ActualWeek, today: string): string {
  const editable = week.days.filter((day) => day.editable);
  if (editable.some((day) => day.date === today)) {
    return today;
  }
  const workdays = editable.filter((day) => !day.weekend);
  return (workdays.at(-1) ?? editable.at(-1) ?? week.days[0]).date;
}

/**
 * Livello dello scarto di una riga: "over" se il consuntivo supera il piano, "under" se a fine
 * settimana (da giovedì in poi, o settimana passata) manca ancora molto, altrimenti niente.
 */
export function deltaLevel(
  row: Pick<ActualRow, 'plannedHours' | 'actualHours' | 'automatic'>,
  lateInWeek: boolean,
): 'over' | 'under' | 'none' {
  if (row.automatic) {
    return 'none';
  }
  if (row.actualHours > row.plannedHours + 0.001) {
    return 'over';
  }
  return lateInWeek && row.plannedHours - row.actualHours >= 4 ? 'under' : 'none';
}

/** Ore leggibili: "7,5" o "—" se zero. */
export function hoursText(value: number, dash = true): string {
  if (dash && Math.abs(value) < 0.005) {
    return '—';
  }
  return value.toLocaleString('it-IT', { maximumFractionDigits: 2 });
}

/** Scarto con il segno: "+2", "−1,5", "0". */
export function signedHours(value: number): string {
  if (Math.abs(value) < 0.005) {
    return '0';
  }
  const text = Math.abs(value).toLocaleString('it-IT', { maximumFractionDigits: 2 });
  return value > 0 ? `+${text}` : `−${text}`;
}

/** Ore scritte dall'utente ("1,5", "1.5", "2") in numero; null se non valide. */
export function parseHours(text: string): number | null {
  const clean = text.trim().replace(',', '.');
  if (clean === '') {
    return 0;
  }
  const value = Number(clean);
  return Number.isFinite(value) && value >= 0 && value <= 24 ? Math.round(value * 100) / 100 : null;
}
