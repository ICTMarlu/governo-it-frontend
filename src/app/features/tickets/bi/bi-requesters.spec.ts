import { describe, expect, it } from 'vitest';

import { Bounce, BounceKind } from './bi-bounces';
import { BiTicket } from './bi.model';
import {
  closersOf,
  daysToClose,
  requesterRows,
  requesterStats,
  ticketFacts,
} from './bi-requesters';

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
    assignee: 'Anna',
    resourceId: null,
    reporter: 'Cliente A',
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

function done(key: string, days: number, over: Partial<BiTicket> = {}): BiTicket {
  const resolved = new Date(new Date('2026-10-01T10:00:00').getTime() + days * 86400000);
  return ticket(key, { category: 'DONE', resolved: resolved.toISOString(), ...over });
}

function bounce(
  kind: BounceKind,
  key: string,
  at: string,
  handler: string | null = 'Anna',
): Bounce {
  return { key, summary: null, area: 'ERP', reporter: 'Cliente A', kind, at, handler };
}

describe('richiedenti dei ticket', () => {
  it('tempo di chiusura: solo per i chiusi con la data', () => {
    expect(daysToClose(done('A-1', 3))).toBeCloseTo(3, 5);
    expect(daysToClose(ticket('A-2'))).toBeNull();
    expect(daysToClose(ticket('A-3', { category: 'DONE', resolved: null }))).toBeNull();
  });

  it('cronologia per ticket: riaperture, attese e chi ha chiuso per ultimo', () => {
    const facts = ticketFacts([
      bounce('COMPLETED', 'A-1', '2026-10-02T10:00:00', 'Anna'),
      bounce('REOPENED', 'A-1', '2026-10-03T10:00:00', 'Anna'),
      bounce('COMPLETED', 'A-1', '2026-10-04T10:00:00', 'Bruno'),
      bounce('WAIT_ENTERED', 'A-2', '2026-10-02T10:00:00'),
    ]);

    expect(facts.get('A-1')).toEqual({ reopenings: 1, waited: false, closedBy: 'Bruno' });
    expect(facts.get('A-2')).toEqual({ reopenings: 0, waited: true, closedBy: null });
  });

  it('numeri del richiedente: creati, chiusi, aperti, tempi, riaperti e attese', () => {
    const tickets = [
      done('A-1', 2),
      done('A-2', 4),
      done('A-3', 20),
      ticket('A-4'),
      ticket('A-5', { waitingCustomer: true }),
    ];
    const facts = ticketFacts([
      bounce('COMPLETED', 'A-1', '2026-10-02T10:00:00'),
      bounce('REOPENED', 'A-1', '2026-10-03T10:00:00'),
      bounce('REOPENED', 'A-1', '2026-10-04T10:00:00'),
      bounce('WAIT_ENTERED', 'A-5', '2026-10-05T10:00:00'),
    ]);

    const stats = requesterStats('Cliente A', tickets, facts);

    expect(stats).toMatchObject({
      created: 5,
      closed: 3,
      open: 2,
      openWaiting: 1,
      closedPct: 60,
      avgDays: 8.7,
      medianDays: 4,
      quickPct: 67,
      reopenedTickets: 1,
      reopenedPct: 33,
      reopenings: 2,
      waitedTickets: 1,
      waitedPct: 20,
    });
  });

  it('senza ticket chiusi le percentuali e i tempi non si calcolano', () => {
    const stats = requesterStats('Cliente A', [ticket('A-1')], new Map());

    expect(stats).toMatchObject({
      closed: 0,
      closedPct: 0,
      avgDays: null,
      quickPct: null,
      reopenedPct: null,
    });
    expect(requesterStats('Nessuno', [], new Map()).closedPct).toBeNull();
  });

  it('una riga per richiedente, da chi ne ha aperti di più; senza richiedente a parte', () => {
    const rows = requesterRows(
      [
        ticket('A-1'),
        ticket('A-2', { reporter: 'Cliente B' }),
        ticket('A-3', { reporter: 'Cliente B' }),
        ticket('A-4', { reporter: null }),
      ],
      new Map(),
    );

    expect(rows.map((row) => [row.name, row.created])).toEqual([
      ['Cliente B', 2],
      ['(non indicato)', 1],
      ['Cliente A', 1],
    ]);
  });

  it('chi ha chiuso: dalla cronologia, altrimenti l assegnatario di oggi', () => {
    const facts = ticketFacts([bounce('COMPLETED', 'A-1', '2026-10-02T10:00:00', 'Bruno')]);

    const closers = closersOf(
      [done('A-1', 1), done('A-2', 1), done('A-3', 1, { assignee: null }), ticket('A-4')],
      facts,
    );

    expect(closers).toEqual([
      { label: 'Anna', value: 1 },
      { label: 'Bruno', value: 1 },
      { label: 'Non assegnato', value: 1 },
    ]);
  });
});
