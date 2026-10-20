import { HelpContent, HelpSection } from './help.model';

/**
 * Testi delle guide di pagina, tutti in un unico file per poterli rileggere e correggere
 * facilmente. Le regole di calcolo devono restare allineate a docs/05-database-sqlserver.md.
 */

/** Funzioni comuni a ogni elenco (ricerca, filtri, ordinamento, colonne). */
export const LIST_SECTION: HelpSection = {
  title: 'Come usare l’elenco',
  items: [
    'Cerca: filtra le righe mentre scrivi.',
    'Filtri: in ogni filtro puoi spuntare più valori insieme, come in Excel; "Azzera filtri" li toglie tutti.',
    'Ordinamento: clicca l’intestazione di una colonna per ordinare in modo crescente, di nuovo per decrescente. Su telefono usa la tendina "Ordina per".',
    'Colonne: scegli quali colonne vedere e trascinale per cambiarne l’ordine. La scelta è salvata per il tuo utente e la ritrovi su ogni dispositivo.',
    'Il pulsante di modifica e quello di creazione compaiono solo se il tuo ruolo lo consente.',
  ],
};

const PERMISSIONS_ADMIN: HelpSection = {
  title: 'Chi può modificare',
  items: ['Solo gli amministratori; gli altri utenti vedono i dati in sola lettura.'],
};

export const HOME_HELP: HelpContent = {
  title: 'Home',
  intro: 'Punto di partenza dell’applicazione: dal menu arrivi a progetti, risorse e anagrafiche.',
  sections: [
    {
      title: 'Navigazione',
      items: [
        'Il menu mostra solo le voci consentite al tuo ruolo (es. "Utenti" solo agli amministratori).',
        'Con il pulsante a forma di chiave in alto cambi la tua password.',
        'In ogni pagina il pulsante "Guida" spiega funzioni e calcoli della pagina.',
      ],
    },
  ],
};

export const PROJECTS_HELP: HelpContent = {
  title: 'Progetti',
  intro:
    'Portafoglio IT con tutti i progetti, di ogni tipo e stato. Clicca il nome di un progetto per aprirne il dettaglio.',
  sections: [
    LIST_SECTION,
    {
      title: 'Regole dei dati',
      items: [
        'Tipi ammessi: Project, AMS, Continuous e Admin (Task ed Emergenza non sono tipi di progetto).',
        'Per un Project sono obbligatori almeno un owner e la priorità IT; per gli altri tipi sono facoltativi.',
        'Un progetto "di tutto il gruppo" non ha società specifiche: o il flag, o le società.',
        'La fine pianificata non può essere prima dell’inizio.',
      ],
    },
    {
      title: 'Codice progetto',
      items: [
        'Formato: ICT + anno a 2 cifre + codice breve del sistema + numero a 3 cifre (es. ICT26ERP118).',
        'Il codice è assegnato in automatico al primo salvataggio, solo se il sistema ha il codice breve; poi non cambia più.',
        'Se il sistema non ha il codice breve il progetto resta senza codice: si recupera da Anagrafiche › Codici progetto.',
      ],
    },
    {
      title: 'Ordinamenti particolari',
      items: [
        'Stato e Tipo si ordinano secondo il campo "Ordine" delle rispettive liste valori, non in ordine alfabetico.',
      ],
    },
    {
      title: 'Chi può modificare',
      items: ['Admin, Project Manager ed Editor.'],
    },
  ],
};

export const PROJECT_DETAIL_HELP: HelpContent = {
  title: 'Dettaglio progetto',
  intro: 'Scheda completa del progetto con la descrizione e la bacheca dei commenti.',
  sections: [
    {
      title: 'Funzioni',
      items: [
        '"Modifica" apre il modulo del progetto (se il tuo ruolo lo consente).',
        'La descrizione si modifica dallo stesso modulo.',
        '"Torna indietro" riporta all’elenco dei progetti.',
      ],
    },
    {
      title: 'Bacheca commenti',
      items: [
        'Ogni utente può scrivere un commento o rispondere a un commento (un solo livello di risposta).',
        'Scrivi @ seguito dal nome per citare una persona del team: scegli il nome dalla tendina.',
        'Puoi modificare solo i tuoi commenti; li elimina l’autore o un amministratore.',
        'Un commento eliminato resta come "commento eliminato" per non perdere il filo della discussione.',
      ],
    },
  ],
};

export const RESOURCES_HELP: HelpContent = {
  title: 'Risorse',
  intro:
    'Persone del team IT: interni, consulenti e fornitori. Apri una risorsa per gestirne capacità, ore extra e tariffe.',
  sections: [
    LIST_SECTION,
    {
      title: 'Chi può modificare',
      items: ['Admin e Project Manager.'],
    },
  ],
};

export const RESOURCE_DETAIL_HELP: HelpContent = {
  title: 'Dettaglio risorsa',
  intro:
    'Dati della risorsa e i valori nel tempo che servono a calcolare la sua capacità nel piano settimanale.',
  sections: [
    {
      title: 'Capacità',
      items: [
        'Ogni riga vale da "Dal" ad "Al" (vuoto = ancora valida). I periodi non possono sovrapporsi.',
        '1 giornata = 7,5 ore.',
        'Capacità settimanale (giornate) = giorni lavorativi a settimana × ore al giorno ÷ 7,5 + ore extra ÷ 7,5.',
        'Esempio: 5 giorni da 7,5 ore + 1 ora extra = 5 + 0,13 = 5,13 giornate.',
        'Riserva emergenze: percentuale di capacità tenuta libera per le urgenze; si calcola anche sulle ore extra.',
        'Quota AMS attesa: giornate a settimana che si prevede di dedicare all’AMS (informativa).',
      ],
    },
    {
      title: 'Ore extra',
      items: [
        'Funzionano "a gradini": ogni riga vale dalla sua data fino alla riga successiva.',
        'Per chiudere l’extra inserisci una nuova riga con 0 ore (es. dal 1° marzo, 0).',
        'Per ogni settimana vale la riga con la data più recente non successiva al lunedì; nessuna riga = 0.',
        'L’extra vale sempre per intero, anche nelle settimane con ferie o festività.',
        'Non possono esserci due righe con la stessa data.',
      ],
    },
    {
      title: 'Tariffe',
      items: [
        'Tariffa giornaliera per periodo (vuoto in "Al" = ancora valida); i periodi non possono sovrapporsi.',
        'Visibili e modificabili solo da chi ha il permesso sui costi.',
      ],
    },
    {
      title: 'Chi può modificare',
      items: ['Admin e Project Manager (le tariffe richiedono anche il permesso sui costi).'],
    },
  ],
};

export const REQUESTERS_HELP: HelpContent = {
  title: 'Richiedenti',
  intro: 'Persone del business che chiedono i progetti, con dipartimento, azienda e ruolo.',
  sections: [
    LIST_SECTION,
    {
      title: 'Chi può modificare',
      items: ['Admin, Project Manager ed Editor.'],
    },
  ],
};

export const MASTER_DATA_HELP: HelpContent = {
  title: 'Anagrafiche e liste',
  intro:
    'Raccolta dei dati di base usati da progetti e risorse. Apri un riquadro per vederne e modificarne i valori.',
  sections: [
    {
      title: 'Cosa trovi',
      items: [
        'Liste valori: tipi di progetto, stati, sistemi, priorità, stream, Capex/Opex, aree aziendali, ruoli nel team.',
        'Anagrafiche di base: società del gruppo, fornitori, sedi, calendari festività.',
        'Codici progetto: contatore dei codici e codice breve di ogni sistema.',
        'In ogni pagina interna il pulsante "Torna indietro" riporta qui.',
      ],
    },
    PERMISSIONS_ADMIN,
  ],
};

/** Guida di una lista valori: regole comuni più quelle proprie della lista. */
export function lookupHelp(
  title: string,
  intro: string,
  rules: readonly string[] = [],
): HelpContent {
  return {
    title,
    intro,
    sections: [
      LIST_SECTION,
      {
        title: 'Regole',
        items: [
          'Il campo "Ordine" decide la posizione del valore nelle tendine e negli ordinamenti dell’elenco progetti.',
          'Un valore non attivo non si può più scegliere, ma resta sui dati che già lo usano.',
          ...rules,
        ],
      },
      PERMISSIONS_ADMIN,
    ],
  };
}

export const LOOKUP_RULES: Readonly<Record<string, readonly string[]>> = {
  'work-types': [
    'Valori fissi: non se ne aggiungono di nuovi.',
    'Solo i valori con "Tipo di progetto" (Project, AMS, Continuous, Admin) si possono usare sui progetti.',
    'Admin comprende tutte le attività non produttive, comprese ferie e festività.',
  ],
  'project-statuses': [
    'Gli stati finali (es. Completed, Rejected, Aborted) escludono il progetto dal carico futuro.',
    '"Conta per la % di avanzamento" indica se lo stato rientra nel calcolo dell’avanzamento.',
  ],
  'main-systems': [
    'Il codice breve (2-5 lettere o numeri) entra nel codice progetto: ICT + anno + codice breve + numero.',
    'Senza codice breve i progetti del sistema restano senza codice.',
    '"Prossimo codice" è il codice che riceverà il prossimo progetto di quel sistema.',
  ],
  'priority-levels': [
    '1 = la più importante, 2 = importante, 3 = posticipabile, 4 = nice to have.',
  ],
};

export const LEGAL_ENTITIES_HELP: HelpContent = {
  title: 'Società del gruppo',
  intro: 'Società a cui si riferiscono i progetti.',
  sections: [
    LIST_SECTION,
    {
      title: 'Regole',
      items: [
        'Per un progetto che riguarda tutto il gruppo non si scelgono società: si usa il flag "Tutto il gruppo" sul progetto.',
      ],
    },
    PERMISSIONS_ADMIN,
  ],
};

export const VENDORS_HELP: HelpContent = {
  title: 'Fornitori',
  intro:
    'Fornitori e società di consulenza a cui appartengono le risorse esterne. "Marlu IT" è il fornitore interno.',
  sections: [LIST_SECTION, PERMISSIONS_ADMIN],
};

export const SITES_HELP: HelpContent = {
  title: 'Sedi',
  intro: 'Sedi di lavoro delle risorse. Ogni sede usa un calendario festività.',
  sections: [
    LIST_SECTION,
    {
      title: 'Regole',
      items: [
        'Le festività del calendario della sede valgono per tutte le risorse di quella sede.',
      ],
    },
    PERMISSIONS_ADMIN,
  ],
};

export const HOLIDAY_CALENDARS_HELP: HelpContent = {
  title: 'Calendari festività',
  intro:
    'Calendari delle festività per sede. Clicca un calendario per vederne e modificarne le date.',
  sections: [
    {
      title: 'Come vengono usate le festività',
      items: [
        'Nel piano settimanale la riga Admin "Festività" si compilerà in automatico per ogni risorsa.',
        'Solo le festività da lunedì a venerdì contano; quelle nel weekend non tolgono nulla.',
        'Ogni festività vale le ore giornaliere della risorsa ÷ 7,5 giornate (es. 7,5 ore = 1 giornata, 4 ore = 0,53 giornate) e riduce così la capacità disponibile della settimana.',
        'Le ferie restano invece una riga da compilare a mano per ogni risorsa.',
      ],
    },
    PERMISSIONS_ADMIN,
  ],
};

export const HOLIDAYS_HELP: HelpContent = {
  title: 'Festività',
  intro: 'Date delle festività del calendario. Le date caricate vanno verificate ogni anno.',
  sections: [
    LIST_SECTION,
    HOLIDAY_CALENDARS_HELP.sections[0],
    {
      title: 'Funzioni',
      items: [
        'Il filtro "Anno" mostra le festività di uno o più anni.',
        'La colonna del giorno della settimana aiuta a vedere quali festività cadono nel weekend.',
      ],
    },
    PERMISSIONS_ADMIN,
  ],
};

export const PROJECT_CODES_HELP: HelpContent = {
  title: 'Codici progetto',
  intro: 'Gestione del contatore che numera i progetti e del codice breve di ogni sistema.',
  sections: [
    {
      title: 'Come si forma il codice',
      items: [
        'ICT + anno a 2 cifre + codice breve del sistema + numero a 3 cifre. Esempio: ICT26ERP118.',
        'Il numero è unico per tutti i sistemi: se l’ultimo progetto è ICT26BI117, il prossimo ERP sarà ICT26ERP118.',
        'Il contatore riparte da 001 ogni anno.',
        'I numeri già usati da altri progetti vengono saltati, quindi non si creano mai doppioni.',
      ],
    },
    {
      title: 'Contatore',
      items: [
        '"Ultimo numero usato" è l’ultimo numero assegnato quest’anno; il prossimo progetto riceve quello successivo.',
        'Puoi correggerlo per allinearti a codici già in uso fuori dall’applicazione (es. nell’Excel).',
      ],
    },
    {
      title: 'Codice breve dei sistemi',
      items: [
        'Ogni sistema ha un codice breve di 2-5 lettere o numeri (es. ERP, BI, AI). Due sistemi non possono avere lo stesso codice.',
        'Finché un sistema non ha il codice breve, i suoi progetti restano senza codice.',
        'Puoi impostarlo direttamente nella scheda del sistema in questa pagina e premere "Salva".',
      ],
    },
    {
      title: 'Pulsante "Assegna codici mancanti"',
      items: [
        'Cerca tutti i progetti senza codice il cui sistema ha il codice breve.',
        'Li numera in ordine di numero storico dell’Excel, continuando dal contatore.',
        'I progetti dei sistemi senza codice breve vengono saltati: imposta il codice breve e premi di nuovo il pulsante.',
        'I codici già assegnati non cambiano mai. Al termine un riepilogo indica quanti codici sono stati assegnati.',
      ],
    },
    PERMISSIONS_ADMIN,
  ],
};

export const USERS_HELP: HelpContent = {
  title: 'Utenti',
  intro: 'Accessi all’applicazione, ruoli e permessi. Pagina riservata agli amministratori.',
  sections: [
    LIST_SECTION,
    {
      title: 'Ruoli',
      items: [
        'Admin: modifica tutto, compresi utenti, liste valori, anagrafiche di base, codici progetto e festività.',
        'Project Manager: risorse (con capacità e ore extra), progetti e richiedenti.',
        'Editor: progetti e richiedenti.',
        'Contributor: solo ciò che gli è assegnato (piano settimanale e task, in arrivo); oggi sola lettura.',
        'Viewer: sola lettura (es. direzione).',
        'Permesso costi: separato dal ruolo, permette di vedere e modificare le tariffe.',
      ],
    },
    {
      title: 'Regole di sicurezza',
      items: [
        'La password deve avere almeno 10 caratteri; in modifica lasciala vuota per non cambiarla.',
        'Non puoi disattivare il tuo utente né toglierti il ruolo Admin.',
        'Deve restare sempre almeno un amministratore attivo.',
        '"Risorsa del team" collega l’utente alla persona del piano (vuoto per chi non è nel team).',
      ],
    },
  ],
};
