import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { TopicsBoard } from './components/topics-board/topics-board';
import { Router } from '@angular/router';
import { filter, finalize, switchMap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { canEdit, canView } from '../../core/auth/permissions';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { CrudApiService, errorMessage } from '../../shared/crud/crud-api.service';
import { CrudSection } from '../../shared/crud/crud-section/crud-section';
import { toIsoDate } from '../../shared/dates/italian-date-adapter';
import { MANAGEMENT_HELP } from '../../shared/help/help-content';
import { ExportDialog, ExportDialogData } from './components/export-dialog/export-dialog';
import {
  StartMeetingDialog,
  StartMeetingResult,
} from './components/start-meeting-dialog/start-meeting-dialog';
import {
  ACTIONS_CONFIG,
  MEETING_ROLES,
  MEETINGS_CONFIG,
  TOPICS_CONFIG,
  TOPIC_TYPE_OPTIONS,
} from './management.configs';
import { ExportTopic, agendaText, formatDay } from './models/management-export';
import { isAuthorized, isAwaitingApproval, isOpen } from '../tickets/bi/bi.model';
import { BiStore } from '../tickets/bi/bi-store.service';

/**
 * Direzione (D-17): la lista viva dei punti da portare alla direzione, con inserimento
 * veloce (titolo + Invio), le azioni nate dai punti e le riunioni.
 */
@Component({
  selector: 'gov-management-page',
  imports: [
    FormsModule,
    PageHeader,
    CrudSection,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTabsModule,
    TopicsBoard,
  ],
  templateUrl: './management-page.html',
  styleUrl: './management-page.scss',
})
export class ManagementPage {
  private readonly api = inject(CrudApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly currentUser = inject(AuthService).currentUser;
  private readonly tickets = inject(BiStore);

  protected readonly help = MANAGEMENT_HELP;
  protected readonly topics = TOPICS_CONFIG;
  protected readonly actions = ACTIONS_CONFIG;
  protected readonly meetings = MEETINGS_CONFIG;
  protected readonly typeOptions = TOPIC_TYPE_OPTIONS;

  protected readonly canWrite = computed(() =>
    canEdit(this.currentUser()?.permissions, 'MANAGEMENT'),
  );

  /** Solo l'Admin vede tutto e gestisce le riunioni; gli altri i punti di cui sono owner (D-31). */
  protected readonly seesAll = computed(() => {
    const role = this.currentUser()?.role;
    return role !== undefined && MEETING_ROLES.includes(role);
  });
  /** Punti: elenco oppure kanban per stato. */
  protected readonly view = signal<'list' | 'board'>(
    localStorage.getItem('gov.management.view') === 'board' ? 'board' : 'list',
  );

  protected setView(view: 'list' | 'board'): void {
    this.view.set(view);
    try {
      localStorage.setItem('gov.management.view', view);
    } catch {
      // Preferenza solo comoda: se il browser non salva, resta per questa sessione
    }
  }

  /** Ticket Jira in attesa di approvazione della direzione o già autorizzati (solo con accesso ai Ticket). */
  protected readonly seesTickets = computed(() =>
    canView(this.currentUser()?.permissions, 'TICKETS'),
  );
  protected readonly awaitingApproval = computed(
    () => this.tickets.tickets().filter((t) => isOpen(t) && isAwaitingApproval(t)).length,
  );
  protected readonly authorized = computed(
    () => this.tickets.tickets().filter((t) => isOpen(t) && isAuthorized(t)).length,
  );

  protected openTickets(scope: 'awaiting-approval' | 'authorized'): void {
    void this.router.navigate(['/tickets/dettaglio'], { queryParams: { scope } });
  }

  constructor() {
    // I ticket servono solo per i due riquadri: si caricano per chi ha accesso ai Ticket
    effect(() => {
      if (this.seesTickets()) {
        untracked(() => this.tickets.load());
      }
    });
  }

  protected readonly linked = computed(() => this.currentUser()?.resourceId != null);

  /** Inserimento veloce: titolo e tipo, il resto si completa dopo. */
  protected readonly quickTitle = signal('');
  protected readonly quickType = signal('TOPIC');
  /** "Rivolto a" (facoltativo): a quali direttori va chiesto il punto. */
  protected readonly quickAudience = signal<number[]>([]);
  protected readonly audienceOptions = toSignal(
    this.api.options(TOPICS_CONFIG.fields.find((field) => field.key === 'audienceIds')!.options!),
    { initialValue: [] },
  );
  protected readonly adding = signal(false);
  /** Fa ricaricare l'elenco dei punti dopo un inserimento veloce. */
  protected readonly topicsRefresh = signal(0);

  protected quickAdd(): void {
    const title = this.quickTitle().trim();
    if (!title || this.adding()) {
      return;
    }
    this.adding.set(true);
    this.api
      .create(TOPICS_CONFIG.endpoint, {
        title,
        topicType: this.quickType(),
        ...(this.quickAudience().length > 0 ? { audienceIds: this.quickAudience() } : {}),
      })
      .pipe(finalize(() => this.adding.set(false)))
      .subscribe({
        next: () => {
          this.quickTitle.set('');
          this.quickAudience.set([]);
          this.topicsRefresh.update((value) => value + 1);
          this.snackBar.open(`Punto aggiunto: ${title}`, 'OK', { duration: 2500 });
        },
        error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi'),
      });
  }

  protected startMeeting(): void {
    this.dialog
      .open<StartMeetingDialog, void, StartMeetingResult>(StartMeetingDialog, {
        width: '440px',
        maxWidth: '100vw',
      })
      .afterClosed()
      .pipe(
        filter((result): result is StartMeetingResult => result !== undefined),
        switchMap((result) => this.api.create(MEETINGS_CONFIG.endpoint, { ...result })),
      )
      .subscribe({
        next: (meeting) => void this.router.navigate(['/management/meetings', meeting.id]),
        error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi'),
      });
  }

  /** Agenda della prossima riunione (da oggi), da copiare o stampare prima dell'incontro. */
  protected showAgenda(): void {
    const today = toIsoDate(new Date());
    this.api.list(`${TOPICS_CONFIG.endpoint}/agenda?date=${today}`).subscribe({
      next: (topics) => {
        const data: ExportDialogData = {
          title: `Agenda · ${formatDay(today)}`,
          text: agendaText(today, topics as unknown as ExportTopic[]),
        };
        this.dialog.open(ExportDialog, { data, width: '720px', maxWidth: '100vw' });
      },
      error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi'),
    });
  }
}
