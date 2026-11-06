import { BiTicket, ageDays, areaOf, assigneeOf, isOpen } from './bi.model';

/** Colonne per cui si ordinano gli elenchi di ticket. */
export type TicketSortKey =
  | 'key'
  | 'summary'
  | 'status'
  | 'area'
  | 'assignee'
  | 'reporter'
  | 'priority'
  | 'impact'
  | 'due'
  | 'created'
  | 'updated'
  | 'resolved'
  | 'age'
  | 'idle'
  | 'requestType';

export interface TicketSort {
  readonly key: TicketSortKey;
  readonly desc: boolean;
}

const PRIORITY_RANK = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
const COLLATOR = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

/** Età mostrata in elenco: dalla creazione alla risoluzione, o a oggi se è ancora aperto. */
export function ticketAge(ticket: BiTicket, now: Date = new Date()): number {
  return ageDays(ticket, ticket.resolved ? new Date(ticket.resolved) : now);
}

/**
 * Giorni da quando il ticket non si muove: dall'ultimo movimento di una persona (modifica o commento; le
 * automazioni di Jira non contano). Solo per i ticket aperti: per quelli chiusi non ha senso, null.
 */
export function ticketIdleDays(ticket: BiTicket, now: Date = new Date()): number | null {
  if (!isOpen(ticket)) {
    return null;
  }
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(ticket.lastMovement).getTime()) / 86_400_000),
  );
}

/** Valore della colonna per l'ordinamento; null = vuoto (va sempre in fondo). */
function valueOf(ticket: BiTicket, key: TicketSortKey, now: Date): string | number | null {
  switch (key) {
    case 'key':
      return Number(ticket.key.split('-').pop()) || 0;
    case 'summary':
      return ticket.summary || null;
    case 'status':
      return ticket.status || null;
    case 'area':
      return areaOf(ticket);
    case 'assignee':
      return ticket.assignee ? assigneeOf(ticket) : null;
    case 'reporter':
      return ticket.reporter || null;
    case 'priority': {
      // Highest = 0: crescente dalla più urgente
      const index = PRIORITY_RANK.indexOf(ticket.priority ?? '');
      return index === -1 ? null : index;
    }
    case 'impact':
      return ticket.impact || null;
    case 'due':
      return ticket.due;
    case 'created':
      return ticket.created;
    case 'updated':
      return ticket.updated;
    case 'resolved':
      return ticket.resolved;
    case 'age':
      return ticketAge(ticket, now);
    case 'idle':
      return ticketIdleDays(ticket, now);
    case 'requestType':
      return ticket.requestType || null;
  }
}

/** Ticket ordinati per colonna; i valori vuoti restano in fondo sia in ordine crescente che decrescente. */
export function sortTickets(
  tickets: readonly BiTicket[],
  sort: TicketSort,
  now: Date = new Date(),
): BiTicket[] {
  const sign = sort.desc ? -1 : 1;
  return [...tickets].sort((a, b) => {
    const x = valueOf(a, sort.key, now);
    const y = valueOf(b, sort.key, now);
    if (x === null || y === null) {
      return x === y ? 0 : x === null ? 1 : -1;
    }
    const result =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : COLLATOR.compare(String(x), String(y));
    return sign * result;
  });
}

/** Effetto di un clic sull'intestazione: nuova colonna dall'alto in basso (data e numeri: dal più recente/alto). */
export function nextTicketSort(current: TicketSort, key: TicketSortKey): TicketSort {
  return { key, desc: current.key === key ? !current.desc : DESC_FIRST.has(key) };
}

/** Colonne che al primo clic vanno dal valore più alto (più recenti, più vecchi, ticket nuovi in cima). */
const DESC_FIRST: ReadonlySet<TicketSortKey> = new Set([
  'key',
  'created',
  'updated',
  'resolved',
  'age',
  'idle',
]);
