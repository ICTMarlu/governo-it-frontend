import { describe, expect, it } from 'vitest';

import {
  Bounce,
  BounceKind,
  bouncesByPerson,
  bouncesByWeek,
  closedWithoutWaiting,
  filterBounces,
  totalBounces,
  worstTickets,
} from './bi-bounces';

function bounce(
  kind: BounceKind,
  handler: string | null,
  key = 'AMS-1',
  at = '2026-10-14T10:00:00',
  area: string | null = 'ERP',
  reporter: string | null = 'Cliente A',
): Bounce {
  return { key, summary: 'Ticket ' + key, area, reporter, kind, at, handler };
}

describe('rimbalzi dei ticket', () => {
  it('conta ticket distinti: chiusi, rimbalzati e la percentuale sui chiusi', () => {
    const rows = bouncesByPerson([
      // AMS-1 chiuso, riaperto, richiuso: un ticket chiuso, due chiusure, due riaperture
      bounce('COMPLETED', 'Anna', 'AMS-1'),
      bounce('REOPENED', 'Anna', 'AMS-1'),
      bounce('COMPLETED', 'Anna', 'AMS-1'),
      bounce('REOPENED', 'Anna', 'AMS-1'),
      bounce('COMPLETED', 'Anna', 'AMS-2'),
      bounce('COMPLETED', 'Anna', 'AMS-3'),
      bounce('COMPLETED', 'Anna', 'AMS-4'),
      bounce('COMPLETED', 'Bruno', 'AMS-5'),
    ]);

    expect(rows[0]).toMatchObject({
      name: 'Anna',
      closedTickets: 4,
      bouncedTickets: 1,
      bouncedPct: 25,
      reopenings: 2,
      repeated: 1,
    });
    expect(rows[1]).toMatchObject({ name: 'Bruno', closedTickets: 1, bouncedTickets: 0 });
  });

  it('un ticket riaperto ma non chiuso nel periodo non entra tra i rimbalzati', () => {
    // Chiuso l'anno prima e riaperto nel periodo: la riapertura c'è, il ticket chiuso del periodo no
    const rows = bouncesByPerson([
      bounce('COMPLETED', 'Anna', 'AMS-1'),
      bounce('REOPENED', 'Anna', 'AMS-9'),
    ]);

    expect(rows[0]).toMatchObject({ closedTickets: 1, bouncedTickets: 0, reopenings: 1 });
  });

  it('attesa del cliente: ticket distinti messi in attesa e ticket con risposta', () => {
    const rows = bouncesByPerson([
      bounce('WAIT_ENTERED', 'Anna', 'AMS-1'),
      bounce('WAIT_RETURNED', 'Anna', 'AMS-1'),
      bounce('WAIT_ENTERED', 'Anna', 'AMS-1'),
      bounce('WAIT_RETURNED', 'Anna', 'AMS-1'),
      bounce('WAIT_ENTERED', 'Anna', 'AMS-2'),
    ]);

    expect(rows[0]).toMatchObject({ waitTickets: 2, answeredTickets: 1, answeredPct: 50 });
  });

  it('per richiedente: stesso conteggio, raggruppato su chi ha aperto la richiesta', () => {
    const rows = bouncesByPerson(
      [
        bounce('COMPLETED', 'Anna', 'AMS-1', '2026-10-14T10:00:00', 'ERP', 'Cliente A'),
        bounce('COMPLETED', 'Bruno', 'AMS-2', '2026-10-14T10:00:00', 'ERP', 'Cliente A'),
        bounce('REOPENED', 'Anna', 'AMS-1', '2026-10-14T10:00:00', 'ERP', 'Cliente A'),
        bounce('REOPENED', 'Bruno', 'AMS-2', '2026-10-14T10:00:00', 'ERP', 'Cliente A'),
        bounce('REOPENED', 'Bruno', 'AMS-3', '2026-10-14T10:00:00', 'ERP', null),
      ],
      'reporter',
    );

    expect(rows.map((row) => [row.name, row.bouncedTickets])).toEqual([
      ['Cliente A', 2],
      ['(senza richiedente)', 0],
    ]);
    expect(rows[0]).toMatchObject({ closedTickets: 2, bouncedPct: 100 });
  });

  it('senza chiusi la percentuale non si calcola e chi non ha assegnatario è "Non assegnato"', () => {
    const rows = bouncesByPerson([bounce('REOPENED', null)]);

    expect(rows[0].name).toBe('Non assegnato');
    expect(rows[0].bouncedPct).toBeNull();
  });

  it('ordina da chi ha più ticket rimbalzati, a parità più riaperture', () => {
    const rows = bouncesByPerson([
      bounce('COMPLETED', 'Anna', 'AMS-1'),
      bounce('REOPENED', 'Anna', 'AMS-1'),
      bounce('COMPLETED', 'Bruno', 'AMS-2'),
      bounce('REOPENED', 'Bruno', 'AMS-2'),
      bounce('REOPENED', 'Bruno', 'AMS-2'),
      bounce('COMPLETED', 'Carla', 'AMS-3'),
    ]);

    expect(rows.map((row) => row.name)).toEqual(['Bruno', 'Anna', 'Carla']);
  });

  it('il totale conta i ticket distinti e calcola le percentuali sui totali', () => {
    const total = totalBounces([
      bounce('COMPLETED', 'Anna', 'AMS-1'),
      bounce('COMPLETED', 'Bruno', 'AMS-2'),
      bounce('REOPENED', 'Anna', 'AMS-1'),
    ]);

    expect(total).toMatchObject({ closedTickets: 2, bouncedTickets: 1, bouncedPct: 50 });
  });

  it('chiusi senza mai passare dall attesa del cliente: la storia si guarda per intero', () => {
    const all = [
      bounce('COMPLETED', 'Anna', 'AMS-1'),
      bounce('COMPLETED', 'Anna', 'AMS-2'),
      bounce('WAIT_ENTERED', 'Bruno', 'AMS-2', '2025-01-10T10:00:00'),
      bounce('COMPLETED', 'Anna', 'AMS-3'),
      bounce('COMPLETED', 'Anna', 'AMS-4'),
    ];
    // Filtri: solo Anna e il 2026. L'attesa di AMS-2 è di un altro e di un anno prima, ma conta lo stesso
    const filtered = all.filter((b) => b.kind === 'COMPLETED' && b.handler === 'Anna');

    expect(closedWithoutWaiting(filtered, all)).toEqual({
      tickets: 3,
      closed: 4,
      pct: 75,
      withWaiting: 1,
      withWaitingPct: 25,
    });
  });

  it('senza chiusi la quota senza attesa non si calcola', () => {
    expect(closedWithoutWaiting([], [])).toEqual({
      tickets: 0,
      closed: 0,
      pct: null,
      withWaiting: 0,
      withWaitingPct: null,
    });
  });

  it('filtra per area, persona, anno e mese del passaggio', () => {
    const all = [
      bounce('REOPENED', 'Anna', 'AMS-1', '2026-10-14T10:00:00', 'ERP'),
      bounce('REOPENED', 'Bruno', 'AMS-2', '2026-10-14T10:00:00', 'ERP'),
      bounce('REOPENED', 'Anna', 'AMS-3', '2025-10-14T10:00:00', 'ERP'),
      bounce('REOPENED', 'Anna', 'AMS-4', '2026-09-14T10:00:00', null),
    ];

    const filtered = filterBounces(all, {
      areas: ['ERP'],
      assignees: ['Anna'],
      years: [2026],
      months: [10],
    });
    expect(filtered.map((b) => b.key)).toEqual(['AMS-1']);
    expect(
      filterBounces(all, { areas: ['(senza area)'], assignees: null, years: null, months: null }),
    ).toHaveLength(1);
  });

  it('i ticket peggiori sono quelli riaperti più volte, a scendere; le risposte del cliente non contano', () => {
    const worst = worstTickets(
      [
        bounce('REOPENED', 'Anna', 'AMS-1'),
        bounce('WAIT_RETURNED', 'Anna', 'AMS-4'),
        bounce('WAIT_RETURNED', 'Anna', 'AMS-4'),
        bounce('REOPENED', 'Anna', 'AMS-2'),
        bounce('REOPENED', 'Anna', 'AMS-2'),
        bounce('REOPENED', 'Anna', 'AMS-3'),
        bounce('REOPENED', 'Anna', 'AMS-3'),
        bounce('REOPENED', 'Anna', 'AMS-3'),
        bounce('COMPLETED', 'Anna', 'AMS-5'),
      ],
      5,
    );

    expect(worst.map((t) => [t.key, t.reopened])).toEqual([
      ['AMS-3', 3],
      ['AMS-2', 2],
      ['AMS-1', 1],
    ]);
  });

  it('per settimana: lunedì-domenica, settimane vuote a zero e ultima parziale', () => {
    // Mercoledì 14/10/2026: la settimana corrente parte lunedì 12/10, la precedente va dal 5/10 all'11/10
    const weeks = bouncesByWeek(
      [
        bounce('REOPENED', 'Anna', 'AMS-1', '2026-10-13T10:00:00'),
        bounce('WAIT_RETURNED', 'Anna', 'AMS-1', '2026-10-05T10:00:00'),
        bounce('REOPENED', 'Anna', 'AMS-1', '2026-10-11T22:00:00'),
      ],
      new Date(2026, 9, 14),
      3,
    );

    expect(weeks).toHaveLength(3);
    expect(weeks.map((w) => [w.reopened, w.waitReturned])).toEqual([
      [0, 0],
      [1, 1],
      [1, 0],
    ]);
    expect(weeks.map((w) => w.partial)).toEqual([false, false, true]);
  });
});
