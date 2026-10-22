import { describe, expect, it } from 'vitest';

import { matchesTerms, normalizeText, searchTerms } from './text-search';

describe('ricerca testuale', () => {
  it('ignora maiuscole, accenti e spazi in più', () => {
    expect(normalizeText('  Festività   Nazionale ')).toBe('festivita nazionale');
    expect(searchTerms('   ')).toEqual([]);
  });

  it('trova tutte le parole in qualsiasi ordine', () => {
    const terms = searchTerms('office  migr ');
    expect(matchesTerms(terms, ['Migrazione Office 365', null])).toBe(true);
    expect(matchesTerms(searchTerms('office sap'), ['Migrazione Office 365'])).toBe(false);
  });

  it('cerca anche tra più campi della riga', () => {
    expect(
      matchesTerms(searchTerms('ict26bi ticket'), ['ICT26BI119', 'BI AMS Marlù - Ticketing']),
    ).toBe(true);
    expect(matchesTerms(searchTerms('marlu'), ['BI AMS Marlù'])).toBe(true);
  });
});
