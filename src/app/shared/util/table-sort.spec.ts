import { describe, expect, it } from 'vitest';

import { nextSort, sortRows } from './table-sort';

interface Row {
  readonly id: number;
  readonly name: string | null;
  readonly n: number | null;
}

const value = (row: Row, key: string) => (key === 'n' ? row.n : row.name);
const ids = (rows: readonly Row[]) => rows.map((row) => row.id);

describe('ordinamento delle tabelle', () => {
  const rows: Row[] = [
    { id: 1, name: 'zeta', n: 3 },
    { id: 2, name: 'Alfa', n: null },
    { id: 3, name: null, n: 10 },
    { id: 4, name: 'beta 10', n: 2 },
    { id: 5, name: 'beta 9', n: 2 },
  ];

  it('senza ordinamento lascia l’ordine di partenza', () => {
    expect(ids(sortRows(rows, null, value))).toEqual([1, 2, 3, 4, 5]);
  });

  it('testo: maiuscole non contano e i numeri dentro il testo si leggono come numeri', () => {
    expect(ids(sortRows(rows, { key: 'name', desc: false }, value))).toEqual([2, 5, 4, 1, 3]);
  });

  it('i vuoti restano in fondo anche in decrescente', () => {
    expect(ids(sortRows(rows, { key: 'name', desc: true }, value))).toEqual([1, 4, 5, 2, 3]);
    expect(ids(sortRows(rows, { key: 'n', desc: true }, value))).toEqual([3, 1, 4, 5, 2]);
  });

  it('un clic: colonna nuova in crescente (o dal più alto), la stessa si inverte', () => {
    expect(nextSort(null, 'name')).toEqual({ key: 'name', desc: false });
    expect(nextSort(null, 'at', true)).toEqual({ key: 'at', desc: true });
    expect(nextSort({ key: 'at', desc: true }, 'at', true)).toEqual({ key: 'at', desc: false });
  });
});
