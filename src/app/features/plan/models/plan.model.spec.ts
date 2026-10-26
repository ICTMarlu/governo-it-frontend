import { describe, expect, it } from 'vitest';

import {
  HOURS_PER_DAY,
  isOpenStatus,
  parseDays,
  parseQuantity,
  saturationLevel,
  sumDays,
  toUnit,
} from './plan.model';
import { formatDays } from './plan-grid.model';

describe('piano settimanale: valori e saturazione', () => {
  it('legge le giornate scritte con la virgola o il punto', () => {
    expect(parseDays('1,5')).toBe(1.5);
    expect(parseDays('0.25')).toBe(0.25);
    expect(parseDays(' ')).toBe(0);
    expect(parseDays('8')).toBeNull();
    expect(parseDays('1,234')).toBeNull();
    expect(parseDays('abc')).toBeNull();
  });

  it('somma senza artefatti dei decimali', () => {
    expect(sumDays([0.1, 0.2])).toBe(0.3);
    expect(sumDays([1.5, 2.2, 0.15])).toBe(3.85);
  });

  it('colora la saturazione: libero sotto il 90%, pieno fino al 100%, oltre in rosso', () => {
    expect(saturationLevel(4, 5)).toBe('free');
    expect(saturationLevel(4.5, 5)).toBe('full');
    expect(saturationLevel(5, 5)).toBe('full');
    expect(saturationLevel(5.7, 5)).toBe('over');
    expect(saturationLevel(1, 0)).toBe('over');
    expect(saturationLevel(0, 0)).toBe('none');
  });

  it('considera aperti solo gli stati non finali, escluso Pending', () => {
    expect(isOpenStatus('IN_PROGRESS', false)).toBe(true);
    expect(isOpenStatus('TO_START', false)).toBe(true);
    expect(isOpenStatus('PENDING', false)).toBe(false);
    expect(isOpenStatus('COMPLETED', true)).toBe(false);
  });

  it('a ore: converte da e verso le giornate da 7,5 ore, senza perdere precisione', () => {
    expect(HOURS_PER_DAY).toBe(7.5);
    expect(toUnit(1, 'hours')).toBe(7.5);
    expect(toUnit(0.4, 'days')).toBe(0.4);
    // 3 ore = 0,4 giornate; 1 ora = 0,1333 giornate, che a ore tornano 1
    expect(parseQuantity('3', 'hours')).toBe(0.4);
    expect(parseQuantity('1', 'hours')).toBe(0.1333);
    expect(formatDays(0.1333, 'hours')).toBe('1');
    expect(formatDays(0.4, 'hours')).toBe('3');
    expect(formatDays(5.3333, 'hours')).toBe('40');
    expect(formatDays(0.2, 'days')).toBe('0,2');
    expect(formatDays(0, 'hours')).toBe('');
    // Il tetto è 7 giornate = 52,5 ore; oltre non è valido
    expect(parseQuantity('52,5', 'hours')).toBe(7);
    expect(parseQuantity('53', 'hours')).toBeNull();
    expect(parseQuantity('7,5', 'days')).toBeNull();
    expect(parseQuantity('1,234', 'hours')).toBeNull();
    expect(parseQuantity(' ', 'hours')).toBe(0);
  });

  it('i totali a ore sono la somma delle giornate per 7,5: la percentuale non cambia', () => {
    // 1 + 2 + 3 ore = 6 ore = 0,8 giornate, su una capacità di 40 ore (5,3333 giornate)
    const days = sumDays([1, 2, 3].map((hours) => parseQuantity(String(hours), 'hours')!));
    expect(days).toBe(0.8);
    expect(formatDays(days, 'hours')).toBe('6');
    const capacity = 5.3333;
    expect(Math.round((days / capacity) * 1000) / 10).toBe(
      Math.round(((days * 7.5) / (capacity * 7.5)) * 1000) / 10,
    );
    expect(saturationLevel(toUnit(days, 'hours'), toUnit(capacity, 'hours'))).toBe(
      saturationLevel(days, capacity),
    );
  });
});
