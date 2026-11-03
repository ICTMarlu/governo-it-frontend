import { NO_AREA, UNASSIGNED } from './bi.model';

/** Tipo di passaggio nella cronologia di un ticket. */
export type BounceKind = 'COMPLETED' | 'REOPENED' | 'WAIT_ENTERED' | 'WAIT_RETURNED';

/**
 * Un passaggio della cronologia: chiuso, riaperto, andato in attesa del cliente o rientrato dall'attesa.
 * handler = chi aveva il ticket in quel momento (per le riaperture, alla chiusura).
 */
export interface Bounce {
  readonly key: string;
  readonly summary: string | null;
  readonly area: string | null;
  /** Chi ha aperto la richiesta. */
  readonly reporter: string | null;
  readonly kind: BounceKind;
  readonly at: string;
  readonly handler: string | null;
}

/** Filtri della pagina: area e persona dai filtri in alto, anno e mesi sulla data del passaggio. */
export interface BounceFilters {
  readonly areas: readonly string[] | null;
  readonly assignees: readonly string[] | null;
  readonly years: readonly number[] | null;
  readonly months: readonly number[] | null;
}

export interface PersonBounces {
  readonly name: string;
  /** Ticket distinti chiusi (Risolta, Chiusa...) nel periodo. */
  readonly closedTickets: number;
  /** Tra i ticket chiusi nel periodo, quelli riaperti almeno una volta (hanno fatto ping pong). */
  readonly bouncedTickets: number;
  /** Ticket rimbalzati ogni 100 chiusi; null se non ci sono chiusi. */
  readonly bouncedPct: number | null;
  /** Riaperture totali nel periodo (un ticket riaperto tre volte ne vale tre). */
  readonly reopenings: number;
  /** Ticket riaperti almeno due volte nel periodo. */
  readonly repeated: number;
  /** Ticket distinti messi in attesa del cliente nel periodo. */
  readonly waitTickets: number;
  /** Tra quelli messi in attesa, i ticket in cui il cliente ha risposto (tornati in lavorazione). */
  readonly answeredTickets: number;
  /** Ticket con risposta ogni 100 messi in attesa; null se non ne ha messi. */
  readonly answeredPct: number | null;
}

export interface TicketBounces {
  readonly key: string;
  readonly summary: string | null;
  readonly handler: string;
  readonly reporter: string;
  readonly reopened: number;
}

export interface WeekBounces {
  readonly label: string;
  readonly title: string;
  readonly reopened: number;
  readonly waitReturned: number;
  /** Settimana in corso: i numeri sono parziali. */
  readonly partial: boolean;
}

export function handlerOf(bounce: Bounce): string {
  return bounce.handler?.trim() || UNASSIGNED;
}

export const NO_REPORTER = '(senza richiedente)';

export function reporterOf(bounce: Bounce): string {
  return bounce.reporter?.trim() || NO_REPORTER;
}

/** Raggruppamento della tabella: chi aveva il ticket oppure chi l'ha richiesto. */
export type BounceGroup = 'handler' | 'reporter';

export function groupNameOf(bounce: Bounce, group: BounceGroup): string {
  return group === 'handler' ? handlerOf(bounce) : reporterOf(bounce);
}

function areaOf(bounce: Bounce): string {
  return bounce.area?.trim() || NO_AREA;
}

/** Passaggi di area e persona scelte, nell'anno e nei mesi scelti. */
export function filterBounces(
  bounces: readonly Bounce[],
  filters: BounceFilters,
): readonly Bounce[] {
  return bounces.filter((bounce) => {
    const date = new Date(bounce.at);
    return (
      (filters.areas === null || filters.areas.includes(areaOf(bounce))) &&
      (filters.assignees === null || filters.assignees.includes(handlerOf(bounce))) &&
      (filters.years === null || filters.years.includes(date.getFullYear())) &&
      (filters.months === null || filters.months.includes(date.getMonth() + 1))
    );
  });
}

function percent(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part / whole) * 100);
}

function summarize(name: string, bounces: readonly Bounce[]): PersonBounces {
  const keysOf = (kind: BounceKind) =>
    new Set(bounces.filter((b) => b.kind === kind).map((b) => b.key));
  const reopenedPerTicket = new Map<string, number>();
  for (const bounce of bounces) {
    if (bounce.kind === 'REOPENED') {
      reopenedPerTicket.set(bounce.key, (reopenedPerTicket.get(bounce.key) ?? 0) + 1);
    }
  }
  const closed = keysOf('COMPLETED');
  const waited = keysOf('WAIT_ENTERED');
  const returned = keysOf('WAIT_RETURNED');
  const bounced = [...closed].filter((key) => reopenedPerTicket.has(key)).length;
  const answered = [...waited].filter((key) => returned.has(key)).length;
  return {
    name,
    closedTickets: closed.size,
    bouncedTickets: bounced,
    bouncedPct: percent(bounced, closed.size),
    reopenings: bounces.filter((b) => b.kind === 'REOPENED').length,
    repeated: [...reopenedPerTicket.values()].filter((times) => times >= 2).length,
    waitTickets: waited.size,
    answeredTickets: answered,
    answeredPct: percent(answered, waited.size),
  };
}

/**
 * Una riga per persona (chi aveva il ticket) o per richiedente, da chi ha più ticket rimbalzati; a parità, più
 * riaperture, poi più ticket con risposta del cliente e infine in ordine alfabetico.
 */
export function bouncesByPerson(
  bounces: readonly Bounce[],
  group: BounceGroup = 'handler',
): PersonBounces[] {
  const byPerson = new Map<string, Bounce[]>();
  for (const bounce of bounces) {
    const name = groupNameOf(bounce, group);
    byPerson.set(name, [...(byPerson.get(name) ?? []), bounce]);
  }
  return [...byPerson.entries()]
    .map(([name, rows]) => summarize(name, rows))
    .sort(
      (a, b) =>
        b.bouncedTickets - a.bouncedTickets ||
        b.reopenings - a.reopenings ||
        b.answeredTickets - a.answeredTickets ||
        a.name.localeCompare(b.name, 'it'),
    );
}

/** Totale su tutte le persone: le percentuali sono calcolate sui totali, non mediate. */
export function totalBounces(bounces: readonly Bounce[]): PersonBounces {
  return summarize('Totale', bounces);
}

export interface ClosedWithoutWaiting {
  /** Ticket chiusi nel periodo che non sono mai stati in attesa di risposta del cliente. */
  readonly tickets: number;
  /** Ticket chiusi nel periodo (gli stessi del totale in tabella). */
  readonly closed: number;
  /** Quota sui chiusi; null se non ci sono chiusi. */
  readonly pct: number | null;
  /** Ticket chiusi nel periodo che sono passati almeno una volta dall'attesa del cliente. */
  readonly withWaiting: number;
  /** Quota sui chiusi; null se non ci sono chiusi. */
  readonly withWaitingPct: number | null;
}

/**
 * Ticket chiusi nel periodo (con i filtri scelti) che in tutta la loro storia non sono mai passati da "In attesa
 * di risposta dal cliente": chiusi senza aver mai chiesto nulla al cliente. Gli altri ({@code withWaiting}) sono
 * passati almeno una volta dall'attesa prima di essere chiusi. La storia si guarda per intero
 * ({@code all}, senza filtri), non solo nel periodo o per la persona scelta.
 */
export function closedWithoutWaiting(
  filtered: readonly Bounce[],
  all: readonly Bounce[],
): ClosedWithoutWaiting {
  const everWaited = new Set(all.filter((b) => b.kind === 'WAIT_ENTERED').map((b) => b.key));
  const closed = new Set(filtered.filter((b) => b.kind === 'COMPLETED').map((b) => b.key));
  const tickets = [...closed].filter((key) => !everWaited.has(key)).length;
  const withWaiting = closed.size - tickets;
  return {
    tickets,
    closed: closed.size,
    pct: percent(tickets, closed.size),
    withWaiting,
    withWaitingPct: percent(withWaiting, closed.size),
  };
}

/** I ticket più volte riaperti dopo la chiusura, da quello riaperto più volte. */
export function worstTickets(bounces: readonly Bounce[], limit: number): TicketBounces[] {
  const byKey = new Map<string, TicketBounces>();
  for (const bounce of bounces) {
    if (bounce.kind !== 'REOPENED') {
      continue;
    }
    const current = byKey.get(bounce.key) ?? {
      key: bounce.key,
      summary: bounce.summary,
      handler: handlerOf(bounce),
      reporter: reporterOf(bounce),
      reopened: 0,
    };
    byKey.set(bounce.key, { ...current, reopened: current.reopened + 1 });
  }
  return [...byKey.values()]
    .sort((a, b) => b.reopened - a.reopened || a.key.localeCompare(b.key, 'it', { numeric: true }))
    .slice(0, limit);
}

function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

/**
 * Riaperture e risposte del cliente per settimana, nelle ultime {@code weeks} settimane che arrivano a oggi
 * (anche quelle senza passaggi, a zero). Le settimane sono lunedì-domenica.
 */
export function bouncesByWeek(bounces: readonly Bounce[], now: Date, weeks: number): WeekBounces[] {
  const current = mondayOf(now);
  const result: WeekBounces[] = [];
  for (let offset = weeks - 1; offset >= 0; offset--) {
    const start = new Date(current);
    start.setDate(start.getDate() - offset * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const inWeek = bounces.filter((b) => {
      const at = new Date(b.at);
      return at >= start && at < end;
    });
    result.push({
      label: start.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
      title: `settimana del ${start.toLocaleDateString('it-IT')}`,
      reopened: inWeek.filter((b) => b.kind === 'REOPENED').length,
      waitReturned: inWeek.filter((b) => b.kind === 'WAIT_RETURNED').length,
      partial: offset === 0,
    });
  }
  return result;
}
