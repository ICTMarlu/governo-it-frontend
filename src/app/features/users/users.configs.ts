import { EntityConfig, ROLES } from '../../shared/crud/crud.model';
import { USERS_HELP } from '../../shared/help/help-content';

const DATE_TIME = new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' });

/** Utenti e ruoli applicativi (ADM-01, MD-03): pagina riservata all'Admin. */
export const USERS_CONFIG: EntityConfig = {
  title: 'Utenti',
  singular: 'Utente',
  subtitle:
    'Accessi all’applicazione: profilo, permesso sui costi e collegamento alla risorsa del team. Cosa vede e modifica ognuno si imposta nelle schede Permessi e Profili. In fase 2 il login passerà a Microsoft.',
  endpoint: '/users',
  canDelete: true,
  help: USERS_HELP,
  writeRoles: [ROLES.admin],
  searchKeys: ['displayName', 'username', 'email', 'resourceName'],
  quickFilters: [{ key: 'roleLabel', label: 'Profilo' }],
  fields: [
    {
      key: 'username',
      label: 'Nome utente',
      type: 'text',
      required: true,
      maxLength: 100,
      pattern: {
        regex: '^[a-zA-Z0-9._-]{3,100}$',
        message: 'Da 3 caratteri: lettere, numeri, punto, trattino e _',
      },
      hint: 'Es. mario.rossi',
    },
    {
      key: 'displayName',
      label: 'Nome visualizzato',
      type: 'text',
      required: true,
      maxLength: 150,
    },
    { key: 'email', label: 'E-mail', type: 'text', maxLength: 200 },
    {
      key: 'appRoleId',
      label: 'Profilo',
      type: 'select',
      required: true,
      options: { endpoint: '/users/roles', activeOnly: false },
      hint: 'Dà i livelli di partenza per modulo; per singole eccezioni usa la scheda Permessi',
    },
    {
      key: 'resourceId',
      label: 'Risorsa del team',
      type: 'select',
      options: { endpoint: '/resources', labelKey: 'fullName' },
      hint: 'Vuoto per chi non è nel team (es. direzione)',
    },
    {
      key: 'password',
      label: 'Password',
      type: 'password',
      requiredOnCreate: true,
      maxLength: 100,
      pattern: { regex: '^.{10,}$', message: 'Almeno 10 caratteri' },
      hint: 'In modifica lascia vuoto per non cambiarla',
    },
    {
      key: 'canViewCosts',
      label: 'Può vedere tariffe e costi',
      type: 'checkbox',
      hint: 'Permesso separato dal ruolo (FIN-04)',
    },
    { key: 'active', label: 'Attivo', type: 'checkbox', defaultValue: true },
  ],
  columns: [
    { key: 'displayName', label: 'Nome', primary: true },
    { key: 'username', label: 'Utente' },
    { key: 'roleLabel', label: 'Profilo' },
    { key: 'canViewCosts', label: 'Costi', type: 'boolean' },
    { key: 'resourceName', label: 'Risorsa', hideOnMobile: true },
    {
      key: 'lastLoginAt',
      label: 'Ultimo accesso',
      hideOnMobile: true,
      format: (value) => (value ? DATE_TIME.format(new Date(String(value))) : 'mai'),
    },
    { key: 'active', label: 'Attivo', type: 'boolean', hideOnMobile: true },
  ],
};
