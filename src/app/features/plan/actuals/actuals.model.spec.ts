import { describe, expect, it } from 'vitest';

import {
  ActualDay,
  ActualWeek,
  addDays,
  dayLabel,
  defaultDay,
  deltaLevel,
  parseHours,
  signedHours,
} from './actuals.model';

const day = (date: string, editable: boolean, weekend = false): ActualDay => ({
  date,
  weekend,
  future: !editable,
  editable,
  holidayName: null,
  theoreticalHours: weekend ? 0 : 7.5,
  loggedHours: 0,
  over: false,
});

const week = (days: ActualDay[]): ActualWeek => ({
  resourceId: 1,
  resourceName: 'Mario',
  weekStart: days[0].date,
  isoWeek: 44,
  status: 'OPEN',
  statusMessage: null,
  canEdit: true,
  canConfirm: true,
  canReopen: false,
  confirmedAt: null,
  confirmedByName: null,
  days,
  rows: [],
  totals: { plannedHours: 0, actualHours: 0, deltaHours: 0, theoreticalHours: 37.5 },
});

describe('consuntivo (D-37)', () => {
  it('propone oggi, altrimenti l’ultimo giorno feriale consuntivabile', () => {
    const current = week([
      day('2026-10-26', true),
      day('2026-10-27', true),
      day('2026-10-28', true),
      day('2026-10-29', false),
      day('2026-10-30', false),
      day('2026-10-31', false, true),
      day('2026-11-01', false, true),
    ]);
    expect(defaultDay(current, '2026-10-28')).toBe('2026-10-28');

    const last = week([
      day('2026-10-19', true),
      day('2026-10-20', true),
      day('2026-10-21', true),
      day('2026-10-22', true),
      day('2026-10-23', true),
      day('2026-10-24', true, true),
      day('2026-10-25', true, true),
    ]);
    expect(defaultDay(last, '2026-10-28')).toBe('2026-10-23');
  });

  it('segnala oltre il piano e, a fine settimana, i progetti indietro', () => {
    expect(deltaLevel({ plannedHours: 7.5, actualHours: 9, automatic: false }, false)).toBe('over');
    expect(deltaLevel({ plannedHours: 15, actualHours: 7.5, automatic: false }, false)).toBe(
      'none',
    );
    expect(deltaLevel({ plannedHours: 15, actualHours: 7.5, automatic: false }, true)).toBe(
      'under',
    );
    expect(deltaLevel({ plannedHours: 7.5, actualHours: 7.5, automatic: true }, true)).toBe('none');
  });

  it('legge le ore scritte con la virgola e scarta quelle impossibili', () => {
    expect(parseHours('1,5')).toBe(1.5);
    expect(parseHours(' 2 ')).toBe(2);
    expect(parseHours('')).toBe(0);
    expect(parseHours('25')).toBeNull();
    expect(parseHours('abc')).toBeNull();
    expect(signedHours(-1.5)).toBe('−1,5');
    expect(signedHours(2)).toBe('+2');
    expect(dayLabel('2026-10-28')).toBe('mer 28/10');
    expect(addDays('2026-10-26', 3)).toBe('2026-10-29');
  });
});
