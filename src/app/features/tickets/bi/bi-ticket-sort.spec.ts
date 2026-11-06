import { describe, expect, it } from 'vitest';

import { BiTicket } from './bi.model';
import { nextTicketSort, sortTickets, ticketIdleDays } from './bi-ticket-sort';

function ticket(key: string, over: Partial<BiTicket> = {}): BiTicket {
  return {
    key,
    summary: 'Ticket ' + key,
    status: 'Open',
    category: 'INDETERMINATE',
    pending: false,
    waitingCustomer: false,
    area: 'ERP',
    requestType: null,
    priority: null,
    assignee: null,
    resourceId: null,
    reporter: null,
    projectCode: null,
    created: '2026-10-01T10:00:00',
    resolved: null,
    updated: '2026-10-01T10:00:00',
    due: null,
    impact: null,
    statusChanged: null,
    lastMovement: '2026-10-01T10:00:00',
    ...over,
  };
}

const keys = (rows: readonly BiTicket[]) => rows.map((t) => t.key);

describe('ordinamento degli elenchi di ticket', () => {
  it('per numero del ticket, non per testo', () => {
    const rows = [ticket('MRLIT-99'), ticket('MRLIT-2658'), ticket('MRLIT-100')];

    expect(keys(sortTickets(rows, { key: 'key', desc: true }))).toEqual([
      'MRLIT-2658',
      'MRLIT-100',
      'MRLIT-99',
    ]);
  });

  it('per testo con le regole italiane, ignorando maiuscole', () => {
    const rows = [
      ticket('A-1', { reporter: 'zeno' }),
      ticket('A-2', { reporter: 'Alex' }),
      ticket('A-3', { reporter: 'Marco' }),
    ];

    expect(keys(sortTickets(rows, { key: 'reporter', desc: false }))).toEqual([
      'A-2',
      'A-3',
      'A-1',
    ]);
    expect(keys(sortTickets(rows, { key: 'reporter', desc: true }))).toEqual(['A-1', 'A-3', 'A-2']);
  });

  it('i valori vuoti restano in fondo sia in crescente che in decrescente', () => {
    const rows = [
      ticket('A-1', { due: null }),
      ticket('A-2', { due: '2026-11-10T00:00:00' }),
      ticket('A-3', { due: '2026-11-05T00:00:00' }),
    ];

    expect(keys(sortTickets(rows, { key: 'due', desc: false }))).toEqual(['A-3', 'A-2', 'A-1']);
    expect(keys(sortTickets(rows, { key: 'due', desc: true }))).toEqual(['A-2', 'A-3', 'A-1']);
  });

  it('la priorità va dalla più urgente (Highest) a crescere', () => {
    const rows = [
      ticket('A-1', { priority: 'Low' }),
      ticket('A-2', { priority: 'Highest' }),
      ticket('A-3', { priority: null }),
      ticket('A-4', { priority: 'Medium' }),
    ];

    expect(keys(sortTickets(rows, { key: 'priority', desc: false }))).toEqual([
      'A-2',
      'A-4',
      'A-1',
      'A-3',
    ]);
  });

  it('l età è quella mostrata: alla risoluzione per i chiusi, a oggi per gli aperti', () => {
    const now = new Date('2026-11-04T10:00:00');
    const rows = [
      ticket('A-1', { created: '2026-10-01T10:00:00' }), // aperto da 34 giorni
      ticket('A-2', { created: '2026-10-01T10:00:00', resolved: '2026-10-03T10:00:00' }), // 2 giorni
    ];

    expect(keys(sortTickets(rows, { key: 'age', desc: true }, now))).toEqual(['A-1', 'A-2']);
  });

  it('Fermo da: giorni dall’ultimo movimento di una persona, solo per gli aperti, i chiusi in fondo', () => {
    const now = new Date('2026-11-06T10:00:00');
    const rows = [
      ticket('A-1', { lastMovement: '2026-11-01T10:00:00' }), // 5 giorni
      ticket('A-2', { lastMovement: '2026-10-06T10:00:00' }), // 31 giorni
      ticket('A-3', { lastMovement: '2026-11-06T08:00:00' }), // oggi
      ticket('A-4', {
        category: 'DONE',
        resolved: '2026-10-01T10:00:00',
        lastMovement: '2026-09-01T10:00:00',
      }),
    ];

    expect(ticketIdleDays(rows[0], now)).toBe(5);
    expect(ticketIdleDays(rows[2], now)).toBe(0);
    expect(ticketIdleDays(rows[3], now)).toBeNull();
    expect(keys(sortTickets(rows, { key: 'idle', desc: true }, now))).toEqual([
      'A-2',
      'A-1',
      'A-3',
      'A-4',
    ]);
    expect(keys(sortTickets(rows, { key: 'idle', desc: false }, now))).toEqual([
      'A-3',
      'A-1',
      'A-2',
      'A-4',
    ]);
  });

  it('al primo clic le date e il numero partono dal più alto, il testo dall inizio; un secondo clic inverte', () => {
    const start = { key: 'created', desc: true } as const;

    expect(nextTicketSort(start, 'reporter')).toEqual({ key: 'reporter', desc: false });
    expect(nextTicketSort(start, 'updated')).toEqual({ key: 'updated', desc: true });
    expect(nextTicketSort(start, 'created')).toEqual({ key: 'created', desc: false });
  });
});
