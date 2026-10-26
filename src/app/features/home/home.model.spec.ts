import { describe, expect, it } from 'vitest';

import {
  HomeInsight,
  ProjectWork,
  byRanking,
  greeting,
  groupWork,
  headline,
  isoWeek,
} from './home.model';

const insight = (summary: string): HomeInsight => ({
  kind: 'TICKET_BALANCE',
  severity: 'HIGH',
  summary,
  text: summary,
  link: '/tickets',
  linkLabel: 'Apri',
});

describe('home', () => {
  it('compone il punto di oggi con le prime tre intuizioni', () => {
    expect(
      headline([
        insight('il backlog AMS cresce di 14,5 ticket a settimana'),
        insight('23 ticket nuovi senza risposta'),
        insight('Elia oltre il 100% questa settimana'),
        insight('non entra'),
      ]),
    ).toBe(
      'Il backlog AMS cresce di 14,5 ticket a settimana, 23 ticket nuovi senza risposta e Elia oltre il 100% questa settimana.',
    );
    expect(headline([])).toBe('Nessun segnale da anticipare: tutto sotto controllo.');
  });

  it('saluta secondo l’ora e conta le settimane ISO', () => {
    expect(greeting(new Date(2026, 9, 23, 9))).toBe('Buongiorno');
    expect(greeting(new Date(2026, 9, 23, 15))).toBe('Buon pomeriggio');
    expect(greeting(new Date(2026, 9, 23, 20))).toBe('Buonasera');
    expect(isoWeek(new Date(2026, 9, 23))).toBe(43);
    expect(isoWeek(new Date(2027, 0, 1))).toBe(53);
  });

  it('raggruppa le giornate dei progetti per progetto, persona e area', () => {
    const weeks = ['2026-10-19', '2026-10-26'];
    const work = (
      projectId: number,
      name: string,
      system: string | null,
      resourceId: number,
      resourceName: string,
      weekStart: string,
      days: number,
      ranking: number | null = null,
    ): ProjectWork => ({
      projectId,
      code: null,
      name,
      ranking,
      system,
      status: 'In Progress',
      resourceId,
      resourceName,
      weekStart,
      days,
    });
    const rows = [
      work(1, 'Alfa', 'ERP', 10, 'Anna', '2026-10-19', 1, 1),
      work(1, 'Alfa', 'ERP', 11, 'Bruno', '2026-10-19', 2, 1),
      work(1, 'Alfa', 'ERP', 11, 'Bruno', '2026-10-26', 0.5, 1),
      work(2, 'Beta', null, 10, 'Anna', '2026-10-26', 1, 2),
    ];
    const byProject = groupWork(rows, weeks, 'project');
    expect(byProject.map((g) => [g.label, g.total, g.perWeek])).toEqual([
      ['Alfa', 3.5, [3, 0.5]],
      ['Beta', 1, [0, 1]],
    ]);
    expect(byProject[0].children.map((c) => [c.label, c.total])).toEqual([
      ['Bruno', 2.5],
      ['Anna', 1],
    ]);
    const byPerson = groupWork(rows, weeks, 'person');
    expect(byPerson.map((g) => [g.label, g.total])).toEqual([
      ['Bruno', 2.5],
      ['Anna', 2],
    ]);
    expect(groupWork(rows, weeks, 'area').map((g) => [g.label, g.total])).toEqual([
      ['ERP', 3.5],
      ['(senza sistema)', 1],
    ]);
  });

  it('ordina per ranking: il più piccolo prima, a parità l’alfabetico, senza ranking in fondo', () => {
    const items = [
      { label: 'Zeta', ranking: 2 },
      { label: 'Senza', ranking: null },
      { label: 'Beta', ranking: 2 },
      { label: 'Alfa', ranking: 9001 },
      { label: 'Primo', ranking: 1 },
    ];
    expect([...items].sort(byRanking).map((item) => item.label)).toEqual([
      'Primo',
      'Beta',
      'Zeta',
      'Alfa',
      'Senza',
    ]);
  });
});
