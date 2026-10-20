import { TestBed } from '@angular/core/testing';
import { DateAdapter } from '@angular/material/core';
import { describe, expect, it } from 'vitest';

import {
  ITALIAN_DATE_FORMATS,
  ItalianDateAdapter,
  fromIsoDate,
  provideItalianDates,
  toIsoDate,
} from './italian-date-adapter';

describe('ItalianDateAdapter', () => {
  TestBed.configureTestingModule({ providers: [provideItalianDates()] });
  const adapter = TestBed.inject(DateAdapter) as ItalianDateAdapter;

  it('legge gg/mm/aaaa e anche l’anno a due cifre', () => {
    expect(toIsoDate(adapter.parse('1/3/2026')!)).toBe('2026-03-01');
    expect(toIsoDate(adapter.parse('15.03.26')!)).toBe('2026-03-15');
  });

  it('rifiuta date inesistenti o scritte male', () => {
    expect(adapter.isValid(adapter.parse('31/02/2026')!)).toBe(false);
    expect(adapter.isValid(adapter.parse('2026/03')!)).toBe(false);
    expect(adapter.parse('  ')).toBeNull();
  });

  it('mostra la data come gg/mm/aaaa e parte dal lunedì', () => {
    expect(adapter.format(new Date(2026, 2, 1), ITALIAN_DATE_FORMATS.display.dateInput)).toBe(
      '01/03/2026',
    );
    expect(adapter.getFirstDayOfWeek()).toBe(1);
  });

  it('converte le date ISO del backend senza slittamenti di fuso', () => {
    expect(toIsoDate(fromIsoDate('2026-12-31')!)).toBe('2026-12-31');
    expect(fromIsoDate(null)).toBeNull();
  });
});
