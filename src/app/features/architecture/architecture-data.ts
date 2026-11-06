import { Injectable, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, filter, forkJoin, map } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { canEdit } from '../../core/auth/permissions';
import { CrudApiService, errorMessage } from '../../shared/crud/crud-api.service';
import { EntityConfig, EntityRow } from '../../shared/crud/crud.model';
import {
  EntityFormDialog,
  EntityFormDialogData,
} from '../../shared/crud/entity-form-dialog/entity-form-dialog';
import { ArchitectureImportDialog } from './architecture-import-dialog';
import { APPLICATION_COLUMNS, CONNECTION_COLUMNS, download, toCsv } from './architecture-csv';
import { APPLICATIONS_CONFIG, CONNECTIONS_CONFIG } from './architecture.configs';
import { AppLink, AppNode } from './architecture.model';

/**
 * Dati e comandi comuni alle pagine di Architettura IT (mappa, elenchi, panoramica):
 * applicativi e connessioni, schede di modifica, import ed export in CSV.
 */
@Injectable({ providedIn: 'root' })
export class ArchitectureData {
  private readonly api = inject(CrudApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly user = inject(AuthService).currentUser;

  readonly editable = computed(() => canEdit(this.user()?.permissions, 'ARCHITECTURE'));

  private readonly rows = signal<{ apps: EntityRow[]; links: EntityRow[] }>({
    apps: [],
    links: [],
  });
  /** true dopo il primo caricamento: prima la mappa non dice "nessun applicativo". */
  readonly loaded = signal(false);
  readonly apps = computed(() => this.rows().apps as unknown as AppNode[]);
  readonly links = computed(() => this.rows().links as unknown as AppLink[]);

  load(): void {
    this.fetch().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loaded.set(true);
      },
      error: (failure: unknown) => this.snackBar.open(errorMessage(failure), 'Chiudi'),
    });
  }

  /** Scheda di un applicativo dalla mappa. */
  editApp(id: number): Observable<boolean> {
    return this.edit(
      APPLICATIONS_CONFIG,
      this.rows().apps.find((app) => app.id === id),
    );
  }

  /** Scheda di un applicativo o di una connessione; senza riga, uno nuovo. Emette se salvato. */
  edit(config: EntityConfig, row?: EntityRow): Observable<boolean> {
    const data: EntityFormDialogData = { config, row };
    return this.dialog
      .open<EntityFormDialog, EntityFormDialogData, EntityRow>(EntityFormDialog, {
        data,
        width: '720px',
        maxWidth: '100vw',
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .pipe(
        filter((saved) => !!saved),
        map(() => {
          const female = config === CONNECTIONS_CONFIG;
          this.snackBar.open(`${config.singular} salvat${female ? 'a' : 'o'}`, 'OK', {
            duration: 3000,
          });
          this.load();
          return true;
        }),
      );
  }

  /** Import dei CSV con anteprima. Emette se qualcosa è cambiato. */
  importFiles(): Observable<boolean> {
    return this.dialog
      .open<ArchitectureImportDialog, void, boolean>(ArchitectureImportDialog, {
        width: '720px',
        maxWidth: '100vw',
      })
      .afterClosed()
      .pipe(
        filter((changed) => changed === true),
        map(() => {
          this.load();
          return true;
        }),
      );
  }

  /** Due CSV per Excel: Applicativi e Connessioni (anche come modello per compilare). */
  exportFiles(): void {
    // Riletti al momento: dagli elenchi si può aver appena modificato qualcosa
    this.fetch().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        const day = new Date().toISOString().slice(0, 10);
        download(`architettura-applicativi-${day}.csv`, toCsv(APPLICATION_COLUMNS, rows.apps));
        download(`architettura-connessioni-${day}.csv`, toCsv(CONNECTION_COLUMNS, rows.links));
      },
      error: (failure: unknown) => this.snackBar.open(errorMessage(failure), 'Chiudi'),
    });
  }

  private fetch(): Observable<{ apps: EntityRow[]; links: EntityRow[] }> {
    return forkJoin({
      apps: this.api.list(APPLICATIONS_CONFIG.endpoint),
      links: this.api.list(CONNECTIONS_CONFIG.endpoint),
    });
  }
}
