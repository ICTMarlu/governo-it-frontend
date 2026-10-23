import { BreakpointObserver } from '@angular/cdk/layout';
import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { filter, map, switchMap } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { canEdit } from '../../core/auth/permissions';
import { UserPreferencesService } from '../../core/preferences/user-preferences.service';
import {
  ExcelFilter,
  ExcelFilterOption,
  ExcelFilterPreset,
} from '../../shared/components/excel-filter/excel-filter';
import {
  ColumnChooserData,
  ColumnChooserDialog,
  ColumnChooserResult,
} from '../../shared/crud/column-chooser-dialog/column-chooser-dialog';
import { ColumnLayout, orderedColumns } from '../../shared/crud/column-layout';
import { ConfirmDialog, ConfirmDialogData } from '../../shared/crud/confirm-dialog/confirm-dialog';
import { CrudApiService, errorMessage } from '../../shared/crud/crud-api.service';
import { toIsoDate } from '../../shared/dates/italian-date-adapter';
import { matchesTerms, searchTerms } from '../../shared/util/text-search';
import { HelpButton } from '../../shared/help/help-button';
import { PLAN_HELP } from '../../shared/help/help-content';
import { CellNoteData, CellNoteDialog } from './components/cell-note-dialog/cell-note-dialog';
import { FillDialog, FillDialogData, FillDialogResult } from './components/fill-dialog/fill-dialog';
import { RowDialog, RowDialogData } from './components/row-dialog/row-dialog';
import {
  CellsResult,
  Plan,
  PlanRow,
  PlanWeek,
  ResourcePlan,
  isOpenStatus,
  parseDays,
  saturationLevel,
  sumDays,
} from './models/plan.model';
import {
  CellChange,
  GridGroup,
  GridRow,
  GROUPING_LABELS,
  GridEntry,
  GridSection,
  HolidayCalendarRow,
  HolidaySection,
  PlanGrouping,
  buildSections,
  compareSystems,
  formatDay,
  formatDays,
  planRowLabel,
  rowTotal,
  systemOf,
  weekTotalsOf,
} from './models/plan-grid.model';
import {
  PLAN_INFO_COLUMNS,
  PLAN_SORT_LABELS,
  SortDirection,
  SortLevel,
  WEEK_SORT_PREFIX,
  compareByLevels,
  isSortable,
  nextSort,
  setSort,
  sortLabel,
} from './models/plan-columns';
import { PlanService, RowBody } from './services/plan.service';
import { PlanMobileWeek } from './components/plan-mobile-week/plan-mobile-week';
import { SavedViews } from '../../shared/views/saved-views';
import {
  CellTasksData,
  CellTasksPanel,
} from '../tasks/components/cell-tasks-panel/cell-tasks-panel';
import { CellTaskCount, cellKey } from '../tasks/models/task.model';
import { TasksService } from '../tasks/services/tasks.service';

type LoadState = 'loading' | 'ready' | 'error';

/** Preferenza dell'utente: stati progetto mostrati. */
const PLAN_PREFERENCES = 'plan.view';

interface PlanPreferences {
  readonly statuses?: string[];
  readonly sort?: SortLevel[];
  readonly columns?: ColumnLayout;
  readonly grouping?: PlanGrouping;
}
/** All'apertura le prime settimane a vista sono le 2 passate, poi la corrente e le future. */
export const PAST_WEEKS = 2;
/**
 * Settimane caricate all'apertura: 8 indietro e 26 avanti. Le colonne a sinistra restano
 * bloccate e si scorrono solo le settimane (come i riquadri bloccati di Excel); quante se ne
 * vedono dipende dalla larghezza dello schermo. Arrivando a un bordo se ne caricano altre 13.
 */
const LOAD_PAST_WEEKS = 8;
const LOAD_FUTURE_WEEKS = 26;
const EXTEND_WEEKS = 13;
/** Settimane caricate al massimo (limite del backend: 106). */
const MAX_LOADED_WEEKS = 104;
/** Larghezza di una settimana se non ancora misurabile (4,5rem + margini). */
const FALLBACK_WEEK_WIDTH = 84;

interface VisibleRange {
  readonly first: number;
  readonly last: number;
}

/** Lunedì della settimana di oggi, in formato ISO. */
function currentMonday(): string {
  const today = new Date();
  today.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return toIsoDate(today);
}

function addWeeks(iso: string, weeks: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return toIsoDate(new Date(year, month - 1, day + weeks * 7));
}

/** Primo lunedì caricato all'apertura. */
function defaultStart(): string {
  return addWeeks(currentMonday(), -LOAD_PAST_WEEKS);
}

/**
 * Piano settimanale (PLN-01, D-18, D-19): giornate per risorsa, progetto e settimana. Ogni
 * cella si salva da sola; per ogni persona la riga Ferie è sempre presente e la riga
 * Festività è calcolata dal calendario della sede. Sotto ogni persona: allocato, capacità e
 * saturazione di ogni settimana.
 */
@Component({
  selector: 'gov-plan-page',
  imports: [
    FormsModule,
    NgTemplateOutlet,
    ExcelFilter,
    HelpButton,
    MatAutocompleteModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    PlanMobileWeek,
    RouterLink,
    SavedViews,
  ],
  templateUrl: './plan-page.html',
  styleUrl: './plan-page.scss',
})
export class PlanPage {
  private readonly planService = inject(PlanService);
  private readonly tasksService = inject(TasksService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly currentUser = inject(AuthService).currentUser;
  private readonly preferences = inject(UserPreferencesService);
  /** Progetti per l'aggiunta veloce (attivi, escluse le festività che si calcolano da sole). */
  private readonly projects = toSignal(inject(CrudApiService).list('/projects'), {
    initialValue: [],
  });

  protected readonly help = PLAN_HELP;
  protected readonly currentYear = new Date().getFullYear();
  protected readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 767.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly state = signal<LoadState>('loading');
  protected readonly plan = signal<Plan | null>(null);
  /** Task e note per casella (riga + settimana), per il pallino nella griglia. */
  protected readonly cellTasks = signal<ReadonlyMap<string, CellTaskCount>>(new Map());
  protected readonly cellKey = cellKey;
  protected readonly from = signal(defaultStart());
  /** Settimane caricate a partire da from. */
  private readonly weekCount = signal(LOAD_PAST_WEEKS + 1 + LOAD_FUTURE_WEEKS);
  /** Settimane a vista nella griglia (indici in weeks()), aggiornate scorrendo. */
  protected readonly visibleRange = signal<VisibleRange>({ first: 0, last: PAST_WEEKS + 4 });
  private readonly gridWrap = viewChild<ElementRef<HTMLElement>>('gridWrap');
  private readonly savedViews = viewChild(SavedViews);
  private readonly injector = inject(Injector);
  /** Dopo il caricamento: scorri alla settimana indicata o sposta di N settimane. */
  private pendingScroll: { readonly toWeek?: string; readonly byWeeks?: number } | null = {
    toWeek: addWeeks(currentMonday(), -PAST_WEEKS),
  };
  private extending = false;
  private scrollFrame = 0;
  protected readonly showArchived = signal(false);
  protected readonly search = signal('');
  /** Stati progetto mostrati; null = default (solo aperti). Salvati per l'utente. */
  protected readonly statusFilter = signal<readonly string[] | null>(null);
  /** Filtri come in Excel: null = nessun filtro. */
  protected readonly resourceFilter = signal<readonly string[] | null>(null);
  protected readonly projectFilter = signal<readonly string[] | null>(null);
  protected readonly priorityFilter = signal<readonly string[] | null>(null);
  /** Testo dell'aggiunta veloce, per persona. */
  protected readonly quickText = signal<Readonly<Record<number, string>>>({});
  /** Ordinamento a due livelli (D-22), salvato per l'utente. */
  protected readonly sortLevels = signal<readonly SortLevel[]>([]);
  /** Colonne a scelta: quali e in che ordine (null = predefinite). */
  protected readonly columnLayout = signal<ColumnLayout | null>(null);
  protected readonly infoColumns = computed(() =>
    orderedColumns(PLAN_INFO_COLUMNS, this.columnLayout())
      .filter((item) => item.visible)
      .map((item) => item.column.id!),
  );
  protected readonly sortLabels = PLAN_SORT_LABELS;
  protected readonly sortHint =
    "Clic: ordina (poi decrescente, poi togli). Su un'altra colonna diventa il secondo livello";
  protected readonly weekSortPrefix = WEEK_SORT_PREFIX;
  protected readonly sortSummary = computed(() =>
    this.sortLevels()
      .map((level) => `${sortLabel(level.id)} ${level.direction === 'asc' ? '↑' : '↓'}`)
      .join(', poi '),
  );
  protected readonly collapsed = signal<ReadonlySet<number>>(new Set());
  /** Raggruppamento delle righe (salvato per l'utente) e gruppi per sistema chiusi. */
  protected readonly grouping = signal<PlanGrouping>('person');
  protected readonly groupingLabels = GROUPING_LABELS;
  protected readonly groupingOptions = Object.keys(GROUPING_LABELS) as PlanGrouping[];
  protected readonly collapsedSections = signal<ReadonlySet<string>>(new Set());
  /** Salvataggi in corso (per l'indicatore "Salvataggio…"). */
  protected readonly pending = signal(0);
  /** Vista telefono: settimana mostrata (indice tra quelle caricate). */
  protected readonly mobileWeek = signal(0);

  protected readonly legendText =
    'Saturazione = caricato (progetti, ferie, festività) ÷ capacità teorica + ore extra. ' +
    'Verde sotto il 90%, giallo dal 90 al 100%, rosso oltre il 100%.';

  /** Stati dei progetti presenti nel piano, nell'ordine della lista valori. */
  protected readonly statusOptions = computed(() => {
    const byCode = new Map<string, { code: string; label: string; order: number; open: boolean }>();
    for (const resource of this.plan()?.resources ?? []) {
      for (const row of resource.rows) {
        if (row.statusCode && !row.vacation && !byCode.has(row.statusCode)) {
          byCode.set(row.statusCode, {
            code: row.statusCode,
            label: row.statusLabel ?? row.statusCode,
            order: row.statusSortOrder,
            open: isOpenStatus(row.statusCode, row.statusTerminal),
          });
        }
      }
    }
    return [...byCode.values()].sort((a, b) => a.order - b.order);
  });

  /** Stati effettivamente filtrati: la scelta dell'utente o, senza scelta, quelli aperti. */
  protected readonly selectedStatuses = computed(
    () =>
      this.statusFilter() ??
      this.statusOptions()
        .filter((option) => option.open)
        .map((option) => option.code),
  );

  protected readonly statusSummary = computed(() => {
    const selected = this.selectedStatuses();
    const options = this.statusOptions();
    if (this.statusFilter() === null) {
      return 'Aperti';
    }
    if (selected.length === options.length) {
      return 'Tutti';
    }
    return options
      .filter((option) => selected.includes(option.code))
      .map((option) => option.label)
      .join(', ');
  });

  protected readonly statusFilterOptions = computed<readonly ExcelFilterOption[]>(() =>
    this.statusOptions().map((option) => ({ value: option.code, label: option.label })),
  );

  protected readonly statusPresets: readonly ExcelFilterPreset[] = [
    { label: 'Solo aperti (default)', values: null },
  ];

  /** Persone nel filtro; le disattivate in fondo, da scegliere apposta per vederle. */
  protected readonly resourceFilterOptions = computed<readonly ExcelFilterOption[]>(() =>
    [...(this.plan()?.resources ?? [])]
      .sort((a, b) => Number(b.active) - Number(a.active))
      .map((resource) => ({
        value: String(resource.resourceId),
        label: resource.active ? resource.name : `${resource.name} (disattivata)`,
      })),
  );

  /** Persone attive: la vista di partenza (senza filtro le disattivate non si vedono). */
  private readonly activeResourceIds = computed(() =>
    (this.plan()?.resources ?? [])
      .filter((resource) => resource.active)
      .map((resource) => String(resource.resourceId)),
  );

  /** Spunte del filtro Persone: senza filtro sono spuntate solo le attive. */
  protected readonly selectedResources = computed(
    () => this.resourceFilter() ?? this.activeResourceIds(),
  );

  /** Senza filtro: "Tutte" (o "Attive" se ci sono persone disattivate, che restano nascoste). */
  protected readonly resourceSummary = computed(() => {
    if (this.resourceFilter() !== null) {
      return null;
    }
    return this.activeResourceIds().length < (this.plan()?.resources.length ?? 0)
      ? 'Attive'
      : 'Tutte';
  });

  /** Stato salvato nelle viste (D-26): filtri, ricerca, ordinamento, colonne, raggruppamento. */
  protected readonly viewState = computed(() => ({
    statuses: this.statusFilter(),
    resources: this.resourceFilter(),
    projects: this.projectFilter(),
    priorities: this.priorityFilter(),
    search: this.search(),
    sort: this.sortLevels(),
    columns: this.columnLayout(),
    grouping: this.grouping(),
    archived: this.showArchived(),
  }));
  /** Una vista è stata applicata: le preferenze salvate in precedenza non la sovrascrivono. */
  private viewApplied = false;

  /** Progetti presenti nel piano (codice · nome), in ordine alfabetico. */
  protected readonly projectFilterOptions = computed<readonly ExcelFilterOption[]>(() => {
    const byId = new Map<string, string>();
    for (const resource of this.plan()?.resources ?? []) {
      for (const row of resource.rows) {
        if (!row.vacation) {
          byId.set(String(row.projectId), this.rowLabel(row));
        }
      }
    }
    return [...byId.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'it'));
  });

  protected readonly priorityFilterOptions: readonly ExcelFilterOption[] = [
    { value: '1', label: '1 – La più importante' },
    { value: '2', label: '2 – Importante' },
    { value: '3', label: '3 – Posticipabile' },
    { value: '4', label: '4 – Nice to have' },
    { value: '-', label: 'Senza priorità' },
  ];

  /** Progetti proposti dall'aggiunta veloce di una persona: cerca nel codice e nel nome. */
  protected quickMatches(
    resourceId: number,
  ): readonly { id: number; label: string; meta: string }[] {
    const terms = searchTerms(this.quickText()[resourceId] ?? '');
    if (terms.length === 0) {
      return [];
    }
    const holiday = this.plan()?.holidayProjectId;
    return this.projects()
      .filter((project) => project['active'] !== false && project.id !== holiday)
      .map((project) => ({
        id: project.id!,
        label: project['code']
          ? `${String(project['code'])} · ${String(project['name'])}`
          : String(project['name']),
        meta: `${String(project['workTypeLabel'] ?? '')} · ${String(project['statusLabel'] ?? '')}`,
      }))
      .filter((project) => matchesTerms(terms, [project.label]))
      .slice(0, 12);
  }

  protected readonly canWrite = computed(() => canEdit(this.currentUser()?.permissions, 'PLAN'));

  protected readonly weeks = computed<readonly PlanWeek[]>(() => this.plan()?.weeks ?? []);

  protected readonly resourceOptions = computed(() =>
    (this.plan()?.resources ?? []).map((resource) => ({
      id: resource.resourceId,
      name: resource.name,
    })),
  );

  /** Settimane a vista: periodo nella barra e totale "Tot". */
  private readonly visibleWeeks = computed(() => {
    const { first, last } = this.visibleRange();
    return this.weeks().slice(first, last + 1);
  });

  protected readonly periodLabel = computed(() => {
    const weeks = this.visibleWeeks();
    if (weeks.length === 0) {
      return '';
    }
    const first = weeks[0];
    const last = weeks[weeks.length - 1];
    return `W${first.isoWeek}–W${last.isoWeek} · ${this.dayLabel(first.weekStart)} – ${this.dayLabel(last.weekStart)}`;
  });

  protected readonly groups = computed<readonly GridGroup[]>(() => {
    const plan = this.plan();
    if (!plan) {
      return [];
    }
    const terms = searchTerms(this.search());
    const people = this.selectedResources();
    const projects = this.projectFilter();
    const priorities = this.priorityFilter();
    const sortLevels = this.sortLevels();
    // Raggruppando per sistema le righe di ogni persona sono già in ordine di sistema
    const bySystem = this.grouping() !== 'person';
    // Con un filtro su progetto, priorità o testo si vedono solo le righe trovate
    const narrowing = terms.length > 0 || projects !== null || priorities !== null;
    let nav = 0;
    return (
      plan.resources
        // Senza filtro solo le persone attive; le disattivate si scelgono nel filtro Persone
        .filter((resource) => people.includes(String(resource.resourceId)))
        .map((resource) => {
          const rows = resource.rows
            .filter((row) => this.showArchived() || !row.archived)
            // La riga Ferie si vede senza filtri, o se la ricerca la trova (es. "ferie elia")
            .filter((row) =>
              row.vacation
                ? projects === null &&
                  priorities === null &&
                  matchesTerms(terms, ['Ferie', resource.name])
                : true,
            )
            // Le righe secondo lo stato del progetto
            .filter(
              (row) =>
                row.vacation || !row.statusCode || this.selectedStatuses().includes(row.statusCode),
            )
            .filter((row) => projects === null || projects.includes(String(row.projectId)))
            .filter(
              (row) =>
                priorities === null || priorities.includes(String(row.itPriorityLevel ?? '-')),
            )
            // Ricerca su tutti i campi della riga e sul nome della persona
            .filter(
              (row) =>
                row.vacation ||
                matchesTerms(terms, [
                  resource.name,
                  row.projectCode,
                  row.projectName,
                  row.rowNote,
                  row.workTypeLabel,
                  row.mainSystemLabel,
                  row.statusLabel,
                  ...row.ownerNames,
                  ...row.requesterNames,
                ]),
            )
            .map((row) => ({
              row,
              cells: Object.fromEntries(row.cells.map((cell) => [cell.weekStart, cell])),
              total: rowTotal(row),
            }))
            // Ordinamento a due livelli dentro ogni persona; la riga Ferie resta in fondo
            .sort(
              (a, b) =>
                Number(a.row.vacation) - Number(b.row.vacation) ||
                (bySystem ? compareSystems(a.row, b.row) : 0) ||
                compareByLevels(a, b, sortLevels),
            )
            .map((entry) => ({ ...entry, nav: nav++ }));
          const totals = resource.weeks.map((week) => {
            // Il caricato conta tutte le righe (anche quelle nascoste dal filtro) e le festività
            const allocated = sumDays([
              ...resource.rows.map(
                (row) => row.cells.find((cell) => cell.weekStart === week.weekStart)?.days ?? 0,
              ),
              week.holidays,
            ]);
            const level = saturationLevel(allocated, week.capacity);
            return {
              weekStart: week.weekStart,
              holidays: week.holidays,
              holidayNames: week.holidayNames,
              allocated,
              capacity: week.capacity,
              level,
              percent: week.capacity > 0 ? Math.round((allocated / week.capacity) * 100) : null,
            };
          });
          const yearAllocated = sumDays(resource.rows.map((row) => row.yearTotal));
          return { resource, rows, totals, yearAllocated };
        })
        // Filtrando, le persone senza righe trovate spariscono (come le righe nascoste di Excel)
        .filter((group) => !narrowing || group.rows.length > 0)
    );
  });

  /** Persona e sistema: le righe di ogni persona divise per sistema (la riga Ferie a parte). */
  protected readonly personSections = computed(() => {
    const sections = new Map<number, GridSection[]>();
    if (this.grouping() !== 'personSystem') {
      return sections;
    }
    for (const group of this.groups()) {
      const entries = group.rows
        .filter((gridRow) => !gridRow.row.vacation)
        .map((gridRow) => ({ group, gridRow }));
      sections.set(
        group.resource.resourceId,
        buildSections(entries, `p${group.resource.resourceId}`),
      );
    }
    return sections;
  });

  /**
   * Solo sistema: le righe di tutte le persone per sistema (senza Ferie e festività, che sono
   * della persona). La posizione per la tastiera segue l'ordine mostrato.
   */
  protected readonly systemSections = computed(() => {
    if (this.grouping() !== 'system') {
      return [];
    }
    let nav = 0;
    const entries = this.groups()
      .flatMap((group) =>
        group.rows
          .filter((gridRow) => !gridRow.row.vacation)
          .map((gridRow) => ({ group, gridRow })),
      )
      .sort((a, b) => compareSystems(a.gridRow.row, b.gridRow.row))
      .map((entry) => ({ group: entry.group, gridRow: { ...entry.gridRow, nav: nav++ } }));
    return buildSections(entries, 's');
  });

  /** Vista per sistema: in fondo le righe Ferie delle persone mostrate. */
  protected readonly systemVacation = computed<GridSection | null>(() => {
    if (this.grouping() !== 'system') {
      return null;
    }
    const start = this.systemSections().reduce((n, section) => n + section.entries.length, 0);
    let nav = start;
    const entries = this.groups().flatMap((group) =>
      group.rows
        .filter((gridRow) => gridRow.row.vacation)
        .map((gridRow) => ({ group, gridRow: { ...gridRow, nav: nav++ } })),
    );
    return {
      key: 's|Ferie',
      label: 'Ferie',
      entries,
      rowCount: entries.length,
      weekTotals: weekTotalsOf(entries),
      total: Math.round(entries.reduce((sum, entry) => sum + entry.gridRow.total, 0) * 100) / 100,
    };
  });

  /**
   * Vista per sistema: le festività nazionali, una riga per calendario (es. San Marino, Italia)
   * dei calendari delle persone mostrate; il valore è il numero di festività della settimana.
   */
  protected readonly systemHolidays = computed<HolidaySection | null>(() => {
    if (this.grouping() !== 'system') {
      return null;
    }
    const calendars = new Map<string, HolidayCalendarRow>();
    for (const group of this.groups()) {
      const name = group.resource.holidayCalendarName ?? 'Senza calendario';
      if (calendars.has(name)) {
        continue;
      }
      calendars.set(name, {
        name,
        weeks: Object.fromEntries(
          group.totals.map((total) => [
            total.weekStart,
            { days: total.holidayNames.length, names: total.holidayNames },
          ]),
        ),
      });
    }
    const rows = [...calendars.values()].sort((a, b) => a.name.localeCompare(b.name, 'it'));
    return {
      key: 's|Festività',
      label: 'Festività nazionali',
      entries: [],
      calendars: rows,
      rowCount: rows.length,
      weekTotals: {},
      total: 0,
    };
  });

  /** Righe visibili nell'ordine della griglia, per incollare un blocco di celle. */
  private readonly flatRows = computed<GridEntry[]>(() => {
    const closedSections = this.collapsedSections();
    if (this.grouping() === 'system') {
      const vacation = this.systemVacation();
      return [...this.systemSections(), ...(vacation ? [vacation] : [])]
        .filter((section) => !closedSections.has(section.key))
        .flatMap((section) => section.entries);
    }
    return this.groups()
      .filter((group) => !this.collapsed().has(group.resource.resourceId))
      .flatMap((group) =>
        group.rows
          .filter(
            (gridRow) =>
              this.grouping() === 'person' ||
              gridRow.row.vacation ||
              !closedSections.has(`p${group.resource.resourceId}|${systemOf(gridRow.row)}`),
          )
          .map((gridRow) => ({ group, gridRow })),
      );
  });

  protected readonly hasFilters = computed(
    () =>
      !!this.search().trim() ||
      this.resourceFilter() !== null ||
      this.projectFilter() !== null ||
      this.priorityFilter() !== null ||
      this.statusFilter() !== null,
  );

  /** Ordinamento, colonne, raggruppamento o gruppi chiusi diversi dalla vista di partenza. */
  protected readonly viewChanged = computed(
    () =>
      this.sortLevels().length > 0 ||
      this.columnLayout() !== null ||
      this.grouping() !== 'person' ||
      this.showArchived() ||
      this.collapsed().size > 0 ||
      this.collapsedSections().size > 0,
  );

  constructor() {
    this.preferences.get<PlanPreferences>(PLAN_PREFERENCES).subscribe({
      next: (saved) => {
        if (this.viewApplied) {
          return;
        }
        if (saved?.statuses) {
          this.statusFilter.set(saved.statuses);
        }
        if (saved?.sort) {
          this.sortLevels.set(saved.sort.filter((level) => isSortable(level.id)));
        }
        if (saved?.columns) {
          this.columnLayout.set(saved.columns);
        }
        if (saved?.grouping && saved.grouping in GROUPING_LABELS) {
          this.grouping.set(saved.grouping);
        }
      },
    });
    effect(() => {
      const from = this.from();
      const weekCount = this.weekCount();
      const archived = this.showArchived();
      untracked(() => this.load(from, weekCount, archived));
    });
    // Posizione delle colonne bloccate: si rimisura quando cambiano colonne o dati
    effect(() => {
      this.infoColumns();
      this.plan();
      afterNextRender(() => this.measureFrozenColumns(), { injector: this.injector });
    });
  }

  /** null = default (solo aperti). */
  protected setStatuses(codes: readonly string[] | null): void {
    this.statusFilter.set(codes);
    this.savePreferences();
  }

  /**
   * Reset per "tornare a casa": vista standard (niente ricerca e filtri, stato solo aperti,
   * ordinamento, colonne e raggruppamento di partenza), gruppi aperti e settimana corrente.
   */
  protected clearFilters(): void {
    const views = this.savedViews();
    if (views) {
      views.reset();
    } else {
      this.applyView(null);
    }
    this.collapsed.set(new Set());
    this.collapsedSections.set(new Set());
    this.goToday();
  }

  /** Clic sull'intestazione: ordina, aggiunge il secondo livello o inverte/toglie (vedi nextSort). */
  protected toggleSort(id: string): void {
    this.sortLevels.update((current) => nextSort(current, id));
    this.savePreferences();
  }

  /** "Ordina crescente/decrescente" dal menu del filtro della colonna (null = togli). */
  protected sortFromMenu(id: string, direction: SortDirection | null): void {
    this.sortLevels.update((current) => setSort(current, id, direction));
    this.savePreferences();
  }

  protected sortDirection(id: string): SortDirection | null {
    return this.sortOf(id)?.direction ?? null;
  }

  protected clearSort(): void {
    this.sortLevels.set([]);
    this.savePreferences();
  }

  /** Posizione (1 o 2) e direzione dell'ordinamento di una colonna, per l'intestazione. */
  protected sortOf(id: string): { position: number; direction: 'asc' | 'desc' } | null {
    const levels = this.sortLevels();
    const index = levels.findIndex((level) => level.id === id);
    return index === -1 ? null : { position: index + 1, direction: levels[index].direction };
  }

  protected ariaSort(id: string): 'ascending' | 'descending' | null {
    const sort = this.sortOf(id);
    return sort ? (sort.direction === 'asc' ? 'ascending' : 'descending') : null;
  }

  protected openColumnChooser(): void {
    const data: ColumnChooserData = { columns: PLAN_INFO_COLUMNS, layout: this.columnLayout() };
    this.dialog
      .open<ColumnChooserDialog, ColumnChooserData, ColumnChooserResult>(ColumnChooserDialog, {
        data,
        width: '440px',
        maxWidth: '100vw',
      })
      .afterClosed()
      .pipe(filter((result): result is ColumnChooserResult => result !== undefined))
      .subscribe((result) => {
        this.columnLayout.set(result === 'reset' ? null : result);
        this.savePreferences();
      });
  }

  protected setQuickText(resourceId: number, value: string | number): void {
    if (typeof value === 'string') {
      this.quickText.update((current) => ({ ...current, [resourceId]: value }));
    }
  }

  /** Aggiunta veloce: la riga nasce subito e il cursore va sulla settimana corrente. */
  protected quickAdd(resource: ResourcePlan, projectId: number): void {
    this.quickText.update((current) => ({ ...current, [resource.resourceId]: '' }));
    this.planService
      .createRow({
        resourceId: resource.resourceId,
        projectId,
        rowNote: null,
        archived: false,
        version: null,
      })
      .subscribe({
        next: (row) => {
          this.plan.update((plan) =>
            plan
              ? {
                  ...plan,
                  resources: plan.resources.map((current) =>
                    current.resourceId !== resource.resourceId
                      ? current
                      : {
                          ...current,
                          // Prima della riga Ferie, che resta in fondo
                          rows: [
                            ...current.rows.filter((r) => !r.vacation),
                            row,
                            ...current.rows.filter((r) => r.vacation),
                          ],
                        },
                  ),
                }
              : plan,
          );
          this.snackBar.open(`Aggiunta: ${this.rowLabel(row)}`, 'OK', { duration: 2500 });
          const week = this.weeks().find((candidate) => candidate.current) ?? this.weeks()[0];
          setTimeout(() =>
            document
              .querySelector<HTMLInputElement>(
                `input[data-row="${row.id}"][data-week="${week.weekStart}"]`,
              )
              ?.focus(),
          );
        },
        error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi'),
      });
  }

  /** Nota della riga scritta direttamente nella cella: si salva uscendo dal campo. */
  protected saveRowNote(resource: ResourcePlan, row: PlanRow, input: HTMLInputElement): void {
    const note = input.value.trim() || null;
    if (row.id === null || note === (row.rowNote ?? null)) {
      return;
    }
    this.pending.update((value) => value + 1);
    this.planService
      .updateRow(row.id, {
        resourceId: row.resourceId,
        projectId: row.projectId,
        rowNote: note,
        archived: row.archived,
        version: row.version,
      })
      .subscribe({
        next: (saved) => {
          this.pending.update((value) => value - 1);
          this.replaceRow(resource.resourceId, row.id!, {
            rowNote: saved.rowNote,
            version: saved.version,
          });
        },
        error: (error: unknown) => {
          this.pending.update((value) => value - 1);
          input.value = row.rowNote ?? '';
          this.snackBar.open(errorMessage(error), 'Chiudi');
        },
      });
  }

  /**
   * Incolla da Excel: un blocco di celle (colonne separate da tabulazione, righe a capo) riempie
   * le settimane a destra e le righe sotto, a partire dalla cella scelta. Valori non validi saltati.
   */
  protected onPaste(event: ClipboardEvent, gridRow: GridRow, weekStart: string): void {
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!/[\t\n]/.test(text.trim())) {
      return;
    }
    event.preventDefault();
    const lines = text.replace(/\r/g, '').replace(/\n$/, '').split('\n');
    const rows = this.flatRows();
    const weeks = this.weeks();
    const firstRow = rows.findIndex((entry) => entry.gridRow.nav === gridRow.nav);
    const firstWeek = weeks.findIndex((week) => week.weekStart === weekStart);
    const writes: {
      resource: ResourcePlan;
      row: PlanRow;
      weekStart: string;
      days: number;
      note: string | null;
    }[] = [];
    let skipped = 0;
    lines.forEach((line, r) => {
      const target = rows[firstRow + r];
      line.split('\t').forEach((value, c) => {
        const week = weeks[firstWeek + c];
        const days = parseDays(value);
        if (!target || !week || days === null) {
          skipped++;
          return;
        }
        const previous = target.gridRow.cells[week.weekStart];
        if (days !== (previous?.days ?? 0)) {
          writes.push({
            resource: target.group.resource,
            row: target.gridRow.row,
            weekStart: week.weekStart,
            days,
            note: previous?.note ?? null,
          });
        }
      });
    });
    this.writeSequentially(writes, writes.length, skipped);
  }

  /** Torna al default: solo progetti aperti. */
  protected resetStatuses(): void {
    this.statusFilter.set(null);
    this.savePreferences();
  }

  /** Frecce del periodo: scorrono le settimane di una, come una colonna in Excel. */
  protected shift(direction: -1 | 1): void {
    this.gridWrap()?.nativeElement.scrollBy({
      left: direction * this.weekWidth(),
      behavior: 'smooth',
    });
  }

  /** Torna alla vista di partenza: prima le 2 settimane passate, poi la corrente e le future. */
  protected goToday(): void {
    const target = addWeeks(currentMonday(), -PAST_WEEKS);
    if (!this.scrollToWeek(target, 'smooth')) {
      this.pendingScroll = { toWeek: target };
      this.from.set(defaultStart());
      this.weekCount.set(LOAD_PAST_WEEKS + 1 + LOAD_FUTURE_WEEKS);
    }
  }

  /** Scorrendo: aggiorna le settimane a vista e, vicino a un bordo, ne carica altre. */
  protected onGridScroll(): void {
    cancelAnimationFrame(this.scrollFrame);
    this.scrollFrame = requestAnimationFrame(() => this.updateVisibleRange());
  }

  @HostListener('window:resize')
  protected onResize(): void {
    this.onGridScroll();
  }

  private updateVisibleRange(): void {
    const wrap = this.gridWrap()?.nativeElement;
    const total = this.weeks().length;
    if (!wrap || total === 0) {
      return;
    }
    const width = this.weekWidth();
    const first = Math.min(total - 1, Math.round(wrap.scrollLeft / width));
    const count = Math.max(1, Math.floor((wrap.clientWidth - this.frozenWidth()) / width));
    const last = Math.min(total - 1, first + count - 1);
    const current = this.visibleRange();
    if (current.first !== first || current.last !== last) {
      this.visibleRange.set({ first, last });
    }
    if (this.extending || this.pendingScroll || total + EXTEND_WEEKS > MAX_LOADED_WEEKS) {
      return;
    }
    if (last >= total - 2) {
      this.extending = true;
      this.weekCount.update((weeks) => weeks + EXTEND_WEEKS);
    } else if (wrap.scrollLeft < width / 2) {
      this.extending = true;
      this.pendingScroll = { byWeeks: EXTEND_WEEKS };
      this.from.update((from) => addWeeks(from, -EXTEND_WEEKS));
      this.weekCount.update((weeks) => weeks + EXTEND_WEEKS);
    }
  }

  /** Porta la settimana al bordo sinistro dell'area che scorre; false se non è caricata. */
  private scrollToWeek(weekStart: string, behavior: ScrollBehavior = 'auto'): boolean {
    const index = this.weeks().findIndex((week) => week.weekStart === weekStart);
    const wrap = this.gridWrap()?.nativeElement;
    if (index === -1 || !wrap) {
      return false;
    }
    wrap.scrollTo({ left: index * this.weekWidth(), behavior });
    return true;
  }

  private weekWidth(): number {
    const head = this.gridWrap()?.nativeElement.querySelector<HTMLElement>('thead .c-week');
    return head?.offsetWidth || FALLBACK_WEEK_WIDTH;
  }

  /** Larghezza delle colonne bloccate a sinistra (fino alla prima settimana). */
  private frozenWidth(): number {
    const head = this.gridWrap()?.nativeElement.querySelector<HTMLElement>('thead .c-week');
    return head?.offsetLeft ?? 0;
  }

  /**
   * Colonne bloccate come i riquadri bloccati di Excel: la posizione di ciascuna (somma delle
   * larghezze di quelle a sinistra) va in variabili CSS sulla tabella, usate da "left".
   */
  private measureFrozenColumns(): void {
    const table = this.gridWrap()?.nativeElement.querySelector<HTMLElement>('table');
    if (!table) {
      return;
    }
    let left = 0;
    let infoLeft: number | null = null;
    for (const head of Array.from(table.querySelectorAll<HTMLElement>('thead tr:first-child th'))) {
      if (head.classList.contains('c-week')) {
        break;
      }
      const id = Array.from(head.classList)
        .find((name) => name.startsWith('c-'))
        ?.slice(2);
      if (id) {
        table.style.setProperty('--left-' + id, left + 'px');
        if (id !== 'menu' && id !== 'code' && id !== 'project') {
          infoLeft ??= left;
        }
      }
      left += head.offsetWidth;
    }
    table.style.setProperty('--left-info', (infoLeft ?? left) + 'px');
    this.updateVisibleRange();
  }

  /** Applica una vista salvata; null = vista standard (solo aperti, nessun filtro, colonne di partenza). */
  protected applyView(state: unknown): void {
    this.viewApplied = true;
    const view = (state ?? {}) as Partial<{
      statuses: readonly string[] | null;
      resources: readonly string[] | null;
      projects: readonly string[] | null;
      priorities: readonly string[] | null;
      search: string;
      sort: SortLevel[];
      columns: ColumnLayout | null;
      grouping: PlanGrouping;
      archived: boolean;
    }>;
    this.statusFilter.set(view.statuses ?? null);
    this.resourceFilter.set(view.resources ?? null);
    this.projectFilter.set(view.projects ?? null);
    this.priorityFilter.set(view.priorities ?? null);
    this.search.set(view.search ?? '');
    this.sortLevels.set((view.sort ?? []).filter((level) => isSortable(level.id)));
    this.columnLayout.set(view.columns ?? null);
    this.grouping.set(view.grouping && view.grouping in GROUPING_LABELS ? view.grouping : 'person');
    this.showArchived.set(view.archived ?? false);
    this.savePreferences();
  }

  protected setGrouping(grouping: PlanGrouping): void {
    this.grouping.set(grouping);
    this.savePreferences();
  }

  /** Apre o chiude un gruppo per sistema: chiuso mostra solo i totali per settimana. */
  protected toggleSection(key: string): void {
    this.collapsedSections.update((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }

  protected vacationRows(group: GridGroup): readonly GridRow[] {
    return group.rows.filter((gridRow) => gridRow.row.vacation);
  }

  protected rowKey(gridRow: GridRow): string | number {
    return gridRow.row.id ?? 'ferie-' + gridRow.row.resourceId;
  }

  protected toggle(resourceId: number): void {
    this.collapsed.update((current) => {
      const next = new Set(current);
      if (next.has(resourceId)) {
        next.delete(resourceId);
      } else {
        next.add(resourceId);
      }
      return next;
    });
  }

  protected weekIsCurrent(weekStart: string): boolean {
    return this.weeks().some((week) => week.current && week.weekStart === weekStart);
  }

  /** Settimana già chiusa (prima di quella corrente): in intestazione è rossa, perché scaduta. */
  protected isPastWeek(weekStart: string): boolean {
    return weekStart < currentMonday();
  }

  protected format(days: number | undefined): string {
    return formatDays(days);
  }

  protected dayLabel(iso: string): string {
    return formatDay(iso);
  }

  protected rowLabel(row: PlanRow): string {
    return planRowLabel(row);
  }

  /** Valore cambiato nella vista telefono. */
  protected commitChange(change: CellChange): void {
    this.commit(change.group, change.gridRow, change.weekStart, change.input);
  }

  /** Salva la cella quando si esce dal campo, solo se il valore è cambiato. */
  protected commit(
    group: GridGroup,
    gridRow: GridRow,
    weekStart: string,
    input: HTMLInputElement,
  ): void {
    const previous = gridRow.cells[weekStart];
    const days = parseDays(input.value);
    if (days === null) {
      input.value = this.format(previous?.days);
      this.snackBar.open('Giornate da 0 a 7, al massimo due decimali (es. 0,25)', 'Chiudi', {
        duration: 4000,
      });
      return;
    }
    input.value = this.format(days);
    if (days === (previous?.days ?? 0)) {
      return;
    }
    this.save(
      group.resource,
      gridRow.row,
      this.planService.saveCell(gridRow.row, weekStart, days, previous?.note ?? null),
    );
  }

  /**
   * Invio e frecce su/giù spostano nella stessa settimana della riga sotto o sopra; Alt+N apre
   * la nota, Alt+T i task della casella.
   */
  protected onKey(
    event: KeyboardEvent,
    group: GridGroup,
    gridRow: GridRow,
    weekStart: string,
  ): void {
    if (event.altKey && (event.key === 'n' || event.key === 'N')) {
      event.preventDefault();
      this.editNote(group, gridRow, weekStart);
      return;
    }
    if (event.altKey && (event.key === 't' || event.key === 'T')) {
      event.preventDefault();
      this.openTasks(group, gridRow, weekStart);
      return;
    }
    const step =
      event.key === 'ArrowDown' || event.key === 'Enter' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const next = document.querySelector<HTMLInputElement>(
      `input[data-nav="${gridRow.nav + step}"][data-week="${weekStart}"]`,
    );
    (event.target as HTMLInputElement).blur();
    next?.focus();
    next?.select();
  }

  protected editNote(group: GridGroup, gridRow: GridRow, weekStart: string): void {
    if (!this.canWrite()) {
      return;
    }
    const cell = gridRow.cells[weekStart];
    const data: CellNoteData = {
      title: `${group.resource.name} · ${this.rowLabel(gridRow.row)} · settimana del ${this.dayLabel(weekStart)}`,
      note: cell?.note ?? null,
    };
    this.dialog
      .open<CellNoteDialog, CellNoteData, string>(CellNoteDialog, {
        data,
        width: '480px',
        maxWidth: '100vw',
      })
      .afterClosed()
      .pipe(filter((note): note is string => note !== undefined))
      .subscribe((note) =>
        this.save(
          group.resource,
          gridRow.row,
          this.planService.saveCell(gridRow.row, weekStart, cell?.days ?? 0, note || null),
        ),
      );
  }

  /** Pannello laterale con task e note della casella; alla chiusura aggiorna i pallini. */
  protected openTasks(group: GridGroup, gridRow: GridRow, weekStart: string): void {
    const planRowId = gridRow.row.id;
    if (planRowId === null) {
      return;
    }
    const data: CellTasksData = {
      planRowId,
      weekStart,
      resourceId: group.resource.resourceId,
      resourceName: group.resource.name,
      rowLabel: this.rowLabel(gridRow.row),
      weekLabel: `settimana del ${this.dayLabel(weekStart)}`,
    };
    this.dialog
      .open<CellTasksPanel, CellTasksData, boolean>(CellTasksPanel, {
        data,
        width: '480px',
        maxWidth: '100vw',
        height: '100%',
        position: { top: '0', right: '0' },
        panelClass: 'side-panel',
        autoFocus: false,
      })
      .afterClosed()
      .pipe(filter((changed) => changed === true))
      .subscribe(() => this.loadCellTasks());
  }

  /** Descrizione del pallino della casella per i lettori di schermo e il tooltip. */
  protected taskCountLabel(count: CellTaskCount | undefined): string {
    if (!count) {
      return 'Aggiungi task o nota (Alt+T)';
    }
    return count.open > 0
      ? `${count.open} task aperti su ${count.total} · apri (Alt+T)`
      : `${count.total} task o note chiusi · apri (Alt+T)`;
  }

  protected fill(group: GridGroup, gridRow: GridRow): void {
    const weeks = this.weeks();
    const data: FillDialogData = {
      rowLabel: `${group.resource.name} · ${this.rowLabel(gridRow.row)}`,
      fromWeek: weeks[0].weekStart,
      toWeek: weeks[weeks.length - 1].weekStart,
    };
    this.dialog
      .open<FillDialog, FillDialogData, FillDialogResult>(FillDialog, {
        data,
        width: '520px',
        maxWidth: '100vw',
      })
      .afterClosed()
      .pipe(filter((result): result is FillDialogResult => result !== undefined))
      .subscribe((result) =>
        this.save(
          group.resource,
          gridRow.row,
          this.planService.fill(gridRow.row, result.fromWeek, result.toWeek, result.days),
          'Intervallo riempito',
        ),
      );
  }

  protected addRow(resourceId?: number): void {
    this.openRowDialog({ resourceId })
      .pipe(switchMap((body) => this.planService.createRow(body)))
      .subscribe({
        next: () => {
          this.snackBar.open('Riga aggiunta', 'OK', { duration: 2500 });
          this.reload();
        },
        error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi'),
      });
  }

  protected editRow(row: PlanRow): void {
    this.openRowDialog({ row })
      .pipe(switchMap((body) => this.planService.updateRow(row.id!, body)))
      .subscribe({
        next: () => {
          this.snackBar.open('Riga salvata', 'OK', { duration: 2500 });
          this.reload();
        },
        error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi'),
      });
  }

  protected toggleArchived(row: PlanRow): void {
    this.planService
      .updateRow(row.id!, {
        resourceId: row.resourceId,
        projectId: row.projectId,
        rowNote: row.rowNote,
        archived: !row.archived,
        version: row.version,
      })
      .subscribe({
        next: () => {
          this.snackBar.open(row.archived ? 'Riga ripristinata' : 'Riga archiviata', 'OK', {
            duration: 2500,
          });
          this.reload();
        },
        error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi'),
      });
  }

  protected deleteRow(row: PlanRow): void {
    const data: ConfirmDialogData = {
      title: 'Eliminare la riga?',
      message: `${this.rowLabel(row)}. Si elimina solo una riga senza giornate.`,
      confirmLabel: 'Elimina',
    };
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => this.planService.deleteRow(row.id!)),
      )
      .subscribe({
        next: () => this.reload(),
        error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi'),
      });
  }

  protected reload(): void {
    this.load(this.from(), this.weekCount(), this.showArchived());
  }

  /** Stati scelti, ordinamento e colonne restano salvati per l'utente. */
  private savePreferences(): void {
    const value: PlanPreferences = {
      ...(this.statusFilter() ? { statuses: [...this.statusFilter()!] } : {}),
      sort: [...this.sortLevels()],
      ...(this.columnLayout() ? { columns: this.columnLayout()! } : {}),
      grouping: this.grouping(),
    };
    this.preferences.save(PLAN_PREFERENCES, value).subscribe({ error: () => undefined });
  }

  private openRowDialog(extra: Partial<RowDialogData>) {
    const plan = this.plan()!;
    const data: RowDialogData = {
      resources: this.resourceOptions(),
      excludedProjectIds: plan.holidayProjectId ? [plan.holidayProjectId] : [],
      ...extra,
    };
    return this.dialog
      .open<RowDialog, RowDialogData, RowBody>(RowDialog, {
        data,
        width: '560px',
        maxWidth: '100vw',
      })
      .afterClosed()
      .pipe(filter((body): body is RowBody => body !== undefined));
  }

  /** Salva e aggiorna solo la riga toccata: le celle tornano dal server, i totali si ricalcolano. */
  private save(
    resource: ResourcePlan,
    row: PlanRow,
    request: ReturnType<PlanService['saveCell']>,
    message?: string,
  ) {
    this.pending.update((value) => value + 1);
    request.subscribe({
      next: (result) => {
        this.pending.update((value) => value - 1);
        this.applyCells(resource.resourceId, row, result);
        if (message) {
          this.snackBar.open(message, 'OK', { duration: 2500 });
        }
      },
      error: (error: unknown) => {
        this.pending.update((value) => value - 1);
        this.snackBar.open(errorMessage(error), 'Chiudi');
        this.reload();
      },
    });
  }

  /** Scrive le celle una alla volta (la riga Ferie può nascere alla prima) e poi riassume. */
  private writeSequentially(
    writes: {
      resource: ResourcePlan;
      row: PlanRow;
      weekStart: string;
      days: number;
      note: string | null;
    }[],
    total: number,
    skipped: number,
  ): void {
    const [next, ...rest] = writes;
    if (!next) {
      const message =
        `${total} ${total === 1 ? 'cella incollata' : 'celle incollate'}` +
        (skipped > 0 ? ` · ${skipped} valori saltati (fuori griglia o non validi)` : '');
      this.snackBar.open(message, 'OK', { duration: 4000 });
      return;
    }
    this.pending.update((value) => value + 1);
    this.planService.saveCell(next.row, next.weekStart, next.days, next.note).subscribe({
      next: (result) => {
        this.pending.update((value) => value - 1);
        this.applyCells(next.resource.resourceId, next.row, result);
        this.writeSequentially(rest, total, skipped);
      },
      error: (error: unknown) => {
        this.pending.update((value) => value - 1);
        this.snackBar.open(errorMessage(error), 'Chiudi');
        this.reload();
      },
    });
  }

  private replaceRow(resourceId: number, rowId: number, change: Partial<PlanRow>): void {
    this.plan.update((plan) =>
      plan
        ? {
            ...plan,
            resources: plan.resources.map((resource) =>
              resource.resourceId !== resourceId
                ? resource
                : {
                    ...resource,
                    rows: resource.rows.map((row) =>
                      row.id === rowId ? { ...row, ...change } : row,
                    ),
                  },
            ),
          }
        : plan,
    );
  }

  private applyCells(resourceId: number, target: PlanRow, result: CellsResult): void {
    this.plan.update((plan) => {
      if (!plan) {
        return plan;
      }
      return {
        ...plan,
        resources: plan.resources.map((resource) =>
          resource.resourceId !== resourceId
            ? resource
            : {
                ...resource,
                rows: resource.rows.map((row) => {
                  // La riga Ferie non ancora creata si riconosce per risorsa: ora ha il suo id
                  // (anche se nel frattempo un salvataggio precedente gliel'ha già dato)
                  const same =
                    target.id === null
                      ? row.vacation && (row.id === null || row.id === result.rowId)
                      : row.id === target.id;
                  if (!same) {
                    return row;
                  }
                  const changed = new Map(result.cells.map((cell) => [cell.weekStart, cell]));
                  const cells = [
                    ...row.cells.filter((cell) => !changed.has(cell.weekStart)),
                    ...result.cells.filter((cell) => cell.days > 0 || cell.note),
                  ].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
                  return { ...row, id: result.rowId, version: result.rowVersion, cells };
                }),
              },
        ),
      };
    });
  }

  private load(from: string, weekCount: number, archived: boolean): void {
    if (!this.plan()) {
      this.state.set('loading');
    }
    this.planService.load(from, weekCount, archived).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        afterNextRender(() => this.applyPendingScroll(), { injector: this.injector });
        this.loadCellTasks();
        this.mobileWeek.set(
          Math.max(
            0,
            plan.weeks.findIndex((week) => week.current),
          ),
        );
        this.state.set('ready');
      },
      error: () => {
        this.extending = false;
        this.pendingScroll = null;
        this.state.set('error');
      },
    });
  }

  /** Dopo un caricamento: posizione di partenza o compensazione delle settimane aggiunte a sinistra. */
  private applyPendingScroll(): void {
    const pending = this.pendingScroll;
    const wrap = this.gridWrap()?.nativeElement;
    this.pendingScroll = null;
    if (pending?.toWeek) {
      this.scrollToWeek(pending.toWeek);
    } else if (pending?.byWeeks && wrap) {
      wrap.scrollLeft += pending.byWeeks * this.weekWidth();
    }
    this.extending = false;
    this.updateVisibleRange();
  }

  private loadCellTasks(): void {
    const weeks = this.weeks();
    if (weeks.length === 0) {
      return;
    }
    this.tasksService.cellCounts(weeks[0].weekStart, weeks[weeks.length - 1].weekStart).subscribe({
      next: (counts) =>
        this.cellTasks.set(
          new Map(counts.map((count) => [cellKey(count.planRowId, count.weekStart), count])),
        ),
      // Senza conteggi la griglia resta usabile: i pallini compaiono al prossimo caricamento
      error: () => this.cellTasks.set(new Map()),
    });
  }
}
