import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';

import { PageHeader } from '../../shared/components/page-header/page-header';
import { SavedViews } from '../../shared/views/saved-views';
import { errorMessage } from '../../shared/crud/crud-api.service';
import { HelpButton } from '../../shared/help/help-button';
import { ALERTS_HELP, PERSON_LOAD_HELP, TICKETS_HELP } from '../../shared/help/help-content';
import { FlowChart } from './components/flow-chart/flow-chart';
import { KpiDirective } from './components/kpi.directive';
import {
  ALERT_KINDS,
  Advice,
  PersonLoad,
  SEVERITY_ICONS,
  SEVERITY_LABELS,
  Ticket,
  TicketDashboard,
  TicketAlert,
  TicketFilter,
  CONFIRM_IDLE_DAYS,
  isConfirmStatus,
  jiraSearchUrl,
  DailyFlow,
} from './models/ticket.model';
import { KpiSettingsService } from './services/kpi-settings.service';
import { TicketSyncService } from './services/ticket-sync.service';
import { TicketsService } from './services/tickets.service';
import {
  SortLevel,
  compareByLevels,
  nextSortLevels,
  sortPosition,
} from '../../shared/util/multi-sort';

/** Colonne ordinabili dell'elenco dei ticket. */
const LIST_COLUMNS: readonly {
  readonly id: string;
  readonly label: string;
  readonly num?: boolean;
}[] = [
  { id: 'key', label: 'Ticket' },
  { id: 'summary', label: 'Titolo' },
  { id: 'status', label: 'Stato' },
  { id: 'person', label: 'Persona' },
  { id: 'reporter', label: 'Richiedente' },
  { id: 'area', label: 'Area' },
  { id: 'project', label: 'Progetto' },
  { id: 'age', label: 'Età', num: true },
  { id: 'idle', label: 'Ultimo agg.', num: true },
  { id: 'due', label: 'Scadenza' },
];

/** Di partenza: dal ticket più recente (numero più alto) al più vecchio. */
const DEFAULT_LIST_SORT: readonly SortLevel[] = [{ id: 'key', direction: 'desc' }];

/** Numero del ticket (MRLIT-2658 → 2658), per ordinare come in Jira. */
function keyNumber(ticket: Ticket): number {
  return Number(ticket.key.split('-').pop()) || 0;
}

function listValue(ticket: Ticket, id: string): string | number | null {
  switch (id) {
    case 'key':
      return keyNumber(ticket);
    case 'summary':
      return ticket.summary;
    case 'status':
      return ticket.statusName;
    case 'person':
      return ticket.assigneeName;
    case 'reporter':
      return ticket.reporterName;
    case 'area':
      return ticket.area;
    case 'project':
      return ticket.projectCode;
    case 'age':
      return ticket.ageDays;
    case 'idle':
      return ticket.idleDays;
    case 'due':
      return ticket.dueDate;
    default:
      return null;
  }
}

type AdviceView = 'all' | 'EM' | 'PERSON';

/**
 * Dashboard dei ticket AMS (D-24): quanto pesa il service desk su ogni persona, come scorrono i
 * ticket settimana per settimana e cosa conviene fare adesso (azioni consigliate per chi
 * coordina e per la persona). In Jira non ci sono ore: si leggono conteggi e flussi, accanto
 * alle giornate AMS pianificate nel piano.
 */
@Component({
  selector: 'gov-tickets-page',
  imports: [
    KpiDirective,
    DatePipe,
    DecimalPipe,
    FlowChart,
    HelpButton,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTooltipModule,
    PageHeader,
    RouterLink,
    SavedViews,
  ],
  templateUrl: './tickets-page.html',
  styleUrl: './tickets-page.scss',
})
export class TicketsPage {
  private readonly service = inject(TicketsService);
  private readonly router = inject(Router);
  protected readonly sync = inject(TicketSyncService);

  protected readonly help = TICKETS_HELP;
  protected readonly personLoadHelp = PERSON_LOAD_HELP;
  protected readonly alertHelp = ALERTS_HELP;
  protected readonly alertKinds = ALERT_KINDS;
  protected readonly severityLabels = SEVERITY_LABELS;
  protected readonly severityIcons = SEVERITY_ICONS;

  protected readonly dashboard = signal<TicketDashboard | null>(null);
  private readonly kpiSettings = inject(KpiSettingsService);
  /** Allerte dei tipi che l'utente non ha nascosto (Personalizza KPI). */
  protected readonly alerts = computed(() =>
    (this.dashboard()?.alerts ?? []).filter((alert) =>
      this.kpiSettings.visible('alert.' + alert.kind),
    ),
  );
  protected readonly loadError = signal<string | null>(null);
  protected readonly adviceView = signal<AdviceView>('all');
  protected readonly filter = signal<TicketFilter | null>(null);
  protected readonly includeDone = signal(false);
  protected readonly tickets = signal<Ticket[] | null>(null);
  /** Elenco: i Pending sono nascosti finché non li si chiede. */
  protected readonly includePending = signal(false);
  /** Ordinamento a due livelli dell'elenco (clic sulle intestazioni). */
  protected readonly listSort = signal<readonly SortLevel[]>(DEFAULT_LIST_SORT);
  protected readonly listColumns = LIST_COLUMNS;
  protected readonly sortHint =
    "Clic: ordina (poi decrescente, poi togli). Su un'altra colonna diventa il secondo livello";

  /** Periodo delle colonne per area e progetto: aperti di oggi, chiusi negli ultimi 28 giorni. */
  protected readonly period28 = computed(() => {
    const to = new Date();
    const from = new Date(to.getFullYear(), to.getMonth(), to.getDate() - 28);
    const fmt = (d: Date) =>
      d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `Aperti: oggi · Chiusi: dal ${fmt(from)} al ${fmt(to)} (ultime 4 settimane)`;
  });
  protected readonly confirmIdleDays = CONFIRM_IDLE_DAYS;

  /** Nome dell'ultimo giorno lavorativo mostrato: "ieri", oppure il giorno della settimana (es. dopo il fine settimana). */
  protected previousLabel(day: string): string {
    const date = new Date(`${day}T00:00:00`);
    const yesterday = new Date();
    yesterday.setHours(0, 0, 0, 0);
    yesterday.setDate(yesterday.getDate() - 1);
    return date.getTime() === yesterday.getTime()
      ? 'ieri'
      : date.toLocaleDateString('it-IT', { weekday: 'long' });
  }

  /** Scostamento dalla media giornaliera, con segno e un decimale: "+1,5", "−0,5", "in linea". */
  protected delta(value: number, average: number): string {
    const diff = Math.round((value - average) * 10) / 10;
    if (diff === 0) {
      return 'in linea';
    }
    const text = Math.abs(diff).toLocaleString('it-IT', { maximumFractionDigits: 1 });
    return `${diff > 0 ? '+' : '−'}${text}`;
  }

  /**
   * Come sta andando rispetto alla media: gli entrati sopra la media sono un peggioramento, i chiusi
   * sotto la media anche. In linea entro mezzo ticket.
   */
  protected trend(created: number, resolved: number, daily: DailyFlow): 'good' | 'bad' | 'flat' {
    const balance = created - resolved;
    const average = daily.averageCreated - daily.averageResolved;
    const diff = Math.round((balance - average) * 10) / 10;
    return diff > 0.5 ? 'bad' : diff < -0.5 ? 'good' : 'flat';
  }
  /** Tutti i ticket aperti, senza filtri: base del numero "in conferma/UAT da oltre N giorni". */
  private readonly openTickets = signal<readonly Ticket[]>([]);
  protected readonly confirmIdleCount = computed(
    () => this.openTickets().filter(isConfirmIdle).length,
  );

  protected readonly hiddenPending = computed(
    () => (this.tickets() ?? []).filter((ticket) => ticket.pending).length,
  );

  /** Ticket mostrati: senza Pending (se richiesto), ordinati; a parità dal più recente. */
  protected readonly visibleTickets = computed(() => {
    const levels = [...this.listSort(), ...DEFAULT_LIST_SORT];
    const confirmIdle = this.filter()?.confirmIdle === true;
    return (this.tickets() ?? [])
      .filter((ticket) => !confirmIdle || isConfirmIdle(ticket))
      .filter((ticket) => confirmIdle || this.includePending() || !ticket.pending)
      .sort((a, b) => compareByLevels(a, b, levels, listValue));
  });

  protected readonly advice = computed(() => {
    const view = this.adviceView();
    return (this.dashboard()?.advice ?? []).filter(
      (item) => view === 'all' || item.audience === view,
    );
  });

  /** Persone con ticket o con giornate AMS; i ticket senza assegnatario in fondo. */
  protected readonly people = computed(() => this.dashboard()?.people ?? []);

  /** Stato salvato nelle viste (D-26): azioni mostrate e filtro dell'elenco. */
  protected readonly viewState = computed(() => ({
    advice: this.adviceView(),
    filter: this.filter(),
    includeDone: this.includeDone(),
    includePending: this.includePending(),
    sort: this.listSort(),
  }));

  constructor() {
    this.load();
    // Dopo un aggiornamento da Jira (da qualunque pagina, o automatico) la pagina si ricarica
    let first = true;
    effect(() => {
      this.sync.version();
      if (first) {
        first = false;
        return;
      }
      untracked(() => this.load());
    });
  }

  protected applyView(state: unknown): void {
    const saved = (state ?? {}) as Partial<{
      advice: AdviceView;
      filter: TicketFilter | null;
      includeDone: boolean;
      includePending: boolean;
      sort: SortLevel[];
    }>;
    this.adviceView.set(saved.advice ?? 'all');
    this.filter.set(saved.filter ?? null);
    this.includeDone.set(saved.includeDone ?? false);
    this.includePending.set(saved.includePending ?? false);
    this.listSort.set(saved.sort ?? DEFAULT_LIST_SORT);
    if (this.dashboard()) {
      this.loadTickets();
    }
  }

  protected load(): void {
    this.service.dashboard().subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        this.sync.known(dashboard.sync);
        this.loadError.set(null);
        this.loadTickets();
        this.service.tickets(null).subscribe({ next: (tickets) => this.openTickets.set(tickets) });
      },
      error: (error: unknown) => this.loadError.set(errorMessage(error)),
    });
  }

  /** Ogni clic che apre un elenco porta alla pagina di dettaglio dedicata. */
  private openDetail(queryParams: Record<string, string>): void {
    void this.router.navigate(['/tickets/dettaglio'], { queryParams });
  }

  /** Persona del carico: i suoi ticket aperti (o quelli senza assegnatario). */
  protected selectPerson(person: PersonLoad): void {
    if (person.name === null) {
      this.openDetail({ scope: 'unassigned' });
    } else {
      this.openDetail({ scope: 'open', dim: 'assignee', value: person.name });
    }
  }

  /** Ticket aperti di un'area ("Progetto Marlù"). */
  protected openArea(area: string): void {
    this.openDetail({ scope: 'open', dim: 'area', value: area });
  }

  /** Ticket aperti di un progetto (codice). */
  protected openProject(code: string): void {
    this.openDetail({ scope: 'open', dim: 'project', value: code });
  }

  /** Ticket in conferma cliente / UAT fermi da oltre la soglia. */
  protected showConfirmIdle(): void {
    this.openDetail({ scope: 'confirm-idle' });
  }

  /** Clic sui box priorità e impatto: elenco di dettaglio con priorità e impatto di ogni ticket. */
  protected openPriority(scope: string): void {
    void this.router.navigate(['/tickets/dettaglio'], { queryParams: { scope } });
  }

  /** Clic su "fermi": ticket senza aggiornamenti oltre la soglia. */
  protected openStale(days: number): void {
    this.openDetail({ scope: 'stale', days: String(days) });
  }

  /** Clic su "senza assegnatario": elenco di dettaglio dei ticket aperti non assegnati. */
  protected openUnassigned(): void {
    this.openDetail({ scope: 'unassigned' });
  }

  protected setFilter(filter: TicketFilter | null): void {
    this.filter.set(filter);
    this.loadTickets();
    document.getElementById('ticket-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected toggleListSort(id: string): void {
    this.listSort.update((current) => nextSortLevels(current, id));
  }

  protected sortOf(id: string) {
    return sortPosition(this.listSort(), id);
  }

  protected ariaSort(id: string): 'ascending' | 'descending' | null {
    const sort = this.sortOf(id);
    return sort ? (sort.direction === 'asc' ? 'ascending' : 'descending') : null;
  }

  protected toggleDone(value: boolean): void {
    this.includeDone.set(value);
    this.loadTickets();
  }

  protected alertUrl(alert: TicketAlert): string | null {
    return jiraSearchUrl(this.dashboard()?.sync.jiraBaseUrl ?? null, alert.issueKeys);
  }

  /** Allerta su una persona o un'area: ne apre i ticket nell'elenco sotto. */
  protected alertFilter(alert: TicketAlert): void {
    if (alert.resourceId !== null && alert.personName) {
      this.openDetail({ scope: 'open', dim: 'assignee', value: alert.personName });
    } else if (alert.area !== null) {
      this.openArea(alert.area);
    }
  }

  protected adviceUrl(item: Advice): string | null {
    return jiraSearchUrl(this.dashboard()?.sync.jiraBaseUrl ?? null, item.issueKeys);
  }

  /** Persona dell'azione: apre i suoi ticket nell'elenco. */
  protected adviceFilter(item: Advice): void {
    if (item.resourceId !== null && item.personName) {
      this.openDetail({ scope: 'open', dim: 'assignee', value: item.personName });
    }
  }

  protected ratio(value: number, total: number): number {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  }

  private loadTickets(): void {
    this.tickets.set(null);
    this.service.tickets(this.filter(), this.includeDone()).subscribe({
      next: (tickets) => this.tickets.set(tickets),
      error: () => this.tickets.set([]),
    });
  }
}

/** In attesa del cliente / UAT da oltre la soglia di giorni nello stato. */
function isConfirmIdle(ticket: Ticket): boolean {
  return (
    !ticket.pending && isConfirmStatus(ticket.statusName) && ticket.statusDays > CONFIRM_IDLE_DAYS
  );
}
