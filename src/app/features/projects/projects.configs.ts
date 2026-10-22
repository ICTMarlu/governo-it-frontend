import { EntityConfig, EntityRow, ROLES } from '../../shared/crud/crud.model';
import { PROJECTS_HELP } from '../../shared/help/help-content';

export const priorityLabel = (row: EntityRow): string => {
  const attributes = row['attributes'] as { level?: number; description?: string } | undefined;
  return attributes?.description
    ? `${attributes.level} – ${attributes.description}`
    : String(row['label']);
};

/** Portafoglio progetti (MD-01, PRJ-01). Il codice (es. ICT26ERP001) è assegnato alla creazione. */
export const PROJECTS_CONFIG: EntityConfig = {
  title: 'Progetti',
  singular: 'Progetto',
  subtitle:
    'Portafoglio IT: Project, AMS, Continuous e Admin. Il codice viene assegnato al salvataggio se il sistema ha il codice breve.',
  endpoint: '/projects',
  help: PROJECTS_HELP,
  writeRoles: [ROLES.admin, ROLES.pm, ROLES.editor],
  rowLink: (row) => ['/projects', row.id!],
  searchKeys: ['code', 'name', 'ownerNames', 'requesterNames', 'mainSystemLabel', 'description'],
  quickFilters: [
    { key: 'workTypeLabel', label: 'Tipo', orderKey: 'workTypeSortOrder' },
    { key: 'statusLabel', label: 'Stato', orderKey: 'statusSortOrder' },
    { key: 'mainSystemLabel', label: 'Sistema' },
    { key: 'ownerNames', label: 'Owner' },
  ],
  fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true, maxLength: 200, fullWidth: true },
    {
      key: 'workTypeId',
      label: 'Tipo',
      type: 'select',
      required: true,
      options: {
        endpoint: '/lookups/work-types',
        filter: (row) =>
          (row['attributes'] as { projectType?: boolean } | undefined)?.projectType === true,
      },
    },
    {
      key: 'mainSystemId',
      label: 'Sistema',
      type: 'select',
      options: { endpoint: '/lookups/main-systems' },
      hint: 'Vuoto se riguarda più sistemi (es. AMS). Il codice progetto usa il codice breve del sistema',
    },
    {
      key: 'statusId',
      label: 'Stato',
      type: 'select',
      required: true,
      options: { endpoint: '/lookups/project-statuses' },
    },
    {
      key: 'expenseTypeId',
      label: 'Capex / Opex',
      type: 'select',
      options: { endpoint: '/lookups/expense-types' },
    },
    {
      key: 'itPriorityId',
      label: 'Priorità IT',
      type: 'select',
      hint: 'Obbligatoria per i Project',
      options: { endpoint: '/lookups/priority-levels', labelKey: priorityLabel },
    },
    {
      key: 'businessPriorityId',
      label: 'Priorità di business',
      type: 'select',
      options: { endpoint: '/lookups/priority-levels', labelKey: priorityLabel },
    },
    {
      key: 'ownerIds',
      label: 'Owner',
      type: 'multiselect',
      hint: 'Obbligatorio per i Project; Admin, Continuous e AMS possono non averlo',
      options: { endpoint: '/resources', labelKey: 'fullName' },
    },
    {
      key: 'primaryOwnerId',
      label: 'Owner principale',
      type: 'select',
      options: { endpoint: '/resources', labelKey: 'fullName' },
      hint: 'Facoltativo, deve essere tra gli owner',
    },
    {
      key: 'requesterIds',
      label: 'Richiesto da',
      type: 'multiselect',
      options: { endpoint: '/requesters', labelKey: 'fullName' },
    },
    {
      key: 'sponsorRequesterId',
      label: 'Sponsor',
      type: 'select',
      options: { endpoint: '/requesters', labelKey: 'fullName' },
    },
    {
      key: 'groupWide',
      label: 'Tutto il gruppo (GLOBAL)',
      type: 'checkbox',
      hint: 'Riguarda tutte le società del gruppo',
    },
    {
      key: 'legalEntityIds',
      label: 'Società',
      type: 'multiselect',
      options: { endpoint: '/legal-entities', labelKey: 'name' },
      visibleWhen: (value) => value['groupWide'] !== true,
    },
    { key: 'streamId', label: 'Stream', type: 'select', options: { endpoint: '/lookups/streams' } },
    { key: 'plannedStartDate', label: 'Inizio pianificato', type: 'date' },
    { key: 'plannedEndDate', label: 'Fine pianificata', type: 'date' },
    {
      key: 'dueForType',
      label: 'Impegno di consegna (Due for)',
      type: 'select',
      options: {
        static: [
          { value: 'QUARTER', label: 'Trimestre' },
          { value: 'DATE', label: 'Data precisa' },
        ],
      },
      hint: 'Facoltativo: se vuoto il progetto non entra negli indicatori di puntualità',
    },
    {
      key: 'dueForQuarter',
      label: 'Trimestre',
      type: 'text',
      required: true,
      pattern: { regex: '^[Qq][1-4] ?\\d{4}$', message: 'Formato "Q2 2026"' },
      visibleWhen: (value) => value['dueForType'] === 'QUARTER',
      initialValue: (row) => (row['dueForType'] === 'QUARTER' ? row['dueForLabel'] : null),
    },
    {
      key: 'dueForDate',
      label: 'Data impegno',
      type: 'date',
      required: true,
      visibleWhen: (value) => value['dueForType'] === 'DATE',
    },
    {
      key: 'estimatedEffortDays',
      label: 'Effort stimato (giornate)',
      type: 'number',
      min: 0,
      step: 0.5,
    },
    {
      key: 'ranking',
      label: 'Ranking',
      type: 'number',
      min: 1,
      hint: 'Posizione unica nel portafoglio',
    },
    { key: 'actualCompletionDate', label: 'Data di completamento effettiva', type: 'date' },
    { key: 'active', label: 'Attivo', type: 'checkbox', defaultValue: true },
    { key: 'description', label: 'Descrizione', type: 'textarea' },
    { key: 'notes', label: 'Note', type: 'textarea' },
  ],
  columns: [
    { key: 'name', label: 'Progetto', primary: true },
    { key: 'code', label: 'Codice', width: 'narrow' },
    { key: 'workTypeLabel', label: 'Tipo', sortKey: 'workTypeSortOrder', width: 'narrow' },
    { key: 'mainSystemLabel', label: 'Sistema' },
    {
      key: 'statusLabel',
      label: 'Stato',
      type: 'badge',
      colorKey: 'statusColor',
      sortKey: 'statusSortOrder',
    },
    { key: 'itPriorityLevel', label: 'Priorità IT', type: 'number' },
    { key: 'businessPriorityLevel', label: 'Priorità business', type: 'number' },
    { key: 'ownerNames', label: 'Owner', type: 'list' },
    { key: 'requesterNames', label: 'Richiesto da', type: 'list', hideOnMobile: true },
    { key: 'dueForLabel', label: 'Due for', hideOnMobile: true, width: 'narrow' },
    { key: 'notes', label: 'Note', clamp: true, hideOnMobile: true },
    { key: 'expenseTypeLabel', label: 'Capex / Opex', defaultHidden: true },
    { key: 'legalEntityNames', label: 'Società', type: 'list', defaultHidden: true },
    { key: 'estimatedEffortDays', label: 'Effort (gg)', type: 'number', defaultHidden: true },
    { key: 'legacyActivityNumber', label: 'N. storico', type: 'number', defaultHidden: true },
  ],
};
