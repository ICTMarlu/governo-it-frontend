import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, filter, finalize } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { canEdit } from '../../core/auth/permissions';
import { BackLink } from '../../shared/components/back-link/back-link';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/crud/confirm-dialog/confirm-dialog';
import { CrudApiService, errorMessage } from '../../shared/crud/crud-api.service';
import { SelectOption } from '../../shared/crud/crud.model';
import { fromIsoDate, toIsoDate } from '../../shared/dates/italian-date-adapter';
import { MEETING_HELP } from '../../shared/help/help-content';
import { AgendaItem, NewAction } from './components/agenda-item/agenda-item';
import { ExportDialog, ExportDialogData } from './components/export-dialog/export-dialog';
import { ExportMeeting, formatDay, summaryText } from './models/management-export';
import { ManagementAction, ManagementTopic, Meeting, MeetingItem } from './models/management.model';
import { MarkBody, MeetingsService } from './services/meetings.service';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Modalità riunione con la direzione (D-17). Ogni esito, nota, azione o spostamento si salva
 * subito sul server: niente "Salva" da ricordare a fine incontro.
 */
@Component({
  selector: 'gov-meeting-detail-page',
  imports: [
    FormsModule,
    AgendaItem,
    BackLink,
    PageHeader,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './meeting-detail-page.html',
  styleUrl: './meeting-detail-page.scss',
})
export class MeetingDetailPage {
  private readonly meetings = inject(MeetingsService);
  private readonly api = inject(CrudApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly currentUser = inject(AuthService).currentUser;

  /** Id della riunione dal percorso /management/meetings/:id. */
  readonly id = input.required<string>();

  protected readonly help = MEETING_HELP;
  protected readonly state = signal<LoadState>('loading');
  protected readonly busy = signal(false);
  protected readonly meeting = signal<Meeting | null>(null);
  protected readonly people = signal<SelectOption[]>([]);
  private readonly allTopics = signal<ManagementTopic[]>([]);

  /** Dati della riunione in modifica. */
  protected readonly editDate = signal<Date | null>(null);
  protected readonly editTitle = signal('');
  protected readonly editNotes = signal('');
  protected readonly toAdd = signal<number[]>([]);

  protected readonly canWrite = computed(() =>
    canEdit(this.currentUser()?.permissions, 'MANAGEMENT'),
  );

  protected readonly heading = computed(() => {
    const meeting = this.meeting();
    return meeting ? `Riunione · ${formatDay(meeting.meetingDate)}` : 'Riunione';
  });

  protected readonly progress = computed(() => {
    const meeting = this.meeting();
    return meeting && meeting.itemCount > 0 ? (meeting.handledCount / meeting.itemCount) * 100 : 0;
  });

  protected readonly dataChanged = computed(() => {
    const meeting = this.meeting();
    const date = this.editDate();
    return (
      meeting !== null &&
      ((date ? toIsoDate(date) : null) !== meeting.meetingDate ||
        this.editTitle().trim() !== (meeting.title ?? '') ||
        this.editNotes().trim() !== (meeting.notes ?? ''))
    );
  });

  /** Punti aperti non ancora in agenda, aggiungibili. */
  protected readonly availableTopics = computed(() => {
    const inAgenda = new Set(this.meeting()?.items.map((item) => item.topic.id) ?? []);
    return this.allTopics().filter(
      (topic) =>
        !inAgenda.has(topic.id) && topic.status !== 'CLOSED' && topic.status !== 'CANCELLED',
    );
  });

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => this.load(id));
    });
    this.api
      .options({ endpoint: '/resources', labelKey: 'fullName' })
      .subscribe((options) => this.people.set(options));
  }

  protected mark(item: MeetingItem, body: MarkBody): void {
    this.run(this.meetings.mark(this.meetingId(), item.topic.id, body));
  }

  protected move(index: number, delta: -1 | 1): void {
    const ids = this.meeting()!.items.map((item) => item.topic.id);
    const target = index + delta;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.run(this.meetings.reorder(this.meetingId(), ids));
  }

  protected remove(item: MeetingItem): void {
    this.run(this.meetings.removeTopic(this.meetingId(), item.topic.id));
  }

  protected addSelected(): void {
    const ids = [...this.toAdd()];
    this.toAdd.set([]);
    this.addSequentially(ids);
  }

  protected addAction(item: MeetingItem, action: NewAction): void {
    this.busy.set(true);
    this.meetings
      .createAction({
        ...action,
        topicId: item.topic.id,
        meetingId: this.meetingId(),
        done: false,
        version: null,
      })
      .subscribe({
        next: () => this.reload('Azione aggiunta'),
        error: (error: unknown) => this.fail(error),
      });
  }

  protected toggleAction(action: ManagementAction, done: boolean): void {
    this.busy.set(true);
    this.meetings.updateAction(action, done).subscribe({
      next: () => this.reload(done ? 'Azione fatta' : 'Azione riaperta'),
      error: (error: unknown) => this.fail(error),
    });
  }

  protected saveData(): void {
    const meeting = this.meeting();
    const date = this.editDate();
    if (!meeting || !date) {
      return;
    }
    this.run(
      this.meetings.update(meeting, {
        meetingDate: toIsoDate(date),
        title: this.editTitle().trim() || null,
        notes: this.editNotes().trim() || null,
      }),
      'Dati della riunione salvati',
    );
  }

  protected closeMeeting(): void {
    const pending = this.meeting()!.itemCount - this.meeting()!.handledCount;
    const data: ConfirmDialogData = {
      title: 'Chiudere la riunione?',
      message:
        pending > 0
          ? `${pending} ${pending === 1 ? 'punto non trattato diventa' : 'punti non trattati diventano'} "non discusso" e resta nella prossima agenda.`
          : 'Tutti i punti sono stati trattati.',
      confirmLabel: 'Chiudi riunione',
    };
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data })
      .afterClosed()
      .pipe(filter((confirmed) => confirmed === true))
      .subscribe(() => this.run(this.meetings.close(this.meetingId()), 'Riunione chiusa'));
  }

  protected reopen(): void {
    this.run(this.meetings.reopen(this.meetingId()), 'Riunione riaperta');
  }

  protected showSummary(): void {
    const meeting = this.meeting()!;
    const data: ExportDialogData = {
      title: `Riepilogo · ${formatDay(meeting.meetingDate)}`,
      text: summaryText(meeting as unknown as ExportMeeting),
    };
    this.dialog.open(ExportDialog, { data, width: '720px', maxWidth: '100vw' });
  }

  private meetingId(): number {
    return Number(this.id());
  }

  /** Aggiunge i punti uno alla volta (ogni chiamata restituisce l'agenda aggiornata). */
  private addSequentially(ids: number[]): void {
    const [next, ...rest] = ids;
    if (next === undefined) {
      return;
    }
    this.busy.set(true);
    this.meetings
      .addTopic(this.meetingId(), next)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (meeting) => {
          this.setMeeting(meeting);
          this.addSequentially(rest);
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  private run(request: Observable<Meeting>, message?: string): void {
    this.busy.set(true);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (meeting) => {
        this.setMeeting(meeting);
        if (message) {
          this.snackBar.open(message, 'OK', { duration: 2500 });
        }
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  /** Rilegge la riunione (le azioni cambiano i punti, che la riunione mostra). */
  private reload(message: string): void {
    this.run(this.meetings.get(this.meetingId()), message);
  }

  private fail(error: unknown): void {
    this.busy.set(false);
    this.snackBar.open(errorMessage(error), 'Chiudi');
  }

  private setMeeting(meeting: Meeting): void {
    this.meeting.set(meeting);
    this.editDate.set(fromIsoDate(meeting.meetingDate));
    this.editTitle.set(meeting.title ?? '');
    this.editNotes.set(meeting.notes ?? '');
  }

  private load(id: number): void {
    this.state.set('loading');
    this.meetings.get(id).subscribe({
      next: (meeting) => {
        this.setMeeting(meeting);
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
    this.meetings.openTopics().subscribe((topics) => this.allTopics.set(topics));
  }
}
