import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { API_BASE_URL } from '../../../core/config/api.config';
import { FocusPersonService } from '../../../core/focus/focus-person.service';
import { HBarChart } from '../../../shared/charts/hbar-chart';
import { PageHeader } from '../../../shared/components/page-header/page-header';
import { CrudApiService, errorMessage } from '../../../shared/crud/crud-api.service';
import { HelpContent } from '../../../shared/help/help.model';
import { formatNumber } from '../../../shared/util/number-format';
import { statusTone } from '../../../shared/util/status-tone';
import {
  OverviewProject,
  PROJECT_TYPE,
  ProjectOverview,
  applyFilter,
  byStatus,
  mismatchCount,
  mismatches,
  planHint,
  completions,
  sortToPlan,
  TO_PLAN_DEFAULT_SORT,
  ToPlanSort,
  ToPlanSortKey,
  statusColor,
  StatusSlice,
  priorityMatrix,
  summary,
  toPlanList,
  workByProject,
  workBySystem,
} from './project-overview.model';

/** Righe di "Da pianificare" mostrate prima del link all'elenco completo. */
const TO_PLAN_SHOWN = 15;
/** Ultimi completati mostrati prima del link all'elenco. */
const CLOSURES_SHOWN = 8;

const HELP: HelpContent = {
  title: 'Progetti · Panoramica',
  intro:
    'Il flash del portafoglio: quanti progetti sono aperti e in che stato, quali sono pianificati nelle prossime 4 settimane, dove va il lavoro e cosa resta da pianificare.',
  sections: [
    {
      title: 'Come si legge',
      items: [
        'Pianificato = ha giornate nel piano dalla settimana in corso alle 3 successive.',
        'Da pianificare = aperto, non in Pending, senza giornate in queste 4 settimane; in cima le priorità più alte.',
        'Pending e progetti chiusi non contano tra quelli da pianificare.',
        'Ogni numero e ogni barra apre l’elenco con solo quei progetti.',
      ],
    },
    {
      title: 'Filtri',
      items: [
        'Persona (Admin e PM): solo i progetti di cui è owner o su cui ha righe nel piano; la scelta resta passando a Home, Ticket, Consuntivo e Task. Gli altri vedono sempre i propri.',
        'Tipo: di partenza solo i Project; aggiungi AMS, Continuous o Admin quando servono.',
      ],
    },
  ],
};

/**
 * Panoramica della pagina Progetti: numeri in evidenza, progetti per stato, priorità × piano,
 * dove va il lavoro, da pianificare e stato e piano che non tornano. I dati arrivano per progetto
 * e i conteggi si rifanno a ogni cambio di filtro.
 */
@Component({
  selector: 'gov-projects-overview-page',
  imports: [
    HBarChart,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    PageHeader,
    RouterLink,
  ],
  templateUrl: './projects-overview-page.html',
  styleUrl: './projects-overview-page.scss',
})
export class ProjectsOverviewPage {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/projects/overview`;

  protected readonly help = HELP;
  protected readonly focus = inject(FocusPersonService);

  /** Persone attive per il selettore (solo per chi può scegliere). */
  protected readonly people = toSignal(
    inject(CrudApiService)
      .list('/resources')
      .pipe(
        map((rows) =>
          rows
            .filter((row) => row['active'] !== false)
            .map((row) => ({ id: Number(row.id), name: String(row['fullName'] ?? '') }))
            .sort((a, b) => a.name.localeCompare(b.name, 'it')),
        ),
        catchError(() => of([] as { id: number; name: string }[])),
      ),
    { initialValue: [] as { id: number; name: string }[] },
  );
  protected readonly data = signal<ProjectOverview | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly types = signal<readonly string[]>([PROJECT_TYPE]);
  protected readonly workBy = signal<'project' | 'system'>('project');

  /** Tipi di lavoro presenti: Project per primo, poi in ordine alfabetico (fisso cambiando persona). */
  protected readonly typeOptions = computed(() => {
    const seen = new Map<string, string>();
    for (const p of this.data()?.projects ?? []) {
      seen.set(p.workTypeCode, p.workTypeLabel);
    }
    return [...seen.entries()]
      .map(([code, label]) => ({ code, label }))
      .sort(
        (a, b) =>
          Number(b.code === PROJECT_TYPE) - Number(a.code === PROJECT_TYPE) ||
          a.label.localeCompare(b.label, 'it'),
      );
  });

  protected readonly rows = computed(() =>
    applyFilter(this.data()?.projects ?? [], {
      types: new Set(this.types()),
      // La persona la filtra già il backend
      mineOnly: false,
    }),
  );
  protected readonly sum = computed(() => summary(this.rows()));
  protected readonly statuses = computed(() => byStatus(this.rows(), this.data()?.statuses ?? []));
  protected readonly statusTotal = computed(() =>
    this.statuses().reduce((sum, s) => sum + s.count, 0),
  );
  protected readonly matrix = computed(() =>
    priorityMatrix(this.rows(), this.data()?.priorities ?? [], this.data()?.statuses ?? []),
  );
  protected readonly matrixMax = computed(() =>
    Math.max(1, ...this.matrix().map((r) => r.planned.length + r.notPlanned.length)),
  );
  protected readonly toPlan = computed(() => toPlanList(this.rows()));
  /** Ordinamento della tabella "Da pianificare": di partenza dalla priorità più importante. */
  protected readonly toPlanSort = signal<ToPlanSort>(TO_PLAN_DEFAULT_SORT);
  protected readonly toPlanSorted = computed(() =>
    sortToPlan(this.rows(), this.toPlanSort(), this.data()?.statuses ?? []),
  );
  protected readonly toPlanShown = computed(() => this.toPlanSorted().slice(0, TO_PLAN_SHOWN));
  protected readonly toPlanColumns: readonly {
    key: ToPlanSortKey;
    label: string;
    hint?: string;
  }[] = [
    { key: 'name', label: 'Progetto' },
    { key: 'owner', label: 'Owner' },
    { key: 'priority', label: 'Priorità IT' },
    { key: 'business', label: 'Priorità business' },
    { key: 'ranking', label: 'Ranking' },
    { key: 'status', label: 'Stato' },
    { key: 'system', label: 'Sistema' },
    { key: 'type', label: 'Tipo' },
    {
      key: 'past',
      label: 'Giornate fatte',
      hint: 'Giornate nel piano nelle settimane già passate',
    },
    { key: 'plan', label: 'Piano', hint: 'Cosa dice il piano oltre le prossime 4 settimane' },
  ];
  protected readonly work = computed(() =>
    this.workBy() === 'project' ? workByProject(this.rows()) : workBySystem(this.rows()),
  );
  protected readonly wrong = computed(() => mismatches(this.rows()));
  protected readonly wrongCount = computed(() => mismatchCount(this.wrong()));

  /** Insiemi di id per aprire l'elenco filtrato. */
  protected readonly openIds = computed(() =>
    this.rows()
      .filter((p) => !p.closed)
      .map((p) => p.id),
  );
  protected readonly inProgressIds = computed(() =>
    this.rows()
      .filter((p) => !p.closed && p.statusCode === 'IN_PROGRESS')
      .map((p) => p.id),
  );
  protected readonly plannedIds = computed(() =>
    this.rows()
      .filter((p) => !p.closed && p.statusCode !== 'PENDING' && p.daysAhead > 0)
      .map((p) => p.id),
  );
  protected readonly toPlanIds = computed(() => this.toPlan().map((p) => p.id));
  protected readonly pendingIds = computed(() =>
    this.rows()
      .filter((p) => p.statusCode === 'PENDING')
      .map((p) => p.id),
  );
  /** Di che casi è fatto il numero "stato e piano non tornano", in breve (singolare o plurale). */
  protected readonly wrongParts = computed(() => {
    const w = this.wrong();
    const part = (count: number, one: string, many: string): string =>
      count === 0 ? '' : `${count} ${count === 1 ? one : many}`;
    return [
      part(
        w.inProgressWithoutPlan.length,
        'In Progress senza giornate',
        'In Progress senza giornate',
      ),
      part(
        w.startedNotInProgress.length,
        'da avviare già pianificato',
        'da avviare già pianificati',
      ),
      part(w.pendingWithPlan.length, 'in Pending pianificato', 'in Pending pianificati'),
    ]
      .filter((text) => text)
      .join(' · ');
  });
  protected readonly wrongIds = computed(() => {
    const w = this.wrong();
    return [...w.inProgressWithoutPlan, ...w.startedNotInProgress, ...w.pendingWithPlan].map(
      (p) => p.id,
    );
  });

  protected readonly planHint = planHint;

  /**
   * Saturazione: giornate sui progetti (dei tipi scelti) sulla capacità nelle 4 settimane, al netto delle
   * festività, della persona in vista o del team. Null senza capacità (es. persona non pianificabile).
   */
  protected readonly saturation = computed(() => {
    const capacity = this.data()?.capacityAhead ?? 0;
    return capacity > 0
      ? { pct: Math.round((this.sum().daysAhead / capacity) * 100), capacity }
      : null;
  });

  /** Chiusure: i Completed come statistica (quanti e quando), mai negli avvisi. */
  protected readonly closures = computed(() =>
    completions(this.rows(), new Date().toISOString().slice(0, 10)),
  );
  protected readonly closuresShown = computed(() => this.closures().items.slice(0, CLOSURES_SHOWN));
  protected readonly completedIds = computed(() => this.closures().items.map((p) => p.id));

  /** Data aaaa-mm-gg come gg/mm/aaaa. */
  protected date(iso: string): string {
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  }

  /** Clic su un'intestazione: ordina per quella colonna; un secondo clic inverte. */
  protected sortToPlanBy(key: ToPlanSortKey): void {
    const current = this.toPlanSort();
    this.toPlanSort.set({ key, desc: current.key === key ? !current.desc : false });
  }

  protected ariaSort(key: ToPlanSortKey): 'ascending' | 'descending' | 'none' {
    const current = this.toPlanSort();
    return current.key !== key ? 'none' : current.desc ? 'descending' : 'ascending';
  }
  protected readonly statusColor = statusColor;
  protected readonly tone = statusTone;

  /** Tooltip del riquadro di uno stato: quanti, che percentuale, e che il clic apre l'elenco. */
  protected statusTitle(slice: StatusSlice): string {
    const pct = this.percent(slice.count, this.statusTotal()).toFixed(0);
    return `${slice.status.label}: ${slice.count} (${pct}%) · apri nell'elenco`;
  }

  constructor() {
    // A ogni cambio della persona in vista si ricarica (anche se scelta in un'altra pagina)
    effect(() => {
      const resource = this.focus.resourceId();
      untracked(() => this.load(resource));
    });
  }

  protected load(resource = this.focus.resourceId()): void {
    this.error.set(null);
    this.data.set(null);
    const params: Record<string, string> = resource === null ? {} : { resource: String(resource) };
    this.http.get<ProjectOverview>(this.url, { params }).subscribe({
      next: (overview) => this.data.set(overview),
      error: (err) => this.error.set(errorMessage(err)),
    });
  }

  /** Query per l'elenco con solo questi progetti (vuoto: nessun progetto). */
  protected listParams(ids: readonly number[]): Record<string, string> {
    return { ids: ids.join(',') };
  }

  protected days(value: number): string {
    return formatNumber(value, 1);
  }

  protected percent(part: number, total: number): number {
    return total > 0 ? (part / total) * 100 : 0;
  }

  protected projectLabel(p: OverviewProject): string {
    return p.code ? `${p.code} · ${p.name}` : p.name;
  }

  protected setTypes(values: readonly string[]): void {
    // Almeno un tipo: togliere l'ultimo riporta ai soli Project
    this.types.set(values.length > 0 ? values : [PROJECT_TYPE]);
  }
}
