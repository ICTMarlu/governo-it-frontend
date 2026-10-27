import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { API_BASE_URL } from '../../core/config/api.config';
import { errorMessage } from '../../shared/crud/crud-api.service';
import { HelpButton } from '../../shared/help/help-button';
import { HOME_HELP } from '../../shared/help/help-content';
import {
  Home,
  ProjectsOverview,
  SEVERITIES,
  WorkGrouping,
  greeting,
  groupWork,
  headline,
  isoWeek,
} from './home.model';

/** Come funziona Governo IT: il giro dell'app in quattro passi (guida iniziale). */
const STEPS = [
  { icon: 'work', label: 'Progetti', hint: 'cosa si fa', link: '/projects' },
  { icon: 'view_week', label: 'Piano', hint: 'chi ci lavora e quando', link: '/plan' },
  { icon: 'task_alt', label: 'Task', hint: 'cosa resta da fare', link: '/tasks' },
  { icon: 'insights', label: 'Ticket e Direzione', hint: 'come va', link: '/tickets' },
] as const;

const SHORTCUTS = [
  { icon: 'groups', label: 'Risorse', link: '/resources' },
  { icon: 'contact_mail', label: 'Richiedenti', link: '/requesters' },
  { icon: 'tune', label: 'Anagrafiche e liste', link: '/master-data' },
] as const;

/**
 * Home (D-33): il punto di oggi. Numeri flash di ticket, piano, task e direzione, le intuizioni
 * che ne nascono, le cose dell'utente e il giro dell'app. Admin e PM vedono il team, gli altri sé.
 */
@Component({
  selector: 'gov-home-page',
  imports: [
    DatePipe,
    HelpButton,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/home`;

  protected readonly help = HOME_HELP;
  protected readonly currentUser = inject(AuthService).currentUser;
  protected readonly severities = SEVERITIES;
  protected readonly steps = STEPS;
  protected readonly shortcuts = SHORTCUTS;

  protected readonly today = new Date();
  protected readonly week = isoWeek(this.today);
  protected readonly hello = greeting(this.today);
  /** Nome per il saluto: quello della persona collegata, altrimenti quello dell'utente. */
  protected readonly firstName = computed(
    () => (this.home()?.resourceName ?? this.currentUser()?.displayName ?? '').split(' ')[0] ?? '',
  );

  protected readonly home = signal<Home | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly headline = computed(() => headline(this.home()?.insights ?? []));

  /** Progetti di tipo Project pianificati (settimana scorsa, in corso e tre successive). */
  protected readonly overview = signal<ProjectsOverview | null>(null);
  protected readonly overviewError = signal<string | null>(null);
  protected readonly grouping = signal<WorkGrouping>('person');
  /** Avanzamento del piano per progetto (chiave "p<id>", come i gruppi e le righe della tabella). */
  protected readonly progress = computed(
    () => new Map((this.overview()?.progress ?? []).map((item) => [`p${item.projectId}`, item])),
  );
  /** Gruppi aperti: da aperti le giornate sono quelle delle righe, senza subtotale sul gruppo. */
  protected readonly opened = signal<ReadonlySet<string>>(new Set());
  protected readonly groups = computed(() => {
    const data = this.overview();
    return data ? groupWork(data.rows, data.weeks, this.grouping()) : [];
  });
  protected readonly weekTotals = computed(() => {
    const data = this.overview();
    return data
      ? groupWork(data.rows, data.weeks, 'project').reduce(
          (acc, group) =>
            acc.map((value, index) => Math.round((value + group.perWeek[index]) * 100) / 100),
          data.weeks.map(() => 0),
        )
      : [];
  });
  protected readonly currentWeek = computed(() => {
    const monday = new Date(this.today);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const pad = (value: number): string => String(value).padStart(2, '0');
    return `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
  });

  constructor() {
    this.http.get<Home>(this.url).subscribe({
      next: (home) => this.home.set(home),
      error: (e) => this.error.set(errorMessage(e)),
    });
    this.http.get<ProjectsOverview>(`${this.url}/projects`).subscribe({
      next: (overview) => this.overview.set(overview),
      error: (e) => this.overviewError.set(errorMessage(e)),
    });
  }

  /** Etichetta dell'avanzamento del piano di un progetto: "62% del piano" o "piano esaurito". */
  protected progressLabel(key: string): { text: string; level: 'none' | 'check' | 'late' } | null {
    const item = this.progress().get(key);
    if (!item) {
      return null;
    }
    if (item.exhausted) {
      return { text: 'piano esaurito', level: 'late' };
    }
    return { text: `${item.percent}% del piano`, level: item.percent >= 50 ? 'check' : 'none' };
  }

  protected toggleGroup(key: string): void {
    this.opened.update((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }

  protected setGrouping(grouping: WorkGrouping): void {
    this.grouping.set(grouping);
    this.opened.set(new Set());
  }

  protected weekLabel(weekStart: string): string {
    const date = new Date(`${weekStart}T00:00:00`);
    return `W${isoWeek(date)} ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  protected days(value: number): string {
    return value === 0 ? '' : value.toLocaleString('it-IT', { maximumFractionDigits: 2 });
  }

  protected signed(value: number): string {
    const text = value.toLocaleString('it-IT', { maximumFractionDigits: 1 });
    return value > 0 ? `+${text}` : text;
  }
}
