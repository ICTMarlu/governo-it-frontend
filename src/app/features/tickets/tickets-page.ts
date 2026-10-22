import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { PageHeader } from '../../shared/components/page-header/page-header';
import { SavedViews } from '../../shared/views/saved-views';
import { errorMessage } from '../../shared/crud/crud-api.service';
import { HelpButton } from '../../shared/help/help-button';
import { ALERTS_HELP, PERSON_LOAD_HELP, TICKETS_HELP } from '../../shared/help/help-content';
import { FlowChart } from './components/flow-chart/flow-chart';
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
  jiraSearchUrl,
} from './models/ticket.model';
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
  protected readonly sync = inject(TicketSyncService);

  protected readonly help = TICKETS_HELP;
  protected readonly personLoadHelp = PERSON_LOAD_HELP;
  protected readonly alertHelp = ALERTS_HELP;
  protected readonly alertKinds = ALERT_KINDS;
  protected readonly severityLabels = SEVERITY_LABELS;
  protected readonly severityIcons = SEVERITY_ICONS;

  protected readonly dashboard = signal<TicketDashboard | null>(null);
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

  protected readonly hiddenPending = computed(
    () => (this.tickets() ?? []).filter((ticket) => ticket.pending).length,
  );

  /** Ticket mostrati: senza Pending (se richiesto), ordinati; a parità dal più recente. */
  protected readonly visibleTickets = computed(() => {
    const levels = [...this.listSort(), ...DEFAULT_LIST_SORT];
    return (this.tickets() ?? [])
      .filter((ticket) => this.includePending() || !ticket.pending)
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
      },
      error: (error: unknown) => this.loadError.set(errorMessage(error)),
    });
  }

  protected selectPerson(person: PersonLoad): void {
    this.setFilter(
      person.resourceId !== null
        ? { label: person.name ?? '', resourceId: person.resourceId }
        : person.name === null
          ? { label: 'Senza assegnatario', unassigned: true }
          : null,
    );
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
    if (alert.resourceId !== null) {
      this.setFilter({ label: alert.personName ?? '', resourceId: alert.resourceId });
    } else if (alert.area !== null) {
      this.setFilter({ label: alert.area, area: alert.area });
    }
  }

  protected adviceUrl(item: Advice): string | null {
    return jiraSearchUrl(this.dashboard()?.sync.jiraBaseUrl ?? null, item.issueKeys);
  }

  /** Persona dell'azione: apre i suoi ticket nell'elenco. */
  protected adviceFilter(item: Advice): void {
    if (item.resourceId !== null) {
      this.setFilter({ label: item.personName ?? '', resourceId: item.resourceId });
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
