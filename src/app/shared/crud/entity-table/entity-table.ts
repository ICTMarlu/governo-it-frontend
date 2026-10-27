import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, model, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { columnId } from '../column-layout';
import { ColumnConfig, EntityRow, readPath } from '../crud.model';

const DATE_FORMAT = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const NUMBER_FORMAT = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });
const COLLATOR = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  /** Identificativo della colonna (resta valido se le colonne vengono spostate). */
  readonly id: string;
  readonly direction: SortDirection;
}

/**
 * Elenco generico (componente di presentazione: riceve righe e colonne, emette le azioni).
 * - Mobile: schede impilate, la colonna "primary" fa da titolo; ordinamento da tendina.
 * - Da 768px: tabella, ordinamento cliccando sull'intestazione
 *   (crescente → decrescente → ordine iniziale).
 */
@Component({
  selector: 'gov-entity-table',
  imports: [
    RouterLink,
    NgTemplateOutlet,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './entity-table.html',
  styleUrl: './entity-table.scss',
})
export class EntityTable {
  readonly rows = input.required<readonly EntityRow[]>();
  readonly columns = input.required<readonly ColumnConfig[]>();
  readonly caption = input.required<string>();
  readonly canEdit = input(false);
  readonly canDelete = input(false);
  readonly rowLink = input<(row: EntityRow) => readonly (string | number)[]>();
  /** Il titolo della riga apre la modifica (oltre alla matita). */
  readonly titleOpensEdit = input(false);
  /** Centra etichette e valori di tutte le colonne tranne il titolo. */
  readonly centerValues = input(false);
  /** Azioni (modifica, elimina) all'inizio della riga, dopo la casella di selezione. */
  readonly actionsFirst = input(false);
  /** Righe su una sola riga: testi lunghi troncati, liste con "+N". */
  readonly singleLine = input(false);

  /** Lista di nomi con il limite della colonna: i primi, quanti altri ci sono e tutti per il tooltip. */
  protected listParts(
    row: EntityRow,
    column: ColumnConfig,
  ): { shown: string; extra: number; all: string } {
    const value = readPath(row, column.key);
    const names = Array.isArray(value) ? value.map(String) : [];
    const limit = column.maxItems ?? names.length;
    return {
      shown: names.slice(0, limit).join(', '),
      extra: Math.max(0, names.length - limit),
      all: names.join(', '),
    };
  }
  /** Righe più basse: meno spazio sopra e sotto, pulsanti più piccoli. */
  readonly compact = input(false);

  protected isCentered(column: ColumnConfig): boolean {
    return this.centerValues() && column !== this.primaryColumn() && column.align !== 'start';
  }

  /** Colonna con le caselle per selezionare più righe (azioni massive). */
  readonly selectable = input(false);
  /** Righe selezionate (id); il genitore lo legge per le azioni massive. */
  readonly selection = model<ReadonlySet<number>>(new Set());

  readonly edit = output<EntityRow>();
  readonly remove = output<EntityRow>();

  /** Ordinamento (colonna e direzione); il genitore lo legge e lo imposta (viste salvate). */
  readonly sort = model<SortState | null>(null);

  protected readonly primaryColumn = computed(
    () => this.columns().find((column) => column.primary) ?? this.columns()[0],
  );
  protected readonly detailColumns = computed(() =>
    this.columns().filter((column) => column !== this.primaryColumn() && !column.hideOnMobile),
  );
  protected readonly allSelected = computed(
    () => this.rows().length > 0 && this.rows().every((row) => this.selection().has(row.id!)),
  );
  protected readonly someSelected = computed(
    () => !this.allSelected() && this.rows().some((row) => this.selection().has(row.id!)),
  );

  protected toggleRow(row: EntityRow): void {
    this.selection.update((current) => {
      const next = new Set(current);
      if (!next.delete(row.id!)) {
        next.add(row.id!);
      }
      return next;
    });
  }

  /** Seleziona tutte le righe mostrate (con i filtri attivi), o le toglie tutte. */
  protected toggleAll(): void {
    const all = this.allSelected();
    this.selection.update((current) => {
      const next = new Set(current);
      for (const row of this.rows()) {
        if (all) {
          next.delete(row.id!);
        } else {
          next.add(row.id!);
        }
      }
      return next;
    });
  }

  protected readonly hasActions = computed(() => this.canEdit() || this.canDelete());

  /** Righe nell'ordine scelto; senza ordinamento restano nell'ordine ricevuto. */
  protected readonly sortedRows = computed(() => {
    const rows = this.rows();
    const sort = this.sort();
    const column = sort ? this.columns().find((c) => columnId(c) === sort.id) : undefined;
    if (!sort || !column) {
      return rows;
    }
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = this.sortValue(a, column);
      const right = this.sortValue(b, column);
      // I valori vuoti vanno sempre in fondo, in entrambe le direzioni
      if (left === null || right === null) {
        return left === right ? 0 : left === null ? 1 : -1;
      }
      const result =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : COLLATOR.compare(String(left), String(right));
      return result * factor;
    });
  });

  /** Larghezza della colonna: quella indicata, altrimenti larga la principale e strette le numeriche. */
  protected widthOf(column: ColumnConfig): 'narrow' | 'wide' | null {
    if (column.width) {
      return column.width;
    }
    if (column === this.primaryColumn()) {
      return 'wide';
    }
    return column.type === 'number' ? 'narrow' : null;
  }

  /** Clic sull'intestazione: crescente, poi decrescente, poi ordine iniziale. */
  protected toggleSort(column: ColumnConfig): void {
    const id = columnId(column);
    const current = this.sort();
    if (current?.id !== id) {
      this.sort.set({ id, direction: 'asc' });
    } else if (current.direction === 'asc') {
      this.sort.set({ id, direction: 'desc' });
    } else {
      this.sort.set(null);
    }
  }

  /** Ordinamento scelto dalla tendina su mobile. */
  protected setSortColumn(id: string | null): void {
    this.sort.set(id === null ? null : { id, direction: this.sort()?.direction ?? 'asc' });
  }

  protected columnId(column: ColumnConfig): string {
    return columnId(column);
  }

  protected isSorted(column: ColumnConfig): boolean {
    return this.sort()?.id === columnId(column);
  }

  protected toggleDirection(): void {
    const current = this.sort();
    if (current) {
      this.sort.set({ ...current, direction: current.direction === 'asc' ? 'desc' : 'asc' });
    }
  }

  protected ariaSort(column: ColumnConfig): 'ascending' | 'descending' | 'none' {
    const sort = this.sort();
    if (sort?.id !== columnId(column)) {
      return 'none';
    }
    return sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected sortIcon(column: ColumnConfig): string {
    const sort = this.sort();
    if (sort?.id !== columnId(column)) {
      return 'unfold_more';
    }
    return sort.direction === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  /** Testo della cella: formattazione per tipo (date e numeri all'italiana, liste, sì/no). */
  protected text(row: EntityRow, column: ColumnConfig): string {
    const value = readPath(row, column.key);
    if (column.format) {
      return column.format(value, row);
    }
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    switch (column.type) {
      case 'boolean':
        return value ? 'Sì' : 'No';
      case 'list':
        return Array.isArray(value) && value.length > 0 ? value.join(', ') : '—';
      case 'date':
        return DATE_FORMAT.format(new Date(`${String(value)}T00:00:00`));
      case 'number':
        return NUMBER_FORMAT.format(Number(value));
      default:
        return String(value);
    }
  }

  protected color(row: EntityRow, column: ColumnConfig): string | null {
    return column.colorKey ? ((readPath(row, column.colorKey) as string | null) ?? null) : null;
  }

  protected rowTitle(row: EntityRow): string {
    return this.text(row, this.primaryColumn());
  }

  /** Valore su cui ordinare: numeri come numeri, date ISO e testi come testo; vuoto = null. */
  private sortValue(row: EntityRow, column: ColumnConfig): number | string | null {
    if (column.sortKey) {
      const key = readPath(row, column.sortKey);
      if (key === null || key === undefined || key === '') {
        return null;
      }
      return typeof key === 'number' ? key : String(key);
    }
    if (column.format) {
      const formatted = column.format(readPath(row, column.key), row);
      return formatted === '—' ? null : formatted;
    }
    const value = readPath(row, column.key);
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : null;
    }
    if (column.type === 'number') {
      return Number(value);
    }
    if (column.type === 'boolean') {
      return value ? 1 : 0;
    }
    return String(value);
  }
}
