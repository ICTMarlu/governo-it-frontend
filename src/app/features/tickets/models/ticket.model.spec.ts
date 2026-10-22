import { describe, expect, it } from 'vitest';

import { jiraSearchUrl, sinceLabel, weekBalance } from './ticket.model';

describe('ticket.model', () => {
  it('apre in Jira la ricerca dei ticket indicati', () => {
    expect(jiraSearchUrl('https://marlu-team.atlassian.net', ['MRLIT-1', 'MRLIT-2'])).toBe(
      'https://marlu-team.atlassian.net/issues/?jql=key%20in%20(MRLIT-1%2CMRLIT-2)',
    );
    expect(jiraSearchUrl(null, ['MRLIT-1'])).toBeNull();
    expect(jiraSearchUrl('https://x/', [])).toBeNull();
  });

  it('dice da quanto tempo è stato aggiornato', () => {
    const now = new Date('2026-10-21T10:00:00Z');
    expect(sinceLabel(null, now)).toBe('mai');
    expect(sinceLabel('2026-10-21T09:55:00Z', now)).toBe('5 min fa');
    expect(sinceLabel('2026-10-21T07:00:00Z', now)).toBe('3 h fa');
    expect(sinceLabel('2026-10-18T10:00:00Z', now)).toBe('il 18/10');
  });

  it('il saldo è positivo quando si chiude più di quanto entra', () => {
    expect(weekBalance({ weekStart: '2026-10-19', created: 3, resolved: 5, openAtEnd: 10 })).toBe(
      2,
    );
  });
});
