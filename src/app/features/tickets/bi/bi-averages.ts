import { BiTicket, MONTHS } from './bi.model';

/** Che cosa si conta: i ticket creati nel mese o quelli risolti nel mese (di chiusura). */
export type AverageField = 'created' | 'resolved';

export type AverageTrend = 'up' | 'down' | 'flat';

/** Quanti mesi completi recenti si confrontano con i precedenti dell'anno. */
export const RECENT_MONTHS = 3;

/** Media mensile dell'anno in corso e trend: ultimi mesi contro i precedenti. */
export interface MonthlyAverage {
  readonly year: number;
  /** Mesi completi dell'anno considerati (il mese in corso è escluso: è parziale). */
  readonly months: number;
  /** Etichette del primo e dell'ultimo mese considerati, es. "gen" e "ott". */
  readonly from: string;
  readonly to: string;
  /** Ticket al mese, in media sui mesi completi. */
  readonly average: number;
  /** Media degli ultimi {@link RECENT_MONTHS} mesi completi; null se non ci sono mesi precedenti da confrontare. */
  readonly recentAverage: number | null;
  /** Media dei mesi completi prima di quelli recenti. */
  readonly earlierAverage: number | null;
  /** Etichette dei mesi recenti e dei precedenti, es. "ago"–"ott" e "gen"–"lug". */
  readonly recentFrom: string | null;
  readonly earlierTo: string | null;
  /** Differenza tra la media recente e la precedente, in ticket al mese. */
  readonly delta: number | null;
  /** Variazione in percentuale; null se la media precedente è zero. */
  readonly deltaPct: number | null;
  readonly trend: AverageTrend | null;
  /** Ticket del mese in corso finora, per orientarsi. */
  readonly currentMonthLabel: string;
  readonly currentMonthSoFar: number;
}

/** Sotto questa variazione (in percentuale) il trend si considera stabile. */
const FLAT_BELOW_PCT = 1;

function inMonth(iso: string | null, year: number, month: number): boolean {
  if (!iso) {
    return false;
  }
  const time = new Date(iso).getTime();
  return (
    time >= new Date(year, month, 1).getTime() && time < new Date(year, month + 1, 1).getTime()
  );
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Media dei ticket al mese dell'anno in corso, sui mesi completi (gennaio fino al mese scorso).
 * Trend: la media degli ultimi {@link RECENT_MONTHS} mesi completi contro quella dei mesi prima, nello stesso
 * anno. Serve almeno un mese prima dei recenti: con meno di {@link RECENT_MONTHS} + 1 mesi completi il
 * confronto non c'è. A gennaio non c'è ancora nessun mese completo e la media è zero.
 */
export function monthlyAverage(
  tickets: readonly BiTicket[],
  now: Date,
  field: AverageField,
): MonthlyAverage {
  const year = now.getFullYear();
  const completed = now.getMonth();
  const counts: number[] = [];
  for (let month = 0; month < completed; month++) {
    counts.push(tickets.filter((t) => inMonth(t[field], year, month)).length);
  }

  let recentAverage: number | null = null;
  let earlierAverage: number | null = null;
  let delta: number | null = null;
  let deltaPct: number | null = null;
  let trend: AverageTrend | null = null;
  if (counts.length > RECENT_MONTHS) {
    recentAverage = mean(counts.slice(-RECENT_MONTHS));
    earlierAverage = mean(counts.slice(0, -RECENT_MONTHS));
    delta = recentAverage - earlierAverage;
    deltaPct = earlierAverage === 0 ? null : (delta * 100) / earlierAverage;
    const small = deltaPct !== null ? Math.abs(deltaPct) < FLAT_BELOW_PCT : delta === 0;
    trend = small ? 'flat' : delta > 0 ? 'up' : 'down';
  }
  return {
    year,
    months: counts.length,
    from: MONTHS[0],
    to: MONTHS[Math.max(completed - 1, 0)],
    average: mean(counts),
    recentAverage,
    earlierAverage,
    recentFrom: recentAverage === null ? null : MONTHS[completed - RECENT_MONTHS],
    earlierTo: earlierAverage === null ? null : MONTHS[completed - RECENT_MONTHS - 1],
    delta,
    deltaPct,
    trend,
    currentMonthLabel: MONTHS[completed],
    currentMonthSoFar: tickets.filter((t) => inMonth(t[field], year, completed)).length,
  };
}
