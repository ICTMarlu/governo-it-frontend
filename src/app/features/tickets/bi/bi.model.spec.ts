import { describe, expect, it } from 'vitest';

import {
  BiTicket,
  agingBuckets,
  backlogDays,
  countBy,
  countByPriority,
  inPeriod,
  inScope,
  monthly,
  percentsSummingTo100,
  personTrends,
  overview,
  weekly,
} from './bi.model';

const NOW = new Date(2026, 9, 21, 12); // mercoledì 21/10/2026

function ticket(changes: Partial<BiTicket>): BiTicket {
  return {
    key: 'MRLIT-1',
    summary: 'Ticket',
    status: 'Aperto',
    category: 'NEW',
    pending: false,
    waitingCustomer: false,
    area: 'ERP FM3',
    requestType: null,
    priority: 'Medium',
    assignee: 'Jonny Collari',
    resourceId: 2,
    reporter: 'Annalisa',
    projectCode: null,
    created: new Date(2026, 9, 1).toISOString(),
    resolved: null,
    updated: new Date(2026, 9, 1).toISOString(),
    due: null,
    impact: null,
    statusChanged: null,
    ...changes,
  };
}

const resolved = (created: Date, at: Date) =>
  ticket({
    category: 'DONE',
    status: 'Risolta',
    created: created.toISOString(),
    resolved: at.toISOString(),
  });

describe('bi.model', () => {
  it('panoramica: aperti, open lavorabili, pending e risolti con le percentuali', () => {
    const numbers = overview([
      ticket({}),
      ticket({ status: 'Pending', category: 'INDETERMINATE', pending: true }),
      resolved(new Date(2026, 8, 1), new Date(2026, 8, 3)),
      resolved(new Date(2026, 8, 1), new Date(2026, 8, 5)),
    ]);
    expect(numbers).toEqual({
      created: 4,
      open: 2,
      openWorkable: 1,
      pending: 1,
      resolved: 2,
      openPct: 50,
      openWorkablePct: 25,
      pendingPct: 25,
      resolvedPct: 50,
    });
  });

  it('filtri: area e assegnatario, anno e mesi della data', () => {
    const t = ticket({ area: null, assignee: null });
    expect(
      inScope(t, { areas: ['(senza area)'], assignees: null, years: null, months: null }),
    ).toBe(true);
    expect(
      inScope(t, { areas: null, assignees: ['Jonny Collari'], years: null, months: null }),
    ).toBe(false);
    expect(inPeriod(t.created, { areas: null, assignees: null, years: [2026], months: [10] })).toBe(
      true,
    );
    expect(inPeriod(t.created, { areas: null, assignees: null, years: [2026], months: [9] })).toBe(
      false,
    );
  });

  it('conteggi: dal più frequente; le priorità nell’ordine di Jira', () => {
    const list = [
      ticket({ priority: 'Low' }),
      ticket({ priority: 'Highest' }),
      ticket({ priority: 'Low' }),
    ];
    expect(countBy(list, (t) => t.priority!)).toEqual([
      { label: 'Low', value: 2 },
      { label: 'Highest', value: 1 },
    ]);
    expect(countByPriority(list).map((c) => c.label)).toEqual(['Highest', 'Low']);
  });

  it('anzianità nelle fasce di Power BI', () => {
    const buckets = agingBuckets(
      [
        ticket({ created: new Date(2026, 9, 18).toISOString() }),
        ticket({ created: new Date(2026, 4, 1).toISOString() }),
      ],
      NOW,
    );
    expect(buckets[0].value).toBe(1);
    expect(buckets[buckets.length - 1].value).toBe(1);
  });

  it('mesi fino a quello corrente e trend settimanale con o senza Pending', () => {
    const tickets = [
      ticket({ created: new Date(2026, 9, 13).toISOString() }),
      ticket({
        created: new Date(2026, 9, 14).toISOString(),
        pending: true,
        category: 'INDETERMINATE',
      }),
      resolved(new Date(2026, 9, 13), new Date(2026, 9, 20)),
    ];
    const months = monthly(tickets, [2026], NOW);
    expect(months).toHaveLength(10);
    expect(months[9]).toMatchObject({ label: 'ott-26', created: 3, resolved: 1, open: 2 });

    const withPending = weekly(tickets, new Date(2026, 9, 12), NOW, true);
    const withoutPending = weekly(tickets, new Date(2026, 9, 12), NOW, false);
    expect(withPending.map((w) => w.label)).toEqual(['12/10', '19/10']);
    expect(withPending[0]).toMatchObject({ created: 3, resolved: 0, open: 3 });
    expect(withPending[1]).toMatchObject({ created: 0, resolved: 1, open: 2 });
    expect(withoutPending[1].open).toBe(1);
  });

  it('giorni di backlog come Power BI: risolti delle ultime 3 settimane complete ÷ 15 giorni lavorativi', () => {
    const tickets = [
      // 3 settimane complete (28/09-18/10): 30 risolti = 2 per giorno lavorativo
      ...Array.from({ length: 30 }, () => resolved(new Date(2026, 8, 1), new Date(2026, 9, 10))),
      // Settimana in corso (dal 19/10) e prima del 28/09: non contano
      ...Array.from({ length: 14 }, () => resolved(new Date(2026, 8, 1), new Date(2026, 9, 20))),
      ...Array.from({ length: 5 }, () => resolved(new Date(2026, 7, 1), new Date(2026, 8, 25))),
      ...Array.from({ length: 20 }, () => ticket({})),
    ];
    expect(backlogDays(tickets, NOW, true)).toBe(10);
    expect(backlogDays([ticket({})], NOW, true)).toBeNull();
  });

  it('le percentuali di open, pending e risolti fanno sempre 100', () => {
    // 124 / 20 / 661 su 805: 15,4 + 2,5 + 82,1 → 15 + 3 + 82
    expect(percentsSummingTo100([124, 20, 661])).toEqual([15, 3, 82]);
    expect(percentsSummingTo100([1, 1, 1])).toEqual([34, 33, 33]);
    expect(percentsSummingTo100([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe('personTrends', () => {
  it('saldo degli ultimi 30 giorni per persona, dal peggiore', () => {
    const day = (d: number) => new Date(2026, 9, d, 10).toISOString();
    const trends = personTrends(
      [
        // Jonny: 4 entrati (dal 22/09 a oggi), nessuno chiuso → 4 ÷ 4,3 settimane = +0,9
        ticket({ key: 'A', created: day(1) }),
        ticket({ key: 'B', created: day(5) }),
        ticket({ key: 'C', created: day(12) }),
        ticket({ key: 'D', created: day(16) }),
        // Elia: 2 entrati, 3 chiusi → −1 ÷ 4,3 = −0,2
        ticket({ key: 'E', assignee: 'Elia', resourceId: 3, created: day(2) }),
        ...['F', 'G', 'H'].map((key) =>
          ticket({
            key,
            assignee: 'Elia',
            resourceId: 3,
            category: 'DONE',
            created: new Date(2026, 8, 1).toISOString(),
            resolved: day(8),
          }),
        ),
        // Ultimi giorni: contano
        ticket({ key: 'I', assignee: 'Elia', resourceId: 3, created: day(20) }),
      ],
      NOW,
      true,
    );

    expect(trends.map((t) => [t.name, t.perWeek, t.direction])).toEqual([
      ['Jonny Collari', 0.9, 'up'],
      ['Elia', -0.2, 'flat'],
    ]);
    expect(trends[1]).toMatchObject({ open: 2, openBefore: 3, created: 2, resolved: 3 });
  });

  it('chi ha portato a zero gli aperti resta in elenco finché ha movimenti nel periodo', () => {
    const closed = ticket({
      key: 'Z',
      assignee: 'Alex',
      resourceId: 9,
      category: 'DONE',
      created: new Date(2026, 8, 1).toISOString(),
      resolved: new Date(2026, 9, 8, 10).toISOString(),
    });
    expect(personTrends([closed], NOW, true).map((t) => [t.name, t.open, t.resolved])).toEqual([
      ['Alex', 0, 1],
    ]);
  });
});
