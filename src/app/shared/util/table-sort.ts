/** Ordinamento semplice di una tabella: colonna e direzione. null = ordine di partenza. */
export interface TableSort {
  readonly key: string;
  readonly desc: boolean;
}

const COLLATOR = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

/**
 * Righe ordinate per colonna: testo con le regole italiane (maiuscole e accenti non contano, i numeri
 * dentro il testo si leggono come numeri), numeri e date come tali. I valori vuoti restano in fondo sia in
 * ordine crescente che decrescente. Senza ordinamento le righe restano nell'ordine di partenza.
 */
export function sortRows<T>(
  rows: readonly T[],
  sort: TableSort | null,
  valueOf: (row: T, key: string) => string | number | null | undefined,
): T[] {
  if (sort === null) {
    return [...rows];
  }
  const sign = sort.desc ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = valueOf(a, sort.key) ?? null;
    const y = valueOf(b, sort.key) ?? null;
    if (x === null || x === '' || y === null || y === '') {
      const emptyX = x === null || x === '';
      const emptyY = y === null || y === '';
      return emptyX === emptyY ? 0 : emptyX ? 1 : -1;
    }
    const result =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : COLLATOR.compare(String(x), String(y));
    return sign * result;
  });
}

/**
 * Effetto di un clic sull'intestazione: una colonna nuova parte in crescente (o dal valore più alto se
 * {@code descFirst}, come le date); un secondo clic inverte.
 */
export function nextSort(current: TableSort | null, key: string, descFirst = false): TableSort {
  return { key, desc: current?.key === key ? !current.desc : descFirst };
}
