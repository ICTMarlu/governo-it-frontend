import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { API_BASE_URL } from '../../../core/config/api.config';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { ROLES } from '../../../shared/crud/crud.model';
import { errorMessage } from '../../../shared/crud/crud-api.service';
import { ACTUALS_HELP } from '../../../shared/help/help-content';
import { SavedViews } from '../../../shared/views/saved-views';
import {
  ACTUAL_COLUMNS,
  ActualColumn,
  ActualRow,
  ActualSortKey,
  ActualWeek,
  DEFAULT_COLUMNS,
  addDays,
  addWeeks,
  dayLabel,
  defaultDay,
  deltaLevel,
  hoursText,
  isoDate,
  mondayOf,
  parseHours,
  signedHours,
} from './actuals.model';
import { ActualsService } from './actuals.service';

interface Option {
  readonly id: number;
  readonly label: string;
}

/**
 * Consuntivo delle ore (D-37), sotto il piano settimanale: chi entra trova la sua settimana con le
 * righe del suo piano; per ogni riga le ore pianificate, quelle già consuntivate e quelle da inserire
 * nel giorno scelto. L'Admin sceglie la persona.
 */
@Component({
  selector: 'gov-actuals-page',
  imports: [
    FormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    PageHeader,
    RouterLink,
    SavedViews,
  ],
  templateUrl: './actuals-page.html',
  styleUrl: './actuals-page.scss',
})
export class ActualsPage {
  private readonly service = inject(ActualsService);
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);
  private readonly api = inject(API_BASE_URL);
  private readonly currentUser = inject(AuthService).currentUser;

  protected readonly help = ACTUALS_HELP;
  protected readonly columnsList = ACTUAL_COLUMNS;
  protected readonly dayLabel = dayLabel;
  protected readonly hoursText = hoursText;
  protected readonly signedHours = signedHours;

  protected readonly isAdmin = computed(() => this.currentUser()?.role === ROLES.admin);
  protected readonly today = isoDate(new Date());

  /** Persona scelta dall'Admin; null = la propria. */
  protected readonly resourceId = signal<number | null>(null);
  protected readonly weekStart = signal(mondayOf(new Date()));
  protected readonly week = signal<ActualWeek | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedDay = signal<string | null>(null);
  /** Ore scritte e non ancora salvate, per riga. */
  protected readonly drafts = signal<ReadonlyMap<number, string>>(new Map());
  protected readonly saving = signal<ReadonlySet<number>>(new Set());
  protected readonly busy = signal(false);

  // Vista salvabile: colonne, ordinamento, righe non pianificate
  protected readonly columns = signal<ReadonlySet<ActualColumn>>(new Set(DEFAULT_COLUMNS));
  protected readonly sort = signal<{ key: ActualSortKey; desc: boolean } | null>(null);
  protected readonly showAll = signal(false);
  protected readonly viewState = computed(() => ({
    columns: [...this.columns()],
    sort: this.sort(),
    showAll: this.showAll(),
  }));

  protected readonly people = signal<Option[]>([]);
  protected readonly projects = signal<Option[]>([]);
  protected readonly projectText = signal('');
  protected readonly adding = signal(false);
  protected readonly projectMatches = computed(() => {
    const text = this.projectText().trim().toLowerCase();
    const inWeek = new Set((this.week()?.rows ?? []).map((row) => row.projectId));
    return this.projects()
      .filter((project) => !inWeek.has(project.id))
      .filter((project) => !text || project.label.toLowerCase().includes(text))
      .slice(0, 30);
  });

  protected readonly day = computed(() => {
    const date = this.selectedDay();
    return this.week()?.days.find((day) => day.date === date) ?? null;
  });
  /** Da giovedì (o per una settimana passata) gli scarti contano: si segnalano le righe indietro. */
  protected readonly lateInWeek = computed(() => {
    const week = this.week();
    if (!week) {
      return false;
    }
    return week.weekStart < mondayOf(new Date()) || this.today >= addDays(week.weekStart, 3);
  });

  protected readonly rows = computed(() => {
    const week = this.week();
    if (!week) {
      return [];
    }
    const visible = week.rows.filter(
      (row) =>
        row.automatic ||
        this.showAll() ||
        row.plannedHours > 0 ||
        row.actualHours > 0 ||
        this.drafts().has(row.planRowId ?? -1),
    );
    const sort = this.sort();
    if (!sort) {
      return visible;
    }
    const value = (row: ActualRow): number | string =>
      sort.key === 'project'
        ? row.projectName.toLowerCase()
        : sort.key === 'planned'
          ? row.plannedHours
          : sort.key === 'actual'
            ? row.actualHours
            : row.deltaHours;
    return [...visible].sort((a, b) => {
      const order = value(a) < value(b) ? -1 : value(a) > value(b) ? 1 : 0;
      return (sort.desc ? -order : order) || Number(a.automatic) - Number(b.automatic);
    });
  });
  protected readonly hiddenRows = computed(
    () => (this.week()?.rows.length ?? 0) - this.rows().length,
  );
  /** Ore del giorno scelto, contando quelle appena scritte. */
  protected readonly dayTotal = computed(() => {
    const date = this.selectedDay();
    const week = this.week();
    if (!week || !date) {
      return 0;
    }
    return week.rows.reduce((total, row) => {
      const draft = row.planRowId === null ? undefined : this.drafts().get(row.planRowId);
      const parsed = draft === undefined ? null : parseHours(draft);
      return total + (parsed ?? row.hoursByDay[date] ?? 0);
    }, 0);
  });

  constructor() {
    effect(() => {
      const resourceId = this.resourceId();
      const weekStart = this.weekStart();
      untracked(() => this.load(weekStart, resourceId));
    });
    effect(() => {
      if (this.isAdmin()) {
        untracked(() => this.loadPeople());
      }
    });
    this.http
      .get<{ id: number; code: string | null; name: string; active: boolean }[]>(
        `${this.api}/projects`,
      )
      .subscribe({
        next: (projects) =>
          this.projects.set(
            projects
              .filter((project) => project.active)
              .map((project) => ({
                id: project.id,
                label: project.code ? `${project.code} · ${project.name}` : project.name,
              }))
              .sort((a, b) => a.label.localeCompare(b.label, 'it')),
          ),
        error: () => this.projects.set([]),
      });
  }

  // ---------------------------------------------------------------- navigazione

  protected shiftWeek(weeks: number): void {
    this.weekStart.set(addWeeks(this.weekStart(), weeks));
  }

  protected goToday(): void {
    this.weekStart.set(mondayOf(new Date()));
  }

  protected chooseResource(id: number | null): void {
    this.resourceId.set(id);
  }

  protected weekRange(week: ActualWeek): string {
    return `${dayLabel(week.days[0].date)} – ${dayLabel(week.days[6].date)}`;
  }

  // ---------------------------------------------------------------- inserimento

  protected draftOf(row: ActualRow): string {
    const id = row.planRowId;
    const date = this.selectedDay();
    if (id === null || !date) {
      return '';
    }
    const draft = this.drafts().get(id);
    if (draft !== undefined) {
      return draft;
    }
    const value = row.hoursByDay[date];
    return value ? String(value).replace('.', ',') : '';
  }

  protected setDraft(row: ActualRow, text: string): void {
    if (row.planRowId === null) {
      return;
    }
    const next = new Map(this.drafts());
    next.set(row.planRowId, text);
    this.drafts.set(next);
  }

  /** Salva le ore della riga nel giorno scelto (Invio o uscita dal campo). */
  protected commit(row: ActualRow, input?: HTMLInputElement): void {
    const id = row.planRowId;
    const date = this.selectedDay();
    const week = this.week();
    const draft = id === null ? undefined : this.drafts().get(id);
    if (id === null || !date || !week || draft === undefined) {
      return;
    }
    const hours = parseHours(draft);
    if (hours === null) {
      this.snackBar.open('Ore non valide: scrivi un numero da 0 a 24 (es. 1,5)', 'OK', {
        duration: 5000,
      });
      return;
    }
    if (hours === (row.hoursByDay[date] ?? 0)) {
      this.clearDraft(id);
      return;
    }
    this.saving.set(new Set([...this.saving(), id]));
    this.service.save(id, date, hours).subscribe({
      next: (updated) => {
        this.week.set(updated);
        this.clearDraft(id);
        this.doneSaving(id);
        input?.blur();
      },
      error: (e) => {
        this.doneSaving(id);
        this.snackBar.open(errorMessage(e), 'OK', { duration: 8000 });
      },
    });
  }

  /** Invio: salva e passa alla riga sotto. */
  protected next(row: ActualRow, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.commit(row);
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input.hours-input'));
    inputs[inputs.indexOf(input) + 1]?.focus();
  }

  protected addProject(projectId: number): void {
    const week = this.week();
    if (!week) {
      return;
    }
    this.adding.set(true);
    this.service.addRow(week.resourceId, projectId, week.weekStart).subscribe({
      next: (updated) => {
        this.adding.set(false);
        this.projectText.set('');
        this.week.set(updated);
        this.snackBar.open('Progetto aggiunto: ora è anche nel piano, con zero giornate', 'OK', {
          duration: 5000,
        });
      },
      error: (e) => {
        this.adding.set(false);
        this.snackBar.open(errorMessage(e), 'OK', { duration: 8000 });
      },
    });
  }

  protected confirmWeek(): void {
    const week = this.week();
    if (!week) {
      return;
    }
    this.busy.set(true);
    this.service.confirm(week.resourceId, week.weekStart).subscribe({
      next: (updated) => this.done(updated, 'Settimana confermata'),
      error: (e) => this.fail(e),
    });
  }

  protected reopenWeek(): void {
    const week = this.week();
    if (!week) {
      return;
    }
    this.busy.set(true);
    this.service.reopen(week.resourceId, week.weekStart).subscribe({
      next: (updated) => this.done(updated, 'Settimana riaperta'),
      error: (e) => this.fail(e),
    });
  }

  // ---------------------------------------------------------------- vista

  protected toggleColumn(id: ActualColumn): void {
    const next = new Set(this.columns());
    if (!next.delete(id)) {
      next.add(id);
    }
    this.columns.set(next);
  }

  protected toggleSort(key: ActualSortKey): void {
    const sort = this.sort();
    this.sort.set(
      sort?.key !== key ? { key, desc: false } : sort.desc ? null : { key, desc: true },
    );
  }

  protected sortIcon(key: ActualSortKey): string {
    const sort = this.sort();
    return sort?.key !== key ? 'unfold_more' : sort.desc ? 'arrow_downward' : 'arrow_upward';
  }

  protected applyView(state: unknown): void {
    const view = (state ?? {}) as Partial<{
      columns: ActualColumn[];
      sort: { key: ActualSortKey; desc: boolean } | null;
      showAll: boolean;
    }>;
    this.columns.set(new Set(view.columns ?? DEFAULT_COLUMNS));
    this.sort.set(view.sort ?? null);
    this.showAll.set(view.showAll ?? false);
  }

  protected level(row: ActualRow): 'over' | 'under' | 'none' {
    return deltaLevel(row, this.lateInWeek());
  }

  // ---------------------------------------------------------------- supporto

  private load(weekStart: string, resourceId: number | null): void {
    this.error.set(null);
    this.drafts.set(new Map());
    this.service.week(weekStart, resourceId).subscribe({
      next: (week) => {
        this.week.set(week);
        const current = this.selectedDay();
        this.selectedDay.set(
          current && week.days.some((day) => day.date === current && day.editable)
            ? current
            : defaultDay(week, this.today),
        );
      },
      error: (e) => {
        this.week.set(null);
        this.error.set(errorMessage(e));
      },
    });
  }

  private loadPeople(): void {
    this.http
      .get<{ id: number; fullName: string; active: boolean }[]>(`${this.api}/resources`)
      .subscribe({
        next: (resources) =>
          this.people.set(
            resources
              .filter((resource) => resource.active)
              .map((resource) => ({ id: resource.id, label: resource.fullName }))
              .sort((a, b) => a.label.localeCompare(b.label, 'it')),
          ),
        error: () => this.people.set([]),
      });
  }

  private clearDraft(id: number): void {
    const next = new Map(this.drafts());
    next.delete(id);
    this.drafts.set(next);
  }

  private doneSaving(id: number): void {
    const next = new Set(this.saving());
    next.delete(id);
    this.saving.set(next);
  }

  private done(week: ActualWeek, message: string): void {
    this.busy.set(false);
    this.week.set(week);
    this.snackBar.open(message, 'OK', { duration: 4000 });
  }

  private fail(error: unknown): void {
    this.busy.set(false);
    this.snackBar.open(errorMessage(error), 'OK', { duration: 8000 });
  }
}
