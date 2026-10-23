import { ModuleKey } from '../auth/permissions';

/**
 * Anagrafiche raggiungibili dal menu "Anagrafiche" e dalla loro home. Per aggiungerne una
 * (es. Telefonia, Licenze, Policy) basta una riga qui: compare nel menu e nella home.
 */
export interface AnagraficaEntry {
  readonly label: string;
  readonly hint: string;
  readonly icon: string;
  readonly route: string;
  /** Modulo che deve essere visibile all'utente per vedere la voce. */
  readonly module: ModuleKey;
}

export const ANAGRAFICHE: readonly AnagraficaEntry[] = [
  {
    label: 'Risorse',
    hint: 'Persone del team: capacità, sedi, competenze',
    icon: 'groups',
    route: '/resources',
    module: 'RESOURCES',
  },
  {
    label: 'Richiedenti',
    hint: 'Chi chiede: referenti e membri della direzione',
    icon: 'contact_mail',
    route: '/requesters',
    module: 'REQUESTERS',
  },
  {
    label: 'Sistemi e tecnologie',
    hint: 'Cosa si usa, versioni, fine supporto e vulnerabilità: cosa è urgente e cosa si pianifica',
    icon: 'memory',
    route: '/technologies',
    module: 'TECHNOLOGY',
  },
  {
    label: 'Liste e tabelle',
    hint: 'Società, fornitori, sedi, calendari, codici progetto e liste valori (stati, priorità, sistemi…)',
    icon: 'tune',
    route: '/master-data',
    module: 'MASTER_DATA',
  },
];
