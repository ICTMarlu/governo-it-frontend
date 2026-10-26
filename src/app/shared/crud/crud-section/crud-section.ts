import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, catchError, filter, forkJoin, map, of, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { canEdit, moduleOfEndpoint } from '../../../core/auth/permissions';
import { UserPreferencesService } from '../../../core/preferences/user-preferences.service';
import {
  ColumnChooserData,
  ColumnChooserDialog,
  ColumnChooserResult,
} from '../column-chooser-dialog/column-chooser-dialog';
import { ColumnLayout, orderedColumns } from '../column-layout';
import { ConfirmDialog, ConfirmDialogData } from '../confirm-dialog/confirm-dialog';
import { CrudApiService, errorMessage } from '../crud-api.service';
import { BulkActionConfig, EntityConfig, EntityRow, readPath } from '../crud.model';
import { EntityFormDialog, EntityFormDialogData } from '../entity-form-dialog/entity-form-dialog';
import { EntityTable, SortState } from '../entity-table/entity-table';
import { SavedViews } from '../../views/saved-views';

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
    SavedViews,
    MatButtonModule,
    MatButtonToggleModule,
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
  private readonly preferences = inject(UserPreferencesService);

  readonly config = input.required<EntityConfig>();
  /** Cambiandolo il genitore fa ricaricare l'elenco (es. dopo un inserimento fatto fuori). */
  readonly refresh = input(0);
  /** Viste salvate (filtri, colonne, ordinamento); spente nelle sottoschede (es. capacità). */
  readonly savedViews = input(true);

  protected readonly state = signal<LoadState>('loading');
  protected readonly rows = signal<EntityRow[]>([]);
  protected readonly search = signal('');
  protected readonly showInactive = signal(false);
  /** Filtro rapido sugli stati: aperti, chiusi o tutti (se la configurazione sa dire cosa è chiuso). */
  protected readonly openState = signal<'all' | 'open' | 'closed'>('all');
  /** Filtri rapidi a scelta multipla: valori in alternativa nello stesso filtro, filtri diversi in AND. */
  protected readonly filters = signal<Record<string, readonly string[]>>({});
  /** Colonne scelte dall'utente (null = predefinite), salvate sul server per utente. */
  protected readonly layout = signal<ColumnLayout | null>(null);
  protected readonly visibleColumns = computed(() =>
    orderedColumns(this.config().columns, this.layout())
      .filter((item) => item.visible)
      .map((item) => item.column),
  );
  protected readonly sort = signal<SortState | null>(null);
  /** Una vista è stata applicata: le colonne salvate in precedenza non la sovrascrivono. */
  private viewApplied = false;

  /** Stato salvato nelle viste: ricerca, filtri, disattivati, colonne e ordinamento. */
  protected readonly viewState = computed(() => ({
    search: this.search(),
    filters: Object.fromEntries(
      Object.entries(this.filters()).filter(([, values]) => values.length > 0),
    ),
    showInactive: this.showInactive(),
    openState: this.openState(),
    columns: this.layout(),
    sort: this.sort(),
  }));

  /** Pagina delle viste salvate: una per elenco, come la chiave delle colonne. */
  protected readonly viewPage = computed(() => `list.${this.layoutKey().slice('columns.'.length)}`);

  protected readonly hasActiveFilters = computed(
    () =>
      Object.values(this.filters()).some((values) => values.length > 0) ||
      this.openState() !== 'all',
  );

  /** Quanti aperti e chiusi ci sono (per i numeri sul filtro), con la ricerca e i filtri esclusi. */
  protected readonly openCounts = computed(() => {
    const closedWhen = this.config().closedWhen;
    const rows = this.rows().filter((row) => row['active'] !== false || this.showInactive());
    const closed = closedWhen ? rows.filter((row) => closedWhen(row)).length : 0;
    return { open: rows.length - closed, closed, all: rows.length };
  });

  protected readonly canWrite = computed(() => {
    if (this.config().readOnly) {
      return false;
    }
    // Con un modulo (dall'indirizzo API) decide il permesso "Modifica" dell'utente su quel modulo
    const module = moduleOfEndpoint(this.config().endpoint);
    if (module) {
      return canEdit(this.currentUser()?.permissions, module);
    }
    const roles = this.config().writeRoles ?? [];
    const role = this.currentUser()?.role;
    return roles.length === 0 || (role !== undefined && roles.includes(role));
  });

  /** Valori distinti delle colonne con filtro rapido. */
  protected readonly filterOptions = computed(() =>
    (this.config().quickFilters ?? []).map((quickFilter) => {
      // Ordine delle voci: campo indicato (es. ordine dello stato), altrimenti alfabetico
      const position = new Map<string, number>();
      for (const row of this.rows()) {
        const order = quickFilter.orderKey ? Number(readPath(row, quickFilter.orderKey)) : 0;
        for (const value of valuesOf(readPath(row, quickFilter.key))) {
          position.set(value, Math.min(position.get(value) ?? Infinity, order || 0));
        }
      }
      const values = [...position.keys()].sort(
        (a, b) => position.get(a)! - position.get(b)! || a.localeCompare(b, 'it'),
      );
      return { ...quickFilter, values };
    }),
  );

  protected readonly hasInactive = computed(() =>
    this.rows().some((row) => row['active'] === false),
  );

  protected readonly visibleRows = computed(() => {
    const config = this.config();
    const text = this.search().trim().toLowerCase();
    const activeFilters = Object.entries(this.filters()).filter(([, values]) => values.length > 0);
    const closedWhen = config.closedWhen;
    const openState = closedWhen ? this.openState() : 'all';
    const rows = this.rows().filter(
      (row) =>
        (this.showInactive() || row['active'] !== false) &&
        (openState === 'all' || closedWhen!(row) === (openState === 'closed')) &&
        (!text ||
          config.searchKeys.some((key) =>
            valuesOf(readPath(row, key)).some((value) => value.toLowerCase().includes(text)),
          )) &&
        activeFilters.every(([key, selected]) =>
          valuesOf(readPath(row, key)).some((value) => selected.includes(value)),
        ),
    );
    return config.sort ? [...rows].sort(config.sort) : rows;
  });

  /** Righe selezionate per le azioni massive (id). */
  protected readonly selection = signal<ReadonlySet<number>>(new Set());
  protected readonly bulkBusy = signal(false);

  /** Selezione solo dove la configurazione prevede azioni massive (e si può modificare). */
  protected readonly selectable = computed(
    () => this.canWrite() && (this.config().bulkActions ?? []).length > 0,
  );

  /** Solo le righe selezionate ancora visibili (un filtro nuovo le toglie dall'azione). */
  protected readonly selectedRows = computed(() =>
    this.visibleRows().filter((row) => this.selection().has(row.id!)),
  );

  constructor() {
    effect(() => {
      const endpoint = this.config().endpoint;
      untracked(() => {
        this.viewApplied = false;
        this.load(endpoint);
        this.loadLayout();
      });
    });
    // Ricarica su richiesta del genitore (il primo valore è già coperto dal caricamento iniziale)
    let firstRefresh = true;
    effect(() => {
      this.refresh();
      if (firstRefresh) {
        firstRefresh = false;
        return;
      }
      untracked(() => this.reload());
    });
  }

  protected reload(): void {
    this.load(this.config().endpoint);
  }

  protected setFilter(key: string, values: readonly string[]): void {
    this.filters.update((current) => ({ ...current, [key]: values }));
  }

  protected clearFilters(): void {
    this.openState.set('all');
    this.filters.set({});
    this.search.set('');
  }

  /** Testo del filtro chiuso: "Tutti", il valore scelto, oppure il primo "+N". */
  protected filterSummary(key: string): string {
    const selected = this.filters()[key] ?? [];
    if (selected.length === 0) {
      return 'Tutti';
    }
    return selected.length === 1 ? selected[0] : `${selected[0]} +${selected.length - 1}`;
  }

  /** Applica una vista salvata (null = vista standard: niente filtri, colonne predefinite). */
  protected applyView(state: unknown): void {
    this.viewApplied = true;
    const view = (state ?? {}) as Partial<{
      search: string;
      filters: Record<string, readonly string[]>;
      showInactive: boolean;
      openState: 'all' | 'open' | 'closed';
      columns: ColumnLayout | null;
      sort: SortState | null;
    }>;
    this.search.set(view.search ?? '');
    this.filters.set(view.filters ?? {});
    this.showInactive.set(view.showInactive ?? false);
    this.openState.set(view.openState ?? 'all');
    this.sort.set(view.sort ?? null);
    const columns = view.columns ?? null;
    this.layout.set(columns);
    const key = this.layoutKey();
    (columns ? this.preferences.save(key, columns) : this.preferences.reset(key)).subscribe({
      error: () => undefined,
    });
  }

  protected openColumnChooser(): void {
    const data: ColumnChooserData = { columns: this.config().columns, layout: this.layout() };
    this.dialog
      .open<ColumnChooserDialog, ColumnChooserData, ColumnChooserResult>(ColumnChooserDialog, {
        data,
        width: '440px',
        maxWidth: '100vw',
      })
      .afterClosed()
      .pipe(filter((result): result is ColumnChooserResult => result !== undefined))
      .subscribe((result) => {
        const key = this.layoutKey();
        if (result === 'reset') {
          this.layout.set(null);
          this.preferences.reset(key).subscribe();
        } else {
          this.layout.set(result);
          this.preferences.save(key, result).subscribe({
            error: () => this.snackBar.open('Colonne non salvate sul server', 'Chiudi'),
          });
        }
      });
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

  protected clearSelection(): void {
    this.selection.set(new Set());
  }

  /** Azione massiva che imposta dei campi (es. chiudi): una richiesta per riga, esito riassunto. */
  protected confirmBulk(action: BulkActionConfig): void {
    const rows = this.selectedRows();
    const data: ConfirmDialogData = {
      title: action.confirmTitle ?? `${action.label}: ${rows.length} elementi?`,
      message:
        action.confirmMessage ??
        `L'azione si applica a tutti i ${rows.length} elementi selezionati.`,
      confirmLabel: action.label,
    };
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data })
      .afterClosed()
      .pipe(filter((confirmed) => confirmed === true))
      .subscribe(() =>
        this.runBulk(
          rows,
          (row) => this.api.update(this.config().endpoint, row.id!, this.bulkBody(row, action)),
          action.label,
        ),
      );
  }

  /** Elimina tutte le righe selezionate, dopo conferma. */
  protected confirmBulkDelete(): void {
    const rows = this.selectedRows();
    const data: ConfirmDialogData = {
      title: `Eliminare ${rows.length} ${rows.length === 1 ? 'elemento' : 'elementi'}?`,
      message: "L'operazione non si può annullare.",
      confirmLabel: 'Elimina',
    };
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data })
      .afterClosed()
      .pipe(filter((confirmed) => confirmed === true))
      .subscribe(() =>
        this.runBulk(rows, (row) => this.api.delete(this.config().endpoint, row.id!), 'Eliminati'),
      );
  }

  private runBulk(
    rows: readonly EntityRow[],
    request: (row: EntityRow) => Observable<unknown>,
    label: string,
  ): void {
    this.bulkBusy.set(true);
    forkJoin(
      rows.map((row) =>
        request(row).pipe(
          map(() => null),
          catchError((error: unknown) => of(errorMessage(error))),
        ),
      ),
    ).subscribe((results) => {
      const failed = results.filter((result): result is string => result !== null);
      const done = rows.length - failed.length;
      this.bulkBusy.set(false);
      this.snackBar.open(
        failed.length === 0
          ? `${label}: ${done} ${done === 1 ? 'elemento' : 'elementi'}`
          : `${label}: ${done} su ${rows.length}. Non riusciti ${failed.length}: ${failed[0]}`,
        'OK',
        { duration: failed.length === 0 ? 3000 : 8000 },
      );
      this.selection.set(new Set());
      this.reload();
    });
  }

  /** Corpo di una modifica che lascia la riga com'è e cambia solo i campi dell'azione. */
  private bulkBody(row: EntityRow, action: BulkActionConfig): Record<string, unknown> {
    const body: Record<string, unknown> = { version: row.version ?? null };
    for (const field of this.config().fields) {
      if (!field.attribute) {
        body[field.key] = row[field.key] ?? null;
      }
    }
    return { ...body, ...action.patch };
  }

  protected confirmDelete(row: EntityRow): void {
    const data: ConfirmDialogData = {
      title: `Eliminare ${this.config().singular.toLowerCase()}?`,
      message: `Stai per eliminare definitivamente "${this.rowName(row)}". L'operazione non si può annullare. Sei sicuro?`,
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

  private rowName(row: EntityRow): string {
    const primary =
      this.config().columns.find((column) => column.primary) ?? this.config().columns[0];
    const value = primary ? row[primary.key] : undefined;
    return value == null || value === '' ? `n. ${row.id}` : String(value);
  }

  /** Chiave della preferenza: una per elenco (gli id nel percorso non contano). */
  private layoutKey(): string {
    const path = this.config()
      .endpoint.replace(/\/\d+/g, '')
      .replace(/^\//, '')
      .replace(/\//g, '.');
    return `columns.${path}`;
  }

  private loadLayout(): void {
    this.layout.set(null);
    this.preferences.get<ColumnLayout>(this.layoutKey()).subscribe({
      next: (layout) => {
        if (!this.viewApplied) {
          this.layout.set(layout);
        }
      },
      error: () => this.layout.set(null),
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
