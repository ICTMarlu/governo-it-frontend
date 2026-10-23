/** Home (D-33): il punto di oggi, per il team (Admin e PM) o per sé (gli altri ruoli). */
export type HomeScope = 'TEAM' | 'PERSONAL';
export type InsightSeverity = 'HIGH' | 'MEDIUM' | 'INFO';

export interface HomeInsight {
  readonly kind: string;
  readonly severity: InsightSeverity;
  /** Frase breve per "il punto di oggi". */
  readonly summary: string;
  readonly text: string;
  readonly link: string;
  readonly linkLabel: string;
}

export interface HomeItem {
  readonly kind: 'TASK' | 'TOPIC';
  readonly id: number;
  readonly title: string;
  readonly dueDate: string | null;
  readonly overdue: boolean;
  readonly link: string;
}

export interface Home {
  readonly scope: HomeScope;
  readonly resourceName: string | null;
  readonly tickets: {
    readonly configured: boolean;
    readonly open: number;
    readonly backlogPerWeek: number;
    readonly dueSoon: number;
    readonly dueSoonDays: number;
    readonly noResponse: number;
  };
  readonly plan: {
    readonly weekStart: string;
    readonly saturationPct: number | null;
    readonly plannedPeople: number;
    readonly activePeople: number;
    readonly overloaded: readonly string[];
    readonly unplanned: readonly string[];
  };
  readonly tasks: { readonly overdue: number; readonly dueSoon: number };
  readonly management: {
    readonly open: number;
    readonly overdue: number;
    readonly nextMeeting: string | null;
  };
  readonly insights: readonly HomeInsight[];
  readonly myItems: readonly HomeItem[];
}

/** Icona e nome di ogni gravità: mai solo il colore. */
export const SEVERITIES: Readonly<
  Record<InsightSeverity, { readonly icon: string; readonly label: string }>
> = {
  HIGH: { icon: 'priority_high', label: 'Urgente' },
  MEDIUM: { icon: 'warning', label: 'Da guardare' },
  INFO: { icon: 'lightbulb', label: 'Spunto' },
};

/** "Il punto di oggi": le prime tre intuizioni in una frase. */
export function headline(insights: readonly HomeInsight[]): string {
  const parts = insights.slice(0, 3).map((insight) => insight.summary);
  if (parts.length === 0) {
    return 'Nessun segnale da anticipare: tutto sotto controllo.';
  }
  const sentence =
    parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
}

/** Buongiorno fino alle 13, buon pomeriggio fino alle 18, poi buonasera. */
export function greeting(now: Date): string {
  const hour = now.getHours();
  return hour < 13 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';
}

/** Numero della settimana ISO 8601. */
export function isoWeek(date: Date): number {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  return Math.ceil(((day.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}
