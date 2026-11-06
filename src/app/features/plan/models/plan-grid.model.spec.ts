import { describe, expect, it } from 'vitest';

import { GridEntry, buildSections, compareSystems } from './plan-grid.model';
import { PlanRow } from './plan.model';

function row(name: string, workTypeCode: string, over: Partial<PlanRow> = {}): PlanRow {
  return {
    id: 1,
    resourceId: 1,
    projectId: 1,
    projectCode: null,
    projectName: name,
    workTypeCode,
    workTypeLabel: workTypeCode,
    mainSystemLabel: null,
    mainSystemSortOrder: null,
    ranking: null,
    cells: [],
    ...over,
  } as unknown as PlanRow;
}

function entry(planRow: PlanRow): GridEntry {
  return {
    group: {} as GridEntry['group'],
    gridRow: { row: planRow, cells: {}, total: 0, nav: 0 },
  };
}

describe('piano: ricorrenti (AMS e Continuous) in cima', () => {
  it('nello stesso gruppo prima i ricorrenti, poi il resto', () => {
    const rows = [
      row('Amministrazione', 'ADMIN'),
      row('Project Management', 'PROJECT'),
      row('AMS Ticketing', 'AMS'),
    ];

    expect(rows.sort(compareSystems).map((r) => r.projectName)).toEqual([
      'AMS Ticketing',
      'Project Management',
      'Amministrazione',
    ]);
  });

  it('ricorrenti in cima, progetti in mezzo, Admin in fondo; il gruppo con i ricorrenti sta sopra, anche senza sistema e anche con ranking peggiore', () => {
    const entries = [
      entry(row('ERP nuovo', 'PROJECT', { mainSystemLabel: 'ERP', ranking: 1 })),
      entry(row('AMS Ticketing', 'AMS', { ranking: 9 })),
      entry(row('Continuous', 'CONTINUOUS', { mainSystemLabel: 'BI', ranking: 5 })),
      entry(row('Formazione', 'ADMIN', { mainSystemLabel: 'HR', ranking: 1 })),
    ];

    expect(buildSections(entries, 'p1').map((s) => s.label)).toEqual([
      'BI',
      'Ricorrenti',
      'ERP',
      'HR',
    ]);
  });
});
