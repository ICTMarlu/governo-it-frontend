import { describe, expect, it } from 'vitest';

import {
  Task,
  TaskStatusOption,
  compareTasks,
  doneStatus,
  dueLabel,
  firstOpenStatus,
  groupByProject,
  toBody,
} from './task.model';

const base: Task = {
  id: 1,
  kind: 'TASK',
  title: 'Configurare VPN',
  description: null,
  statusId: 1,
  statusCode: 'TODO',
  statusLabel: 'Da fare',
  statusColor: null,
  done: false,
  priorityLevelId: null,
  priorityLevel: null,
  assigneeId: 5,
  assigneeName: 'Andrea Franciosi',
  projectId: 10,
  projectCode: 'ICT26ERP127',
  projectName: 'ERP',
  planRowId: 14,
  weekStart: '2026-10-19',
  dueDate: null,
  remindOn: null,
  completedOn: null,
  overdue: false,
  createdByName: 'Admin',
  createdAt: '2026-10-21T07:00:00Z',
  updatedAt: null,
  commentCount: 0,
  canEdit: true,
  version: 'AAA',
};

const task = (changes: Partial<Task>): Task => ({ ...base, ...changes });

const statuses: TaskStatusOption[] = [
  { id: 1, code: 'TODO', label: 'Da fare', color: null, active: true, done: false },
  { id: 4, code: 'CANCELLED', label: 'Annullato', color: null, active: true, done: true },
  { id: 3, code: 'DONE', label: 'Fatto', color: null, active: true, done: true },
];

describe('task.model', () => {
  it('la spunta usa lo stato DONE e la riapertura il primo stato aperto', () => {
    expect(doneStatus(statuses)?.code).toBe('DONE');
    expect(firstOpenStatus(statuses)?.code).toBe('TODO');
    expect(doneStatus(statuses.filter((s) => s.code !== 'DONE'))?.code).toBe('CANCELLED');
  });

  it('ordina aperti prima, poi in ritardo, poi per scadenza', () => {
    const sorted = [
      task({ id: 1, done: true }),
      task({ id: 2, dueDate: '2026-11-10' }),
      task({ id: 3, dueDate: '2026-10-01', overdue: true }),
      task({ id: 4 }),
      task({ id: 5, dueDate: '2026-10-25' }),
    ].sort(compareTasks);
    expect(sorted.map((t) => t.id)).toEqual([3, 5, 2, 4, 1]);
  });

  it('raggruppa per progetto con i senza progetto in fondo', () => {
    const groups = groupByProject([
      task({ id: 1, projectId: null, projectCode: null, projectName: null }),
      task({ id: 2, projectId: 20, projectCode: 'ICT26AMS001', projectName: 'AMS' }),
      task({ id: 3, done: true }),
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      'ICT26AMS001 AMS',
      'ICT26ERP127 ERP',
      'Senza progetto',
    ]);
    expect(groups[1].open).toBe(0);
  });

  it('descrive la scadenza in parole', () => {
    expect(dueLabel(task({ dueDate: '2026-10-21' }), '2026-10-21')).toBe('scade oggi');
    expect(dueLabel(task({ dueDate: '2026-10-20', overdue: true }), '2026-10-21')).toBe(
      'scaduto il 20/10',
    );
    expect(dueLabel(task({ dueDate: '2026-10-30' }), '2026-10-21')).toBe('entro il 30/10');
    expect(dueLabel(task({}), '2026-10-21')).toBe('');
  });

  it('il corpo di salvataggio mantiene i campi non modificati', () => {
    const body = toBody(base, { title: 'Nuovo titolo' });
    expect(body.title).toBe('Nuovo titolo');
    expect(body.planRowId).toBe(14);
    expect(body.version).toBe('AAA');
  });
});
