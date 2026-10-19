import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter, map, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ConfirmDialog, ConfirmDialogData } from '../confirm-dialog/confirm-dialog';
import { CrudApiService, errorMessage } from '../crud-api.service';
import { EntityConfig, EntityRow, readPath } from '../crud.model';
import { EntityFormDialog, EntityFormDialogData } from '../entity-form-dialog/entity-form-dialog';
import { EntityTable } from '../entity-table/entity-table';

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Gestione completa di un'anagrafica (smart component): carica l'elenco, ricerca e filtri,
 * apre il form di creazione/modifica, conferma le cancellazioni e mostra l'esito.
 */
@Component({
  selector: 'gov-crud-section',
  imports: [
    FormsModule,
    EntityTable,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './crud-section.html',
  styleUrl: './crud-section.scss',
})
export class CrudSection {
  private readonly api = inject(CrudApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 599.98px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  private readonly currentUser = inject(AuthService).currentUser;

  readonly config = input.required<EntityConfig>();

  protected readonly state = signal<LoadState>('loading');
  protected readonly rows = signal<EntityRow[]>([]);
  protected readonly search = signal('');
  protected readonly showInactive = signal(false);
  protected readonly filters = signal<Record<string, string>>({});

  protected readonly canWrite = computed(() => {
    const roles = this.config().writeRoles ?? [];
    const role = this.currentUser()?.role;
    return roles.length === 0 || (role !== undefined && roles.includes(role));
  });

  /** Valori distinti delle colonne con filtro rapido. */
  protected readonly filterOptions = computed(() =>
    (this.config().quickFilters ?? []).map((quickFilter) => ({
      ...quickFilter,
      values: [
        ...new Set(this.rows().flatMap((row) => valuesOf(readPath(row, quickFilter.key)))),
      ].sort((a, b) => a.localeCompare(b, 'it')),
    })),
  );

  protected readonly hasInactive = computed(() =>
    this.rows().some((row) => row['active'] === false),
  );

  protected readonly visibleRows = computed(() => {
    const config = this.config();
    const text = this.search().trim().toLowerCase();
    const activeFilters = Object.entries(this.filters()).filter(([, value]) => value);
    const rows = this.rows().filter(
      (row) =>
        (this.showInactive() || row['active'] !== false) &&
        (!text ||
          config.searchKeys.some((key) =>
            valuesOf(readPath(row, key)).some((value) => value.toLowerCase().includes(text)),
          )) &&
        activeFilters.every(([key, value]) => valuesOf(readPath(row, key)).includes(value)),
    );
    return config.sort ? [...rows].sort(config.sort) : rows;
  });

  constructor() {
    effect(() => {
      const endpoint = this.config().endpoint;
      untracked(() => this.load(endpoint));
    });
  }

  protected reload(): void {
    this.load(this.config().endpoint);
  }

  protected setFilter(key: string, value: string): void {
    this.filters.update((current) => ({ ...current, [key]: value }));
  }

  protected openForm(row?: EntityRow): void {
    const data: EntityFormDialogData = { config: this.config(), row };
    const mobile = this.isMobile();
    this.dialog
      .open<EntityFormDialog, EntityFormDialogData, EntityRow>(EntityFormDialog, {
        data,
        width: mobile ? '100vw' : '720px',
        maxWidth: '100vw',
        height: mobile ? '100dvh' : undefined,
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .pipe(filter((saved): saved is EntityRow => saved !== undefined))
      .subscribe(() => {
        this.snackBar.open(`${this.config().singular} salvato`, 'OK', { duration: 3000 });
        this.reload();
      });
  }

  protected confirmDelete(row: EntityRow): void {
    const data: ConfirmDialogData = {
      title: `Eliminare ${this.config().singular.toLowerCase()}?`,
      message: "L'operazione non si può annullare.",
      confirmLabel: 'Elimina',
    };
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => this.api.delete(this.config().endpoint, row.id!)),
      )
      .subscribe({
        next: () => {
          this.snackBar.open('Eliminato', 'OK', { duration: 3000 });
          this.reload();
        },
        error: (error: unknown) => this.snackBar.open(errorMessage(error), 'Chiudi'),
      });
  }

  private load(endpoint: string): void {
    this.state.set('loading');
    this.api.list(endpoint).subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }
}

/** Valori testuali di una cella (le liste diventano più valori). */
function valuesOf(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value.map(String) : [String(value)];
}
