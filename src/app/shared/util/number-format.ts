// Numeri all'italiana con il punto delle migliaia anche sotto 10.000 ("1.372 €", non "1372 €"):
// il formato it-IT del browser lo omette per i numeri di 4 cifre (minimumGroupingDigits = 2),
// mentre la pipe "number" di Angular lo mette sempre. Così i due modi danno lo stesso risultato.

const cache = new Map<string, Intl.NumberFormat>();

/** Formattatore it-IT con il separatore delle migliaia sempre presente (riusato a parità di opzioni). */
export function numberFormat(options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const key = JSON.stringify(options);
  let format = cache.get(key);
  if (!format) {
    // 'always' è standard (ES2023) ma non ancora nei tipi della lib ES2022 del progetto
    const grouping = { useGrouping: 'always' } as unknown as Intl.NumberFormatOptions;
    format = new Intl.NumberFormat('it-IT', { ...options, ...grouping });
    cache.set(key, format);
  }
  return format;
}

/** Numero it-IT, al massimo con i decimali indicati (es. 1.372,5). */
export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return numberFormat({ maximumFractionDigits }).format(value);
}
