import { EntityConfig, EntityRow } from '../../shared/crud/crud.model';
import { TECHNOLOGIES_HELP } from '../../shared/help/help-content';

const DATE = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export const CATEGORIES = [
  { value: 'OPERATING_SYSTEM', label: 'Sistema operativo' },
  { value: 'DATABASE', label: 'Database' },
  { value: 'RUNTIME', label: 'Runtime / linguaggio' },
  { value: 'FRAMEWORK', label: 'Framework / libreria' },
  { value: 'APPLICATION', label: 'Applicativo' },
  { value: 'WEBSITE', label: 'Sito web / e-commerce' },
  { value: 'MIDDLEWARE', label: 'Middleware / server web' },
  { value: 'NETWORK', label: 'Rete / sicurezza' },
  { value: 'HARDWARE', label: 'Hardware / firmware' },
  { value: 'CLOUD', label: 'Servizio cloud' },
  { value: 'CERTIFICATE', label: 'Certificato / dominio' },
  { value: 'OTHER', label: 'Altro' },
];

export const CRITICALITIES = [
  { value: 'CRITICAL', label: 'Critica' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'LOW', label: 'Bassa' },
];

export const EXPOSURES = [
  { value: 'INTERNAL', label: 'Interna' },
  { value: 'INTERNET', label: 'Esposta a internet' },
];

const SEVERITIES = [
  { value: 'CRITICAL', label: 'Critica' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'LOW', label: 'Bassa' },
];

const VULN_STATUSES = [
  { value: 'OPEN', label: 'Aperta' },
  { value: 'PLANNED', label: 'Pianificata' },
  { value: 'MITIGATED', label: 'Mitigata' },
  { value: 'ACCEPTED', label: 'Rischio accettato' },
  { value: 'FIXED', label: 'Risolta' },
];

/** "14/10/2025 · scaduto da 374 giorni" oppure "tra 60 giorni"; vuoto se la data non c'è. */
function supportEnd(value: unknown, row: EntityRow): string {
  if (!value) {
    return 'non indicata';
  }
  const date = DATE.format(new Date(String(value)));
  const days = Number(row['daysToSupportEnd']);
  if (Number.isNaN(days)) {
    return date;
  }
  if (days < 0) {
    return `${date} · scaduto da ${-days} gg`;
  }
  return days === 0 ? `${date} · oggi` : `${date} · tra ${days} gg`;
}

/** Inventario delle tecnologie in uso (D-34). */
export const TECHNOLOGIES_CONFIG: EntityConfig = {
  title: 'Inventario',
  singular: 'Tecnologia',
  subtitle: 'Cosa si usa, in che versione e fino a quando è supportato.',
  endpoint: '/technologies',
  canDelete: true,
  help: TECHNOLOGIES_HELP,
  searchKeys: [
    'name',
    'softwareVersion',
    'vendorName',
    'hosts',
    'systemNames',
    'ownerName',
    'notes',
  ],
  quickFilters: [
    { key: 'priorityLabel', label: 'Priorità', orderKey: 'priorityRank' },
    { key: 'exposureLabel', label: 'Esposizione' },
    { key: 'systemNames', label: 'Sistema' },
    { key: 'categoryLabel', label: 'Categoria' },
    { key: 'supportStatusLabel', label: 'Supporto' },
    { key: 'businessCriticalityLabel', label: 'Criticità' },
  ],
  fields: [
    {
      key: 'name',
      label: 'Tecnologia',
      type: 'text',
      required: true,
      maxLength: 150,
      hint: 'Es. Windows Server, SQL Server, PHP',
    },
    {
      key: 'softwareVersion',
      label: 'Versione in uso',
      type: 'text',
      maxLength: 50,
      hint: 'Es. 2016, 8.1.27',
    },
    {
      key: 'category',
      label: 'Categoria',
      type: 'select',
      required: true,
      defaultValue: 'APPLICATION',
      options: { static: CATEGORIES },
    },
    {
      key: 'vendorId',
      label: 'Produttore / fornitore',
      type: 'select',
      options: { endpoint: '/vendors', labelKey: 'name' },
    },
    {
      key: 'systemIds',
      label: 'Sistemi che la usano',
      type: 'multiselect',
      options: { endpoint: '/lookups/main-systems' },
      fullWidth: true,
    },
    {
      key: 'hosts',
      label: 'Server / ambienti',
      type: 'text',
      maxLength: 300,
      hint: 'Dove gira, es. SRV-ERP01 (produzione)',
      fullWidth: true,
    },
    {
      key: 'exposure',
      label: 'Esposizione',
      type: 'select',
      required: true,
      defaultValue: 'INTERNAL',
      options: { static: EXPOSURES },
      hint: 'Esposta a internet: siti, e-commerce, servizi pubblici. Pesa di più',
    },
    {
      key: 'businessCriticality',
      label: 'Criticità per il business',
      type: 'select',
      required: true,
      defaultValue: 'MEDIUM',
      options: { static: CRITICALITIES },
      hint: 'Quanto pesa se si ferma o viene attaccata',
    },
    {
      key: 'supportEndDate',
      label: 'Fine supporto o scadenza',
      type: 'date',
      hint: 'Fine degli aggiornamenti di sicurezza; per un certificato o un dominio, la scadenza',
    },
    { key: 'latestVersion', label: 'Ultima versione disponibile', type: 'text', maxLength: 50 },
    {
      key: 'ownerResourceId',
      label: 'Referente',
      type: 'select',
      options: { endpoint: '/resources', labelKey: 'fullName' },
    },
    {
      key: 'eolProduct',
      label: 'Identificativo endoflife.date',
      type: 'text',
      maxLength: 100,
      hint: 'Facoltativo, es. windows-server: per i controlli in rete',
    },
    {
      key: 'cpe',
      label: 'Nome CPE',
      type: 'text',
      maxLength: 200,
      hint: 'Facoltativo: per cercare le vulnerabilità note',
    },
    { key: 'notes', label: 'Note', type: 'textarea', maxLength: 1000 },
    {
      key: 'active',
      label: 'In uso',
      type: 'checkbox',
      defaultValue: true,
      hint: 'Togli la spunta quando viene dismessa',
    },
  ],
  columns: [
    { key: 'name', label: 'Tecnologia', primary: true },
    { key: 'softwareVersion', label: 'Versione', width: 'narrow' },
    { key: 'exposureLabel', label: 'Esposizione', width: 'narrow' },
    {
      key: 'priorityLabel',
      label: 'Priorità',
      type: 'badge',
      colorKey: 'priorityColor',
      sortKey: 'priorityRank',
    },
    { key: 'supportEndDate', label: 'Fine supporto / scadenza', format: supportEnd },
    { key: 'openVulnerabilities', label: 'Vuln. aperte', type: 'number', width: 'narrow' },
    { key: 'systemNames', label: 'Sistemi', type: 'list' },
    { key: 'categoryLabel', label: 'Categoria', hideOnMobile: true },
    { key: 'businessCriticalityLabel', label: 'Criticità', hideOnMobile: true },
    { key: 'ownerName', label: 'Referente', hideOnMobile: true, defaultHidden: true },
    { key: 'hosts', label: 'Server / ambienti', hideOnMobile: true, defaultHidden: true },
    { key: 'vendorName', label: 'Produttore', hideOnMobile: true, defaultHidden: true },
  ],
  titleOpensForm: true,
};

/** Vulnerabilità note delle tecnologie. */
export const VULNERABILITIES_CONFIG: EntityConfig = {
  title: 'Vulnerabilità',
  singular: 'Vulnerabilità',
  subtitle: 'CVE e bollettini che riguardano le tecnologie in uso.',
  endpoint: '/vulnerabilities',
  canDelete: true,
  help: TECHNOLOGIES_HELP,
  searchKeys: ['reference', 'title', 'technologyName', 'fixVersion', 'notes'],
  quickFilters: [
    { key: 'statusLabel', label: 'Stato' },
    { key: 'severityLabel', label: 'Gravità', orderKey: 'severityRank' },
    { key: 'technologyName', label: 'Tecnologia' },
  ],
  fields: [
    {
      key: 'technologyId',
      label: 'Tecnologia',
      type: 'search',
      required: true,
      options: {
        endpoint: '/technologies',
        labelKey: (row) =>
          `${String(row['name'])}${row['softwareVersion'] ? ' ' + String(row['softwareVersion']) : ''}`,
      },
      fullWidth: true,
    },
    {
      key: 'reference',
      label: 'Riferimento',
      type: 'text',
      required: true,
      maxLength: 100,
      hint: 'Es. CVE-2025-1234',
    },
    {
      key: 'severity',
      label: 'Gravità',
      type: 'select',
      required: true,
      defaultValue: 'MEDIUM',
      options: { static: SEVERITIES },
    },
    { key: 'title', label: 'Titolo', type: 'text', maxLength: 300, fullWidth: true },
    {
      key: 'cvss',
      label: 'Punteggio CVSS',
      type: 'number',
      min: 0,
      max: 10,
      step: 0.1,
      hint: 'Da 0 a 10, facoltativo',
    },
    {
      key: 'activelyExploited',
      label: 'Sfruttata attivamente',
      type: 'checkbox',
      hint: 'Esiste già un attacco in corso (es. catalogo CISA KEV): diventa urgente',
    },
    {
      key: 'status',
      label: 'Stato',
      type: 'select',
      required: true,
      defaultValue: 'OPEN',
      options: { static: VULN_STATUSES },
    },
    { key: 'fixVersion', label: 'Versione che la risolve', type: 'text', maxLength: 50 },
    { key: 'detectedOn', label: 'Rilevata il', type: 'date' },
    {
      key: 'dueOn',
      label: 'Da risolvere entro',
      type: 'date',
      hint: 'Passata questa data senza risoluzione diventa urgente',
    },
    { key: 'url', label: 'Link al bollettino', type: 'text', maxLength: 400, fullWidth: true },
    { key: 'notes', label: 'Note', type: 'textarea', maxLength: 1000 },
  ],
  columns: [
    { key: 'reference', label: 'Riferimento', primary: true },
    { key: 'technologyName', label: 'Tecnologia' },
    {
      key: 'severityLabel',
      label: 'Gravità',
      type: 'badge',
      colorKey: 'severityColor',
      sortKey: 'severityRank',
      width: 'narrow',
    },
    { key: 'statusLabel', label: 'Stato', width: 'narrow' },
    { key: 'activelyExploited', label: 'Sfruttata', type: 'boolean', width: 'narrow' },
    { key: 'dueOn', label: 'Entro', type: 'date', width: 'narrow' },
    { key: 'fixVersion', label: 'Risolta con', hideOnMobile: true },
    { key: 'title', label: 'Titolo', clamp: true, hideOnMobile: true },
  ],
  titleOpensForm: true,
};
