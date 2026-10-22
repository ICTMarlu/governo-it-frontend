/**
 * Ordinamento a due livelli per le tabelle, come "ordina per… poi per…" di Excel (D-22):
 * clic su una colonna = crescente → decrescente → tolta; clic su un'altra colonna con un
 * ordinamento attivo = secondo livello; una terza colonna sostituisce il secondo.
 */
export type SortDirection = 'asc' | 'desc';

export interface SortLevel {
  readonly id: string;
  readonly direction: SortDirection;
}

export const MAX_SORT_LEVELS = 2;

/** Effetto di un clic sull'intestazione della colonna {@code id}. */
export function nextSortLevels(current: readonly SortLevel[], id: string): SortLevel[] {
  const index = current.findIndex((level) => level.id === id);
  if (index === -1) {
    return [...current.slice(0, MAX_SORT_LEVELS - 1), { id, direction: 'asc' }];
  }
  if (current[index].direction === 'asc') {
    return current.map((level, i) => (i === index ? { id, direction: 'desc' } : level));
  }
  return current.filter((_, i) => i !== index);
}

const COLLATOR = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

/**
 * Confronto su più livelli; {@code valueOf} dà il valore della colonna. I valori vuoti vanno in
 * fondo in entrambe le direzioni.
 */
export function compareByLevels<T>(
  a: T,
  b: T,
  levels: readonly SortLevel[],
  valueOf: (item: T, id: string) => string | number | null | undefined,
): number {
  for (const level of levels) {
    const x = valueOf(a, level.id);
    const y = valueOf(b, level.id);
    const xEmpty = x === null || x === undefined || x === '';
    const yEmpty = y === null || y === undefined || y === '';
    if (xEmpty || yEmpty) {
      if (xEmpty !== yEmpty) {
        return xEmpty ? 1 : -1;
      }
      continue;
    }
    const result =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : COLLATOR.compare(String(x), String(y));
    if (result !== 0) {
      return level.direction === 'asc' ? result : -result;
    }
  }
  return 0;
}

/** Posizione (1 o 2) e direzione della colonna nell'ordinamento, per l'intestazione. */
export function sortPosition(
  levels: readonly SortLevel[],
  id: string,
): { readonly position: number; readonly direction: SortDirection } | null {
  const index = levels.findIndex((level) => level.id === id);
  return index === -1 ? null : { position: index + 1, direction: levels[index].direction };
}
