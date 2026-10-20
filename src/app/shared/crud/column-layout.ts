import { ColumnConfig } from './crud.model';

/** Colonne scelte dall'utente: ordine e colonne nascoste, per identificativo. */
export interface ColumnLayout {
  readonly order: readonly string[];
  readonly hidden: readonly string[];
}

export function columnId(column: ColumnConfig): string {
  return column.id ?? column.key;
}

/** Layout predefinito: ordine della configurazione, nascoste quelle con defaultHidden. */
export function defaultLayout(columns: readonly ColumnConfig[]): ColumnLayout {
  return {
    order: columns.map(columnId),
    hidden: columns.filter((column) => column.defaultHidden).map(columnId),
  };
}

/**
 * Colonne nell'ordine scelto. Le colonne aggiunte dopo il salvataggio del layout compaiono
 * in fondo (visibili salvo defaultHidden); quelle non più esistenti vengono ignorate.
 * La colonna principale (titolo) è sempre visibile.
 */
export function orderedColumns(
  columns: readonly ColumnConfig[],
  layout: ColumnLayout | null,
): { readonly column: ColumnConfig; readonly visible: boolean }[] {
  const effective = layout ?? defaultLayout(columns);
  const byId = new Map(columns.map((column) => [columnId(column), column]));
  const known = effective.order.filter((id) => byId.has(id));
  const added = columns.map(columnId).filter((id) => !known.includes(id));
  return [...known, ...added].map((id) => {
    const column = byId.get(id)!;
    const hidden = known.includes(id)
      ? effective.hidden.includes(id)
      : column.defaultHidden === true;
    return { column, visible: column.primary === true || !hidden };
  });
}
