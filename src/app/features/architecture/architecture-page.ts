import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { canEdit, canView } from '../../core/auth/permissions';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { CrudApiService, errorMessage } from '../../shared/crud/crud-api.service';
import { CrudSection } from '../../shared/crud/crud-section/crud-section';
import { EntityConfig, EntityRow } from '../../shared/crud/crud.model';
import {
  EntityFormDialog,
  EntityFormDialogData,
} from '../../shared/crud/entity-form-dialog/entity-form-dialog';
import { ArchitectureImportDialog } from './architecture-import-dialog';
import { ArchitectureMap } from './architecture-map';
import { APPLICATIONS_CONFIG, CONNECTIONS_CONFIG } from './architecture.configs';
import { ARCHITECTURE_HELP } from './architecture.help';
import { APPLICATION_COLUMNS, CONNECTION_COLUMNS, download, toCsv } from './architecture-csv';
import { AppLink, AppNode, dependencies } from './architecture.model';

/**
 * Architettura IT (D-38): la mappa degli applicativi di Marlù e dei flussi tra loro, con gli
 * elenchi per compilarla e l'import/export in CSV.
 */
@Component({
  selector: 'gov-architecture-page',
  imports: [
    ArchitectureMap,
    CrudSection,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTooltipModule,
    PageHeader,
    RouterLink,
  ],
  template: `
    <gov-page-header
      title="Architettura IT"
      subtitle="Gli applicativi, chi li usa e come si passano i dati: cosa si ferma se un sistema va giù."
      [help]="help"
    />

    <div class="actions">
      @if (editable()) {
        <button mat-flat-button type="button" (click)="edit(applications)">
          <mat-icon aria-hidden="true">add</mat-icon>
          Nuovo applicativo
        </button>
        <button mat-stroked-button type="button" (click)="edit(connections)">
          <mat-icon aria-hidden="true">swap_horiz</mat-icon>
          Nuova connessione
        </button>
        <button mat-stroked-button type="button" (click)="importFiles()">
          <mat-icon aria-hidden="true">upload</mat-icon>
          Importa
        </button>
      }
      <button
        mat-stroked-button
        type="button"
        matTooltip="Due file CSV per Excel: Applicativi e Connessioni (anche come modello)"
        (click)="exportFiles()"
      >
        <mat-icon aria-hidden="true">download</mat-icon>
        Esporta
      </button>
      @if (seesTechnologies()) {
        <a mat-button routerLink="/technologies">
          <mat-icon aria-hidden="true">memory</mat-icon>
          Tecnologie e vulnerabilità
        </a>
      }
    </div>

    <ul class="gi-kpis" aria-label="Riepilogo">
      <li class="gi-kpi">
        <span class="gi-kpi__value">{{ summary().apps }}</span>
        <span class="gi-kpi__label">applicativi in uso</span>
      </li>
      <li class="gi-kpi">
        <span class="gi-kpi__value">{{ summary().links }}</span>
        <span class="gi-kpi__label">connessioni</span>
      </li>
      <li class="gi-kpi gi-kpi--critical">
        <span class="gi-kpi__value">{{ summary().critical }}</span>
        <span class="gi-kpi__label">critici per il business</span>
      </li>
      <li
        class="gi-kpi gi-kpi--warning"
        matTooltip="Applicativi che girano su tecnologie fuori supporto o con vulnerabilità aperte"
      >
        <span class="gi-kpi__value">{{ summary().techWarnings }}</span>
        <span class="gi-kpi__label">con tecnologie da trattare</span>
      </li>
      <li
        class="gi-kpi gi-kpi--info"
        matTooltip="Applicativi da cui dipendono direttamente almeno 3 altri: se si fermano, il fermo si allarga"
      >
        <span class="gi-kpi__value">{{ summary().hubs }}</span>
        <span class="gi-kpi__label">snodi (3+ dipendenti)</span>
      </li>
      <li class="gi-kpi" matTooltip="Applicativi senza nessuna connessione: da completare">
        <span class="gi-kpi__value">{{ summary().isolated }}</span>
        <span class="gi-kpi__label">senza connessioni</span>
      </li>
    </ul>

    <mat-tab-group
      mat-stretch-tabs="false"
      dynamicHeight
      [selectedIndex]="tab()"
      (selectedIndexChange)="tab.set($event); load()"
    >
      <mat-tab label="Mappa">
        <gov-architecture-map
          [apps]="apps()"
          [connections]="links()"
          [editable]="editable()"
          [initialId]="initialId"
          (edit)="editApp($event)"
        />
      </mat-tab>
      <mat-tab [label]="'Applicativi (' + apps().length + ')'">
        <ng-template matTabContent>
          <gov-crud-section [config]="applications" [refresh]="refresh()" [leadActions]="true" />
        </ng-template>
      </mat-tab>
      <mat-tab [label]="'Connessioni (' + links().length + ')'">
        <ng-template matTabContent>
          <gov-crud-section [config]="connections" [refresh]="refresh()" [leadActions]="true" />
        </ng-template>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: `
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem 1rem;
      margin-block-end: 1rem;
    }

    .gi-kpis {
      margin-block-end: 1rem;
    }
  `,
})
export class ArchitecturePage {
  private readonly api = inject(CrudApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly user = inject(AuthService).currentUser;

  protected readonly help = ARCHITECTURE_HELP;
  protected readonly applications = APPLICATIONS_CONFIG;
  protected readonly connections = CONNECTIONS_CONFIG;
  protected readonly editable = computed(() => canEdit(this.user()?.permissions, 'ARCHITECTURE'));
  /** Il collegamento alle tecnologie solo per chi vede quel modulo. */
  protected readonly seesTechnologies = computed(() =>
    canView(this.user()?.permissions, 'TECHNOLOGY'),
  );

  /** ?app=12 apre la mappa con l'applicativo già scelto (es. da un task collegato). */
  protected readonly initialId = (() => {
    const id = Number(inject(ActivatedRoute).snapshot.queryParamMap.get('app'));
    return Number.isInteger(id) && id > 0 ? id : null;
  })();

  protected readonly tab = signal(0);
  protected readonly refresh = signal(0);
  private readonly rows = signal<{ apps: EntityRow[]; links: EntityRow[] }>({
    apps: [],
    links: [],
  });

  protected readonly apps = computed(() => this.rows().apps as unknown as AppNode[]);
  protected readonly links = computed(() => this.rows().links as unknown as AppLink[]);

  protected readonly summary = computed(() => {
    const active = this.apps().filter((app) => app.active && app.lifecycle !== 'RETIRED');
    const activeLinks = this.links().filter((link) => link.active);
    const graph = dependencies(activeLinks);
    const connected = new Set(activeLinks.flatMap((link) => [link.sourceId, link.targetId]));
    return {
      apps: active.length,
      links: activeLinks.length,
      critical: active.filter((app) => app.businessCriticality === 'CRITICAL').length,
      techWarnings: active.filter((app) => app.technologyWarnings.length > 0).length,
      hubs: active.filter((app) => (graph.dependents.get(app.id)?.size ?? 0) >= 3).length,
      isolated: active.filter((app) => !connected.has(app.id)).length,
    };
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    forkJoin({
      apps: this.api.list(APPLICATIONS_CONFIG.endpoint),
      links: this.api.list(CONNECTIONS_CONFIG.endpoint),
    }).subscribe({
      next: (rows) => this.rows.set(rows),
      error: (failure: unknown) => this.snackBar.open(errorMessage(failure), 'Chiudi'),
    });
  }

  protected editApp(id: number): void {
    const row = this.rows().apps.find((app) => app.id === id);
    if (row) {
      this.edit(APPLICATIONS_CONFIG, row);
    }
  }

  /** Scheda di un applicativo o di una connessione; senza riga, uno nuovo. */
  protected edit(config: EntityConfig, row?: EntityRow): void {
    const data: EntityFormDialogData = { config, row };
    this.dialog
      .open<EntityFormDialog, EntityFormDialogData, EntityRow>(EntityFormDialog, {
        data,
        width: '720px',
        maxWidth: '100vw',
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open(
            `${config.singular} salvat${config === CONNECTIONS_CONFIG ? 'a' : 'o'}`,
            'OK',
            {
              duration: 3000,
            },
          );
          this.reload();
        }
      });
  }

  protected importFiles(): void {
    this.dialog
      .open<ArchitectureImportDialog, void, boolean>(ArchitectureImportDialog, {
        width: '720px',
        maxWidth: '100vw',
      })
      .afterClosed()
      .subscribe((changed) => {
        if (changed) {
          this.reload();
        }
      });
  }

  protected exportFiles(): void {
    const day = new Date().toISOString().slice(0, 10);
    download(`architettura-applicativi-${day}.csv`, toCsv(APPLICATION_COLUMNS, this.rows().apps));
    download(`architettura-connessioni-${day}.csv`, toCsv(CONNECTION_COLUMNS, this.rows().links));
  }

  private reload(): void {
    this.refresh.update((value) => value + 1);
    this.load();
  }
}
