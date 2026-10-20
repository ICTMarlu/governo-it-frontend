import { Injectable, Provider } from '@angular/core';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MAT_DATE_LOCALE,
  MatDateFormats,
  NativeDateAdapter,
} from '@angular/material/core';

const DAY_MONTH_YEAR = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\s*$/;

/**
 * Adattatore date del calendario: legge e scrive le date come gg/mm/aaaa e fa partire la
 * settimana dal lunedì.
 */
@Injectable()
export class ItalianDateAdapter extends NativeDateAdapter {
  override getFirstDayOfWeek(): number {
    return 1;
  }

  override parse(value: unknown): Date | null {
    if (typeof value !== 'string') {
      return super.parse(value);
    }
    if (value.trim() === '') {
      return null;
    }
    const match = DAY_MONTH_YEAR.exec(value);
    if (!match) {
      return this.invalid();
    }
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    const date = new Date(year, month, day);
    // Rifiuta date inesistenti come 31/02
    return date.getMonth() === month && date.getDate() === day ? date : this.invalid();
  }

  override format(date: Date, displayFormat: object): string {
    if (displayFormat === ITALIAN_DATE_FORMATS.display.dateInput) {
      const pad = (part: number) => String(part).padStart(2, '0');
      return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
    }
    return super.format(date, displayFormat);
  }
}

export const ITALIAN_DATE_FORMATS: MatDateFormats = {
  parse: { dateInput: null },
  display: {
    dateInput: { year: 'numeric', month: '2-digit', day: '2-digit' },
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
  },
};

export function provideItalianDates(): Provider[] {
  return [
    { provide: MAT_DATE_LOCALE, useValue: 'it-IT' },
    { provide: DateAdapter, useClass: ItalianDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: ITALIAN_DATE_FORMATS },
  ];
}

/** Data ISO del backend (aaaa-mm-gg) in data locale, senza slittamenti di fuso. */
export function fromIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Data locale in formato ISO per il backend (aaaa-mm-gg). */
export function toIsoDate(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
