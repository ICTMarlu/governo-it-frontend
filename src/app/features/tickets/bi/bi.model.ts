import { TicketSync } from '../models/ticket.model';

/**
 * BI dei ticket (D-27): tutti i ticket copiati da Jira arrivano nel browser e qui si filtrano e
 * si aggregano, come con i filtri di Power BI. Le date sono lette nell'ora locale (Italia).
 */
export interface BiTicket {
  readonly key: string;
  readonly summary: string;
  readonly status: string;
  readonly category: 'NEW' | 'INDETERMINATE' | 'DONE';
  readonly pending: boolean;
  readonly waitingCustomer: boolean;
  readonly area: string | null;
  readonly requestType: string | null;
  readonly priority: string | null;
  readonly assignee: string | null;
  readonly resourceId: number | null;
  readonly reporter: string | null;
  readonly projectCode: string | null;
  readonly created: string;
  readonly resolved: string | null;
  readonly updated: string;
  readonly due: string | null;
  /** Impatto (campo Impact di Jira), es. "Significant / Large". */
  readonly impact: string | null;
  /** Quando il ticket è entrato nello stato attuale (cambio di categoria di stato in Jira). */
  readonly statusChanged: string | null;
}

export interface BiData {
  readonly sync: TicketSync;
  readonly pendingStatuses: readonly string[];
  readonly tickets: readonly BiTicket[];
}

/** Filtri in alto, comuni a tutte le pagine BI. null = tutti. */
export interface BiFilters {
  readonly areas: readonly string[] | null;
  readonly assignees: readonly string[] | null;
  /** Anni della data di creazione; null = tutti gli anni. */
  readonly years: readonly number[] | null;
  /** Mesi (1-12) della data di creazione; null = tutti. */
  readonly months: readonly number[] | null;
}

export interface Count {
  readonly label: string;
  readonly value: number;
}

export interface PeriodPoint {
  /** Periodo ancora in corso (es. la settimana di oggi): i numeri sono parziali. */
  readonly partial?: boolean;
  readonly label: string;
  /** Etichetta lunga per il riquadro con i numeri (es. "settimana del 19/10/2026"). */
  readonly title: string;
  readonly created: number;
  readonly resolved: number;
  /** Ticket lavorabili (aperti) a fine periodo. */
  readonly open: number;
}

export const NO_AREA = '(senza area)';
export const UNASSIGNED = 'Non assegnato';
export const MONTHS = [
  'gen',
  'feb',
  'mar',
  'apr',
  'mag',
  'giu',
  'lug',
  'ago',
  'set',
  'ott',
  'nov',
  'dic',
];
const PRIORITY_ORDER = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
const DAY = 24 * 60 * 60 * 1000;
/** Giorni di backlog (come Power BI): 3 settimane complete da 5 giorni lavorativi. */
export const BACKLOG_WEEKS = 3;
const WORKING_DAYS = 5;

export const AGING_BUCKETS: readonly { readonly label: string; readonly max: number }[] = [
  { label: '0–7 giorni', max: 7 },
  { label: '8–30 giorni', max: 30 },
  { label: '31–60 giorni', max: 60 },
  { label: '61–90 giorni', max: 90 },
  { label: '91–120 giorni', max: 120 },
  { label: 'oltre 120 giorni', max: Infinity },
];

export function areaOf(ticket: BiTicket): string {
  return ticket.area ?? NO_AREA;
}

export function assigneeOf(ticket: BiTicket): string {
  return ticket.assignee ?? UNASSIGNED;
}

/**
 * Ticket in attesa di risposta del cliente trattati come chiusi: chiusi dal giorno in cui sono
 * entrati in quello stato (se non si sa, dall'ultimo aggiornamento). Così contano tra i chiusi
 * del periodo e delle settimane, e non tra gli aperti.
 */
export function waitingAsClosed(tickets: readonly BiTicket[]): BiTicket[] {
  return tickets.map((ticket) =>
    ticket.waitingCustomer && ticket.category !== 'DONE'
      ? { ...ticket, category: 'DONE', resolved: ticket.statusChanged ?? ticket.updated }
      : ticket,
  );
}

/** Stato Jira "Awaiting approval": si aspetta l'approvazione, o va chiesta alla direzione. */
export function isAwaitingApproval(ticket: BiTicket): boolean {
  return ticket.status.trim().toLowerCase() === 'awaiting approval';
}

/** Stato Jira "Authorize": il ticket è stato autorizzato. */
export function isAuthorized(ticket: BiTicket): boolean {
  return ticket.status.trim().toLowerCase() === 'authorize';
}

export function isOpen(ticket: BiTicket): boolean {
  return ticket.category !== 'DONE';
}

/** Filtri su area e assegnatario (non sul periodo). */
export function inScope(ticket: BiTicket, filters: BiFilters): boolean {
  return (
    (filters.areas === null || filters.areas.includes(areaOf(ticket))) &&
    (filters.assignees === null || filters.assignees.includes(assigneeOf(ticket)))
  );
}

/** La data (ISO) cade nell'anno e nei mesi scelti. */
export function inPeriod(iso: string | null, filters: BiFilters): boolean {
  if (!iso) {
    return false;
  }
  const date = new Date(iso);
  return (
    (filters.years === null || filters.years.includes(date.getFullYear())) &&
    (filters.months === null || filters.months.includes(date.getMonth() + 1))
  );
}

/** Conteggio per valore, dal più frequente (a parità in ordine alfabetico). */
export function countBy(
  tickets: readonly BiTicket[],
  keyOf: (ticket: BiTicket) => string,
): Count[] {
  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    const key = keyOf(ticket);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'it'));
}

/** Voci dei grafici a barre da cui si può passare all'elenco dei ticket. */
export type DrillDimension =
  'area' | 'assignee' | 'reporter' | 'status' | 'priority' | 'aging' | 'requestType' | 'project';

export const DRILL_LABELS: Readonly<Record<DrillDimension, string>> = {
  area: 'Progetto Marlù',
  assignee: 'Assegnatario',
  reporter: 'Richiedente',
  status: 'Stato',
  priority: 'Priorità',
  aging: 'Anzianità',
  requestType: 'Tipo di richiesta',
  project: 'Progetto',
};

/** Vero se il ticket appartiene alla barra {@code value} del grafico {@code dim}. */
export function matchesDimension(
  ticket: BiTicket,
  dim: DrillDimension,
  value: string,
  now: Date,
): boolean {
  switch (dim) {
    case 'area':
      return areaOf(ticket) === value;
    case 'assignee':
      return assigneeOf(ticket) === value;
    case 'reporter':
      return (ticket.reporter ?? '(non indicato)') === value;
    case 'status':
      return ticket.status === value;
    case 'priority':
      return (ticket.priority ?? '(nessuna)') === value;
    case 'requestType':
      return (ticket.requestType ?? '(non indicato)') === value;
    case 'project':
      return ticket.projectCode === value;
    case 'aging': {
      const age = ageDays(ticket, now);
      return AGING_BUCKETS.find((bucket) => age <= bucket.max)?.label === value;
    }
  }
}

/** Priorità nell'ordine di Jira (da Highest a Lowest), non per frequenza. */
export function countByPriority(tickets: readonly BiTicket[]): Count[] {
  return countBy(tickets, (t) => t.priority ?? '(nessuna)').sort(
    (a, b) => rank(PRIORITY_ORDER, a.label) - rank(PRIORITY_ORDER, b.label),
  );
}

export function ageDays(ticket: BiTicket, now: Date): number {
  return Math.floor((now.getTime() - new Date(ticket.created).getTime()) / DAY);
}

/** Ticket aperti per anzianità, nelle fasce di Power BI. */
export function agingBuckets(tickets: readonly BiTicket[], now: Date): Count[] {
  const counts = AGING_BUCKETS.map((bucket) => ({ label: bucket.label, value: 0 }));
  for (const ticket of tickets) {
    const age = ageDays(ticket, now);
    counts[AGING_BUCKETS.findIndex((bucket) => age <= bucket.max)].value++;
  }
  return counts;
}

/**
 * Numeri della panoramica sui ticket creati nel periodo. Le percentuali di open, pending e
 * risolti fanno sempre 100 (arrotondamento con il metodo del resto più grande); quella degli
 * aperti è open + pending.
 */
export function overview(created: readonly BiTicket[]) {
  const open = created.filter(isOpen);
  const pending = open.filter((t) => t.pending).length;
  const workable = open.length - pending;
  const resolved = created.length - open.length;
  const [workablePct, pendingPct, resolvedPct] = percentsSummingTo100([
    workable,
    pending,
    resolved,
  ]);
  return {
    created: created.length,
    open: open.length,
    openWorkable: workable,
    pending,
    resolved,
    openPct: workablePct + pendingPct,
    openWorkablePct: workablePct,
    pendingPct,
    resolvedPct,
  };
}

/** Percentuali intere che sommano a 100: arrotonda per difetto e dà i punti mancanti ai resti più grandi. */
export function percentsSummingTo100(values: readonly number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total === 0) {
    return values.map(() => 0);
  }
  const exact = values.map((value) => (value * 100) / total);
  const result = exact.map(Math.floor);
  let missing = 100 - result.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of order) {
    if (missing-- <= 0) {
      break;
    }
    result[index]++;
  }
  return result;
}

/**
 * Creati e chiusi per mese degli anni scelti (i chiusi per mese di chiusura); fino al mese corrente
 * per l'anno in corso. Senza anni: gli ultimi 12 mesi.
 */
export function monthly(
  tickets: readonly BiTicket[],
  years: readonly number[] | null,
  now: Date,
): PeriodPoint[] {
  const months: { year: number; month: number }[] = [];
  if (years === null || years.length === 0) {
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: date.getFullYear(), month: date.getMonth() });
    }
  } else {
    for (const year of [...years].sort((a, b) => a - b)) {
      const last = year === now.getFullYear() ? now.getMonth() : 11;
      for (let month = 0; month <= last; month++) {
        months.push({ year, month });
      }
    }
  }
  return months.map(({ year: y, month }) => {
    const start = new Date(y, month, 1).getTime();
    const end = new Date(y, month + 1, 1).getTime();
    const label = `${MONTHS[month]}-${String(y).slice(2)}`;
    return {
      label,
      title: `${MONTHS[month]} ${y}`,
      created: tickets.filter((t) => within(t.created, start, end)).length,
      resolved: tickets.filter((t) => within(t.resolved, start, end)).length,
      open: openAt(tickets, Math.min(end, now.getTime()), true),
    };
  });
}

/**
 * Trend settimanale dal lunedì di {@code from} a oggi: creati, risolti e lavorabili a fine
 * settimana (aperti; senza i Pending se {@code includePending} è falso). Lo stato Pending è
 * quello di oggi: Jira non dà lo storico degli stati in questa copia.
 */
export function weekly(
  tickets: readonly BiTicket[],
  from: Date,
  now: Date,
  includePending: boolean,
): PeriodPoint[] {
  const points: PeriodPoint[] = [];
  const monday = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  for (let start = monday; start.getTime() <= now.getTime();) {
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    const day = `${String(start.getDate()).padStart(2, '0')}/${String(start.getMonth() + 1).padStart(2, '0')}`;
    points.push({
      label: day,
      title: `settimana del ${day}/${start.getFullYear()}${end.getTime() > now.getTime() ? ' (in corso)' : ''}`,
      partial: end.getTime() > now.getTime(),
      created: tickets.filter((t) => within(t.created, start.getTime(), end.getTime())).length,
      resolved: tickets.filter((t) => within(t.resolved, start.getTime(), end.getTime())).length,
      open: openAt(tickets, Math.min(end.getTime(), now.getTime()), includePending),
    });
    start = end;
  }
  return points;
}

/**
 * Giorni di backlog, come la misura "Backlog Days" di Power BI: lavorabili di oggi ÷ risolti per
 * giorno lavorativo nelle ultime 3 settimane complete (da lunedì a domenica, esclusa quella in
 * corso), cioè risolti ÷ 3 settimane ÷ 5 giorni. Il risultato è in giorni lavorativi. null se in
 * quelle settimane non si è chiuso nulla.
 */
export function backlogDays(
  tickets: readonly BiTicket[],
  now: Date,
  includePending: boolean,
): number | null {
  const resolvedPerWorkingDay = resolvedPerDay(tickets, now);
  const workable = tickets.filter((t) => isOpen(t) && (includePending || !t.pending)).length;
  return resolvedPerWorkingDay > 0 ? Math.round(workable / resolvedPerWorkingDay) : null;
}

/** Periodo (da lunedì a domenica) delle ultime BACKLOG_WEEKS settimane complete prima di {@code now}. */
export function backlogPeriod(now: Date): { from: Date; to: Date } {
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7),
  );
  return {
    from: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7 * BACKLOG_WEEKS),
    to: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 1),
  };
}

/**
 * Media di ticket risolti per giorno lavorativo nelle ultime 3 settimane complete (esclusa quella
 * in corso): la velocità di chiusura usata per i giorni di backlog.
 */
export function resolvedPerDay(tickets: readonly BiTicket[], now: Date): number {
  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - ((now.getDay() + 6) % 7),
  );
  const since = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() - 7 * BACKLOG_WEEKS,
  );
  const resolved = tickets.filter((t) =>
    within(t.resolved, since.getTime(), monday.getTime()),
  ).length;
  return resolved / BACKLOG_WEEKS / WORKING_DAYS;
}

/** Lunedì–venerdì tra l'1/1 dell'anno di {@code now} e ieri (oggi non è ancora finito), almeno 1. */
export function workingDaysThisYear(now: Date): number {
  let days = 0;
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let d = new Date(now.getFullYear(), 0, 1); d < end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      days++;
    }
  }
  return Math.max(days, 1);
}

/** Ticket risolti nell'anno solare di {@code now}. */
export function resolvedThisYear(tickets: readonly BiTicket[], now: Date): BiTicket[] {
  return tickets.filter(
    (t) => t.resolved !== null && new Date(t.resolved).getFullYear() === now.getFullYear(),
  );
}

/** Media di ticket risolti per giorno lavorativo nell'anno solare in corso. */
export function resolvedPerDayYear(tickets: readonly BiTicket[], now: Date): number {
  return resolvedThisYear(tickets, now).length / workingDaysThisYear(now);
}

/** Anni presenti nei dati (per il filtro), dal più recente. */
export function yearsOf(tickets: readonly BiTicket[]): number[] {
  return [...new Set(tickets.map((t) => new Date(t.created).getFullYear()))].sort((a, b) => b - a);
}

function openAt(tickets: readonly BiTicket[], at: number, includePending: boolean): number {
  return tickets.filter(
    (t) =>
      new Date(t.created).getTime() < at &&
      (t.resolved === null || new Date(t.resolved).getTime() >= at) &&
      (includePending || !(t.pending && isOpen(t))),
  ).length;
}

function within(iso: string | null, start: number, end: number): boolean {
  if (!iso) {
    return false;
  }
  const time = new Date(iso).getTime();
  return time >= start && time < end;
}

function rank(order: readonly string[], value: string): number {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}

/** Giorni del saldo di ogni persona: gli ultimi 30, oggi compreso (finestra mobile). */
export const PERSON_TREND_DAYS = 30;

/**
 * Periodo del saldo per persona: gli ultimi {@code PERSON_TREND_DAYS} giorni, oggi compreso.
 * {@code weeks}: quante settimane sono (30 giorni = 4,3), per cui si divide il saldo.
 */
export function personTrendPeriod(
  now: Date,
  days: number = PERSON_TREND_DAYS,
): { start: Date; weeks: number } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const weeks = Math.round((days / 7) * 10) / 10;
  return { start, weeks };
}

/** Periodi tra cui scegliere nella pagina Persone (giorni). */
export const PERSON_TREND_PERIODS: readonly number[] = [15, 30, 60, 90, 120];

/** Andamento del backlog di una persona (KPI per risorsa). */
export interface PersonTrend {
  readonly name: string;
  readonly resourceId: number | null;
  /** Aperti oggi e 30 giorni fa. */
  readonly open: number;
  readonly openBefore: number;
  /** Entrati e chiusi negli ultimi 30 giorni. */
  readonly created: number;
  readonly resolved: number;
  /** (entrati − chiusi) ÷ settimane trascorse: di quanto cresce (positivo) o cala il backlog a settimana. */
  readonly perWeek: number;
  readonly direction: 'up' | 'down' | 'flat';
}

/**
 * Saldo del backlog per persona negli ultimi 30 giorni (finestra mobile), dal peggiore. Chi ha
 * portato a zero gli aperti resta in elenco finché ha movimenti nel periodo. La persona è l'assegnatario di oggi: Jira non dà lo storico
 * delle assegnazioni in questa copia. Sotto mezzo ticket a settimana il saldo è "stabile".
 */
export function personTrends(
  tickets: readonly BiTicket[],
  now: Date,
  includePending: boolean,
  days: number = PERSON_TREND_DAYS,
): PersonTrend[] {
  const { start, weeks } = personTrendPeriod(now, days);
  const end = now.getTime() + 1;
  const byPerson = new Map<string, BiTicket[]>();
  for (const ticket of tickets) {
    const name = assigneeOf(ticket);
    byPerson.set(name, [...(byPerson.get(name) ?? []), ticket]);
  }
  return [...byPerson.entries()]
    .map(([name, list]) => {
      const created = list.filter((t) => within(t.created, start.getTime(), end)).length;
      const resolved = list.filter((t) => within(t.resolved, start.getTime(), end)).length;
      const perWeek = Math.round(((created - resolved) / weeks) * 10) / 10;
      return {
        name,
        resourceId: list.find((t) => t.resourceId !== null)?.resourceId ?? null,
        open: openAt(list, now.getTime(), includePending),
        openBefore: openAt(list, start.getTime(), includePending),
        created,
        resolved,
        perWeek,
        direction: perWeek >= 0.5 ? 'up' : perWeek <= -0.5 ? 'down' : 'flat',
      } satisfies PersonTrend;
    })
    .filter((row) => row.open > 0 || row.created > 0 || row.resolved > 0)
    .sort(
      (a, b) =>
        Number(a.name === UNASSIGNED) - Number(b.name === UNASSIGNED) ||
        b.perWeek - a.perWeek ||
        b.open - a.open ||
        a.name.localeCompare(b.name),
    );
}
