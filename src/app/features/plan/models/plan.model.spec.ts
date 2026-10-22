import { describe, expect, it } from 'vitest';

import { isOpenStatus, parseDays, saturationLevel, sumDays } from './plan.model';

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
});
