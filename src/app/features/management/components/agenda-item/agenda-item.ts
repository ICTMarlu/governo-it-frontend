import { Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { SelectOption } from '../../../../shared/crud/crud.model';
import { fromIsoDate, toIsoDate } from '../../../../shared/dates/italian-date-adapter';
import { DEFERRAL_WARNING, TOPIC_TYPE_COLORS } from '../../management.configs';
import { AgendaResult, ManagementAction, MeetingItem } from '../../models/management.model';
import { MarkBody } from '../../services/meetings.service';

export interface NewAction {
  readonly description: string;
  readonly ownerResourceId: number | null;
  readonly dueDate: string | null;
}

const DATE = new Intl.DateTimeFormat('it-IT');

/**
 * Punto all'ordine del giorno in modalità riunione (componente di presentazione): esito con
 * un clic, nota, decisione, azioni. Ogni scelta viene emessa subito al genitore, che la salva.
 */
@Component({
  selector: 'gov-agenda-item',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './agenda-item.html',
  styleUrl: './agenda-item.scss',
})
export class AgendaItem {
  readonly item = input.required<MeetingItem>();
  readonly position = input.required<number>();
  /** Riunione in corso: esclusa dallo storico del punto. */
  readonly meetingId = input.required<number>();
  readonly canWrite = input(false);
  readonly busy = input(false);
  readonly first = input(false);
  readonly last = input(false);
  readonly people = input<readonly SelectOption[]>([]);

  readonly marked = output<MarkBody>();
  readonly actionAdded = output<NewAction>();
  readonly actionToggled = output<{ action: ManagementAction; done: boolean }>();
  readonly removed = output<void>();
  readonly moved = output<-1 | 1>();

  protected readonly typeColors = TOPIC_TYPE_COLORS;
  protected readonly results: readonly { value: AgendaResult; label: string; icon: string }[] = [
    { value: 'DISCUSSED', label: 'Discusso', icon: 'check' },
    { value: 'POSTPONED', label: 'Posticipa', icon: 'schedule' },
    { value: 'NOT_DISCUSSED', label: 'Non discusso', icon: 'block' },
    { value: 'CLOSED', label: 'Chiudi', icon: 'task_alt' },
  ];

  protected readonly topic = computed(() => this.item().topic);
  protected readonly warnDeferrals = computed(() => this.topic().deferralCount >= DEFERRAL_WARNING);
  protected readonly pastMeetings = computed(() =>
    this.topic().history.filter((past) => past.meetingId !== this.meetingId()),
  );

  /** Testi in modifica: si ricaricano quando arriva la versione salvata del punto. */
  protected readonly note = linkedSignal(() => this.item().note ?? '');
  protected readonly decision = linkedSignal(() => this.topic().decision ?? '');

  /** Pannello "Posticipa": alla prossima riunione o da una data. */
  protected readonly postponing = signal(false);
  protected readonly postponeMode = signal<'next' | 'date'>('next');
  protected readonly postponeDate = signal<Date | null>(null);

  protected readonly addingAction = signal(false);
  protected readonly actionText = signal('');
  protected readonly actionOwner = signal<number | null>(null);
  protected readonly actionDue = signal<Date | null>(null);

  protected formatDate(value: string | null): string {
    const date = fromIsoDate(value);
    return date ? DATE.format(date) : '';
  }

  protected choose(result: AgendaResult): void {
    if (result === 'POSTPONED') {
      this.postponing.set(true);
      this.postponeMode.set(this.item().postponedUntil ? 'date' : 'next');
      this.postponeDate.set(fromIsoDate(this.item().postponedUntil));
      return;
    }
    this.postponing.set(false);
    this.emitMark(result, null);
  }

  protected confirmPostpone(): void {
    const date = this.postponeMode() === 'date' ? this.postponeDate() : null;
    if (this.postponeMode() === 'date' && !date) {
      return;
    }
    this.postponing.set(false);
    this.emitMark('POSTPONED', date ? toIsoDate(date) : null);
  }

  protected resetResult(): void {
    this.emitMark(null, null);
  }

  /** Nota e decisione si salvano quando si esce dal campo, solo se cambiate. */
  protected saveNote(): void {
    if (this.note().trim() !== (this.item().note ?? '')) {
      this.emitMark(this.item().result, this.item().postponedUntil);
    }
  }

  protected saveDecision(): void {
    if (this.decision().trim() !== (this.topic().decision ?? '')) {
      this.emitMark(this.item().result, this.item().postponedUntil);
    }
  }

  protected addAction(): void {
    const description = this.actionText().trim();
    if (!description) {
      return;
    }
    const due = this.actionDue();
    this.actionAdded.emit({
      description,
      ownerResourceId: this.actionOwner(),
      dueDate: due ? toIsoDate(due) : null,
    });
    this.actionText.set('');
    this.actionOwner.set(null);
    this.actionDue.set(null);
    this.addingAction.set(false);
  }

  private emitMark(result: AgendaResult | null, postponedUntil: string | null): void {
    this.marked.emit({
      result,
      note: this.note().trim() || null,
      postponedUntil,
      decision: this.decision().trim() || null,
    });
  }
}
