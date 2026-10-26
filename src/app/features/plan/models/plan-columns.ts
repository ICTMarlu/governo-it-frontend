import { ColumnConfig } from '../../../shared/crud/crud.model';
import { PlanRow } from './plan.model';

/**
 * Colonne a scelta del piano (tra Progetto e Tot) e ordinamento a due livelli (D-22).
 * Le colonne Codice e Progetto restano sempre visibili e fisse a sinistra.
 */
export const PLAN_INFO_COLUMNS: readonly ColumnConfig[] = [
  { key: 'statusLabel', id: 'status', label: 'Stato' },
  { key: 'itPriorityLevel', id: 'prio', label: 'Prio IT' },
  { key: 'mainSystemLabel', id: 'system', label: 'Sistema' },
  { key: 'businessPriorityLevel', id: 'businessPrio', label: 'Prio business', defaultHidden: true },
  { key: 'workTypeLabel', id: 'type', label: 'Tipo', defaultHidden: true },
  { key: 'ownerNames', id: 'owner', label: 'Owner', defaultHidden: true },
  { key: 'requesterNames', id: 'requester', label: 'Richiesto da', defaultHidden: true },
  { key: 'rowNote', id: 'note', label: 'Nota' },
];

/** Colonne ordinabili oltre a quelle a scelta. */
export const PLAN_SORT_LABELS: Readonly<Record<string, string>> = {
  code: 'Codice',
  project: 'Progetto',
  total: 'Tot',
  ...Object.fromEntries(PLAN_INFO_COLUMNS.map((column) => [column.id!, column.label])),
};

/** Le settimane si ordinano per giornate: id "w:" + lunedì della settimana (es. w:2026-10-19). */
export const WEEK_SORT_PREFIX = 'w:';

/** La colonna si può ordinare (anche dopo un salvataggio delle preferenze). */
export function isSortable(id: string): boolean {
  return id in PLAN_SORT_LABELS || /^w:\d{4}-\d{2}-\d{2}$/.test(id);
}

/** Nome della colonna nel riepilogo dell'ordinamento. */
export function sortLabel(id: string): string {
  if (id.startsWith(WEEK_SORT_PREFIX)) {
    const [, month, day] = id.slice(WEEK_SORT_PREFIX.length).split('-');
    return `Settimana ${day}/${month}`;
  }
  return PLAN_SORT_LABELS[id] ?? id;
}

export type SortDirection = 'asc' | 'desc';

export interface SortLevel {
  readonly id: string;
  readonly direction: SortDirection;
}

/** Livelli di ordinamento al massimo: primo e secondo, come "ordina per… poi per…" di Excel. */
export const MAX_SORT_LEVELS = 2;

/**
 * Effetto di un clic sull'intestazione:
 * - colonna non ordinata: diventa il primo livello, o il secondo se il primo c'è già
 *   (con due livelli prende il posto del secondo), crescente;
 * - colonna già ordinata: crescente → decrescente → tolta (il secondo sale a primo).
 */
export function nextSort(current: readonly SortLevel[], id: string): SortLevel[] {
  const index = current.findIndex((level) => level.id === id);
  if (index === -1) {
    const kept = current.slice(0, MAX_SORT_LEVELS - 1);
    return [...kept, { id, direction: 'asc' }];
  }
  if (current[index].direction === 'asc') {
    return current.map((level, i) => (i === index ? { id, direction: 'desc' } : level));
  }
  return current.filter((_, i) => i !== index);
}

/**
 * Ordinamento scelto dal menu del filtro ("Ordina crescente/decrescente", come in Excel):
 * colonna già ordinata = cambia direzione (null = la toglie); altrimenti si aggiunge come
 * secondo livello (o sostituisce il secondo), come il clic sull'intestazione.
 */
export function setSort(
  current: readonly SortLevel[],
  id: string,
  direction: SortDirection | null,
): SortLevel[] {
  const index = current.findIndex((level) => level.id === id);
  if (direction === null) {
    return current.filter((_, i) => i !== index);
  }
  if (index !== -1) {
    return current.map((level, i) => (i === index ? { id, direction } : level));
  }
  return [...current.slice(0, MAX_SORT_LEVELS - 1), { id, direction }];
}

/** Valore della riga per l'ordinamento; null = vuoto (sempre in fondo). */
export function sortValue(row: PlanRow, id: string, total: number): string | number | null {
  switch (id) {
    case 'code':
      return row.projectCode;
    case 'project':
      return row.projectName;
    case 'status':
      return row.statusCode ? row.statusSortOrder : null;
    case 'prio':
      return row.itPriorityLevel;
    case 'businessPrio':
      return row.businessPriorityLevel;
    case 'system':
      return row.mainSystemLabel;
    case 'type':
      return row.workTypeLabel;
    case 'owner':
      return row.ownerNames[0] ?? null;
    case 'requester':
      return row.requesterNames[0] ?? null;
    case 'note':
      return row.rowNote;
    case 'total':
      return total;
    default:
      if (id.startsWith(WEEK_SORT_PREFIX)) {
        const week = id.slice(WEEK_SORT_PREFIX.length);
        return row.cells.find((cell) => cell.weekStart === week)?.days || null;
      }
      return null;
  }
}

/** Confronto su più livelli; i valori vuoti vanno in fondo in entrambe le direzioni. */
export function compareByLevels(
  a: { row: PlanRow; total: number },
  b: { row: PlanRow; total: number },
  levels: readonly SortLevel[],
): number {
  for (const level of levels) {
    const x = sortValue(a.row, level.id, a.total);
    const y = sortValue(b.row, level.id, b.total);
    const xEmpty = x === null || x === '';
    const yEmpty = y === null || y === '';
    if (xEmpty || yEmpty) {
      if (xEmpty !== yEmpty) {
        return xEmpty ? 1 : -1;
      }
      continue;
    }
    const result =
      typeof x === 'number' && typeof y === 'number'
        ? x - y
        : String(x).localeCompare(String(y), 'it', { sensitivity: 'base', numeric: true });
    if (result !== 0) {
      return level.direction === 'asc' ? result : -result;
    }
  }
  // Dopo l'ordine scelto: ranking del progetto (il più piccolo è il più importante), poi alfabetico
  const rankA = a.row.ranking;
  const rankB = b.row.ranking;
  if (rankA !== rankB) {
    return rankA === null ? 1 : rankB === null ? -1 : rankA - rankB;
  }
  return a.row.projectName.localeCompare(b.row.projectName, 'it', { sensitivity: 'base' });
}
