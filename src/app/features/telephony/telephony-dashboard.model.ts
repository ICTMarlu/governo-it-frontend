/** Linee attive per una combinazione di dimensioni (come le restituisce il backend). */
export interface SimCount {
  readonly country: string | null;
  readonly company: string | null;
  readonly plan: string | null;
  readonly lineUse: string | null;
  readonly migrationStatus: string | null;
  readonly operator: string | null;
  readonly assigneeType: string | null;
  readonly lines: number;
  /** Canone dei profili delle linee del gruppo. */
  readonly monthlyCost: number | null;
  /** Canone delle opzioni dell'operatore attive sulle stesse linee. */
  readonly optionsCost: number | null;
}

export type DimensionKey =
  'country' | 'company' | 'plan' | 'lineUse' | 'assigneeType' | 'migrationStatus' | 'operator';

export type Measure = 'lines' | 'cost';

export const DIMENSIONS: readonly { readonly key: DimensionKey; readonly label: string }[] = [
  { key: 'country', label: 'Paese' },
  { key: 'company', label: 'Società' },
  { key: 'plan', label: 'Profilo' },
  { key: 'lineUse', label: 'Uso (telefono, allarme, router)' },
  { key: 'assigneeType', label: 'Tipo di assegnatario' },
  { key: 'migrationStatus', label: 'Stato migrazione' },
  { key: 'operator', label: 'Operatore' },
];

/** Valore mostrato quando il dato non è stato indicato sulla linea. */
export const NOT_SET = 'Non indicato';

/** Filtri sulle dimensioni: un valore per dimensione, assente = tutti. */
export type Filters = Partial<Record<DimensionKey, string>>;

export interface PivotRow {
  readonly label: string;
  readonly cells: readonly number[];
  readonly total: number;
}

export interface Pivot {
  readonly columns: readonly string[];
  readonly rows: readonly PivotRow[];
  readonly columnTotals: readonly number[];
  readonly grandTotal: number;
}

export function valueOf(row: SimCount, key: DimensionKey): string {
  return row[key] ?? NOT_SET;
}

export function applyFilters(rows: readonly SimCount[], filters: Filters): SimCount[] {
  const active = Object.entries(filters).filter(([, value]) => !!value) as [DimensionKey, string][];
  return rows.filter((row) => active.every(([key, value]) => valueOf(row, key) === value));
}

export function measureOf(row: SimCount, measure: Measure): number {
  return measure === 'lines' ? row.lines : (row.monthlyCost ?? 0) + (row.optionsCost ?? 0);
}

export function total(rows: readonly SimCount[], measure: Measure): number {
  return round(rows.reduce((sum, row) => sum + measureOf(row, measure), 0));
}

/** Spesa mensile divisa tra canone dei profili e delle opzioni. */
export function costParts(rows: readonly SimCount[]): { profiles: number; options: number } {
  return {
    profiles: round(rows.reduce((sum, row) => sum + (row.monthlyCost ?? 0), 0)),
    options: round(rows.reduce((sum, row) => sum + (row.optionsCost ?? 0), 0)),
  };
}

/** Valori distinti di una dimensione, in ordine alfabetico (per le tendine dei filtri). */
export function distinct(rows: readonly SimCount[], key: DimensionKey): string[] {
  return [...new Set(rows.map((row) => valueOf(row, key)))].sort((a, b) =>
    a.localeCompare(b, 'it'),
  );
}

/**
 * Tabella pivot: una riga per valore della dimensione di riga e una colonna per valore della
 * dimensione di colonna (nessuna colonna extra se non c'è). Righe e colonne dal totale più alto.
 */
export function pivot(
  rows: readonly SimCount[],
  rowKey: DimensionKey,
  columnKey: DimensionKey | null,
  measure: Measure,
): Pivot {
  const cells = new Map<string, Map<string, number>>();
  const columnTotals = new Map<string, number>();
  for (const row of rows) {
    const rowLabel = valueOf(row, rowKey);
    const column = columnKey ? valueOf(row, columnKey) : '';
    const value = measureOf(row, measure);
    const inRow = cells.get(rowLabel) ?? new Map<string, number>();
    inRow.set(column, (inRow.get(column) ?? 0) + value);
    cells.set(rowLabel, inRow);
    columnTotals.set(column, (columnTotals.get(column) ?? 0) + value);
  }

  const columns = columnKey ? sortedByTotal(columnTotals) : [];
  const pivotRows = [...cells.entries()]
    .map(([label, inRow]) => ({
      label,
      cells: columns.map((column) => round(inRow.get(column) ?? 0)),
      total: round([...inRow.values()].reduce((sum, value) => sum + value, 0)),
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'it'));

  return {
    columns,
    rows: pivotRows,
    columnTotals: columns.map((column) => round(columnTotals.get(column) ?? 0)),
    grandTotal: round([...columnTotals.values()].reduce((sum, value) => sum + value, 0)),
  };
}

function sortedByTotal(totals: ReadonlyMap<string, number>): string[] {
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'it'))
    .map(([label]) => label);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
