/** Ticket AMS da Jira (D-24): tipi della dashboard e piccole funzioni di supporto. */

export interface TicketSync {
  readonly configured: boolean;
  readonly running: boolean;
  readonly lastSuccessAt: string | null;
  readonly lastRunAt: string | null;
  readonly lastSucceeded: boolean;
  readonly lastMessage: string | null;
  readonly jiraBaseUrl: string | null;
}

export interface TicketKpis {
  readonly open: number;
  readonly toDo: number;
  readonly inProgress: number;
  readonly waitingCustomer: number;
  readonly unassigned: number;
  /** Senza assegnatario da oltre {@link unassignedHours} ore (quelli delle azioni consigliate). */
  readonly unassignedLate: number;
  readonly unassignedHours: number;
  readonly overdue: number;
  readonly stale: number;
  /** Soglia dei fermi: senza aggiornamenti da oltre questi giorni. */
  readonly staleDays: number;
  readonly createdLast7Days: number;
  readonly resolvedLast7Days: number;
  readonly withProject: number;
  readonly averageAgeDays: number;
}

export interface WeekFlow {
  readonly weekStart: string;
  readonly created: number;
  readonly resolved: number;
  readonly openAtEnd: number;
}

export interface PersonLoad {
  readonly resourceId: number | null;
  readonly name: string | null;
  readonly open: number;
  readonly toDo: number;
  readonly inProgress: number;
  readonly waitingCustomer: number;
  readonly overdue: number;
  readonly stale: number;
  readonly oldestDays: number;
  readonly averageAgeDays: number;
  /** Entrati e chiusi negli ultimi 7 giorni di calendario. */
  readonly createdLast7Days: number;
  readonly resolvedLast7Days: number;
  /** Entrati e chiusi nelle ultime 4 settimane complete. */
  readonly createdLast4Weeks: number;
  readonly resolvedLast4Weeks: number;
  readonly resolvedPerWeek: number;
  readonly amsPlannedDays: number | null;
  readonly weeks: readonly WeekFlow[];
  readonly backlogGrowing: boolean;
}

export interface AreaLoad {
  readonly area: string;
  readonly open: number;
  readonly resolvedLast4Weeks: number;
}

export interface ProjectTickets {
  readonly projectId: number;
  readonly code: string;
  readonly name: string;
  readonly open: number;
  readonly resolvedLast4Weeks: number;
}

export type AdviceSeverity = 'HIGH' | 'MEDIUM' | 'INFO';

export interface Advice {
  readonly severity: AdviceSeverity;
  readonly audience: 'EM' | 'PERSON';
  readonly resourceId: number | null;
  readonly personName: string | null;
  readonly title: string;
  readonly detail: string;
  readonly issueKeys: readonly string[];
  readonly count: number;
}

/** Allerta da anticipare (D-30). */
export type AlertKind = 'SPIKE' | 'BALANCE' | 'DUE_SOON' | 'NO_RESPONSE' | 'CONCENTRATION';

export interface TicketAlert {
  readonly kind: AlertKind;
  readonly severity: AdviceSeverity;
  readonly title: string;
  readonly detail: string;
  readonly issueKeys: readonly string[];
  readonly area: string | null;
  readonly resourceId: number | null;
  readonly personName: string | null;
}

/** Nome e icona di ogni tipo di allerta. */
export const ALERT_KINDS: Readonly<
  Record<AlertKind, { readonly label: string; readonly icon: string }>
> = {
  SPIKE: { label: 'Picco di richieste', icon: 'bolt' },
  BALANCE: { label: 'Saldo che peggiora', icon: 'trending_up' },
  DUE_SOON: { label: 'Scadenze vicine', icon: 'schedule' },
  NO_RESPONSE: { label: 'Nuovi senza risposta', icon: 'mark_email_unread' },
  CONCENTRATION: { label: 'Carico concentrato', icon: 'person_alert' },
};

export interface TicketDashboard {
  readonly sync: TicketSync;
  readonly kpis: TicketKpis;
  readonly weeks: readonly WeekFlow[];
  readonly people: readonly PersonLoad[];
  readonly areas: readonly AreaLoad[];
  readonly projects: readonly ProjectTickets[];
  readonly advice: readonly Advice[];
  readonly alerts: readonly TicketAlert[];
}

export interface Ticket {
  readonly key: string;
  readonly summary: string;
  readonly statusName: string;
  readonly statusCategory: 'NEW' | 'INDETERMINATE' | 'DONE';
  readonly waitingCustomer: boolean;
  /** Stato tra i "Pending" dei parametri generali. */
  readonly pending: boolean;
  readonly area: string | null;
  readonly requestType: string | null;
  readonly priority: string | null;
  readonly resourceId: number | null;
  readonly assigneeName: string | null;
  readonly projectId: number | null;
  readonly projectCode: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly resolvedAt: string | null;
  readonly dueDate: string | null;
  readonly ageDays: number;
  /** Giorni dall'ultimo aggiornamento in Jira. */
  readonly idleDays: number;
  readonly overdue: boolean;
  readonly stale: boolean;
  readonly url: string | null;
}

/** Filtro dell'elenco dei ticket (dal clic su persona, area o progetto). */
export interface TicketFilter {
  readonly label: string;
  readonly resourceId?: number;
  readonly unassigned?: boolean;
  readonly area?: string;
  readonly projectId?: number;
}

export const SEVERITY_LABELS: Readonly<Record<AdviceSeverity, string>> = {
  HIGH: 'Urgente',
  MEDIUM: 'Da fare',
  INFO: 'Suggerimento',
};

export const SEVERITY_ICONS: Readonly<Record<AdviceSeverity, string>> = {
  HIGH: 'error',
  MEDIUM: 'warning',
  INFO: 'lightbulb',
};

/** Link a Jira con una ricerca sui ticket indicati (o null senza indirizzo di Jira). */
export function jiraSearchUrl(baseUrl: string | null, keys: readonly string[]): string | null {
  if (!baseUrl || keys.length === 0) {
    return null;
  }
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}issues/?jql=${encodeURIComponent(`key in (${keys.join(',')})`)}`;
}

/** Tempo trascorso in parole: "3 min fa", "2 h fa", "ieri", "il 18/10". */
export function sinceLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) {
    return 'mai';
  }
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) {
    return 'adesso';
  }
  if (minutes < 60) {
    return `${minutes} min fa`;
  }
  if (minutes < 24 * 60) {
    return `${Math.round(minutes / 60)} h fa`;
  }
  const date = new Date(iso);
  return `il ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Saldo della settimana: chiusi meno entrati (positivo = il backlog scende). */
export function weekBalance(week: WeekFlow): number {
  return week.resolved - week.created;
}
