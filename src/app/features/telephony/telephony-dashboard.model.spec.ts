import { describe, expect, it } from 'vitest';

import {
  NOT_SET,
  SimCount,
  applyFilters,
  costParts,
  distinct,
  pivot,
  total,
} from './telephony-dashboard.model';

function sim(changes: Partial<SimCount>): SimCount {
  return {
    country: 'Italia',
    company: 'Marlu Retail',
    plan: 'PROFILO 1',
    lineUse: 'Telefono',
    migrationStatus: 'Migrata a TIM',
    operator: 'TIM',
    assigneeType: 'Persona',
    lines: 1,
    monthlyCost: 6,
    optionsCost: 0,
    ...changes,
  };
}

const ROWS: SimCount[] = [
  sim({ lines: 10, monthlyCost: 60, optionsCost: 5 }),
  sim({ plan: 'PROFILO ALLARMI', lineUse: 'Allarme', lines: 4, monthlyCost: 12 }),
  sim({
    country: 'San Marino',
    company: 'Marlù SpA',
    plan: 'TMS 1',
    lineUse: null,
    lines: 20,
    monthlyCost: null,
  }),
];

describe('dashboard telefonia', () => {
  it('somma le linee e i costi', () => {
    expect(total(ROWS, 'lines')).toBe(34);
    expect(total(ROWS, 'cost')).toBe(77);
    expect(costParts(ROWS)).toEqual({ profiles: 72, options: 5 });
  });

  it('filtra per paese e tratta il dato mancante come "Non indicato"', () => {
    expect(applyFilters(ROWS, { country: 'Italia' })).toHaveLength(2);
    expect(applyFilters(ROWS, { lineUse: NOT_SET })).toHaveLength(1);
    expect(applyFilters(ROWS, {})).toHaveLength(3);
  });

  it('elenca i valori distinti in ordine alfabetico', () => {
    expect(distinct(ROWS, 'country')).toEqual(['Italia', 'San Marino']);
  });

  it('costruisce la pivot con righe e colonne dal totale più alto', () => {
    const result = pivot(ROWS, 'company', 'country', 'lines');
    expect(result.columns).toEqual(['San Marino', 'Italia']);
    expect(result.rows[0]).toEqual({ label: 'Marlù SpA', cells: [20, 0], total: 20 });
    expect(result.rows[1]).toEqual({ label: 'Marlu Retail', cells: [0, 14], total: 14 });
    expect(result.columnTotals).toEqual([20, 14]);
    expect(result.grandTotal).toBe(34);
  });

  it('senza dimensione di colonna dà solo il totale per riga', () => {
    const result = pivot(ROWS, 'plan', null, 'cost');
    expect(result.columns).toEqual([]);
    expect(result.rows.map((row) => row.label)).toEqual(['PROFILO 1', 'PROFILO ALLARMI', 'TMS 1']);
    expect(result.grandTotal).toBe(77);
  });
});
