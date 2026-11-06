import { describe, expect, it } from 'vitest';

import { monthlyAverage } from './bi-averages';
import { BiTicket } from './bi.model';

function ticket(created: string, resolved: string | null = null): BiTicket {
  return {
    key: 'A-' + created + resolved,
    summary: 's',
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
    created,
    resolved,
    updated: created,
    due: null,
    impact: null,
    statusChanged: null,
    lastMovement: created,
  };
}

/** n ticket creati nel mese indicato (1-12) del 2026. */
function created(month: number, n: number): BiTicket[] {
  const mm = String(month).padStart(2, '0');
  return Array.from({ length: n }, (_, i) =>
    ticket(`2026-${mm}-${String((i % 28) + 1).padStart(2, '0')}T10:00:00`),
  );
}

/** Ticket creati mese per mese: counts[0] = gennaio. */
function perMonth(counts: readonly number[]): BiTicket[] {
  return counts.flatMap((n, i) => created(i + 1, n));
}

const NOW = new Date(2026, 10, 5); // 5 novembre: ott è l'ultimo mese completo

describe('media mensile dei ticket', () => {
  it('media sui mesi completi dell’anno e il mese in corso resta fuori', () => {
    const tickets = [...created(1, 10), ...created(2, 20), ...created(10, 30), ...created(11, 99)];

    const result = monthlyAverage(tickets, NOW, 'created');

    expect(result.months).toBe(10);
    expect(result.average).toBe(6); // (10+20+30)/10
    expect(result.currentMonthSoFar).toBe(99);
    expect(result.to).toBe('ott');
  });

  it('trend: ultimi 3 mesi contro i precedenti, in crescita', () => {
    // gen-lug 10 al mese; ago-ott 20 al mese
    const tickets = perMonth([10, 10, 10, 10, 10, 10, 10, 20, 20, 20]);

    const result = monthlyAverage(tickets, NOW, 'created');

    expect(result.earlierAverage).toBe(10);
    expect(result.recentAverage).toBe(20);
    expect(result.delta).toBe(10);
    expect(result.deltaPct).toBe(100);
    expect(result.trend).toBe('up');
    expect(result.recentFrom).toBe('ago');
    expect(result.earlierTo).toBe('lug');
  });

  it('trend in calo e stabile', () => {
    const down = perMonth([20, 20, 20, 20, 20, 20, 20, 10, 10, 10]);
    const flat = perMonth([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]);

    expect(monthlyAverage(down, NOW, 'created').trend).toBe('down');
    expect(monthlyAverage(down, NOW, 'created').deltaPct).toBe(-50);
    expect(monthlyAverage(flat, NOW, 'created').trend).toBe('flat');
  });

  it('un solo mese fuori scala pesa un terzo, non tutto', () => {
    // gen-set 10 al mese, ottobre 40: gli ultimi 3 mesi fanno (10+10+40)/3 = 20
    const tickets = perMonth([10, 10, 10, 10, 10, 10, 10, 10, 10, 40]);

    expect(monthlyAverage(tickets, NOW, 'created').recentAverage).toBe(20);
  });

  it('i risolti si contano nel mese di chiusura, non di creazione', () => {
    const tickets = [
      ticket('2026-01-05T10:00:00', '2026-10-02T10:00:00'),
      ticket('2025-12-01T10:00:00', '2026-02-02T10:00:00'),
    ];

    const result = monthlyAverage(tickets, NOW, 'resolved');

    expect(result.average).toBeCloseTo(0.2);
  });

  it('serve almeno un mese prima dei 3 recenti: con 3 mesi completi non c’è confronto', () => {
    const april = monthlyAverage(created(1, 5), new Date(2026, 3, 10), 'created');
    const may = monthlyAverage(perMonth([10, 10, 10, 20]), new Date(2026, 4, 10), 'created');
    const january = monthlyAverage([], new Date(2026, 0, 10), 'created');

    expect(april.months).toBe(3);
    expect(april.trend).toBeNull();
    expect(may.months).toBe(4);
    expect(may.trend).toBe('up');
    expect(january.months).toBe(0);
    expect(january.average).toBe(0);
  });

  it('gli anni passati non entrano', () => {
    const tickets = [ticket('2025-03-01T10:00:00'), ...created(3, 4)];

    expect(monthlyAverage(tickets, NOW, 'created').average).toBeCloseTo(0.4);
  });
});
