import { describe, expect, it } from 'vitest';

import { ExportItem, ExportTopic, agendaText, summaryText } from './management-export';

const topic = (overrides: Partial<ExportTopic>): ExportTopic => ({
  title: 'Punto',
  topicTypeLabel: 'Argomento',
  status: 'TO_DISCUSS',
  priorityLevel: null,
  ownerName: null,
  projectCode: null,
  notes: null,
  decision: null,
  deferralCount: 0,
  actions: [],
  ...overrides,
});

describe('agenda e riepilogo per la direzione', () => {
  it('mette prima gli aggiornamenti con le azioni aperte, poi i punti da discutere', () => {
    const text = agendaText('2026-10-26', [
      topic({
        title: 'Firewall sede',
        topicTypeLabel: 'Roadblock',
        status: 'IN_FOLLOW_UP',
        actions: [
          {
            description: 'Preventivo',
            ownerName: 'Davide',
            dueDate: '2026-10-30',
            done: false,
            overdue: false,
          },
          { description: 'Già fatta', ownerName: null, dueDate: null, done: true, overdue: false },
        ],
      }),
      topic({ title: 'Budget licenze', priorityLevel: 1, deferralCount: 2 }),
    ]);

    expect(text).toContain('AGGIORNAMENTI\n1. [Roadblock] Firewall sede');
    expect(text).toContain('- Preventivo — Davide · entro 30/10');
    expect(text).not.toContain('Già fatta');
    expect(text).toContain(
      'DA DISCUTERE\n2. [Argomento] Budget licenze (priorità 1, rinviato 2 volte)',
    );
  });

  it('raggruppa il riepilogo per esito e indica quando si riparla dei posticipati', () => {
    const item = (
      title: string,
      result: string | null,
      extra: Partial<ExportItem> = {},
    ): ExportItem => ({
      topic: topic({ title }),
      result,
      note: null,
      postponedUntil: null,
      ...extra,
    });
    const text = summaryText({
      meetingDate: '2026-10-26',
      title: null,
      notes: null,
      items: [
        item('Budget', 'CLOSED', { note: 'Approvato' }),
        item('Firewall', 'POSTPONED', { postponedUntil: '2026-11-09' }),
        item('Stampanti', 'POSTPONED'),
        item('Formazione', 'NOT_DISCUSSED'),
      ],
      actions: [],
    });

    expect(text).toContain('DECISIONI E PUNTI CHIUSI\n- Budget: Approvato');
    expect(text).toContain('- Firewall → dal 09/11');
    expect(text).toContain('- Stampanti → alla prossima riunione');
    expect(text).toContain('NON DISCUSSI (restano in agenda)\n- Formazione');
  });
});
