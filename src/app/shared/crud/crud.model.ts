/**
 * Configurazione dichiarativa di un'anagrafica: campi del form, colonne dell'elenco, permessi.
 * Un solo insieme di componenti (CrudSection, EntityTable, EntityFormDialog) gestisce tutte
 * le anagrafiche a partire da questa configurazione.
 */

/** Riga generica restituita dalle API (DTO). */
export type EntityRow = Record<string, unknown> & {
  readonly id?: number;
  readonly version?: string;
};

export interface SelectOption {
  readonly value: unknown;
  readonly label: string;
}

/** Opzioni di una tendina: fisse oppure lette da un endpoint. */
export interface OptionsSource {
  readonly endpoint?: string;
  readonly valueKey?: string;
  /** Campo da mostrare, oppure funzione che compone l'etichetta. */
  readonly labelKey?: string | ((row: EntityRow) => string);
  /** Mostra solo i valori attivi (default: sì). I valori già scelti restano visibili. */
  readonly activeOnly?: boolean;
  /** Mostra solo le righe che rispettano la condizione (es. solo i tipi di progetto). */
  readonly filter?: (row: EntityRow) => boolean;
  readonly static?: readonly SelectOption[];
}

export type FieldType =
  'text' | 'textarea' | 'number' | 'date' | 'checkbox' | 'color' | 'select' | 'multiselect';

export interface FieldConfig {
  readonly key: string;
  readonly label: string;
  readonly type: FieldType;
  readonly required?: boolean;
  readonly maxLength?: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly pattern?: { readonly regex: string; readonly message: string };
  readonly hint?: string;
  readonly options?: OptionsSource;
  /** Il valore sta in `attributes` (campi propri di una lista valori). */
  readonly attribute?: boolean;
  /** Non modificabile dopo la creazione (es. codice di una lista a valori fissi). */
  readonly readonlyOnEdit?: boolean;
  readonly readonly?: boolean;
  /** Il campo occupa tutta la riga anche su desktop. */
  readonly fullWidth?: boolean;
  /** Mostra il campo solo se la condizione sui valori correnti è vera. */
  readonly visibleWhen?: (value: Record<string, unknown>) => boolean;
  readonly defaultValue?: unknown;
  /** Valore del form iniziale ricavato dalla riga (es. trimestre dalla data). */
  readonly initialValue?: (row: EntityRow) => unknown;
}

export type ColumnType = 'text' | 'boolean' | 'badge' | 'list' | 'date' | 'number';

export interface ColumnConfig {
  /** Campo della riga; per gli attributi delle liste valori: "attributes.terminal". */
  readonly key: string;
  readonly label: string;
  readonly type?: ColumnType;
  /** Per 'badge': chiave della riga con il colore. */
  readonly colorKey?: string;
  /** Prima informazione della scheda su mobile (titolo). */
  readonly primary?: boolean;
  /** Nascosta su mobile (resta in tabella da tablet in su). */
  readonly hideOnMobile?: boolean;
  /** Testo da mostrare al posto del valore grezzo (es. INTERNAL -> Interno). */
  readonly format?: (value: unknown, row: EntityRow) => string;
}

export interface EntityConfig {
  /** Titolo plurale (pagina) e singolare (dialog). */
  readonly title: string;
  readonly singular: string;
  readonly subtitle?: string;
  readonly endpoint: string;
  readonly fields: readonly FieldConfig[];
  readonly columns: readonly ColumnConfig[];
  /** Campi su cui lavora la ricerca testuale. */
  readonly searchKeys: readonly string[];
  /** Filtri rapidi: valori distinti della colonna indicata. */
  readonly quickFilters?: readonly { readonly key: string; readonly label: string }[];
  /** Ruoli che possono creare e modificare; vuoto = tutti. */
  readonly writeRoles?: readonly string[];
  /** Sola lettura per tutti (nessuna creazione o modifica). */
  readonly readOnly?: boolean;
  readonly canCreate?: boolean;
  readonly canDelete?: boolean;
  /** Link di dettaglio della riga (es. ['/resources', id]). */
  readonly rowLink?: (row: EntityRow) => readonly (string | number)[];
  /** Ordinamento iniziale dell'elenco. */
  readonly sort?: (a: EntityRow, b: EntityRow) => number;
}

/** Valore di un campo della riga, anche annidato ("attributes.shortCode"). */
export function readPath(row: EntityRow, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        value !== null && typeof value === 'object'
          ? (value as Record<string, unknown>)[key]
          : undefined,
      row,
    );
}

/** Ruoli applicativi (ADM-01). */
export const ROLES = {
  admin: 'ADMIN',
  pm: 'PM',
  editor: 'EDITOR',
} as const;
