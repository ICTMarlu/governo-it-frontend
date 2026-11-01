import { describe, expect, it } from 'vitest';

import { BiTicket } from './bi.model';
import { flashWindows, previousWorkingDay, serviceFlash } from './service-flash.model';

const NOW = new Date(2026, 9, 21, 12); // mercoledì 21/10/2026, ore 12

function at(day: number, hour: number): string {
  return new Date(2026, 9, day, hour, 30).toISOString();
}

function ticket(changes: Partial<BiTicket>): BiTicket {
  return {
    key: 'MRLIT-1',
    summary: 'Ticket',
    status: 'Chiuso',
    category: 'DONE',
    pending: false,
    waitingCustomer: false,
    area: 'ERP',
    requestType: null,
    priority: 'Medium',
    assignee: 'Anna',
    resourceId: 1,
    reporter: 'Marco',
    projectCode: null,
    created: at(20, 9),
    resolved: at(21, 10),
    updated: at(21, 10),
    due: null,
    impact: null,
    statusChanged: null,
    ...changes,
  };
}

describe('serviceFlash', () => {
  it('ieri è l’ultima giornata lavorativa: il lunedì guarda al venerdì', () => {
    const monday = new Date(2026, 9, 19, 9);
    expect(previousWorkingDay(monday).getDate()).toBe(16);
    expect(previousWorkingDay(NOW).getDate()).toBe(20);
  });

  it('oggi conta solo la giornata in corso e non ha un periodo di confronto', () => {
    const { current, before } = flashWindows('today', NOW);
    expect(before).toBeNull();
    const flash = serviceFlash(
      [
        ticket({}),
        ticket({ key: 'B', resolved: at(20, 15) }),
        ticket({ key: 'C', created: at(21, 8), resolved: null, category: 'NEW' }),
      ],
      current,
      NOW,
    );
    expect(flash.resolved).toBe(1);
    expect(flash.created).toBe(1);
  });

  it('chi chiude, per chi e a che ora, con la matrice che torna ai totali', () => {
    const tickets = [
      ticket({ key: 'A', assignee: 'Anna', reporter: 'Marco' }),
      ticket({ key: 'B', assignee: 'Anna', reporter: 'Lucia', resolved: at(21, 11) }),
      ticket({ key: 'C', assignee: 'Bruno', reporter: 'Marco', resolved: at(21, 10) }),
      ticket({ key: 'D', assignee: 'Bruno', reporter: 'Marco', resolved: at(14, 10) }),
    ];
    const flash = serviceFlash(tickets, flashWindows('7', NOW).current, NOW);
    expect(flash.resolved).toBe(3);
    expect(flash.closedBy.map((c) => `${c.label}:${c.value}`)).toEqual(['Anna:2', 'Bruno:1']);
    expect(flash.requesters[0]).toMatchObject({ name: 'Marco', resolved: 2 });
    expect(flash.matrix.rows.map((row) => row.total)).toEqual([2, 1]);
    expect(
      flash.matrix.rows.every((row) => row.cells.reduce((a, b) => a + b, 0) === row.total),
    ).toBe(true);
    expect(flash.hours.find((bar) => bar.hour === 10)?.resolved).toBe(2);
    expect(flash.hours.find((bar) => bar.hour === 9)?.created).toBe(4);
    expect(flash.days).toHaveLength(8);
  });

  it('il confronto con il periodo precedente guarda i giorni subito prima', () => {
    const { current, before } = flashWindows('7', NOW);
    expect(before?.end).toBe(current.start);
    const flash = serviceFlash([ticket({ resolved: at(10, 10) })], before!, NOW);
    expect(flash.resolved).toBe(1);
  });

  it('i periodi lunghi diventano settimane', () => {
    const flash = serviceFlash([ticket({})], flashWindows('90', NOW).current, NOW);
    expect(flash.dailyBars).toBe(false);
    expect(flash.days.length).toBeLessThan(16);
  });
});

describe('serviceFlash — congruenza dei numeri', () => {
  // Ticket generati in modo ripetibile: persone, richiedenti, progetti, ore e giorni diversi
  const people = ['Anna', 'Bruno', null, 'Carla'];
  const reporters = ['Marco', 'Lucia', null, 'Dario', 'Elena'];
  const areas = ['ERP', 'BI', null];
  const tickets = Array.from({ length: 300 }, (_, i) =>
    ticket({
      key: `MRLIT-${i}`,
      assignee: people[i % people.length],
      reporter: reporters[(i * 7) % reporters.length],
      area: areas[(i * 3) % areas.length],
      created: at(1 + (i % 21), 7 + (i % 12)),
      resolved: i % 5 === 0 ? null : at(1 + ((i * 5) % 21), 8 + ((i * 11) % 12)),
      category: i % 5 === 0 ? 'NEW' : 'DONE',
    }),
  );

  for (const period of ['today', 'previous', '7', '15', '30'] as const) {
    it(`periodo ${period}: ogni grafico somma al totale`, () => {
      const { current } = flashWindows(period, NOW);
      const flash = serviceFlash(tickets, current, NOW);
      const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);

      expect(sum(flash.closedBy.map((c) => c.value))).toBe(flash.resolved);
      expect(sum(flash.areas.map((c) => c.value))).toBe(flash.resolved);
      expect(sum(flash.requesters.map((r) => r.resolved))).toBe(flash.resolved);
      expect(sum(flash.matrix.rows.map((r) => r.total))).toBe(flash.resolved);
      expect(sum(flash.matrix.rows.flatMap((r) => [...r.cells]))).toBe(flash.resolved);
      expect(sum(flash.hours.map((h) => h.resolved))).toBe(flash.resolved);
      expect(sum(flash.hours.map((h) => h.created))).toBe(flash.created);
      if (flash.days.length > 0) {
        expect(sum(flash.days.map((d) => d.resolved))).toBe(flash.resolved);
        expect(sum(flash.days.map((d) => d.created))).toBe(flash.created);
      }
      // I richiedenti contano gli entrati solo per chi ha avuto ticket chiusi: mai più del totale
      expect(sum(flash.requesters.map((r) => r.created))).toBeLessThanOrEqual(flash.created);
    });
  }
});
