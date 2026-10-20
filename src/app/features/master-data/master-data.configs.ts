import {
  ColumnConfig,
  EntityConfig,
  EntityRow,
  FieldConfig,
  ROLES,
} from '../../shared/crud/crud.model';
import {
  HOLIDAY_CALENDARS_HELP,
  HOLIDAYS_HELP,
  LEGAL_ENTITIES_HELP,
  LOOKUP_RULES,
  lookupHelp,
  REQUESTERS_HELP,
  SITES_HELP,
  VENDORS_HELP,
} from '../../shared/help/help-content';

const CODE_PATTERN = {
  regex: '^[A-Z0-9_]{1,30}$',
  message: 'Solo lettere maiuscole, numeri e _ (max 30)',
};
const COUNTRY_PATTERN = { regex: '^[A-Z]{2}$', message: 'Codice ISO di 2 lettere (es. IT, SM)' };

const ACTIVE_FIELD: FieldConfig = {
  key: 'active',
  label: 'Attivo',
  type: 'checkbox',
  defaultValue: true,
  hint: 'I valori disattivati non compaiono più nelle scelte ma restano sullo storico',
};
const ACTIVE_COLUMN: ColumnConfig = {
  key: 'active',
  label: 'Attivo',
  type: 'boolean',
  hideOnMobile: true,
};

const bySortOrder = (a: EntityRow, b: EntityRow): number =>
  Number(a['sortOrder']) - Number(b['sortOrder']) ||
  String(a['label']).localeCompare(String(b['label']), 'it');

interface LookupDefinition {
  readonly slug: string;
  readonly title: string;
  readonly singular: string;
  readonly subtitle: string;
  /** Valori fissi: niente nuovi valori, codice non modificabile. */
  readonly fixed?: boolean;
  readonly extraFields?: readonly FieldConfig[];
  readonly extraColumns?: readonly ColumnConfig[];
}

/** Configurazione di una lista valori (ADM-02): campi comuni + campi propri della lista. */
function lookupConfig(definition: LookupDefinition): EntityConfig {
  return {
    title: definition.title,
    singular: definition.singular,
    subtitle: definition.subtitle,
    endpoint: `/lookups/${definition.slug}`,
    writeRoles: [ROLES.admin],
    canCreate: !definition.fixed,
    searchKeys: ['label', 'code'],
    sort: bySortOrder,
    help: lookupHelp(definition.title, definition.subtitle, LOOKUP_RULES[definition.slug]),
    fields: [
      {
        key: 'code',
        label: 'Codice',
        type: 'text',
        required: true,
        maxLength: 30,
        pattern: CODE_PATTERN,
        readonlyOnEdit: definition.fixed,
        hint: definition.fixed ? 'Codice fisso: il software ne dipende' : 'Es. IN_PROGRESS',
      },
      { key: 'label', label: 'Etichetta', type: 'text', required: true, maxLength: 100 },
      {
        key: 'color',
        label: 'Colore',
        type: 'color',
        pattern: { regex: '^#[0-9A-Fa-f]{6}$', message: 'Formato #RRGGBB (es. #2E7D32)' },
      },
      {
        key: 'sortOrder',
        label: 'Ordine',
        type: 'number',
        required: true,
        min: 0,
        defaultValue: 0,
      },
      ...(definition.extraFields ?? []),
      ACTIVE_FIELD,
    ],
    columns: [
      { key: 'label', label: 'Etichetta', type: 'badge', colorKey: 'color', primary: true },
      { key: 'code', label: 'Codice' },
      ...(definition.extraColumns ?? []),
      { key: 'sortOrder', label: 'Ordine', type: 'number', hideOnMobile: true },
      ACTIVE_COLUMN,
    ],
  };
}

/** Liste valori configurabili, nell'ordine in cui compaiono nella pagina "Anagrafiche e liste". */
const LOOKUP_DEFINITIONS: readonly LookupDefinition[] = [
  {
    slug: 'work-types',
    title: 'Tipi di progetto',
    singular: 'Tipo',
    subtitle:
      'Project, AMS, Continuous e Admin sono i tipi di progetto; Task ed Emergenza sono altri tipi di lavoro.',
    fixed: true,
    extraFields: [
      {
        key: 'projectType',
        label: 'Tipo di progetto',
        type: 'checkbox',
        attribute: true,
        readonly: true,
      },
      {
        key: 'backlog',
        label: 'Lavoro produttivo',
        type: 'checkbox',
        attribute: true,
        readonly: true,
      },
    ],
    extraColumns: [{ key: 'attributes.projectType', label: 'Tipo di progetto', type: 'boolean' }],
  },
  {
    slug: 'project-statuses',
    title: 'Stati progetto',
    singular: 'Stato',
    subtitle: 'Ciclo di vita dei progetti. Gli stati finali sono esclusi dal carico futuro.',
    extraFields: [
      {
        key: 'terminal',
        label: 'Stato finale',
        type: 'checkbox',
        attribute: true,
        hint: 'Es. Completed, Rejected, Aborted',
      },
      {
        key: 'countsForProgress',
        label: 'Conta per la % di avanzamento',
        type: 'checkbox',
        attribute: true,
        defaultValue: true,
      },
    ],
    extraColumns: [
      { key: 'attributes.terminal', label: 'Stato finale', type: 'boolean' },
      { key: 'attributes.countsForProgress', label: 'Conta per avanzamento', type: 'boolean' },
    ],
  },
  {
    slug: 'main-systems',
    title: 'Sistemi',
    singular: 'Sistema',
    subtitle:
      'Sistemi e aree applicative. Il codice breve entra nel codice progetto (es. ICT26ERP001).',
    extraFields: [
      {
        key: 'shortCode',
        label: 'Codice breve',
        type: 'text',
        attribute: true,
        maxLength: 5,
        pattern: { regex: '^[A-Za-z0-9]{2,5}$', message: 'Da 2 a 5 lettere o numeri (es. ERP)' },
        hint: 'Serve per assegnare i codici ai progetti di questo sistema',
      },
    ],
    extraColumns: [
      { key: 'attributes.shortCode', label: 'Codice breve' },
      { key: 'attributes.nextCode', label: 'Prossimo codice' },
    ],
  },
  {
    slug: 'priority-levels',
    title: 'Priorità',
    singular: 'Priorità',
    subtitle: 'Livelli da 1 (la più importante) a 4 (nice to have), per priorità IT e di business.',
    fixed: true,
    extraFields: [
      { key: 'level', label: 'Livello', type: 'number', attribute: true, readonly: true },
      { key: 'description', label: 'Significato', type: 'text', attribute: true, maxLength: 300 },
    ],
    extraColumns: [{ key: 'attributes.description', label: 'Significato' }],
  },
  {
    slug: 'streams',
    title: 'Stream',
    singular: 'Stream',
    subtitle: 'Categorie dei progetti (da definire).',
  },
  {
    slug: 'expense-types',
    title: 'Capex / Opex',
    singular: 'Classificazione',
    subtitle: 'Classificazione della spesa dei progetti.',
  },
  {
    slug: 'business-areas',
    title: 'Aree aziendali',
    singular: 'Area',
    subtitle: 'Aree di appartenenza dei richiedenti.',
  },
  {
    slug: 'team-roles',
    title: 'Ruoli nel team',
    singular: 'Ruolo',
    subtitle: 'Ruolo delle risorse nel team IT (diverso dal ruolo applicativo).',
  },
];

/** Liste valori pronte per pagine e rotte. */
export const LOOKUP_CONFIGS: readonly (EntityConfig & { readonly slug: string })[] =
  LOOKUP_DEFINITIONS.map((definition) => ({ ...lookupConfig(definition), slug: definition.slug }));

export const LEGAL_ENTITIES_CONFIG: EntityConfig = {
  title: 'Società del gruppo',
  singular: 'Società',
  subtitle: 'Per i progetti di tutto il gruppo usa il flag "Tutto il gruppo" sul progetto.',
  endpoint: '/legal-entities',
  help: LEGAL_ENTITIES_HELP,
  writeRoles: [ROLES.admin],
  searchKeys: ['name', 'code'],
  fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true, maxLength: 150 },
    {
      key: 'code',
      label: 'Codice',
      type: 'text',
      required: true,
      maxLength: 30,
      pattern: CODE_PATTERN,
    },
    { key: 'countryCode', label: 'Paese', type: 'text', maxLength: 2, pattern: COUNTRY_PATTERN },
    ACTIVE_FIELD,
  ],
  columns: [
    { key: 'name', label: 'Nome', primary: true },
    { key: 'code', label: 'Codice' },
    { key: 'countryCode', label: 'Paese' },
    ACTIVE_COLUMN,
  ],
};

export const VENDORS_CONFIG: EntityConfig = {
  title: 'Fornitori',
  singular: 'Fornitore',
  subtitle: 'Fornitori e società di consulenza; "Marlu IT" è il fornitore interno.',
  endpoint: '/vendors',
  help: VENDORS_HELP,
  writeRoles: [ROLES.admin],
  searchKeys: ['name', 'email', 'vatNumber'],
  fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true, maxLength: 150 },
    { key: 'vatNumber', label: 'Partita IVA', type: 'text', maxLength: 30 },
    { key: 'email', label: 'E-mail', type: 'text', maxLength: 200 },
    { key: 'phone', label: 'Telefono', type: 'text', maxLength: 30 },
    { key: 'internal', label: 'Fornitore interno', type: 'checkbox' },
    ACTIVE_FIELD,
    { key: 'notes', label: 'Note', type: 'textarea', maxLength: 1000 },
  ],
  columns: [
    { key: 'name', label: 'Nome', primary: true },
    { key: 'internal', label: 'Interno', type: 'boolean' },
    { key: 'email', label: 'E-mail', hideOnMobile: true },
    { key: 'phone', label: 'Telefono', hideOnMobile: true },
    ACTIVE_COLUMN,
  ],
};

export const SITES_CONFIG: EntityConfig = {
  title: 'Sedi',
  singular: 'Sede',
  subtitle: 'Sedi di lavoro delle risorse, con il calendario festività di riferimento.',
  endpoint: '/sites',
  help: SITES_HELP,
  writeRoles: [ROLES.admin],
  searchKeys: ['name', 'code'],
  fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true, maxLength: 100 },
    {
      key: 'code',
      label: 'Codice',
      type: 'text',
      required: true,
      maxLength: 30,
      pattern: CODE_PATTERN,
    },
    {
      key: 'countryCode',
      label: 'Paese',
      type: 'text',
      required: true,
      maxLength: 2,
      pattern: COUNTRY_PATTERN,
    },
    {
      key: 'holidayCalendarId',
      label: 'Calendario festività',
      type: 'select',
      required: true,
      options: { endpoint: '/holiday-calendars', labelKey: 'name' },
    },
    ACTIVE_FIELD,
  ],
  columns: [
    { key: 'name', label: 'Nome', primary: true },
    { key: 'code', label: 'Codice' },
    { key: 'countryCode', label: 'Paese' },
    { key: 'holidayCalendarName', label: 'Calendario' },
    ACTIVE_COLUMN,
  ],
};

export const REQUESTERS_CONFIG: EntityConfig = {
  title: 'Richiedenti',
  singular: 'Richiedente',
  subtitle: 'Persone del business che chiedono i progetti, con dipartimento, azienda e ruolo.',
  endpoint: '/requesters',
  help: REQUESTERS_HELP,
  writeRoles: [ROLES.admin, ROLES.pm, ROLES.editor],
  searchKeys: ['fullName', 'email', 'businessAreaLabel', 'legalEntityName', 'jobTitle'],
  quickFilters: [
    { key: 'businessAreaLabel', label: 'Dipartimento' },
    { key: 'legalEntityName', label: 'Azienda' },
  ],
  fields: [
    { key: 'firstName', label: 'Nome', type: 'text', required: true, maxLength: 80 },
    { key: 'lastName', label: 'Cognome', type: 'text', required: true, maxLength: 80 },
    {
      key: 'businessAreaId',
      label: 'Dipartimento',
      type: 'select',
      options: { endpoint: '/lookups/business-areas' },
      hint: 'Elenco in Liste valori → Aree aziendali',
    },
    {
      key: 'legalEntityId',
      label: 'Azienda',
      type: 'select',
      options: { endpoint: '/legal-entities', labelKey: 'name' },
    },
    {
      key: 'jobTitle',
      label: 'Ruolo',
      type: 'text',
      maxLength: 100,
      hint: 'Es. Responsabile Logistica',
    },
    { key: 'email', label: 'E-mail', type: 'text', maxLength: 200 },
    { key: 'phone', label: 'Telefono', type: 'text', maxLength: 30 },
    {
      key: 'resourceId',
      label: 'È anche una risorsa IT',
      type: 'select',
      options: { endpoint: '/resources', labelKey: 'fullName' },
      hint: 'Solo se il richiedente fa parte del team IT',
    },
    ACTIVE_FIELD,
    { key: 'notes', label: 'Note', type: 'textarea', maxLength: 500 },
  ],
  columns: [
    { key: 'fullName', label: 'Nome', primary: true },
    { key: 'businessAreaLabel', label: 'Dipartimento' },
    { key: 'legalEntityName', label: 'Azienda' },
    { key: 'jobTitle', label: 'Ruolo' },
    { key: 'email', label: 'E-mail', hideOnMobile: true },
    ACTIVE_COLUMN,
  ],
};

/** Calendari festività (D-14): ognuno si apre per modificarne le festività. */
export const HOLIDAY_CALENDARS_CONFIG: EntityConfig = {
  title: 'Calendari festività',
  singular: 'Calendario',
  subtitle:
    'Le festività riempiono in automatico la riga "Festività" del piano e riducono la capacità delle risorse della sede.',
  endpoint: '/holiday-calendars',
  help: HOLIDAY_CALENDARS_HELP,
  readOnly: true,
  searchKeys: [],
  rowLink: (row) => ['/master-data/holiday-calendars', row.id!],
  fields: [],
  columns: [
    { key: 'name', label: 'Calendario', primary: true },
    { key: 'code', label: 'Codice' },
  ],
};

const WEEKDAY = new Intl.DateTimeFormat('it-IT', { weekday: 'long' });

/** Festività di un calendario, modificabili dall'Admin. */
export function holidaysConfig(calendarId: number): EntityConfig {
  return {
    title: 'Festività',
    singular: 'Festività',
    endpoint: `/holiday-calendars/${calendarId}/holidays`,
    help: HOLIDAYS_HELP,
    writeRoles: [ROLES.admin],
    canDelete: true,
    searchKeys: ['description'],
    quickFilters: [{ key: 'year', label: 'Anno' }],
    fields: [
      { key: 'holidayDate', label: 'Data', type: 'date', required: true },
      { key: 'description', label: 'Festività', type: 'text', required: true, maxLength: 100 },
    ],
    columns: [
      { key: 'holidayDate', label: 'Data', type: 'date', primary: true },
      {
        key: 'holidayDate',
        id: 'weekday',
        label: 'Giorno',
        format: (value) => WEEKDAY.format(new Date(`${String(value)}T00:00:00`)),
      },
      { key: 'description', label: 'Festività' },
    ],
  };
}
