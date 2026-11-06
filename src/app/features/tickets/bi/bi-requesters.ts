import { Bounce } from './bi-bounces';
import { BiTicket, Count, UNASSIGNED, isOpen } from './bi.model';

const DAY = 24 * 60 * 60 * 1000;
/** Un ticket chiuso entro questi giorni dalla creazione è "chiuso in fretta". */
export const QUICK_DAYS = 7;

/** Nome mostrato per i ticket senza richiedente (lo stesso dell'elenco dei dettagli). */
export const NO_REPORTER = '(non indicato)';

export function reporterName(ticket: BiTicket): string {
  return ticket.reporter?.trim() || NO_REPORTER;
}

/** Che cosa dice la cronologia di un ticket: quante volte è stato riaperto, se è stato in attesa, chi l'ha chiuso. */
export interface TicketFacts {
  readonly reopenings: number;
  readonly waited: boolean;
  /** Chi aveva il ticket all'ultima chiusura; null se la cronologia non la ricorda. */
  readonly closedBy: string | null;
}

/** Fatti per ticket dalla cronologia (la stessa della pagina Rimbalzi). */
export function ticketFacts(bounces: readonly Bounce[]): Map<string, TicketFacts> {
  const facts = new Map<string, TicketFacts>();
  const ordered = [...bounces].sort((a, b) => a.at.localeCompare(b.at));
  for (const bounce of ordered) {
    const current = facts.get(bounce.key) ?? { reopenings: 0, waited: false, closedBy: null };
    facts.set(bounce.key, {
      reopenings: current.reopenings + (bounce.kind === 'REOPENED' ? 1 : 0),
      waited: current.waited || bounce.kind === 'WAIT_ENTERED',
      closedBy:
        bounce.kind === 'COMPLETED' ? bounce.handler?.trim() || UNASSIGNED : current.closedBy,
    });
  }
  return facts;
}

/** Giorni dalla creazione alla chiusura; null se il ticket non è chiuso o la data manca. */
export function daysToClose(ticket: BiTicket): number | null {
  if (isOpen(ticket) || !ticket.resolved) {
    return null;
  }
  return Math.max(
    0,
    (new Date(ticket.resolved).getTime() - new Date(ticket.created).getTime()) / DAY,
  );
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percent(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part / whole) * 100);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export interface RequesterStats {
  readonly name: string;
  /** Ticket aperti dal richiedente (creati nel periodo). */
  readonly created: number;
  readonly closed: number;
  /** Ancora aperti (compresi Pending e in attesa del cliente). */
  readonly open: number;
  /** Tra gli aperti, quelli in attesa di risposta del cliente. */
  readonly openWaiting: number;
  /** Chiusi ogni 100 creati; null se non ha creato nulla. */
  readonly closedPct: number | null;
  /** Giorni medi e mediani per chiudere, sui chiusi con la data nota; null se non ce n'è nessuno. */
  readonly avgDays: number | null;
  readonly medianDays: number | null;
  /** Quota dei chiusi entro {@link QUICK_DAYS} giorni dalla creazione. */
  readonly quickPct: number | null;
  /** Ticket chiusi poi riaperti almeno una volta, e quante riaperture in tutto. */
  readonly reopenedTickets: number;
  readonly reopenedPct: number | null;
  readonly reopenings: number;
  /** Ticket passati almeno una volta da "In attesa di risposta dal cliente". */
  readonly waitedTickets: number;
  readonly waitedPct: number | null;
}

/** Numeri di un richiedente sui ticket che ha aperto (già filtrati per periodo, area e assegnatario). */
export function requesterStats(
  name: string,
  tickets: readonly BiTicket[],
  facts: ReadonlyMap<string, TicketFacts>,
): RequesterStats {
  const closedTickets = tickets.filter((t) => !isOpen(t));
  const open = tickets.filter(isOpen);
  const times = closedTickets.map(daysToClose).filter((days): days is number => days !== null);
  const reopened = closedTickets.filter((t) => (facts.get(t.key)?.reopenings ?? 0) > 0);
  const waited = tickets.filter((t) => facts.get(t.key)?.waited);
  const avg = times.length === 0 ? null : times.reduce((sum, days) => sum + days, 0) / times.length;
  const med = median(times);
  return {
    name,
    created: tickets.length,
    closed: closedTickets.length,
    open: open.length,
    openWaiting: open.filter((t) => t.waitingCustomer && !t.pending).length,
    closedPct: percent(closedTickets.length, tickets.length),
    avgDays: avg === null ? null : round1(avg),
    medianDays: med === null ? null : round1(med),
    quickPct: percent(times.filter((days) => days <= QUICK_DAYS).length, times.length),
    reopenedTickets: reopened.length,
    reopenedPct: percent(reopened.length, closedTickets.length),
    reopenings: tickets.reduce((sum, t) => sum + (facts.get(t.key)?.reopenings ?? 0), 0),
    waitedTickets: waited.length,
    waitedPct: percent(waited.length, tickets.length),
  };
}

/** Una riga per richiedente, da chi ha aperto più ticket; a parità in ordine alfabetico. */
export function requesterRows(
  tickets: readonly BiTicket[],
  facts: ReadonlyMap<string, TicketFacts>,
): RequesterStats[] {
  const byName = new Map<string, BiTicket[]>();
  for (const ticket of tickets) {
    const name = reporterName(ticket);
    byName.set(name, [...(byName.get(name) ?? []), ticket]);
  }
  return [...byName.entries()]
    .map(([name, rows]) => requesterStats(name, rows, facts))
    .sort((a, b) => b.created - a.created || a.name.localeCompare(b.name, 'it'));
}

/**
 * Chi ha chiuso i ticket chiusi: chi li aveva all'ultima chiusura secondo la cronologia, altrimenti
 * l'assegnatario di oggi. Dal più frequente.
 */
export function closersOf(
  tickets: readonly BiTicket[],
  facts: ReadonlyMap<string, TicketFacts>,
): Count[] {
  const counts = new Map<string, number>();
  for (const ticket of tickets) {
    if (isOpen(ticket)) {
      continue;
    }
    const who = facts.get(ticket.key)?.closedBy ?? ticket.assignee ?? UNASSIGNED;
    counts.set(who, (counts.get(who) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'it'));
}
