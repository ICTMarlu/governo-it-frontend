import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { ColumnConfig, EntityRow, readPath } from '../crud.model';

const DATE_FORMAT = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const NUMBER_FORMAT = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

/**
 * Elenco generico (componente di presentazione: riceve righe e colonne, emette le azioni).
 * - Mobile: schede impilate, la colonna "primary" fa da titolo.
 * - Da 768px: tabella.
 */
@Component({
  selector: 'gov-entity-table',
  imports: [RouterLink, NgTemplateOutlet, MatButtonModule, MatIconModule, MatTooltipModule],
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

  readonly edit = output<EntityRow>();
  readonly remove = output<EntityRow>();

  protected readonly primaryColumn = computed(
    () => this.columns().find((column) => column.primary) ?? this.columns()[0],
  );
  protected readonly detailColumns = computed(() =>
    this.columns().filter((column) => column !== this.primaryColumn() && !column.hideOnMobile),
  );
  protected readonly hasActions = computed(() => this.canEdit() || this.canDelete());

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
}
