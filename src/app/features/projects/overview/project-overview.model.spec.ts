import {
  OverviewPriority,
  OverviewProject,
  OverviewStatus,
  applyFilter,
  byStatus,
  mismatches,
  planHint,
  completions,
  priorityName,
  sortToPlan,
  ToPlanSortKey,
  statusColor,
  priorityMatrix,
  summary,
  toPlanList,
  workByProject,
  workBySystem,
} from './project-overview.model';

const STATUSES: OverviewStatus[] = [
  { id: 1, code: 'TO_START', label: 'To Start', color: null, closed: false },
  { id: 2, code: 'APPROVED', label: 'Approved', color: null, closed: false },
  { id: 3, code: 'IN_PROGRESS', label: 'In Progress', color: null, closed: false },
  { id: 4, code: 'PENDING', label: 'Pending', color: null, closed: false },
  { id: 5, code: 'COMPLETED', label: 'Completed', color: null, closed: true },
  { id: 6, code: 'STANDBY', label: 'Stand By', color: null, closed: false },
];
const PRIORITIES: OverviewPriority[] = [
  { level: 1, label: 'Importante', color: null },
  { level: 2, label: 'Necessario', color: null },
];

function project(id: number, over: Partial<OverviewProject> = {}): OverviewProject {
  const status = STATUSES.find((s) => s.code === (over.statusCode ?? 'IN_PROGRESS'))!;
  const base: OverviewProject = {
    id,
    code: null,
    name: `P${id}`,
    workTypeCode: 'PROJECT',
    workTypeLabel: 'Project',
    statusId: status.id,
    statusCode: status.code,
    statusLabel: status.label,
    statusColor: null,
    closed: status.closed,
    priorityLevel: 1,
    priorityLabel: 'Importante',
    priorityColor: null,
    businessPriorityLevel: null,
    systemLabel: 'ERP',
    owners: null,
    ranking: null,
    mine: false,
    daysPast: 0,
    daysThisWeek: 0,
    daysAhead: 0,
    daysLater: 0,
    peopleAhead: 0,
    lastPlannedWeek: null,
    closedOn: null,
    focusDaysAhead: 0,
    ...over,
  };
  // Senza persona in vista le giornate della persona sono tutte le giornate
  return { ...base, focusDaysAhead: over.focusDaysAhead ?? base.daysAhead };
}

describe('panoramica progetti', () => {
  const rows = [
    project(1, { daysAhead: 10, daysThisWeek: 2, systemLabel: 'ERP' }),
    project(2, {
      priorityLevel: 2,
      statusCode: 'TO_START',
      daysAhead: 4,
      daysThisWeek: 1,
      systemLabel: 'BI',
    }),
    project(3, { statusCode: 'APPROVED', daysLater: 6 }),
    project(4, { priorityLevel: null, statusCode: 'TO_START' }),
    project(5, { statusCode: 'PENDING' }),
    project(6, { statusCode: 'COMPLETED', daysAhead: 2 }),
    project(7, { workTypeCode: 'AMS', mine: true, daysAhead: 5, systemLabel: null }),
  ];

  it('filtra per tipo e per "i miei"', () => {
    const only = (types: string[], mineOnly = false) =>
      applyFilter(rows, { types: new Set(types), mineOnly }).map((p) => p.id);
    expect(only(['PROJECT'])).toEqual([1, 2, 3, 4, 5, 6]);
    expect(only([])).toHaveLength(7);
    expect(only([], true)).toEqual([7]);
  });

  it('riassume aperti, pianificati e da pianificare (Pending e chiusi esclusi)', () => {
    const s = summary(rows);
    expect(s.open).toBe(6);
    expect(s.inProgress).toBe(2);
    expect(s.pending).toBe(1);
    expect(s.planned).toBe(3);
    expect(s.toPlan).toBe(2);
    expect(s.toPlanTop).toBe(1);
    expect(s.daysAhead).toBe(19);
  });

  it('Stand By è fermo: fuori da aperti e da pianificare, contato a parte, avviso solo se pianificato', () => {
    const standby = [
      project(20, { statusCode: 'STANDBY' }),
      project(21, { statusCode: 'STANDBY', daysAhead: 2 }),
    ];
    const all = [...rows, ...standby];
    const s = summary(all);
    expect(s.standby).toBe(2);
    expect(s.open).toBe(6);
    expect(s.planned).toBe(3);
    expect(s.toPlan).toBe(2);
    expect(toPlanList(all).map((p) => p.id)).not.toContain(20);
    expect(mismatches(all).pendingWithPlan.map((p) => p.id)).toEqual([21]);
  });

  it('conta per stato solo gli stati con progetti', () => {
    expect(byStatus(rows, STATUSES).map((s) => [s.status.code, s.count])).toEqual([
      ['TO_START', 2],
      ['APPROVED', 1],
      ['IN_PROGRESS', 2],
      ['PENDING', 1],
      ['COMPLETED', 1],
    ]);
  });

  it('incrocia priorità e piano sugli attivi', () => {
    const m = priorityMatrix(rows, PRIORITIES);
    expect(m.map((r) => [r.level, r.planned, r.notPlanned])).toEqual([
      [1, [1, 7], [3]],
      [2, [2], []],
      [null, [], [4]],
    ]);
    // In che stato sono i da pianificare
    const byStatusOf = (level: number | null) =>
      priorityMatrix(rows, PRIORITIES, STATUSES)
        .find((r) => r.level === level)!
        .notPlannedByStatus.map((s) => [s.status.code, s.count]);
    expect(byStatusOf(1)).toEqual([['APPROVED', 1]]);
    expect(byStatusOf(null)).toEqual([['TO_START', 1]]);
  });

  it('ordina i da pianificare per priorità, senza priorità in fondo', () => {
    expect(toPlanList(rows).map((p) => p.id)).toEqual([3, 4]);
    expect(planHint(rows[2])).toBe('più avanti: 6 gg');
    expect(planHint(rows[3])).toBe('mai pianificato');
    expect(planHint(project(9, { lastPlannedWeek: '2026-10-05' }))).toBe('piano finito');
  });

  it('dice dove va il lavoro per progetto e per sistema', () => {
    expect(workByProject(rows, 2)).toEqual([
      { label: 'P1', value: 10 },
      { label: 'P7', value: 5 },
    ]);
    expect(workBySystem(rows)).toEqual([
      { label: 'ERP', value: 12 },
      { label: 'Senza sistema', value: 5 },
      { label: 'BI', value: 4 },
    ]);
  });

  it('trova stato e piano che non tornano', () => {
    const m = mismatches([
      ...rows,
      project(8, { statusCode: 'IN_PROGRESS' }),
      project(9, { statusCode: 'PENDING', daysLater: 3 }),
    ]);
    expect(m.inProgressWithoutPlan.map((p) => p.id)).toEqual([8]);
    expect(m.startedNotInProgress.map((p) => p.id)).toEqual([2]);
    // Il Completed 6 con giornate non è un avviso; il Pending 9 con giornate sì
    expect(m.pendingWithPlan.map((p) => p.id)).toEqual([9]);
  });

  it('dà un nome leggibile alle priorità e un colore agli stati senza colore', () => {
    expect(priorityName({ level: 1, label: '1', color: null })).toBe('Priorità 1');
    expect(priorityName({ level: 2, label: 'Necessario', color: null })).toBe('P2 · Necessario');
    expect(statusColor(STATUSES[2])).toBe('var(--mat-sys-primary)');
    expect(statusColor({ ...STATUSES[4], color: '#123456' })).toBe('#123456');
  });

  it('ordina i da pianificare per colonna, di partenza dalla priorità più importante', () => {
    const list = [
      project(10, {
        name: 'Zeta',
        priorityLevel: 3,
        statusCode: 'TO_START',
        systemLabel: 'BI',
        daysPast: 2,
      }),
      project(11, {
        name: 'Alfa',
        priorityLevel: 1,
        statusCode: 'APPROVED',
        daysLater: 4,
        daysPast: 9,
      }),
      project(12, {
        name: 'Beta',
        priorityLevel: null,
        statusCode: 'IN_PROGRESS',
        systemLabel: 'CRM',
      }),
      project(13, {
        name: 'Gamma',
        priorityLevel: 2,
        statusCode: 'TO_START',
        lastPlannedWeek: '2026-09-07',
        daysPast: 5,
      }),
    ];
    const ids = (key: ToPlanSortKey, desc = false) =>
      sortToPlan(list, { key, desc }, STATUSES).map((p) => p.id);
    expect(ids('priority')).toEqual([11, 13, 10, 12]);
    expect(ids('priority', true)).toEqual([12, 10, 13, 11]);
    expect(ids('name')).toEqual([11, 12, 13, 10]);
    expect(ids('status')).toEqual([13, 10, 11, 12]);
    expect(ids('plan')).toEqual([10, 12, 13, 11]);
    // Giornate già fatte, dalla più alta
    expect(ids('past', true)).toEqual([11, 13, 10, 12]);
  });

  it('conta le chiusure come statistica, dalla più recente', () => {
    const c = completions(
      [
        project(20, { name: 'Vecchio', statusCode: 'COMPLETED', closedOn: '2026-08-01' }),
        project(21, { name: 'Recente', statusCode: 'COMPLETED', closedOn: '2026-10-28' }),
        project(22, { name: 'Senza data', statusCode: 'COMPLETED' }),
        project(23, { statusCode: 'IN_PROGRESS' }),
      ],
      '2026-11-02',
    );
    expect(c.items.map((p) => p.id)).toEqual([21, 20, 22]);
    expect(c.last30).toBe(1);
    expect(c.withDate).toBe(2);
  });

  it('con una persona in vista conta solo le sue giornate', () => {
    const s = summary([
      project(30, { daysAhead: 10, focusDaysAhead: 4 }),
      project(31, { daysAhead: 6, focusDaysAhead: 0 }),
    ]);
    expect(s.daysAhead).toBe(4);
  });
});
