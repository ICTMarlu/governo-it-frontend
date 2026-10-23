/**
 * Permessi per modulo (D-33). Ogni utente ha un livello per modulo, dato dal suo profilo e dalle
 * eccezioni; li applica il backend, qui servono a mostrare solo ciò che l'utente può usare.
 */
export type AccessLevel = 'NONE' | 'VIEW' | 'EDIT';

export type ModuleKey =
  | 'PROJECTS'
  | 'PLAN'
  | 'TASKS'
  | 'TICKETS'
  | 'MANAGEMENT'
  | 'RESOURCES'
  | 'REQUESTERS'
  | 'MASTER_DATA'
  | 'TECHNOLOGY'
  | 'USERS';

export const LEVELS: readonly AccessLevel[] = ['NONE', 'VIEW', 'EDIT'];

export const LEVEL_LABELS: Readonly<Record<AccessLevel, string>> = {
  NONE: 'Nascosto',
  VIEW: 'Vista',
  EDIT: 'Modifica',
};

export const LEVEL_ICONS: Readonly<Record<AccessLevel, string>> = {
  NONE: 'visibility_off',
  VIEW: 'visibility',
  EDIT: 'edit',
};

export interface ModuleInfo {
  readonly key: ModuleKey;
  readonly label: string;
  readonly icon: string;
  /** Gruppo nella schermata dei permessi, come nel menu. */
  readonly group: string;
  readonly hint: string;
}

/** I moduli, nell'ordine del menu. */
export const MODULES: readonly ModuleInfo[] = [
  {
    key: 'PROJECTS',
    label: 'Progetti',
    icon: 'work',
    group: 'Operatività',
    hint: 'Elenco, schede e commenti dei progetti',
  },
  {
    key: 'PLAN',
    label: 'Piano settimanale',
    icon: 'calendar_view_week',
    group: 'Operatività',
    hint: 'Griglia delle giornate per persona e progetto',
  },
  {
    key: 'TASKS',
    label: 'Task',
    icon: 'task_alt',
    group: 'Operatività',
    hint: 'Task e promemoria',
  },
  {
    key: 'TICKETS',
    label: 'Ticket AMS',
    icon: 'support_agent',
    group: 'Operatività',
    hint: 'Ticket Jira: operativa, analisi ed elenchi',
  },
  {
    key: 'MANAGEMENT',
    label: 'Direzione',
    icon: 'record_voice_over',
    group: 'Direzione',
    hint: 'Punti, azioni e riunioni di direzione',
  },
  {
    key: 'RESOURCES',
    label: 'Risorse',
    icon: 'groups',
    group: 'Anagrafiche',
    hint: 'Persone del team, capacità e tariffe',
  },
  {
    key: 'REQUESTERS',
    label: 'Richiedenti',
    icon: 'contact_mail',
    group: 'Anagrafiche',
    hint: 'Referenti e membri della direzione',
  },
  {
    key: 'TECHNOLOGY',
    label: 'Sistemi e tecnologie',
    icon: 'memory',
    group: 'Anagrafiche',
    hint: 'Tecnologie in uso, fine supporto e vulnerabilità',
  },
  {
    key: 'MASTER_DATA',
    label: 'Liste e tabelle',
    icon: 'tune',
    group: 'Anagrafiche',
    hint: 'Società, fornitori, sedi, calendari, liste valori',
  },
  {
    key: 'USERS',
    label: 'Utenti e permessi',
    icon: 'manage_accounts',
    group: 'Amministrazione',
    hint: 'Utenti, profili e permessi',
  },
];

export type Permissions = Readonly<Partial<Record<string, string>>>;

function levelIn(permissions: Permissions | undefined | null, module: ModuleKey): AccessLevel {
  const level = permissions?.[module];
  return level === 'VIEW' || level === 'EDIT' ? level : 'NONE';
}

export function canView(permissions: Permissions | undefined | null, module: ModuleKey): boolean {
  return levelIn(permissions, module) !== 'NONE';
}

export function canEdit(permissions: Permissions | undefined | null, module: ModuleKey): boolean {
  return levelIn(permissions, module) === 'EDIT';
}

/** Modulo a cui appartiene un'anagrafica, dal suo indirizzo API (es. /resources/3/rates → RESOURCES). */
export function moduleOfEndpoint(endpoint: string): ModuleKey | null {
  const base = endpoint.replace(/^\//, '').split('/')[0];
  switch (base) {
    case 'projects':
      return 'PROJECTS';
    case 'resources':
      return 'RESOURCES';
    case 'requesters':
      return 'REQUESTERS';
    case 'management':
      return 'MANAGEMENT';
    case 'users':
    case 'permissions':
      return 'USERS';
    case 'technologies':
    case 'vulnerabilities':
      return 'TECHNOLOGY';
    case 'lookups':
    case 'legal-entities':
    case 'vendors':
    case 'sites':
    case 'holiday-calendars':
    case 'project-codes':
    case 'parameters':
      return 'MASTER_DATA';
    default:
      return null;
  }
}
