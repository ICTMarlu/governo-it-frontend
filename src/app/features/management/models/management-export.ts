/**
 * Testi da mandare alla direzione: agenda prima dell'incontro e riepilogo dopo (D-17).
 * Testo semplice, pronto da incollare in una mail o da stampare.
 */

export interface ExportAction {
  readonly description: string;
  readonly ownerName: string | null;
  readonly dueDate: string | null;
  readonly done: boolean;
  readonly overdue: boolean;
  readonly topicTitle?: string;
}

export interface ExportTopic {
  readonly title: string;
  readonly topicTypeLabel: string;
  readonly status: string;
  readonly priorityLevel: number | null;
  readonly ownerName: string | null;
  readonly projectCode: string | null;
  readonly notes: string | null;
  readonly decision: string | null;
  readonly deferralCount: number;
  readonly actions: readonly ExportAction[];
}

export interface ExportItem {
  readonly topic: ExportTopic;
  readonly result: string | null;
  readonly note: string | null;
  readonly postponedUntil: string | null;
}

export interface ExportMeeting {
  readonly meetingDate: string;
  readonly title: string | null;
  readonly notes: string | null;
  readonly items: readonly ExportItem[];
  readonly actions: readonly ExportAction[];
}

const DAY = new Intl.DateTimeFormat('it-IT', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const SHORT = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit' });

/** Data ISO (aaaa-mm-gg) in data locale, senza slittamenti di fuso. */
function parse(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDay(iso: string): string {
  return DAY.format(parse(iso));
}

function formatShort(iso: string): string {
  return SHORT.format(parse(iso));
}

function topicLine(index: number, topic: ExportTopic): string {
  const details = [
    topic.priorityLevel ? `priorità ${topic.priorityLevel}` : null,
    topic.ownerName ? `owner ${topic.ownerName}` : null,
    topic.projectCode ? `progetto ${topic.projectCode}` : null,
    topic.deferralCount > 0
      ? `rinviato ${topic.deferralCount} ${topic.deferralCount === 1 ? 'volta' : 'volte'}`
      : null,
  ].filter(Boolean);
  return `${index}. [${topic.topicTypeLabel}] ${topic.title}${details.length ? ` (${details.join(', ')})` : ''}`;
}

function actionLine(action: ExportAction, withTopic = false): string {
  const parts = [
    action.ownerName,
    action.dueDate ? `entro ${formatShort(action.dueDate)}` : null,
    action.done ? 'fatta' : action.overdue ? 'IN RITARDO' : null,
  ].filter(Boolean);
  const topic = withTopic && action.topicTitle ? ` (punto: ${action.topicTitle})` : '';
  return `- ${action.description}${parts.length ? ` — ${parts.join(' · ')}` : ''}${topic}`;
}

/** Agenda prima dell'incontro: aggiornamenti sulle azioni, poi i punti da discutere. */
export function agendaText(meetingDate: string, topics: readonly ExportTopic[]): string {
  const lines = [`Agenda incontro con la direzione — ${formatDay(meetingDate)}`, ''];
  const followUps = topics.filter((topic) => topic.status === 'IN_FOLLOW_UP');
  const toDiscuss = topics.filter((topic) => topic.status !== 'IN_FOLLOW_UP');
  let index = 1;
  if (followUps.length > 0) {
    lines.push('AGGIORNAMENTI');
    for (const topic of followUps) {
      lines.push(topicLine(index++, topic));
      const open = topic.actions.filter((action) => !action.done);
      for (const action of open) {
        lines.push(`   ${actionLine(action)}`);
      }
    }
    lines.push('');
  }
  lines.push('DA DISCUTERE');
  if (toDiscuss.length === 0) {
    lines.push('Nessun punto.');
  }
  for (const topic of toDiscuss) {
    lines.push(topicLine(index++, topic));
    if (topic.notes) {
      lines.push(`   ${topic.notes.replace(/\n/g, '\n   ')}`);
    }
  }
  return lines.join('\n');
}

/** Riepilogo dopo l'incontro: decisioni, discussi, posticipati, non discussi e azioni. */
export function summaryText(meeting: ExportMeeting): string {
  const title = meeting.title ? ` · ${meeting.title}` : '';
  const lines = [
    `Riepilogo incontro con la direzione — ${formatDay(meeting.meetingDate)}${title}`,
    '',
  ];
  const group = (result: string) => meeting.items.filter((item) => item.result === result);
  const section = (
    heading: string,
    items: readonly ExportItem[],
    line: (item: ExportItem) => string,
  ) => {
    if (items.length === 0) {
      return;
    }
    lines.push(heading);
    items.forEach((item) => lines.push(line(item)));
    lines.push('');
  };

  section('DECISIONI E PUNTI CHIUSI', group('CLOSED'), (item) => {
    const text = item.topic.decision ?? item.note;
    return `- ${item.topic.title}${text ? `: ${text}` : ''}`;
  });
  section(
    'DISCUSSI, IN CORSO',
    group('DISCUSSED'),
    (item) => `- ${item.topic.title}${item.note ? `: ${item.note}` : ''}`,
  );
  section('POSTICIPATI', group('POSTPONED'), (item) => {
    const when = item.postponedUntil
      ? `dal ${formatShort(item.postponedUntil)}`
      : 'alla prossima riunione';
    return `- ${item.topic.title} → ${when}${item.note ? `: ${item.note}` : ''}`;
  });
  section(
    'NON DISCUSSI (restano in agenda)',
    group('NOT_DISCUSSED'),
    (item) => `- ${item.topic.title}`,
  );
  const pending = meeting.items.filter((item) => item.result === null);
  section('ANCORA DA TRATTARE', pending, (item) => `- ${item.topic.title}`);

  if (meeting.actions.length > 0) {
    lines.push('AZIONI');
    meeting.actions.forEach((action) => lines.push(actionLine(action, true)));
    lines.push('');
  }
  if (meeting.notes) {
    lines.push('NOTE', meeting.notes, '');
  }
  return lines.join('\n').trimEnd();
}
