import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { filter, map } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { canEdit } from '../../core/auth/permissions';
import { BackLink } from '../../shared/components/back-link/back-link';
import { CrudApiService } from '../../shared/crud/crud-api.service';
import { EntityRow } from '../../shared/crud/crud.model';
import {
  EntityFormDialog,
  EntityFormDialogData,
} from '../../shared/crud/entity-form-dialog/entity-form-dialog';
import { ProjectComments } from './components/project-comments/project-comments';
import { PROJECTS_CONFIG } from './projects.configs';
import { HelpButton } from '../../shared/help/help-button';
import { PROJECT_DETAIL_HELP } from '../../shared/help/help-content';

type LoadState = 'loading' | 'ready' | 'error';

const DATE = new Intl.DateTimeFormat('it-IT');
const NUMBER = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

interface DetailItem {
  readonly label: string;
  readonly value: string;
}

/**
 * Dettaglio di un progetto (smart component): dati completi, descrizione e bacheca commenti.
 * La modifica dei dati usa lo stesso form dell'elenco.
 */
@Component({
  selector: 'gov-project-detail-page',
  imports: [
    HelpButton,
    BackLink,
    ProjectComments,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './project-detail-page.html',
  styleUrl: './project-detail-page.scss',
})
export class ProjectDetailPage {
  protected readonly help = PROJECT_DETAIL_HELP;
  private readonly api = inject(CrudApiService);
  private readonly dialog = inject(MatDialog);
  private readonly currentUser = inject(AuthService).currentUser;
  private readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 599.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  /** Id del progetto dal percorso /projects/:id. */
  readonly id = input.required<string>();

  protected readonly projectId = computed(() => Number(this.id()));
  protected readonly state = signal<LoadState>('loading');
  protected readonly project = signal<EntityRow | null>(null);
  protected readonly canEdit = computed(() => canEdit(this.currentUser()?.permissions, 'PROJECTS'));

  protected readonly details = computed<DetailItem[]>(() => {
    const p = this.project();
    if (!p) {
      return [];
    }
    const text = (value: unknown): string =>
      Array.isArray(value)
        ? value.join(', ') || '—'
        : value === null || value === undefined || value === ''
          ? '—'
          : String(value);
    const date = (value: unknown): string =>
      value ? DATE.format(new Date(`${String(value)}T00:00:00`)) : '—';
    return [
      { label: 'Tipo', value: text(p['workTypeLabel']) },
      { label: 'Sistema', value: text(p['mainSystemLabel']) },
      { label: 'Stato', value: text(p['statusLabel']) },
      { label: 'Priorità IT', value: text(p['itPriorityLevel']) },
      { label: 'Priorità business', value: text(p['businessPriorityLevel']) },
      { label: 'Ranking', value: text(p['ranking']) },
      { label: 'Owner', value: text(p['ownerNames']) },
      { label: 'Richiesto da', value: text(p['requesterNames']) },
      { label: 'Sponsor', value: text(p['sponsorName']) },
      {
        label: 'Società',
        value: p['groupWide'] ? 'Tutto il gruppo' : text(p['legalEntityNames']),
      },
      { label: 'Capex / Opex', value: text(p['expenseTypeLabel']) },
      { label: 'Stream', value: text(p['streamLabel']) },
      { label: 'Inizio pianificato', value: date(p['plannedStartDate']) },
      { label: 'Fine pianificata', value: date(p['plannedEndDate']) },
      { label: 'Impegno (Due for)', value: text(p['dueForLabel']) },
      {
        label: 'Effort stimato',
        value: p['estimatedEffortDays']
          ? `${NUMBER.format(Number(p['estimatedEffortDays']))} gg`
          : '—',
      },
      { label: 'Completato il', value: date(p['actualCompletionDate']) },
      { label: 'Numero storico Excel', value: text(p['legacyActivityNumber']) },
    ];
  });

  constructor() {
    effect(() => {
      const id = this.projectId();
      untracked(() => this.load(id));
    });
  }

  protected edit(): void {
    const project = this.project();
    if (!project) {
      return;
    }
    const mobile = this.isMobile();
    this.dialog
      .open<EntityFormDialog, EntityFormDialogData, EntityRow>(EntityFormDialog, {
        data: { config: PROJECTS_CONFIG, row: project },
        width: mobile ? '100vw' : '720px',
        maxWidth: '100vw',
        height: mobile ? '100dvh' : undefined,
      })
      .afterClosed()
      .pipe(filter((saved): saved is EntityRow => saved !== undefined))
      .subscribe((saved) => this.project.set(saved));
  }

  private load(id: number): void {
    this.state.set('loading');
    this.api.get(PROJECTS_CONFIG.endpoint, id).subscribe({
      next: (project) => {
        this.project.set(project);
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }
}
