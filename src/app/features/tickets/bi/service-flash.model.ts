import { BiTicket, Count, UNASSIGNED, areaOf, assigneeOf, countBy } from './bi.model';

/**
 * Flash del servizio: in un periodo, chi ha chiuso i ticket, per chi, a che ora e su cosa.
 * Si calcola nel browser dai ticket già caricati (come la BI), senza chiamate in più.
 */
export type FlashPeriod = 'today' | 'previous' | '7' | '15' | '30' | '60' | '90';

export const FLASH_PERIODS: readonly FlashPeriod[] = [
  'today',
  'previous',
  '7',
  '15',
  '30',
  '60',
  '90',
];

export const NO_REPORTER = '(non indicato)';

const DAY = 24 * 60 * 60 * 1000;
/** Oltre questi giorni il grafico per giorno diventa per settimana. */
const MAX_DAILY_BARS = 35;
const TOP_REQUESTERS = 6;

export function isFlashPeriod(value: string | null | undefined): value is FlashPeriod {
  return FLASH_PERIODS.includes(value as FlashPeriod);
}

export interface FlashWindow {
  /** Millisecondi: l'inizio è compreso, la fine no. */
  readonly start: number;
  readonly end: number;
  /** Giorno singolo (oggi, ieri) o intervallo di più giorni. */
  readonly singleDay: boolean;
  /** Giorni lavorativi (lun–ven) toccati dal periodo. */
  readonly workingDays: number;
}

export interface FlashWindows {
  readonly current: FlashWindow;
  /** Periodo di confronto: la giornata lavorativa prima, o i giorni subito prima. Assente per "oggi". */
  readonly before: FlashWindow | null;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isWeekend(date: Date): boolean {
  return date.getDay() === 0 || date.getDay() === 6;
}

/** L'ultima giornata lavorativa prima di {@code from} (sabato e domenica non contano). */
export function previousWorkingDay(from: Date): Date {
  const day = startOfDay(from);
  do {
    day.setDate(day.getDate() - 1);
  } while (isWeekend(day));
  return day;
}

function workingDaysBetween(start: number, end: number): number {
  let count = 0;
  const day = startOfDay(new Date(start));
  while (day.getTime() < end) {
    if (!isWeekend(day)) {
      count++;
    }
    day.setDate(day.getDate() + 1);
  }
  return count;
}

function windowOf(start: number, end: number, singleDay: boolean): FlashWindow {
  return { start, end, singleDay, workingDays: workingDaysBetween(start, end) };
}

function wholeDay(day: Date): FlashWindow {
  const start = startOfDay(day);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  return windowOf(start.getTime(), end.getTime(), true);
}

/**
 * Finestre di tempo del periodo scelto. Gli ultimi N giorni contano a ritroso da adesso (come
 * l'indicatore "in 7 giorni" della pagina operativa); "ieri" è l'ultima giornata lavorativa,
 * oppure il giorno {@code day} se la pagina di partenza lo indica.
 */
export function flashWindows(period: FlashPeriod, now: Date, day?: string | null): FlashWindows {
  if (period === 'today') {
    return { current: windowOf(startOfDay(now).getTime(), now.getTime(), true), before: null };
  }
  if (period === 'previous') {
    const parsed = day ? new Date(`${day}T00:00:00`) : null;
    const target =
      parsed && !Number.isNaN(parsed.getTime()) ? parsed : previousWorkingDay(startOfDay(now));
    return { current: wholeDay(target), before: wholeDay(previousWorkingDay(target)) };
  }
  const span = Number(period) * DAY;
  const start = now.getTime() - span;
  return {
    current: windowOf(start, now.getTime(), false),
    before: windowOf(start - span, start, false),
  };
}

function within(iso: string | null, window: FlashWindow): boolean {
  if (!iso) {
    return false;
  }
  const time = new Date(iso).getTime();
  return time >= window.start && time < window.end;
}

export interface HourBar {
  readonly hour: number;
  readonly created: number;
  readonly resolved: number;
}

export interface DayBar {
  readonly label: string;
  readonly title: string;
  readonly created: number;
  readonly resolved: number;
  readonly weekend: boolean;
  /** Millisecondi: la fascia del giorno (o della settimana); la fine non è compresa. */
  readonly start: number;
  readonly end: number;
}

/** Quanti ticket di un richiedente sono stati chiusi da ciascuna persona. */
export interface ServiceMatrix {
  readonly requesters: readonly string[];
  readonly rows: readonly {
    readonly person: string;
    readonly cells: readonly number[];
    readonly total: number;
  }[];
  readonly max: number;
}

export interface RequesterLine {
  readonly name: string;
  readonly resolved: number;
  readonly created: number;
}

export interface Flash {
  readonly created: number;
  readonly resolved: number;
  /** Chi ha chiuso, dal più attivo. */
  readonly closedBy: readonly Count[];
  /** Per chi: richiedenti dei ticket chiusi, con quanti ne hanno aperti nel periodo. */
  readonly requesters: readonly RequesterLine[];
  readonly matrix: ServiceMatrix;
  readonly hours: readonly HourBar[];
  readonly days: readonly DayBar[];
  readonly dailyBars: boolean;
  /** Su cosa: Progetto Marlù dei ticket chiusi. */
  readonly areas: readonly Count[];
  readonly medianDays: number | null;
  /** Percentuale di chiusi entro 24 ore dall'apertura (0–100), null se non ne è stato chiuso nessuno. */
  readonly within24h: number | null;
  readonly requesterCount: number;
  readonly personCount: number;
  /** Chiusi al giorno lavorativo. */
  readonly perWorkingDay: number | null;
}

export function reporterOf(ticket: BiTicket): string {
  return ticket.reporter ?? NO_REPORTER;
}

export function serviceFlash(tickets: readonly BiTicket[], window: FlashWindow, now: Date): Flash {
  const created = tickets.filter((ticket) => within(ticket.created, window));
  const resolved = tickets.filter((ticket) => within(ticket.resolved, window));

  const closedBy = countBy(resolved, assigneeOf);
  const requesters = requesterLines(created, resolved);
  const hours = hourBars(created, resolved);
  const bars = dayBars(created, resolved, window, now);

  return {
    created: created.length,
    resolved: resolved.length,
    closedBy,
    requesters,
    matrix: matrixOf(resolved, closedBy, requesters),
    hours,
    days: bars.bars,
    dailyBars: bars.daily,
    areas: countBy(resolved, areaOf),
    medianDays: median(resolved.map(daysToResolve)),
    within24h: share(resolved, (ticket) => daysToResolve(ticket) <= 1),
    requesterCount: new Set(resolved.map(reporterOf)).size,
    personCount: new Set(resolved.map(assigneeOf).filter((name) => name !== UNASSIGNED)).size,
    perWorkingDay:
      window.workingDays > 0 ? Math.round((resolved.length / window.workingDays) * 10) / 10 : null,
  };
}

function daysToResolve(ticket: BiTicket): number {
  const from = new Date(ticket.created).getTime();
  const to = new Date(ticket.resolved ?? ticket.created).getTime();
  return Math.max(0, (to - from) / DAY);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return Math.round(value * 10) / 10;
}

function share(list: readonly BiTicket[], test: (ticket: BiTicket) => boolean): number | null {
  return list.length === 0 ? null : Math.round((list.filter(test).length / list.length) * 100);
}

function requesterLines(
  created: readonly BiTicket[],
  resolved: readonly BiTicket[],
): RequesterLine[] {
  const opened = new Map(countBy(created, reporterOf).map((c) => [c.label, c.value]));
  return countBy(resolved, reporterOf).map((c) => ({
    name: c.label,
    resolved: c.value,
    created: opened.get(c.label) ?? 0,
  }));
}

function matrixOf(
  resolved: readonly BiTicket[],
  people: readonly Count[],
  requesters: readonly RequesterLine[],
): ServiceMatrix {
  const top = requesters.slice(0, TOP_REQUESTERS).map((line) => line.name);
  const hasOthers = requesters.length > top.length;
  const names = hasOthers ? [...top, 'Altri'] : top;
  let max = 0;
  const rows = people.map((person) => {
    const mine = resolved.filter((ticket) => assigneeOf(ticket) === person.label);
    const cells = names.map((name) =>
      name === 'Altri' && hasOthers
        ? mine.filter((ticket) => !top.includes(reporterOf(ticket))).length
        : mine.filter((ticket) => reporterOf(ticket) === name).length,
    );
    max = Math.max(max, ...cells);
    return { person: person.label, cells, total: mine.length };
  });
  return { requesters: names, rows, max };
}

/** Ora per ora (ora locale): quando arrivano e quando si chiudono i ticket. Almeno dalle 8 alle 19. */
function hourBars(created: readonly BiTicket[], resolved: readonly BiTicket[]): HourBar[] {
  const opened = new Array<number>(24).fill(0);
  const closed = new Array<number>(24).fill(0);
  for (const ticket of created) {
    opened[new Date(ticket.created).getHours()]++;
  }
  for (const ticket of resolved) {
    closed[new Date(ticket.resolved ?? ticket.created).getHours()]++;
  }
  let first = 8;
  let last = 19;
  for (let hour = 0; hour < 24; hour++) {
    if (opened[hour] > 0 || closed[hour] > 0) {
      first = Math.min(first, hour);
      last = Math.max(last, hour);
    }
  }
  const bars: HourBar[] = [];
  for (let hour = first; hour <= last; hour++) {
    bars.push({ hour, created: opened[hour], resolved: closed[hour] });
  }
  return bars;
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'numeric' });
}

/** Giorno per giorno (fino a 35 giorni) o settimana per settimana (dal lunedì) per i periodi lunghi. */
function dayBars(
  created: readonly BiTicket[],
  resolved: readonly BiTicket[],
  window: FlashWindow,
  now: Date,
): { bars: DayBar[]; daily: boolean } {
  if (window.singleDay) {
    return { bars: [], daily: true };
  }
  const first = startOfDay(new Date(window.start));
  const last = startOfDay(new Date(Math.min(window.end, now.getTime() + 1) - 1));
  const spanDays = Math.round((last.getTime() - first.getTime()) / DAY) + 1;
  const daily = spanDays <= MAX_DAILY_BARS;
  const keyOf = (iso: string): string => {
    const date = startOfDay(new Date(iso));
    if (!daily) {
      date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    }
    return date.toDateString();
  };
  const opened = new Map<string, number>();
  const closed = new Map<string, number>();
  for (const ticket of created) {
    opened.set(keyOf(ticket.created), (opened.get(keyOf(ticket.created)) ?? 0) + 1);
  }
  for (const ticket of resolved) {
    const key = keyOf(ticket.resolved ?? ticket.created);
    closed.set(key, (closed.get(key) ?? 0) + 1);
  }
  const bars: DayBar[] = [];
  const cursor = new Date(first);
  if (!daily) {
    cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  }
  while (cursor.getTime() <= last.getTime()) {
    const key = cursor.toDateString();
    const end = new Date(cursor);
    end.setDate(end.getDate() + 6);
    bars.push({
      label: dayLabel(cursor),
      title: daily
        ? cursor.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
        : `settimana dal ${dayLabel(cursor)} al ${dayLabel(end)}`,
      created: opened.get(key) ?? 0,
      resolved: closed.get(key) ?? 0,
      weekend: daily && isWeekend(cursor),
      start: cursor.getTime(),
      end: new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate() + (daily ? 1 : 7),
      ).getTime(),
    });
    cursor.setDate(cursor.getDate() + (daily ? 1 : 7));
  }
  return { bars, daily };
}
