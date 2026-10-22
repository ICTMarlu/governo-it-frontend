import { describe, expect, it } from 'vitest';

import { compareByLevels, nextSortLevels, sortPosition } from './multi-sort';

interface Row {
  readonly key: number;
  readonly person: string | null;
  readonly age: number;
}

const value = (row: Row, id: string) => row[id as keyof Row];

describe('multi-sort', () => {
  it('clic: crescente, decrescente, tolto; un’altra colonna è il secondo livello', () => {
    let sort = nextSortLevels([], 'person');
    expect(sort).toEqual([{ id: 'person', direction: 'asc' }]);
    sort = nextSortLevels(sort, 'age');
    expect(sort.map((s) => s.id)).toEqual(['person', 'age']);
    expect(sortPosition(sort, 'age')).toEqual({ position: 2, direction: 'asc' });
    sort = nextSortLevels(sort, 'person');
    expect(sort[0].direction).toBe('desc');
    sort = nextSortLevels(sort, 'person');
    expect(sort).toEqual([{ id: 'age', direction: 'asc' }]);
  });

  it('ordina per persona e, a parità, per età decrescente; i vuoti in fondo', () => {
    const rows: Row[] = [
      { key: 1, person: 'Mirco', age: 5 },
      { key: 2, person: null, age: 50 },
      { key: 3, person: 'Elia', age: 3 },
      { key: 4, person: 'Elia', age: 30 },
    ];
    const levels = [
      { id: 'person', direction: 'asc' as const },
      { id: 'age', direction: 'desc' as const },
    ];
    expect(
      [...rows].sort((a, b) => compareByLevels(a, b, levels, value)).map((r) => r.key),
    ).toEqual([4, 3, 1, 2]);
  });
});
