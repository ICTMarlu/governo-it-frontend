import { describe, expect, it } from 'vitest';

import { compareByLevels, isSortable, nextSort, setSort, sortLabel } from './plan-columns';
import { PlanRow } from './plan.model';

const row = (overrides: Partial<PlanRow>): { row: PlanRow; total: number } => ({
  row: {
    id: 1,
    resourceId: 1,
    projectId: 1,
    projectCode: null,
    projectName: 'P',
    workTypeCode: 'PROJECT',
    workTypeLabel: 'Project',
    mainSystemLabel: null,
    mainSystemSortOrder: null,
    statusCode: 'IN_PROGRESS',
    statusLabel: 'In Progress',
    statusSortOrder: 3,
    statusColor: null,
    statusTerminal: false,
    itPriorityLevel: null,
    businessPriorityLevel: null,
    ownerNames: [],
    requesterNames: [],
    rowNote: null,
    sortOrder: 0,
    archived: false,
    vacation: false,
    cells: [],
    yearTotal: 0,
    totalDays: 0,
    version: null,
    ...overrides,
  },
  total: 0,
});

describe('ordinamento a due livelli del piano', () => {
  it("il primo clic ordina, il clic su un'altra colonna aggiunge il secondo livello", () => {
    let sort = nextSort([], 'system');
    expect(sort).toEqual([{ id: 'system', direction: 'asc' }]);
    sort = nextSort(sort, 'prio');
    expect(sort).toEqual([
      { id: 'system', direction: 'asc' },
      { id: 'prio', direction: 'asc' },
    ]);
  });

  it('riclic: crescente, decrescente, tolto; il secondo sale a primo', () => {
    let sort = nextSort(nextSort([], 'system'), 'prio');
    sort = nextSort(sort, 'system');
    expect(sort[0]).toEqual({ id: 'system', direction: 'desc' });
    sort = nextSort(sort, 'system');
    expect(sort).toEqual([{ id: 'prio', direction: 'asc' }]);
  });

  it('una terza colonna prende il posto del secondo livello', () => {
    const sort = nextSort(nextSort(nextSort([], 'system'), 'prio'), 'owner');
    expect(sort.map((level) => level.id)).toEqual(['system', 'owner']);
  });

  it('ordina per sistema e, a parità, per priorità; i vuoti in fondo', () => {
    const rows = [
      row({ projectName: 'A', mainSystemLabel: 'ERP', itPriorityLevel: 3 }),
      row({ projectName: 'B', mainSystemLabel: 'BI', itPriorityLevel: 2 }),
      row({ projectName: 'C', mainSystemLabel: 'ERP', itPriorityLevel: 1 }),
      row({ projectName: 'D', mainSystemLabel: null, itPriorityLevel: 1 }),
    ];
    const levels = [
      { id: 'system', direction: 'asc' as const },
      { id: 'prio', direction: 'asc' as const },
    ];
    expect(
      [...rows].sort((a, b) => compareByLevels(a, b, levels)).map((r) => r.row.projectName),
    ).toEqual(['B', 'C', 'A', 'D']);
  });

  it('dal menu del filtro: imposta la direzione, aggiunge il livello o lo toglie', () => {
    let sort = setSort([], 'prio', 'asc');
    expect(sort).toEqual([{ id: 'prio', direction: 'asc' }]);
    sort = setSort(sort, 'prio', 'desc');
    expect(sort).toEqual([{ id: 'prio', direction: 'desc' }]);
    sort = setSort(sort, 'status', 'asc');
    expect(sort.map((level) => level.id)).toEqual(['prio', 'status']);
    expect(setSort(sort, 'prio', null)).toEqual([{ id: 'status', direction: 'asc' }]);
  });

  it('ordina per giornate di una settimana, le celle vuote in fondo', () => {
    const week = (days: number | null, name: string) =>
      row({
        projectName: name,
        cells: days === null ? [] : [{ weekStart: '2026-10-19', days, note: null }],
      });
    const rows = [week(1, 'A'), week(null, 'B'), week(2.5, 'C')];
    const levels = [{ id: 'w:2026-10-19', direction: 'desc' as const }];
    expect(
      [...rows].sort((a, b) => compareByLevels(a, b, levels)).map((r) => r.row.projectName),
    ).toEqual(['C', 'A', 'B']);
    expect(isSortable('w:2026-10-19')).toBe(true);
    expect(isSortable('w:ieri')).toBe(false);
    expect(sortLabel('w:2026-10-19')).toBe('Settimana 19/10');
  });
});
