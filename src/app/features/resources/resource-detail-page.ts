import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { CrudApiService } from '../../shared/crud/crud-api.service';
import { CrudSection } from '../../shared/crud/crud-section/crud-section';
import { EntityRow } from '../../shared/crud/crud.model';
import {
  EntityFormDialog,
  EntityFormDialogData,
} from '../../shared/crud/entity-form-dialog/entity-form-dialog';
import {
  RESOURCES_CONFIG,
  capacityPeriodsConfig,
  extraCapacitiesConfig,
  ratesConfig,
} from './resources.configs';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Scheda risorsa (smart component): dati anagrafici e, in schede, capacità per periodo,
 * ore extra settimanali e tariffe (queste ultime solo con il permesso sui costi).
 */
@Component({
  selector: 'gov-resource-detail-page',
  imports: [
    RouterLink,
    PageHeader,
    CrudSection,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './resource-detail-page.html',
  styleUrl: './resource-detail-page.scss',
})
export class ResourceDetailPage {
  private readonly api = inject(CrudApiService);
  private readonly dialog = inject(MatDialog);
  private readonly currentUser = inject(AuthService).currentUser;
  private readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 599.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  /** Id della risorsa dal percorso /resources/:id. */
  readonly id = input.required<string>();

  protected readonly state = signal<LoadState>('loading');
  protected readonly resource = signal<EntityRow | null>(null);

  protected readonly resourceId = computed(() => Number(this.id()));
  protected readonly capacityConfig = computed(() => capacityPeriodsConfig(this.resourceId()));
  protected readonly extraConfig = computed(() => extraCapacitiesConfig(this.resourceId()));
  protected readonly ratesConfig = computed(() => ratesConfig(this.resourceId()));
  protected readonly canViewCosts = computed(() => this.currentUser()?.canViewCosts === true);
  protected readonly canEdit = computed(() => {
    const role = this.currentUser()?.role;
    return role !== undefined && (RESOURCES_CONFIG.writeRoles ?? []).includes(role);
  });

  protected readonly details = computed(() => {
    const resource = this.resource();
    if (!resource) {
      return [];
    }
    const text = (value: unknown): string =>
      Array.isArray(value) ? value.join(', ') || '—' : value ? String(value) : '—';
    const date = (value: unknown): string =>
      value ? new Intl.DateTimeFormat('it-IT').format(new Date(`${String(value)}T00:00:00`)) : '—';
    return [
      { label: 'Tipo', value: resource['resourceType'] === 'EXTERNAL' ? 'Esterna' : 'Interna' },
      { label: 'Fornitore', value: text(resource['vendorName']) },
      { label: 'Ruolo nel team', value: text(resource['teamRoleLabel']) },
      { label: 'Responsabile', value: text(resource['managerName']) },
      { label: 'Sede', value: text(resource['siteName']) },
      { label: 'Sistemi presidiati', value: text(resource['mainSystemLabels']) },
      { label: 'E-mail', value: text(resource['email']) },
      {
        label: 'Collaborazione',
        value: `${date(resource['startDate'])} → ${date(resource['endDate'])}`,
      },
      { label: 'Competenze', value: text(resource['skills']) },
    ];
  });

  constructor() {
    effect(() => {
      const id = this.resourceId();
      untracked(() => this.load(id));
    });
  }

  protected edit(): void {
    const resource = this.resource();
    if (!resource) {
      return;
    }
    const mobile = this.isMobile();
    this.dialog
      .open<EntityFormDialog, EntityFormDialogData, EntityRow>(EntityFormDialog, {
        data: { config: RESOURCES_CONFIG, row: resource },
        width: mobile ? '100vw' : '720px',
        maxWidth: '100vw',
        height: mobile ? '100dvh' : undefined,
      })
      .afterClosed()
      .pipe(filter((saved): saved is EntityRow => saved !== undefined))
      .subscribe((saved) => this.resource.set(saved));
  }

  private load(id: number): void {
    this.state.set('loading');
    this.api.get(RESOURCES_CONFIG.endpoint, id).subscribe({
      next: (resource) => {
        this.resource.set(resource);
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }
}
