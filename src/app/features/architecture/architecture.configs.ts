import { EntityConfig, SelectOption } from '../../shared/crud/crud.model';
import { CRITICALITIES, EXPOSURES } from '../technologies/technologies.configs';
import { ARCHITECTURE_HELP } from './architecture.help';

/**
 * Architettura IT (D-38): applicativi e connessioni. I codici sono gli stessi del backend
 * (ArchCodes): il tipo decide il livello della mappa.
 */

/** Livelli della mappa, da sinistra a destra. */
export const LAYERS: readonly SelectOption[] = [
  { value: 'CHANNELS', label: 'Canali e postazioni' },
  { value: 'CORE', label: 'Gestionali' },
  { value: 'INTEGRATION', label: 'Integrazioni ed elaborazioni' },
  { value: 'DATA', label: 'Dati e analisi' },
  { value: 'EXTERNAL', label: 'Partner esterni' },
  { value: 'INFRASTRUCTURE', label: 'Infrastruttura' },
];

export const DEPLOYMENTS: readonly SelectOption[] = [
  { value: 'ON_PREMISE', label: 'In sede (on-premise)' },
  { value: 'HOSTED', label: 'Hosting / datacenter esterno' },
  { value: 'IAAS', label: 'Cloud (Azure, AWS…)' },
  { value: 'SAAS', label: 'SaaS, in abbonamento' },
  { value: 'DEVICE', label: 'Sui dispositivi (casse, PC, telefoni)' },
];

export const LIFECYCLES: readonly SelectOption[] = [
  { value: 'PLANNED', label: 'In arrivo' },
  { value: 'ACTIVE', label: 'In uso' },
  { value: 'PHASING_OUT', label: 'In dismissione' },
  { value: 'RETIRED', label: 'Dismesso' },
];

export const DIRECTIONS: readonly SelectOption[] = [
  { value: 'PUSH', label: 'invia a' },
  { value: 'PULL', label: 'legge da' },
  { value: 'SYNC', label: 'sincronizza con' },
];

export const FREQUENCIES: readonly SelectOption[] = [
  { value: 'REAL_TIME', label: 'In tempo reale' },
  { value: 'MINUTES', label: 'Ogni pochi minuti' },
  { value: 'HOURLY', label: 'Ogni ora' },
  { value: 'DAILY', label: 'Una volta al giorno' },
  { value: 'WEEKLY', label: 'Ogni settimana' },
  { value: 'MONTHLY', label: 'Ogni mese' },
  { value: 'ON_DEMAND', label: 'A richiesta / a mano' },
];

const CRITICALITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export const APPLICATIONS_CONFIG: EntityConfig = {
  title: 'Applicativi',
  singular: 'Applicativo',
  subtitle: 'Cosa usa il business: gestionali, casse, e-commerce, BI, partner esterni.',
  endpoint: '/applications',
  canDelete: true,
  help: ARCHITECTURE_HELP,
  // Task collegati all'applicativo: migrazioni, aggiornamenti, problemi aperti (D-36)
  taskSource: {
    type: 'APPLICATION',
    label: (row) => String(row['name'] ?? `Applicativo ${String(row['id'])}`),
  },
  searchKeys: [
    'name',
    'typeLabel',
    'vendorName',
    'hosts',
    'ownerName',
    'businessOwner',
    'userAreaNames',
    'technologyNames',
    'notes',
  ],
  quickFilters: [
    // Quattro filtri: con ricerca e pulsanti stanno su una riga sola
    { key: 'layerLabel', label: 'Livello' },
    { key: 'typeLabel', label: 'Tipologia' },
    { key: 'businessCriticalityLabel', label: 'Criticità' },
    { key: 'userAreaNames', label: 'Chi lo usa' },
  ],
  fields: [
    {
      key: 'name',
      label: 'Nome',
      type: 'text',
      required: true,
      maxLength: 100,
      hint: 'Come lo chiamate in azienda, es. FM3, Sito Ordini. È la stessa voce che si sceglie nei progetti',
    },
    {
      key: 'systemTypeId',
      label: 'Tipologia',
      type: 'select',
      required: true,
      options: { endpoint: '/lookups/system-types' },
      hint: 'Decide la colonna della mappa. Le tipologie si modificano in Anagrafiche › Liste',
    },
    {
      key: 'lifecycle',
      label: 'Stato',
      type: 'select',
      required: true,
      defaultValue: 'ACTIVE',
      options: { static: LIFECYCLES },
    },
    {
      key: 'deployment',
      label: 'Dove gira',
      type: 'select',
      required: true,
      defaultValue: 'ON_PREMISE',
      options: { static: DEPLOYMENTS },
    },
    {
      key: 'vendorId',
      label: 'Fornitore',
      type: 'select',
      options: { endpoint: '/vendors', labelKey: 'name' },
      hint: 'Chi lo fornisce o lo assiste',
    },
    {
      key: 'siteId',
      label: 'Sede',
      type: 'select',
      options: { endpoint: '/sites', labelKey: 'name' },
    },
    {
      key: 'hosts',
      label: 'Server / indirizzi',
      type: 'text',
      maxLength: 300,
      hint: 'Es. SRV-ERP01, erp.marlu.local, tenant Microsoft',
      fullWidth: true,
    },
    {
      key: 'userAreaIds',
      label: 'Chi lo usa',
      type: 'multiselect',
      options: { endpoint: '/lookups/business-areas' },
      fullWidth: true,
    },
    {
      key: 'technologyIds',
      label: 'Gira su (tecnologie)',
      type: 'multiselect',
      options: {
        endpoint: '/technologies',
        labelKey: (row) =>
          `${String(row['name'])}${row['softwareVersion'] ? ' ' + String(row['softwareVersion']) : ''}`,
      },
      hint: 'Dall’inventario: fine supporto e vulnerabilità arrivano fino all’applicativo',
      fullWidth: true,
    },
    {
      key: 'businessCriticality',
      label: 'Criticità per il business',
      type: 'select',
      required: true,
      defaultValue: 'MEDIUM',
      options: { static: CRITICALITIES },
      hint: 'Quanto pesa se si ferma',
    },
    {
      key: 'exposure',
      label: 'Esposizione',
      type: 'select',
      required: true,
      defaultValue: 'INTERNAL',
      options: { static: EXPOSURES },
    },
    {
      key: 'ownerResourceId',
      label: 'Referente IT',
      type: 'select',
      options: { endpoint: '/resources', labelKey: 'fullName' },
    },
    {
      key: 'businessOwner',
      label: 'Referente di business',
      type: 'text',
      maxLength: 150,
      hint: 'Es. Ufficio Acquisti, Responsabile logistica',
    },
    { key: 'notes', label: 'Note', type: 'textarea', maxLength: 1000 },
    {
      key: 'active',
      label: 'Attivo',
      type: 'checkbox',
      defaultValue: true,
      hint: 'Togli la spunta per toglierlo dalla mappa senza cancellarlo',
    },
  ],
  columns: [
    { key: 'name', label: 'Applicativo', primary: true },
    { key: 'typeLabel', label: 'Tipologia' },
    { key: 'lifecycleLabel', label: 'Stato', width: 'narrow' },
    { key: 'businessCriticalityLabel', label: 'Criticità', width: 'narrow' },
    {
      key: 'technologyPriorityLabel',
      label: 'Tecnologie',
      type: 'badge',
      colorKey: 'technologyPriorityColor',
      width: 'narrow',
    },
    { key: 'incoming', label: 'Flussi in entrata', type: 'number', width: 'narrow' },
    { key: 'outgoing', label: 'Flussi in uscita', type: 'number', width: 'narrow' },
    { key: 'userAreaNames', label: 'Chi lo usa', type: 'list', maxItems: 2, hideOnMobile: true },
    { key: 'deploymentLabel', label: 'Dove gira', hideOnMobile: true, defaultHidden: true },
    { key: 'vendorName', label: 'Fornitore', hideOnMobile: true, defaultHidden: true },
    {
      key: 'technologyNames',
      label: 'Gira su',
      type: 'list',
      hideOnMobile: true,
      defaultHidden: true,
    },
    { key: 'hosts', label: 'Server', hideOnMobile: true, defaultHidden: true },
    { key: 'ownerName', label: 'Referente IT', hideOnMobile: true, defaultHidden: true },
    { key: 'businessOwner', label: 'Referente business', hideOnMobile: true, defaultHidden: true },
    { key: 'active', label: 'Attivo', type: 'boolean', width: 'narrow', defaultHidden: true },
  ],
  centerValues: true,
  titleOpensForm: true,
  sort: (a, b) =>
    (CRITICALITY_RANK[String(b['businessCriticality'])] ?? 0) -
      (CRITICALITY_RANK[String(a['businessCriticality'])] ?? 0) ||
    String(a['name']).localeCompare(String(b['name']), 'it'),
};

const APP_OPTION = { endpoint: '/applications', labelKey: 'name' } as const;

export const CONNECTIONS_CONFIG: EntityConfig = {
  title: 'Connessioni',
  singular: 'Connessione',
  subtitle: 'Chi passa quali dati a chi: si legge “ERP invia a WMS ordini e articoli”.',
  endpoint: '/app-connections',
  canDelete: true,
  help: ARCHITECTURE_HELP,
  searchKeys: ['sourceName', 'targetName', 'dataObjects', 'protocolLabel', 'details'],
  quickFilters: [
    { key: 'sourceName', label: 'Da' },
    { key: 'targetName', label: 'A' },
    { key: 'protocolLabel', label: 'Protocollo' },
    { key: 'businessCriticalityLabel', label: 'Criticità' },
  ],
  fields: [
    { key: 'sourceId', label: 'Da', type: 'search', required: true, options: APP_OPTION },
    {
      key: 'direction',
      label: 'Direzione',
      type: 'select',
      required: true,
      defaultValue: 'PUSH',
      options: { static: DIRECTIONS },
      hint: 'Invia a: i dati partono da sinistra. Legge da: è chi sta a sinistra ad andarli a prendere',
    },
    { key: 'targetId', label: 'A', type: 'search', required: true, options: APP_OPTION },
    {
      key: 'dataObjects',
      label: 'Dati scambiati',
      type: 'text',
      maxLength: 300,
      hint: 'Es. ordini, articoli, giacenze, prezzi, scontrini, clienti',
      fullWidth: true,
    },
    {
      key: 'protocolId',
      label: 'Protocollo',
      type: 'select',
      options: { endpoint: '/lookups/integration-protocols' },
    },
    {
      key: 'frequency',
      label: 'Frequenza',
      type: 'select',
      required: true,
      defaultValue: 'DAILY',
      options: { static: FREQUENCIES },
    },
    {
      key: 'businessCriticality',
      label: 'Criticità del flusso',
      type: 'select',
      required: true,
      defaultValue: 'MEDIUM',
      options: { static: CRITICALITIES },
      hint: 'Quanto pesa se il flusso si blocca',
    },
    {
      key: 'details',
      label: 'Dettagli tecnici',
      type: 'textarea',
      maxLength: 500,
      hint: 'Endpoint, cartella, orario del job, chi lo gestisce',
    },
    { key: 'active', label: 'Attiva', type: 'checkbox', defaultValue: true },
  ],
  columns: [
    { key: 'sourceName', label: 'Da', primary: true },
    { key: 'directionLabel', label: 'Direzione', width: 'narrow' },
    { key: 'targetName', label: 'A' },
    { key: 'dataObjects', label: 'Dati scambiati', clamp: true },
    { key: 'protocolLabel', label: 'Protocollo', width: 'narrow' },
    { key: 'frequencyLabel', label: 'Frequenza', width: 'narrow' },
    { key: 'businessCriticalityLabel', label: 'Criticità', width: 'narrow', hideOnMobile: true },
    { key: 'details', label: 'Dettagli', clamp: true, hideOnMobile: true, defaultHidden: true },
    { key: 'active', label: 'Attiva', type: 'boolean', width: 'narrow', defaultHidden: true },
  ],
  centerValues: true,
  titleOpensForm: true,
};
