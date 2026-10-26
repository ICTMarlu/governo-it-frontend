import { EntityConfig, ROLES } from '../../shared/crud/crud.model';
import { RESOURCES_HELP } from '../../shared/help/help-content';

const RESOURCE_TYPES = [
  { value: 'INTERNAL', label: 'Interna' },
  { value: 'EXTERNAL', label: 'Esterna' },
] as const;

const resourceTypeLabel = (value: unknown): string =>
  RESOURCE_TYPES.find((type) => type.value === value)?.label ?? '—';

const RESOURCE_WRITE_ROLES = [ROLES.admin, ROLES.pm];

/** Anagrafica risorse (MD-02). */
export const RESOURCES_CONFIG: EntityConfig = {
  title: 'Risorse',
  singular: 'Risorsa',
  subtitle: 'Interni, consulenti e fornitori. Apri una risorsa per capacità, ore extra e tariffe.',
  endpoint: '/resources',
  canDelete: true,
  help: RESOURCES_HELP,
  writeRoles: RESOURCE_WRITE_ROLES,
  searchKeys: ['fullName', 'alias', 'email', 'vendorName', 'mainSystemLabels'],
  quickFilters: [
    { key: 'teamRoleLabel', label: 'Ruolo' },
    { key: 'mainSystemLabels', label: 'Sistema' },
  ],
  rowLink: (row) => ['/resources', row.id!],
  fields: [
    { key: 'firstName', label: 'Nome', type: 'text', required: true, maxLength: 80 },
    { key: 'lastName', label: 'Cognome', type: 'text', required: true, maxLength: 80 },
    {
      key: 'alias',
      label: 'Alias',
      type: 'text',
      maxLength: 50,
      hint: 'Nome breve, solo etichetta',
    },
    { key: 'email', label: 'E-mail', type: 'text', maxLength: 200 },
    {
      key: 'jiraAccountId',
      label: 'Account Jira',
      type: 'text',
      maxLength: 128,
      hint: 'Si compila da solo se il nome è uguale in Jira; altrimenti incolla l’accountId (dal profilo Jira)',
    },
    {
      key: 'resourceType',
      label: 'Tipo',
      type: 'select',
      required: true,
      defaultValue: 'INTERNAL',
      options: { static: RESOURCE_TYPES },
    },
    {
      key: 'vendorId',
      label: 'Fornitore',
      type: 'select',
      options: { endpoint: '/vendors', labelKey: 'name' },
      visibleWhen: (value) => value['resourceType'] === 'EXTERNAL',
      required: true,
    },
    {
      key: 'teamRoleId',
      label: 'Ruolo nel team',
      type: 'select',
      options: { endpoint: '/lookups/team-roles' },
    },
    {
      key: 'managerResourceId',
      label: 'Responsabile',
      type: 'select',
      options: { endpoint: '/resources', labelKey: 'fullName' },
    },
    {
      key: 'siteId',
      label: 'Sede',
      type: 'select',
      required: true,
      options: { endpoint: '/sites', labelKey: 'name' },
      hint: 'Le sedi si creano in "Anagrafiche e liste"',
    },
    {
      key: 'mainSystemIds',
      label: 'Sistemi presidiati',
      type: 'multiselect',
      options: { endpoint: '/lookups/main-systems' },
    },
    {
      key: 'primaryMainSystemId',
      label: 'Sistema principale',
      type: 'select',
      options: { endpoint: '/lookups/main-systems' },
      hint: 'Viene aggiunto ai sistemi presidiati se manca',
    },
    { key: 'startDate', label: 'Inizio collaborazione', type: 'date' },
    { key: 'endDate', label: 'Fine collaborazione', type: 'date' },
    { key: 'active', label: 'Attiva', type: 'checkbox', defaultValue: true },
    {
      key: 'projectPlannable',
      label: 'Pianificabile su progetti e piano settimanale',
      type: 'checkbox',
      defaultValue: true,
      hint: 'Togli la spunta per chi fa solo ticketing: non entra nel piano settimanale né nei progetti',
    },
    { key: 'skills', label: 'Competenze principali', type: 'textarea', maxLength: 500 },
  ],
  columns: [
    { key: 'fullName', label: 'Nome', primary: true },
    { key: 'resourceType', label: 'Tipo', format: resourceTypeLabel },
    { key: 'teamRoleLabel', label: 'Ruolo' },
    { key: 'mainSystemLabels', label: 'Sistemi', type: 'list' },
    { key: 'vendorName', label: 'Fornitore', hideOnMobile: true },
    { key: 'siteName', label: 'Sede', hideOnMobile: true },
    { key: 'projectPlannable', label: 'Pianificabile', type: 'boolean', hideOnMobile: true },
    { key: 'active', label: 'Attiva', type: 'boolean', hideOnMobile: true },
  ],
};

/** Capacità per periodo (MD-04): 7,5 ore x 5 giorni = 5 giornate a settimana. */
export function capacityPeriodsConfig(resourceId: number): EntityConfig {
  return {
    title: 'Capacità',
    singular: 'Periodo di capacità',
    endpoint: `/resources/${resourceId}/capacity-periods`,
    writeRoles: RESOURCE_WRITE_ROLES,
    canDelete: true,
    searchKeys: [],
    fields: [
      { key: 'validFrom', label: 'Dal', type: 'date', required: true },
      { key: 'validTo', label: 'Al', type: 'date', hint: 'Vuoto = ancora valido' },
      {
        key: 'hoursPerDay',
        label: 'Ore al giorno',
        type: 'number',
        required: true,
        min: 0.25,
        max: 24,
        step: 0.25,
        defaultValue: 7.5,
      },
      {
        key: 'workingDaysPerWeek',
        label: 'Giorni lavorativi a settimana',
        type: 'number',
        required: true,
        min: 0.5,
        max: 7,
        step: 0.5,
        defaultValue: 5,
      },
      {
        key: 'emergencyReservePct',
        label: 'Riserva emergenze (%)',
        type: 'number',
        required: true,
        min: 0,
        max: 100,
        defaultValue: 0,
      },
      {
        key: 'amsQuotaDaysPerWeek',
        label: 'Quota AMS attesa (giornate/settimana)',
        type: 'number',
        min: 0,
        step: 0.25,
      },
      { key: 'notes', label: 'Note', type: 'text', maxLength: 300, fullWidth: true },
    ],
    columns: [
      { key: 'validFrom', label: 'Dal', type: 'date', primary: true },
      { key: 'validTo', label: 'Al', format: (value) => (value ? formatDate(value) : 'in corso') },
      { key: 'hoursPerDay', label: 'Ore/giorno', type: 'number' },
      { key: 'workingDaysPerWeek', label: 'Giorni/settimana', type: 'number' },
      { key: 'emergencyReservePct', label: 'Riserva %', type: 'number' },
      { key: 'amsQuotaDaysPerWeek', label: 'Quota AMS', type: 'number', hideOnMobile: true },
      { key: 'notes', label: 'Note', hideOnMobile: true },
    ],
  };
}

/** Ore extra a settimana "a gradini": per chiudere l'extra si inserisce una riga con 0. */
export function extraCapacitiesConfig(resourceId: number): EntityConfig {
  return {
    title: 'Ore extra',
    singular: 'Capacità extra',
    endpoint: `/resources/${resourceId}/extra-capacities`,
    writeRoles: RESOURCE_WRITE_ROLES,
    canDelete: true,
    searchKeys: [],
    fields: [
      { key: 'effectiveFrom', label: 'Dal', type: 'date', required: true },
      {
        key: 'extraHoursPerWeek',
        label: 'Ore extra a settimana',
        type: 'number',
        required: true,
        min: 0,
        max: 40,
        step: 0.25,
        hint: '0 per chiudere l’extra',
      },
      { key: 'notes', label: 'Note', type: 'text', maxLength: 300, fullWidth: true },
    ],
    columns: [
      { key: 'effectiveFrom', label: 'Dal', type: 'date', primary: true },
      { key: 'extraHoursPerWeek', label: 'Ore extra/settimana', type: 'number' },
      { key: 'notes', label: 'Note' },
    ],
  };
}

/** Tariffe giornaliere (FIN-04): visibili solo a chi ha il permesso sui costi. */
export function ratesConfig(resourceId: number): EntityConfig {
  return {
    title: 'Tariffe',
    singular: 'Tariffa',
    endpoint: `/resources/${resourceId}/rates`,
    writeRoles: RESOURCE_WRITE_ROLES,
    canDelete: true,
    searchKeys: [],
    fields: [
      { key: 'validFrom', label: 'Dal', type: 'date', required: true },
      { key: 'validTo', label: 'Al', type: 'date', hint: 'Vuoto = ancora valida' },
      {
        key: 'dailyRate',
        label: 'Tariffa giornaliera',
        type: 'number',
        required: true,
        min: 0,
        step: 0.01,
      },
      {
        key: 'currency',
        label: 'Valuta',
        type: 'text',
        defaultValue: 'EUR',
        maxLength: 3,
        pattern: { regex: '^[A-Z]{3}$', message: 'Codice ISO di 3 lettere (es. EUR)' },
      },
    ],
    columns: [
      { key: 'validFrom', label: 'Dal', type: 'date', primary: true },
      { key: 'validTo', label: 'Al', format: (value) => (value ? formatDate(value) : 'in corso') },
      { key: 'dailyRate', label: 'Tariffa', type: 'number' },
      { key: 'currency', label: 'Valuta' },
    ],
  };
}

function formatDate(value: unknown): string {
  return new Intl.DateTimeFormat('it-IT').format(new Date(`${String(value)}T00:00:00`));
}
