import {
  ColumnConfig,
  EntityConfig,
  EntityRow,
  FieldConfig,
  OptionsSource,
  SelectOption,
} from '../../shared/crud/crud.model';

const ASSIGNEE_TYPES: readonly SelectOption[] = [
  { value: 'PERSON', label: 'Persona' },
  { value: 'STORE', label: 'Negozio' },
  { value: 'DEPARTMENT', label: 'Ufficio / reparto' },
  { value: 'FUNCTION', label: 'Uso tecnico (allarme, home banking…)' },
  { value: 'UNKNOWN', label: 'Ignoto' },
];

const LINE_USES: readonly SelectOption[] = [
  { value: 'MOBILE', label: 'Telefono' },
  { value: 'ALARM', label: 'Allarme' },
  { value: 'ROUTER', label: 'Router' },
];

const MIGRATION_STATUSES: readonly SelectOption[] = [
  { value: 'COMPLETED', label: 'Migrata a TIM' },
  { value: 'TO_MIGRATE', label: 'Da migrare' },
];

const PIN = { regex: '^\\d{4,8}$', message: 'Il PIN ha da 4 a 8 cifre' };
const PUK = { regex: '^\\d{8,10}$', message: 'Il PUK ha da 8 a 10 cifre' };

const COUNTRIES: readonly SelectOption[] = [
  { value: 'SM', label: 'San Marino' },
  { value: 'IT', label: 'Italia' },
];

/** Solo i fornitori segnati come operatore telefonico (TIM, WIND-TRE, Vodafone/Fastweb, TMS San Marino). */
const OPERATORS: OptionsSource = {
  endpoint: '/vendors',
  labelKey: 'name',
  filter: (row) => row['telecomOperator'] === true,
};

const DEVICE_STATUSES: readonly SelectOption[] = [
  { value: 'ASSIGNED', label: 'Assegnato' },
  { value: 'IN_STOCK', label: 'In magazzino' },
  { value: 'TO_VERIFY', label: 'Da verificare' },
  { value: 'IN_REPAIR', label: 'In riparazione' },
  { value: 'LOST', label: 'Perso o rubato' },
  { value: 'RETIRED', label: 'Dismesso' },
];

const ACTIVE_COLUMN: ColumnConfig = {
  key: 'active',
  label: 'Attiva',
  type: 'boolean',
  hideOnMobile: true,
};

const IMEI = { regex: '^\\d{15}$', message: "L'IMEI ha esattamente 15 cifre" };

const EURO = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

/** "12,00 €" oppure "Da definire" se il costo non è noto. */
function euro(value: unknown): string {
  return value === null || value === undefined || value === ''
    ? 'Da definire'
    : EURO.format(Number(value));
}

const byAssignee = (a: EntityRow, b: EntityRow): number =>
  String(a['assigneeName'] ?? '\uffff').localeCompare(String(b['assigneeName'] ?? '\uffff'), 'it');

/** Linee mobili: ogni numero appartiene a una società, che è il filtro principale. */
export const MOBILE_LINES_CONFIG: EntityConfig = {
  title: 'Linee mobili',
  singular: 'Linea',
  subtitle: 'Numeri di cellulare divisi per società, con profilo tariffario e assegnatario.',
  endpoint: '/mobile-lines',
  canDelete: true,
  // Task collegati alla linea (D-36)
  taskSource: {
    type: 'MOBILE_LINE',
    label: (row) =>
      [row['phoneNumber'], row['assigneeName']].filter(Boolean).join(' · ') ||
      `Linea ${String(row['id'])}`,
  },
  titleOpensForm: true,
  compact: true,
  centerValues: true,
  searchKeys: [
    'phoneNumber',
    'assigneeName',
    'legalEntityName',
    'tariffPlanCode',
    'operatorName',
    'originalDescription',
    'deviceLabel',
    'optionNames',
    'iccid',
    'notes',
  ],
  quickFilters: [
    { key: 'legalEntityName', label: 'Società' },
    { key: 'operatorName', label: 'Operatore' },
    { key: 'migrationStatusLabel', label: 'Migrazione' },
    { key: 'lineUseLabel', label: 'Tipo linea' },
    { key: 'tariffPlanCode', label: 'Profilo' },
    { key: 'assigneeTypeLabel', label: 'Assegnata a' },
  ],
  fields: [
    {
      key: 'legalEntityId',
      label: 'Società',
      type: 'select',
      required: true,
      options: { endpoint: '/legal-entities', labelKey: 'name' },
      hint: 'Società intestataria del contratto',
    },
    {
      key: 'phoneNumber',
      label: 'Numero',
      type: 'text',
      required: true,
      maxLength: 20,
      pattern: { regex: '^\\+?\\d{6,15}$', message: 'Solo cifre, senza spazi (es. 3668451431)' },
    },
    {
      key: 'tariffPlanId',
      label: 'Profilo tariffario',
      type: 'select',
      options: { endpoint: '/tariff-plans', labelKey: 'code' },
    },
    {
      key: 'operatorId',
      label: 'Operatore',
      type: 'select',
      options: OPERATORS,
      hint: 'Operatore attuale della SIM (TIM per le linee migrate)',
    },
    {
      key: 'previousOperatorId',
      label: 'Operatore precedente',
      type: 'select',
      options: OPERATORS,
      hint: 'Da dove arriva la linea, se è stata migrata',
    },
    {
      key: 'lineUse',
      label: 'Tipo di linea',
      type: 'select',
      options: { static: LINE_USES },
    },
    {
      key: 'migrationStatus',
      label: 'Migrazione a TIM',
      type: 'select',
      options: { static: MIGRATION_STATUSES },
      hint: 'Solo per le linee italiane; vuoto per San Marino',
    },
    { key: 'activationDate', label: 'Data attivazione', type: 'date' },
    {
      key: 'assigneeType',
      label: 'Assegnata a',
      type: 'select',
      required: true,
      defaultValue: 'PERSON',
      options: { static: ASSIGNEE_TYPES },
    },
    {
      key: 'assigneeName',
      label: 'Nome assegnatario',
      type: 'text',
      maxLength: 150,
      hint: 'Persona, ufficio o uso (es. Allarme magazzino)',
    },
    { key: 'assignedFrom', label: 'Assegnata dal', type: 'date' },
    {
      key: 'deviceId',
      label: 'Smartphone in cui è inserita',
      type: 'search',
      options: {
        endpoint: '/smartphones',
        labelKey: (row) =>
          `${String(row['displayName'])}${row['assigneeName'] ? ' · ' + String(row['assigneeName']) : ''}`,
      },
      fullWidth: true,
    },
    {
      key: 'iccid',
      label: 'ICCID (seriale SIM)',
      type: 'text',
      maxLength: 22,
      hint: '18-22 cifre stampate sulla SIM: utile per bloccarla se si perde',
    },
    { key: 'pin', label: 'PIN', type: 'text', maxLength: 8, pattern: PIN },
    { key: 'puk', label: 'PUK', type: 'text', maxLength: 10, pattern: PUK },
    { key: 'nmu', label: 'NMU', type: 'text', maxLength: 20 },
    {
      key: 'proposalNumber',
      label: 'Progressivo proposta TIM',
      type: 'number',
      min: 1,
      hint: 'Numero della riga nell’allegato SIM di TIM',
    },
    {
      key: 'optionIds',
      label: 'Opzioni attive',
      type: 'multiselect',
      fullWidth: true,
      options: {
        endpoint: '/operator-options',
        labelKey: (row) => `${String(row['operatorName'])} · ${String(row['code'])}`,
      },
      hint: 'Una o più, e solo dell’operatore scelto sopra (es. Voce UE di TIM)',
    },
    {
      key: 'originalDescription',
      label: 'Descrizione originale',
      type: 'text',
      maxLength: 300,
      fullWidth: true,
      hint: 'Testo del foglio Excel, conservato com’era',
    },
    {
      key: 'active',
      label: 'Attiva',
      type: 'checkbox',
      defaultValue: true,
      hint: 'Togli la spunta quando la linea è cessata',
    },
    { key: 'notes', label: 'Note', type: 'textarea', maxLength: 1000, fullWidth: true },
  ],
  columns: [
    { key: 'phoneNumber', label: 'Numero', primary: true, width: 'narrow' },
    {
      key: 'assigneeName',
      label: 'Assegnatario',
      align: 'start',
      width: 'wide',
      clamp: true,
      format: (v) => (v ? String(v) : 'Da definire'),
    },
    { key: 'legalEntityName', label: 'Società' },
    { key: 'tariffPlanCode', label: 'Profilo' },
    { key: 'operatorName', label: 'Operatore', hideOnMobile: true },
    { key: 'migrationStatusLabel', label: 'Migrazione', hideOnMobile: true },
    { key: 'lineUseLabel', label: 'Linea', hideOnMobile: true },
    { key: 'assigneeTypeLabel', label: 'Tipo', hideOnMobile: true },
    { key: 'activationDate', label: 'Attivazione', type: 'date', hideOnMobile: true },
    { key: 'optionNames', label: 'Opzioni', type: 'list', hideOnMobile: true },
    { key: 'iccid', label: 'ICCID', hideOnMobile: true, defaultHidden: true },
    { key: 'pin', label: 'PIN', hideOnMobile: true, defaultHidden: true },
    { key: 'puk', label: 'PUK', hideOnMobile: true, defaultHidden: true },
    { key: 'nmu', label: 'NMU', hideOnMobile: true, defaultHidden: true },
    {
      key: 'proposalNumber',
      label: 'Progr. TIM',
      type: 'number',
      hideOnMobile: true,
      defaultHidden: true,
    },
    { key: 'deviceLabel', label: 'Smartphone', hideOnMobile: true, defaultHidden: true },
    ACTIVE_COLUMN,
  ],
};

/** Profili tariffari: la piccola anagrafica che spiega cosa include ogni profilo. */
export const TARIFF_PLANS_CONFIG: EntityConfig = {
  title: 'Profili tariffari',
  singular: 'Profilo',
  subtitle: 'Cosa include ogni profilo delle SIM, quanto costa e quante linee lo usano.',
  endpoint: '/tariff-plans',
  canDelete: true,
  titleOpensForm: true,
  compact: true,
  centerValues: true,
  searchKeys: ['code', 'countryName', 'operatorName', 'otherInfo', 'notes'],
  quickFilters: [
    { key: 'countryName', label: 'Paese' },
    { key: 'operatorName', label: 'Operatore' },
  ],
  fields: [
    {
      key: 'code',
      label: 'Profilo',
      type: 'text',
      required: true,
      maxLength: 30,
      hint: 'Come si chiama sul contratto, es. MARLUTMS',
    },
    {
      key: 'country',
      label: 'Paese',
      type: 'select',
      required: true,
      defaultValue: 'SM',
      options: { static: COUNTRIES },
      hint: 'Dove si applica la tariffa',
    },
    {
      key: 'operatorId',
      label: 'Operatore',
      type: 'select',
      required: true,
      options: OPERATORS,
      hint: 'Chi offre il profilo: TIM per l’Italia, TMS San Marino per San Marino',
    },
    {
      key: 'monthlyCost',
      label: 'Costo al mese (€)',
      type: 'number',
      min: 0,
      step: 0.01,
      hint: 'Da Definire se non lo conosci: lascialo vuoto',
    },
    {
      key: 'activationCost',
      label: 'Costo di attivazione (€)',
      type: 'number',
      min: 0,
      step: 0.01,
    },
    { key: 'dataAllowance', label: 'Dati', type: 'text', maxLength: 30, hint: 'Es. 200GB, No' },
    { key: 'minutes', label: 'Minuti', type: 'text', maxLength: 30, hint: 'Es. Illimitati' },
    { key: 'sms', label: 'SMS', type: 'text', maxLength: 30 },
    { key: 'euCalls', label: 'Chiamate estere UE', type: 'text', maxLength: 30 },
    { key: 'euRoaming', label: 'Roaming UE', type: 'text', maxLength: 30, hint: 'Es. 20GB, No' },
    { key: 'otherInfo', label: 'Altro', type: 'text', maxLength: 200, fullWidth: true },
    {
      key: 'active',
      label: 'Attivo',
      type: 'checkbox',
      defaultValue: true,
      hint: 'Togli la spunta per disattivarlo: sparisce dall’elenco e dalla scelta nelle linee (si rivede con «Mostra disattivati»)',
    },
    { key: 'notes', label: 'Note', type: 'textarea', maxLength: 1000, fullWidth: true },
  ],
  columns: [
    { key: 'code', label: 'Profilo', primary: true },
    { key: 'countryName', label: 'Paese', width: 'narrow' },
    { key: 'operatorName', label: 'Operatore', width: 'narrow' },
    { key: 'monthlyCost', label: '€ / mese', format: euro, width: 'narrow' },
    { key: 'dataAllowance', label: 'Dati', width: 'narrow' },
    { key: 'minutes', label: 'Minuti', hideOnMobile: true, width: 'narrow' },
    { key: 'sms', label: 'SMS', hideOnMobile: true, width: 'narrow' },
    { key: 'euCalls', label: 'Chiamate UE', hideOnMobile: true, width: 'narrow' },
    { key: 'euRoaming', label: 'Roaming UE', hideOnMobile: true, width: 'narrow' },
    {
      key: 'activationCost',
      label: 'Attivazione',
      format: euro,
      hideOnMobile: true,
      width: 'narrow',
    },
    { key: 'lineCount', label: 'Linee', type: 'number', width: 'narrow' },
    { key: 'otherInfo', label: 'Altro', hideOnMobile: true, clamp: true },
  ],
};

/** Opzioni dell'operatore: si attivano solo con un certo operatore (oggi TIM) e si assegnano alle linee. */
export const OPERATOR_OPTIONS_CONFIG: EntityConfig = {
  title: 'Opzioni operatore',
  singular: 'Opzione',
  subtitle:
    'Opzioni aggiuntive che si attivano solo con un certo operatore (es. Voce UE di TIM): si assegnano alle singole linee.',
  endpoint: '/operator-options',
  canDelete: true,
  titleOpensForm: true,
  compact: true,
  centerValues: true,
  searchKeys: ['code', 'operatorName', 'description', 'notes'],
  quickFilters: [{ key: 'operatorName', label: 'Operatore' }],
  fields: [
    {
      key: 'operatorId',
      label: 'Operatore',
      type: 'select',
      required: true,
      options: OPERATORS,
      hint: 'L’opzione si può attivare solo sulle linee di questo operatore',
    },
    {
      key: 'code',
      label: 'Opzione',
      type: 'text',
      required: true,
      maxLength: 40,
      hint: 'Es. VOCE UE, USA, ROAMING MONDO',
    },
    {
      key: 'monthlyCost',
      label: 'Costo al mese (€)',
      type: 'number',
      min: 0,
      step: 0.01,
      hint: 'Per le opzioni a gettone indica nelle note il costo a uso',
    },
    { key: 'description', label: 'Cosa include', type: 'text', maxLength: 300, fullWidth: true },
    { key: 'active', label: 'Attivabile', type: 'checkbox', defaultValue: true },
    { key: 'notes', label: 'Note', type: 'textarea', maxLength: 1000, fullWidth: true },
  ],
  columns: [
    { key: 'code', label: 'Opzione', primary: true },
    { key: 'operatorName', label: 'Operatore', width: 'narrow' },
    { key: 'monthlyCost', label: '€ / mese', format: euro, width: 'narrow' },
    { key: 'description', label: 'Cosa include', align: 'start', clamp: true, hideOnMobile: true },
    { key: 'lineCount', label: 'Linee', type: 'number', width: 'narrow' },
    { key: 'active', label: 'Attivabile', type: 'boolean', width: 'narrow', hideOnMobile: true },
  ],
};

/** Campi comuni a smartphone e tablet (stessa tabella, due anagrafiche). */
function deviceFields(tablet: boolean): readonly FieldConfig[] {
  return [
    {
      key: 'brand',
      label: 'Marca',
      type: 'text',
      required: true,
      maxLength: 50,
      hint: 'Es. Samsung',
    },
    {
      key: 'model',
      label: 'Modello',
      type: 'text',
      required: true,
      maxLength: 100,
      hint: tablet ? 'Es. iPad 9 gen' : 'Es. Galaxy A37 5G',
    },
    { key: 'ramGb', label: 'RAM (GB)', type: 'number', min: 1, max: 64 },
    { key: 'storageGb', label: 'Memoria (GB)', type: 'number', min: 1, max: 4096 },
    { key: 'color', label: 'Colore', type: 'text', maxLength: 30 },
    { key: 'serialNumber', label: 'Matricola (SN)', type: 'text', maxLength: 50 },
    {
      key: 'imei1',
      label: 'IMEI 1',
      type: 'text',
      maxLength: 15,
      pattern: IMEI,
      hint: 'Si legge con *#06# o sulla scatola',
    },
    { key: 'imei2', label: 'IMEI 2', type: 'text', maxLength: 15, pattern: IMEI },
    {
      key: 'status',
      label: 'Stato',
      type: 'select',
      required: true,
      defaultValue: 'ASSIGNED',
      options: { static: DEVICE_STATUSES },
    },
    {
      key: 'assigneeType',
      label: 'Assegnato a',
      type: 'select',
      required: true,
      defaultValue: 'PERSON',
      options: { static: ASSIGNEE_TYPES },
    },
    { key: 'assigneeName', label: 'Nome assegnatario', type: 'text', maxLength: 150 },
    { key: 'assignedFrom', label: 'Assegnato dal', type: 'date' },
    {
      key: 'legalEntityId',
      label: 'Società che ha acquistato',
      type: 'select',
      options: { endpoint: '/legal-entities', labelKey: 'name' },
    },
    { key: 'purchaseDate', label: 'Data acquisto', type: 'date' },
    { key: 'purchasePrice', label: 'Prezzo (€)', type: 'number', min: 0, step: 0.01 },
    {
      key: 'supplierId',
      label: 'Fornitore',
      type: 'select',
      options: { endpoint: '/vendors', labelKey: 'name' },
    },
    {
      key: 'warrantyEndDate',
      label: 'Fine garanzia',
      type: 'date',
      hint: 'Di solito 24 mesi dall’acquisto per i dispositivi aziendali (da verificare sulla fattura)',
    },
    {
      key: 'osVersion',
      label: 'Versione sistema',
      type: 'text',
      maxLength: 30,
      hint: 'Es. Android 16, iOS 19',
    },
    {
      key: 'osSupportEndDate',
      label: 'Fine aggiornamenti di sicurezza',
      type: 'date',
      hint: 'Dopo questa data il device non riceve più patch: va sostituito',
    },
    {
      key: 'mdmEnrolled',
      label: 'Gestito da MDM',
      type: 'checkbox',
      hint: 'Il device è registrato nella gestione centralizzata (cancellazione da remoto, policy)',
    },
    {
      key: 'productUrl',
      label: 'Link al prodotto',
      type: 'text',
      maxLength: 500,
      fullWidth: true,
      hint: 'Scheda del produttore o del fornitore',
    },
    { key: 'active', label: 'Attivo', type: 'checkbox', defaultValue: true },
    { key: 'notes', label: 'Note', type: 'textarea', maxLength: 1000, fullWidth: true },
  ];
}

function deviceColumns(): readonly ColumnConfig[] {
  return [
    {
      key: 'assigneeName',
      label: 'Assegnatario',
      primary: true,
      format: (v) => (v ? String(v) : 'Da definire'),
    },
    { key: 'displayName', label: 'Device' },
    { key: 'statusLabel', label: 'Stato' },
    { key: 'legalEntityName', label: 'Società acquisto', hideOnMobile: true },
    { key: 'storageGb', label: 'GB', type: 'number', hideOnMobile: true },
    { key: 'imei1', label: 'IMEI 1', hideOnMobile: true, defaultHidden: true },
    { key: 'serialNumber', label: 'Matricola', hideOnMobile: true, defaultHidden: true },
    { key: 'lineNumbers', label: 'Linee', hideOnMobile: true },
    { key: 'purchaseDate', label: 'Acquisto', type: 'date', hideOnMobile: true },
    { key: 'warrantyStatusLabel', label: 'Garanzia', hideOnMobile: true },
    {
      key: 'osSupportStatusLabel',
      label: 'Aggiornamenti',
      hideOnMobile: true,
      defaultHidden: true,
    },
  ];
}

const DEVICE_SEARCH = [
  'assigneeName',
  'displayName',
  'imei1',
  'imei2',
  'serialNumber',
  'legalEntityName',
  'lineNumbers',
  'notes',
];

const DEVICE_FILTERS = [
  { key: 'statusLabel', label: 'Stato' },
  { key: 'legalEntityName', label: 'Società acquisto' },
  { key: 'brand', label: 'Marca' },
  { key: 'warrantyStatusLabel', label: 'Garanzia' },
];

/** Smartphone aziendali. */
export const SMARTPHONES_CONFIG: EntityConfig = {
  title: 'Smartphone',
  singular: 'Smartphone',
  subtitle: 'A chi è assegnato ogni telefono, con IMEI, garanzia e società di acquisto.',
  endpoint: '/smartphones',
  canDelete: true,
  taskSource: {
    type: 'MOBILE_DEVICE',
    label: (row) =>
      [[row['brand'], row['model']].filter(Boolean).join(' '), row['assigneeName']]
        .filter(Boolean)
        .join(' · ') || `Device ${String(row['id'])}`,
  },
  titleOpensForm: true,
  compact: true,
  centerValues: true,
  sort: byAssignee,
  searchKeys: DEVICE_SEARCH,
  quickFilters: DEVICE_FILTERS,
  fields: deviceFields(false),
  columns: deviceColumns(),
};

/** Tablet aziendali. */
export const TABLETS_CONFIG: EntityConfig = {
  title: 'Tablet',
  singular: 'Tablet',
  subtitle: 'A chi è assegnato ogni tablet, con matricola, garanzia e società di acquisto.',
  endpoint: '/tablets',
  canDelete: true,
  taskSource: {
    type: 'MOBILE_DEVICE',
    label: (row) =>
      [[row['brand'], row['model']].filter(Boolean).join(' '), row['assigneeName']]
        .filter(Boolean)
        .join(' · ') || `Device ${String(row['id'])}`,
  },
  titleOpensForm: true,
  compact: true,
  centerValues: true,
  sort: byAssignee,
  searchKeys: DEVICE_SEARCH,
  quickFilters: DEVICE_FILTERS,
  fields: deviceFields(true),
  columns: deviceColumns(),
};
