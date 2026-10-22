/**
 * Ricerca testuale "alla Excel" ma più tollerante: ignora maiuscole, accenti e spazi in più;
 * più parole valgono come "contiene tutte", in qualsiasi ordine ("office migr" trova
 * "Migrazione Office 365").
 */

/** Testo confrontabile: minuscolo, senza accenti, spazi ridotti a uno. */
export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Parole della ricerca già normalizzate; nessuna parola = nessun filtro. */
export function searchTerms(query: string): string[] {
  const normalized = normalizeText(query);
  return normalized ? normalized.split(' ') : [];
}

/** Vero se tutte le parole compaiono in almeno uno dei testi. */
export function matchesTerms(
  terms: readonly string[],
  values: readonly (string | null | undefined)[],
): boolean {
  if (terms.length === 0) {
    return true;
  }
  const haystack = normalizeText(values.filter(Boolean).join(' '));
  return terms.every((term) => haystack.includes(term));
}
