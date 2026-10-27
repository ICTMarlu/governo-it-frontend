import { HelpContent } from '../help/help.model';

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
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'checkbox'
  | 'color'
  | 'select'
  /** Come 'select' ma con ricerca mentre si scrive (per elenchi lunghi). */
  | 'search'
  | 'multiselect'
  | 'password';

export interface FieldConfig {
  readonly key: string;
  readonly label: string;
  readonly type: FieldType;
  readonly required?: boolean;
  /** Obbligatorio solo in creazione (es. password iniziale; in modifica vuoto = invariato). */
  readonly requiredOnCreate?: boolean;
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
  /** Identificativo della colonna per le preferenze, se due colonne leggono lo stesso campo. */
  readonly id?: string;
  readonly label: string;
  /** Nascosta finché l'utente non la attiva da "Colonne". */
  readonly defaultHidden?: boolean;
  /** Testo lungo: mostrato su due righe al massimo, completo al passaggio del mouse. */
  readonly clamp?: boolean;
  readonly type?: ColumnType;
  /** Per 'badge': chiave della riga con il colore. */
  readonly colorKey?: string;
  /** Prima informazione della scheda su mobile (titolo). */
  readonly primary?: boolean;
  /** Nascosta su mobile (resta in tabella da tablet in su). */
  readonly hideOnMobile?: boolean;
  /** Campo su cui ordinare al posto del valore mostrato (es. ordine dello stato invece dell'etichetta). */
  readonly sortKey?: string;
  /** Testo da mostrare al posto del valore grezzo (es. INTERNAL -> Interno). */
  readonly format?: (value: unknown, row: EntityRow) => string;
  /**
   * Larghezza in tabella: 'narrow' per valori corti (l'intestazione va al massimo su due righe),
   * 'wide' per i testi lunghi. Di partenza: larga la colonna principale, strette le numeriche.
   */
  readonly width?: 'narrow' | 'wide';
  /** 'start': testo allineato a sinistra e stretto (max 16rem, poi a capo) anche con centerValues. */
  readonly align?: 'start';
  /** Per 'list': quanti nomi mostrare prima di "+N" (gli altri sono nel tooltip). */
  readonly maxItems?: number;
}

/** Filtro rapido a scelta multipla sui valori distinti di un campo. */
export interface QuickFilterConfig {
  readonly key: string;
  readonly label: string;
  /** Ordine delle voci: campo numerico della riga (es. ordine dello stato); se assente, alfabetico. */
  readonly orderKey?: string;
}

/** Azione massiva sulle righe selezionate: imposta dei campi (es. chiudere i punti scelti). */
export interface BulkActionConfig {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  /** Campi da impostare su ogni riga selezionata (gli altri restano come sono). */
  readonly patch: Readonly<Record<string, unknown>>;
  readonly confirmTitle?: string;
  readonly confirmMessage?: string;
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
  readonly quickFilters?: readonly QuickFilterConfig[];
  /** Ruoli che possono creare e modificare; vuoto = tutti. */
  readonly writeRoles?: readonly string[];
  /** Sola lettura per tutti (nessuna creazione o modifica). */
  readonly readOnly?: boolean;
  readonly canCreate?: boolean;
  readonly canDelete?: boolean;
  /** Azioni massive sulle righe selezionate (oltre a "Elimina" se canDelete). */
  readonly bulkActions?: readonly BulkActionConfig[];
  /** Link di dettaglio della riga (es. ['/resources', id]). */
  readonly rowLink?: (row: EntityRow) => readonly (string | number)[];
  /** Clic sul titolo della riga = apre la scheda di modifica (per chi può modificare). */
  readonly titleOpensForm?: boolean;
  /**
   * Riga chiusa (es. progetto in uno stato finale): abilita il filtro rapido Aperti / Chiusi / Tutti
   * nella barra, come le categorie di stato di Jira.
   */
  readonly closedWhen?: (row: EntityRow) => boolean;
  /** Ogni riga su una sola riga: i testi lunghi si troncano (il tooltip li mostra per intero). */
  readonly singleLine?: boolean;
  /** Pulsanti di modifica ed eliminazione a sinistra, dove inizia la riga (invece che a destra). */
  readonly actionsFirst?: boolean;
  /** Etichette e valori centrati in tutte le colonne tranne il titolo (anche il trattino dei vuoti). */
  readonly centerValues?: boolean;
  /** Righe della tabella più basse (elenchi lunghi da scorrere a colpo d'occhio). */
  readonly compact?: boolean;
  /** Ordinamento iniziale dell'elenco. */
  readonly sort?: (a: EntityRow, b: EntityRow) => number;
  /** Guida della pagina (pulsante Guida). */
  readonly help?: HelpContent;
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
  viewer: 'VIEWER',
} as const;
