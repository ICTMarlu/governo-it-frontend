import { describe, expect, it } from 'vitest';

import { MovementWeek, movementPoints, movementTotals } from './portfolio.model';

const week = (
  weekStart: string,
  opened: number,
  closed: number,
  inProgress: number,
): MovementWeek => ({
  weekStart,
  opened,
  started: 0,
  closed,
  pending: 0,
  aborted: 0,
  inProgressAtEnd: inProgress,
});

describe('portfolio', () => {
  const weeks = [
    week('2026-10-26', 2, 0, 34),
    week('2026-11-02', 1, 1, 35),
    week('2026-11-30', 0, 3, 31),
  ];

  it('per settimana tiene i punti come sono', () => {
    expect(
      movementPoints(weeks, 'week').map((p) => [p.label, p.opened, p.inProgressAtEnd]),
    ).toEqual([
      ['26/10', 2, 34],
      ['02/11', 1, 35],
      ['30/11', 0, 31],
    ]);
  });

  it('per mese somma le settimane del lunedì e prende gli in corso dell’ultima', () => {
    expect(
      movementPoints(weeks, 'month').map((p) => [p.label, p.opened, p.closed, p.inProgressAtEnd]),
    ).toEqual([
      ['ott-26', 2, 0, 34],
      ['nov-26', 1, 4, 31],
    ]);
    expect(movementTotals(weeks)).toEqual({
      opened: 3,
      started: 0,
      closed: 4,
      pending: 0,
      aborted: 0,
    });
  });
});
