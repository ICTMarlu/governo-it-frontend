import { describe, expect, it } from 'vitest';

import { HomeInsight, greeting, headline, isoWeek } from './home.model';

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
});
