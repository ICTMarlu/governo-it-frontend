import { EntityConfig, EntityRow, ROLES } from '../../shared/crud/crud.model';
import { priorityLabel } from '../projects/projects.configs';

/** Chi gestisce la pagina Direzione (D-17); il Viewer legge soltanto. */
export const MANAGEMENT_WRITE_ROLES: readonly string[] = [ROLES.admin, ROLES.pm];
/** Riunioni e visione completa della Direzione: solo Admin (D-31); gli altri vedono i propri punti. */
export const MEETING_ROLES: readonly string[] = [ROLES.admin];

export const TOPIC_TYPE_OPTIONS = [
  { value: 'TOPIC', label: 'Argomento' },
  { value: 'TASK', label: 'Task' },
  { value: 'ROADBLOCK', label: 'Roadblock' },
  { value: 'DECISION', label: 'Decisione richiesta' },
];

export const TOPIC_STATUS_OPTIONS = [
  { value: 'TO_DISCUSS', label: 'Da discutere' },
  { value: 'POSTPONED', label: 'Posticipato' },
  { value: 'IN_FOLLOW_UP', label: 'Discusso, in corso' },
  { value: 'CLOSED', label: 'Chiuso' },
  { value: 'CANCELLED', label: 'Annullato' },
];

/** Colore del tipo di punto, uguale in tutta la pagina. */
export const TOPIC_TYPE_COLORS: Readonly<Record<string, string>> = {
  TOPIC: '#1565C0',
  TASK: '#2E7D32',
  ROADBLOCK: '#C62828',
  DECISION: '#EF6C00',
};

/** Da quanti rinvii un punto va segnalato: o si decide, o si riassegna, o si annulla. */
export const DEFERRAL_WARNING = 2;

const STATUS_ORDER = TOPIC_STATUS_OPTIONS.map((option) => option.value);

const projectLabel = (row: EntityRow): string =>
  row['code'] ? `${String(row['code'])} · ${String(row['name'])}` : String(row['name']);

/** Prima i punti vivi nell'ordine degli stati, poi per priorità (senza in fondo), poi i più recenti. */
const byStatusThenPriority = (a: EntityRow, b: EntityRow): number => {
  const status = (row: EntityRow) => STATUS_ORDER.indexOf(String(row['status']));
  const priority = (row: EntityRow) => Number(row['priorityLevel'] ?? 99);
  return status(a) - status(b) || priority(a) - priority(b) || Number(b.id) - Number(a.id);
};

/** Punti da portare alla direzione: la lista viva. */
export const TOPICS_CONFIG: EntityConfig = {
  title: 'Punti',
  singular: 'Punto',
  endpoint: '/management/topics',
  writeRoles: MANAGEMENT_WRITE_ROLES,
  canDelete: true,
  searchKeys: [
    'title',
    'notes',
    'decision',
    'projectCode',
    'projectName',
    'ownerName',
    'audienceNames',
  ],
  quickFilters: [
    { key: 'statusLabel', label: 'Stato' },
    { key: 'topicTypeLabel', label: 'Tipo' },
    { key: 'audienceNames', label: 'Rivolto a' },
    { key: 'ownerName', label: 'Owner' },
  ],
  sort: byStatusThenPriority,
  // Clic sul titolo: si apre la scheda del punto per modificarlo
  titleOpensForm: true,
  fields: [
    {
      key: 'title',
      label: 'Titolo',
      type: 'text',
      required: true,
      maxLength: 200,
      fullWidth: true,
    },
    {
      key: 'topicType',
      label: 'Tipo',
      type: 'select',
      required: true,
      defaultValue: 'TOPIC',
      options: { static: TOPIC_TYPE_OPTIONS },
    },
    {
      key: 'audienceIds',
      label: 'Rivolto a',
      type: 'multiselect',
      options: {
        endpoint: '/requesters',
        labelKey: 'fullName',
        filter: (row) => row['management'] === true,
      },
      hint: 'Uno o più membri della direzione (si indicano in Richiedenti › "Fa parte della direzione")',
    },
    {
      key: 'status',
      label: 'Stato',
      type: 'select',
      required: true,
      defaultValue: 'TO_DISCUSS',
      options: { static: TOPIC_STATUS_OPTIONS },
    },
    {
      key: 'postponedUntil',
      label: 'Riproponi dal',
      type: 'date',
      required: true,
      visibleWhen: (value) => value['status'] === 'POSTPONED',
      hint: 'Da questa data torna nell’agenda',
    },
    {
      key: 'priorityLevelId',
      label: 'Priorità',
      type: 'select',
      options: { endpoint: '/lookups/priority-levels', labelKey: priorityLabel },
    },
    {
      key: 'dueDate',
      label: 'Scadenza',
      type: 'date',
      hint: 'Entro quando va risolto o deciso',
    },
    {
      key: 'ownerResourceId',
      label: 'Owner',
      type: 'select',
      options: { endpoint: '/resources', labelKey: 'fullName' },
    },
    {
      key: 'projectId',
      label: 'Progetto collegato',
      type: 'select',
      options: { endpoint: '/projects', labelKey: projectLabel },
    },
    {
      key: 'notes',
      label: 'Note',
      type: 'textarea',
      maxLength: 10000,
      hint: 'Contesto, numeri, cosa chiedi alla direzione',
    },
    {
      key: 'decision',
      label: 'Decisione',
      type: 'textarea',
      maxLength: 10000,
      hint: 'Cosa si è deciso e, se serve, chi l’ha deciso',
    },
  ],
  columns: [
    { key: 'title', label: 'Titolo', primary: true, clamp: true },
    { key: 'audienceNames', label: 'Rivolto a', type: 'list' },
    { key: 'topicTypeLabel', label: 'Tipo' },
    { key: 'statusLabel', label: 'Stato' },
    { key: 'priorityLevel', label: 'Priorità', type: 'number' },
    {
      key: 'dueDate',
      label: 'Scadenza',
      format: (value, row) =>
        value
          ? `${new Intl.DateTimeFormat('it-IT').format(new Date(`${String(value)}T00:00:00`))}${row['overdue'] ? ' · scaduto' : ''}`
          : '',
    },
    { key: 'createdOn', label: 'Creato il', type: 'date', hideOnMobile: true },
    { key: 'ownerName', label: 'Owner' },
    { key: 'postponedUntil', label: 'Riproponi dal', type: 'date', hideOnMobile: true },
    { key: 'deferralCount', label: 'Rinvii', type: 'number', hideOnMobile: true },
    { key: 'openActionCount', label: 'Azioni aperte', type: 'number', hideOnMobile: true },
    { key: 'lastDiscussedOn', label: 'Ultima riunione', type: 'date', hideOnMobile: true },
    { key: 'projectCode', label: 'Progetto', defaultHidden: true },
    { key: 'notes', label: 'Note', clamp: true, defaultHidden: true },
    { key: 'decision', label: 'Decisione', clamp: true, defaultHidden: true },
    { key: 'closedOn', label: 'Chiuso il', type: 'date', defaultHidden: true },
  ],
};

/** Azioni nate dai punti: chi fa cosa entro quando. */
export const ACTIONS_CONFIG: EntityConfig = {
  title: 'Azioni',
  singular: 'Azione',
  endpoint: '/management/actions',
  writeRoles: MANAGEMENT_WRITE_ROLES,
  canDelete: true,
  searchKeys: ['description', 'topicTitle', 'ownerName'],
  quickFilters: [{ key: 'ownerName', label: 'Chi' }],
  sort: (a, b) =>
    Number(a['done']) - Number(b['done']) ||
    String(a['dueDate'] ?? '9999').localeCompare(String(b['dueDate'] ?? '9999')) ||
    Number(a.id) - Number(b.id),
  fields: [
    {
      key: 'topicId',
      label: 'Punto',
      type: 'select',
      required: true,
      fullWidth: true,
      options: {
        endpoint: '/management/topics',
        labelKey: 'title',
        filter: (row) => row['status'] !== 'CLOSED' && row['status'] !== 'CANCELLED',
      },
    },
    {
      key: 'description',
      label: 'Cosa fare',
      type: 'text',
      required: true,
      maxLength: 500,
      fullWidth: true,
    },
    {
      key: 'ownerResourceId',
      label: 'Chi',
      type: 'select',
      options: { endpoint: '/resources', labelKey: 'fullName' },
    },
    { key: 'dueDate', label: 'Entro', type: 'date' },
    {
      key: 'done',
      label: 'Fatta',
      type: 'checkbox',
      hint: 'Quando l’ultima azione di un punto discusso è fatta, il punto si chiude',
    },
  ],
  columns: [
    { key: 'description', label: 'Cosa fare', primary: true, clamp: true },
    { key: 'topicTitle', label: 'Punto', clamp: true },
    { key: 'ownerName', label: 'Chi' },
    { key: 'dueDate', label: 'Entro', type: 'date' },
    { key: 'overdue', label: 'In ritardo', type: 'boolean' },
    { key: 'done', label: 'Fatta', type: 'boolean' },
    { key: 'doneOn', label: 'Fatta il', type: 'date', defaultHidden: true },
    { key: 'meetingDate', label: 'Decisa in riunione del', type: 'date', defaultHidden: true },
  ],
};

/** Riunioni con la direzione: si creano con "Inizia riunione", si aprono per marcare i punti. */
export const MEETINGS_CONFIG: EntityConfig = {
  title: 'Riunioni',
  singular: 'Riunione',
  endpoint: '/management/meetings',
  writeRoles: MANAGEMENT_WRITE_ROLES,
  canCreate: false,
  canDelete: true,
  searchKeys: ['title', 'notes'],
  rowLink: (row) => ['/management/meetings', row.id!],
  fields: [
    { key: 'meetingDate', label: 'Data', type: 'date', required: true },
    { key: 'title', label: 'Titolo', type: 'text', maxLength: 200 },
    { key: 'notes', label: 'Note', type: 'textarea', maxLength: 10000 },
  ],
  columns: [
    { key: 'meetingDate', label: 'Data', type: 'date', primary: true },
    { key: 'title', label: 'Titolo' },
    { key: 'statusLabel', label: 'Stato' },
    { key: 'itemCount', label: 'Punti', type: 'number' },
    { key: 'handledCount', label: 'Trattati', type: 'number' },
    { key: 'closedCount', label: 'Chiusi', type: 'number' },
    { key: 'deferredCount', label: 'Rinviati', type: 'number' },
  ],
};
