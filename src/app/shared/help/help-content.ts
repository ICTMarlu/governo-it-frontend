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
    'Viste salvate: con "Vista" salvi con un nome filtri, colonne e ordinamento attuali e li richiami dal menu; una vista può essere la predefinita e si apre da sola. Il pallino accanto al nome dice che hai cambiato qualcosa: "Aggiorna" la salva. "Vista standard" torna ai filtri di partenza. Le viste sono tue, per ogni pagina.',
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
  'task-statuses': [
    'Ogni stato attivo è una colonna del kanban nella pagina Task, nell’ordine indicato.',
    'Gli stati finali (es. Fatto, Annullato) chiudono il task: esce dai promemoria e dai pallini dei task aperti nel piano.',
    'I task nuovi partono dal primo stato aperto; la spunta "fatto" usa lo stato finale con codice DONE (o il primo finale).',
    'Uno stato non si cancella: si disattiva, e i task che lo hanno lo mantengono.',
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

export const MANAGEMENT_HELP: HelpContent = {
  title: 'Direzione',
  intro:
    'La lista viva di quello che devi portare alla direzione: la riempi quando ti viene in mente e la usi durante l’incontro.',
  sections: [
    {
      title: 'Inserimento veloce',
      items: [
        'Scrivi il titolo nel campo "Nuovo punto", scegli il tipo (Argomento, Task, Roadblock, Decisione richiesta) e premi Invio.',
        'Il punto nasce "Da discutere" con la data di oggi ("Creato il"). Il resto lo aggiungi dopo, solo se serve: clicca il titolo del punto (o la matita) per aprirlo e modificarlo.',
        '"Rivolto a": uno o più membri della direzione (oggi Morena, Monica e Marta). Chi compare nell’elenco si decide in Anagrafiche › Richiedenti con "Fa parte della direzione".',
        '"Scadenza": entro quando va risolto o deciso; se passa e il punto è ancora aperto, nella colonna compare "scaduto".',
        'Nell’elenco puoi filtrare per "Rivolto a" e scegliere le colonne con "Colonne".',
      ],
    },
    {
      title: 'Stati del punto',
      items: [
        'Da discutere: entra nella prossima agenda.',
        'Posticipato: torna in agenda dalla data "Riproponi dal".',
        'Discusso, in corso: se n’è parlato e ci sono azioni da seguire; torna in agenda come aggiornamento.',
        'Chiuso: risolto o deciso. Annullato: non serve più.',
        '"Rinvii" conta le volte in cui il punto è stato posticipato o non discusso: da 2 rinvii in su viene evidenziato, perché va deciso, riassegnato o annullato.',
        'Si può eliminare solo un punto mai portato in riunione e senza azioni; altrimenti si annulla, così lo storico resta.',
      ],
    },
    {
      title: 'Azioni',
      items: [
        'Chi fa cosa entro quando, collegate a un punto. Le aggiungi in riunione o dalla scheda Azioni.',
        'Quando l’ultima azione aperta di un punto "Discusso, in corso" è fatta, il punto si chiude da solo.',
        'Le azioni scadute sono segnalate "in ritardo".',
      ],
    },
    {
      title: 'Prima e durante l’incontro',
      items: [
        '"Agenda" mostra cosa porterai oggi: prima gli aggiornamenti sulle azioni, poi i punti da discutere per priorità. Copiala in una mail o stampala.',
        '"Inizia riunione" crea la riunione con l’agenda già pronta e la apre in modalità riunione.',
      ],
    },
    LIST_SECTION,
    {
      title: 'Chi può modificare',
      items: [
        'Admin e Project Manager gestiscono punti e azioni; le riunioni (agenda, inizio, esito) sono solo dell’Admin.',
        'Chi vede cosa: l’Admin vede tutto. Gli altri vedono solo i punti di cui sono owner e le azioni assegnate a loro o nate dai loro punti; serve che il loro utente sia collegato a una persona del team (Utenti › Risorsa).',
        'Gli altri ruoli non vedono questa pagina.',
      ],
    },
  ],
};

export const MEETING_HELP: HelpContent = {
  title: 'Riunione',
  intro: 'Modalità riunione: per ogni punto un clic sull’esito. Tutto si salva subito.',
  sections: [
    {
      title: 'Esito di un punto',
      items: [
        'Discusso: il punto passa a "Discusso, in corso" e torna nella prossima agenda come aggiornamento finché ha azioni aperte o finché non lo chiudi.',
        'Posticipa: scegli "Alla prossima riunione" oppure una data da cui riproporlo.',
        'Non discusso: non c’è stato tempo, resta da discutere e il contatore dei rinvii sale.',
        'Chiudi: il punto si chiude con la data della riunione; se non ha una decisione prende le note della discussione.',
        '"Annulla esito" toglie la scelta fatta per errore.',
      ],
    },
    {
      title: 'Note, decisioni e azioni',
      items: [
        'Le note della discussione e la decisione si salvano quando esci dal campo.',
        '"Aggiungi azione": cosa fare, chi ed entro quando; spunta l’azione quando è fatta.',
      ],
    },
    {
      title: 'Agenda e chiusura',
      items: [
        'L’agenda si compone da sola alla creazione; puoi aggiungere altri punti aperti, toglierli (finché non hanno un esito) e cambiarne l’ordine con le frecce.',
        '"Chiudi riunione" segna come non discussi i punti rimasti, che restano nella prossima agenda. Puoi riaprirla per correggere.',
        '"Riepilogo" prepara il testo con decisioni, discussi, posticipati, non discussi e azioni, da copiare in una mail o stampare in PDF.',
      ],
    },
  ],
};

export const PLAN_HELP: HelpContent = {
  title: 'Piano settimanale',
  intro:
    'Le giornate di ogni persona su ogni progetto, settimana per settimana, come nel foglio Plan dell’Excel. Ogni cella si salva da sola.',
  sections: [
    {
      title: 'Inserire le giornate',
      items: [
        'Clicca una cella e scrivi le giornate (anche 0,1, 0,25 o 1,5; al massimo 7). Si salva quando esci dalla cella; vuota o 0 la svuota.',
        'Invio e frecce su/giù passano alla riga sotto o sopra nella stessa settimana; Tab passa alla settimana successiva.',
        'Nota sulla cella (al posto dei commenti di Excel): tasto destro sulla cella oppure Alt+N. Un triangolino nell’angolo indica che c’è una nota; passaci sopra per leggerla.',
        'Riempi intervallo: dal menu ⋮ della riga scegli le settimane di inizio e fine e le giornate; vengono scritte su tutte. Con 0 svuoti le settimane (le note restano).',
        'Incolla da Excel: copia un blocco di celle in Excel (anche più righe e colonne) e incollalo con Ctrl+V in una cella: riempie le settimane a destra e le righe sotto, partendo da quella cella. I valori fuori griglia o non numerici vengono saltati e te lo dice un messaggio.',
      ],
    },
    {
      title: 'Righe',
      items: [
        'Ogni riga è una persona su un progetto, con una nota del momento (la "Project Description" dell’Excel). Lo stesso progetto può avere più righe con note diverse.',
        'Aggiunta veloce: in fondo alle righe di ogni persona c’è "Aggiungi progetto…". Scrivi parte del codice o del nome, scegli con le frecce e Invio: la riga nasce subito e il cursore va sulla settimana corrente, pronto per le giornate.',
        'In alternativa "Riga" in alto o il + accanto al nome aprono la finestra completa (persona, progetto, nota).',
        'La nota della riga si scrive direttamente nella colonna Nota, come in Excel: si salva con Invio o uscendo dalla cella; Esc annulla.',
        'Ferie: ogni persona ha sempre la sua riga, anche vuota; scrivi lì i giorni di ferie.',
        'Festività: riga calcolata dal calendario della sede della persona, non si modifica. Ogni festività da lunedì a venerdì vale le ore giornaliere della persona ÷ 7,5 (7,5 ore = 1 giornata). Il calendario si corregge da Anagrafiche › Calendari festività.',
        'Archivia una riga quando il lavoro è finito: sparisce dal piano ma le giornate restano. Si può eliminare solo una riga senza giornate.',
      ],
    },
    {
      title: 'Capacità e saturazione',
      items: [
        'Caricato della settimana = tutte le righe della persona (progetti, AMS, Continuous, Admin, ferie) + festività.',
        'Capacità = giorni lavorativi × ore al giorno ÷ 7,5 + ore extra ÷ 7,5, con i valori validi al lunedì (scheda della risorsa).',
        'Saturazione = caricato ÷ capacità: verde sotto il 90%, giallo dal 90% al 100%, rosso oltre il 100%.',
        'La riserva emergenze e la quota AMS della risorsa non entrano nel calcolo.',
        'In ogni riga: codice, progetto e le colonne scelte con "Colonne" (pulsante nella barra o icona nell’angolo in alto a sinistra della griglia): di partenza stato (con il colore della lista valori), priorità IT, sistema e nota; puoi aggiungere priorità business, tipo, owner e richiesto da, e cambiarne l’ordine trascinandole. La scelta resta salvata per il tuo utente. Poi "Tot", fisso e non cambia scorrendo: per i Project il totale di tutte le settimane del progetto, per Admin, Continuous, AMS e Ferie il totale dell’anno solare. Nella riga della persona "Tot" sono le giornate dell’anno di tutte le sue righe.',
        'Ordinamento a due livelli, come "ordina per… poi per…" di Excel: clic sull’intestazione di una colonna = ordina crescente; un altro clic = decrescente; il terzo toglie. Cliccando un’altra colonna mentre la prima è ordinata, la nuova diventa il secondo livello e la prima resta (es. Sistema, poi Prio IT). Una terza colonna prende il posto del secondo livello. Le colonne ordinabili hanno un ↕ tenue accanto al nome; la freccia e il numero 1 o 2 dicono come è ordinato; "Togli ordinamento" nella barra azzera. Come in Excel, anche il menu del filtro (imbuto) di Progetto, Stato e Prio IT ha in cima "Ordina…": per la priorità "1 → 4" mette prima le più importanti. Cliccando l’intestazione di una settimana le righe si ordinano per le giornate di quella settimana. L’ordinamento vale dentro le righe di ogni persona; la riga Ferie resta in fondo.',
        'Nella riga della persona la percentuale è la saturazione della settimana; passandoci sopra vedi caricato e capacità in giornate.',
      ],
    },
    {
      title: 'Navigazione',
      items: [
        'Le colonne a sinistra (codice, progetto, colonne scelte e Tot) restano bloccate, come i riquadri bloccati di Excel: scorrendo in orizzontale (barra di scorrimento, Maiusc + rotellina o trackpad) si spostano solo le settimane, avanti e indietro nel tempo. Più lo schermo è largo, più settimane vedi.',
        'All’apertura le prime settimane a vista sono le 2 passate (intestazione rossa, perché già scadute), poi la corrente (azzurro tenue) e le future. Arrivando al bordo si caricano da sole altre settimane (un trimestre alla volta).',
        'Le frecce ‹ › accanto al periodo scorrono di una settimana; "Oggi" torna alla vista di partenza. Il periodo nella barra indica le settimane a vista.',
        'Con le barre di scorrimento la griglia scorre anche in verticale; le intestazioni restano in alto.',
        'Ricerca: il campo "Cerca" filtra la griglia mentre scrivi, su persona, codice, progetto, nota, tipo, sistema e stato. Maiuscole, accenti e spazi in più non contano; più parole valgono tutte insieme e in qualsiasi ordine ("office migr" trova "Migrazione Office 365", "ferie elia" la riga Ferie di Elia). Vale anche per la ricerca dentro i filtri e per l’aggiunta veloce.',
        'Filtri come in Excel: Stato e Persone nella barra, Risorsa, Progetto, Stato e Prio con l’imbuto nell’intestazione della colonna. Nel filtro scrivi per trovare le voci e spunta quelle da vedere: la griglia si aggiorna subito. "Seleziona visibili" e "Togli visibili" agiscono solo sulle voci trovate; "Togli filtro" mostra tutto. L’imbuto pieno indica un filtro attivo.',
        'Stato: per default solo i progetti aperti (To Start, Approved, In Progress); Pending e gli stati finali (Completed, Rejected, Aborted) sono nascosti. "Solo aperti (default)" nel filtro torna al default; la scelta resta salvata per il tuo utente.',
        'Con un filtro su progetto, priorità o testo spariscono le persone senza righe trovate e anche la riga Ferie; senza filtri la riga Ferie si vede sempre.',
        'Il nome della persona apre la sua scheda, il nome del progetto la scheda del progetto.',
        'Le persone disattivate non compaiono: per vederle spuntale nel filtro Persone (in fondo all’elenco, con "(disattivata)"). "Togli filtro" torna alle sole attive.',
        'Viste salvate: con "Vista" salvi con un nome filtri, ricerca, ordinamento, colonne, raggruppamento e archiviate attuali e li richiami dal menu; una vista può essere la predefinita e si apre da sola. Il pallino accanto al nome dice che hai cambiato qualcosa: "Aggiorna" la salva. "Vista standard" torna ai filtri di partenza. Le viste sono tue, per ogni pagina.',
        '"Togli filtri" toglie ricerca e filtri in un colpo solo. Le righe nascoste dai filtri contano comunque nella saturazione della persona.',
        '"Archiviate" mostra anche le righe archiviate.',
        'La freccia accanto al nome della persona apre e chiude le sue righe; resta visibile la riga con la saturazione.',
        '"Raggruppa" sceglie come dividere le righe: per Persona (come l’Excel), per Persona e sistema (dentro ogni persona un gruppo per sistema) o per Sistema (le righe di tutte le persone per sistema, con il nome della persona accanto al progetto; in fondo le righe Ferie delle persone mostrate e una riga di festività per ogni calendario nazionale delle loro sedi, es. "Festività · San Marino", con il numero di festività della settimana; il nome della festività compare passandoci sopra). La scelta resta salvata per il tuo utente.',
        'Ogni gruppo per sistema ha la sua freccia: chiuso mostra una sola riga con il totale delle giornate per settimana. I progetti senza sistema (es. AMS su più sistemi) sono in "Più sistemi o nessuno".',
        'Sul telefono vedi una settimana alla volta, con una scheda per persona.',
      ],
    },
    {
      title: 'Task e note della casella',
      items: [
        'Ogni casella (persona + progetto + settimana) può avere task e note: il pallino blu nell’angolo in alto a sinistra dice quanti task sono aperti, ✓ che sono tutti chiusi.',
        'Clic sul pallino, oppure Alt+T con il cursore nella casella, apre il pannello a destra: scrivi il titolo e premi Invio. Il task è assegnato alla persona della riga e legato a quella settimana; l’icona a sinistra lo trasforma in nota, il calendario aggiunge la scadenza.',
        'Passando il mouse su una casella vuota compare il + per aggiungere il primo task.',
        'Nel pannello spunti i task fatti, cambi lo stato dal menu e apri il dettaglio (commenti, storico, promemoria). "Tutti i task di…" porta alla pagina Task della persona.',
      ],
    },
    {
      title: 'Chi può modificare',
      items: [
        'Giornate e righe: Admin e Project Manager; gli altri ruoli vedono il piano in sola lettura.',
        'Task e note: tutti; ognuno modifica i suoi (creati da lui o assegnati a lui), Admin e PM tutti.',
      ],
    },
  ],
};

export const TASKS_HELP: HelpContent = {
  title: 'Task',
  intro:
    'Task e note di ogni persona, nati dalle caselle del piano o scritti qui: una guida che va oltre il ticket, per non perdere nulla tra un allineamento e l’altro.',
  sections: [
    {
      title: 'Inserire e aggiornare',
      items: [
        'Scrivi il titolo nel campo in alto e premi Invio: il task è assegnato alla persona scelta. L’icona a sinistra lo trasforma in nota, il calendario aggiunge la scadenza.',
        'Dal piano settimanale: pallino della casella o Alt+T. Il task resta legato a quella persona, progetto e settimana.',
        'La spunta segna il task come fatto (e lo riapre); la pillola dello stato apre il menu per cambiarlo.',
        'Il titolo apre il dettaglio: descrizione, stato, assegnatario, progetto, scadenza, promemoria e priorità, poi "Salva".',
        'Nel dettaglio "Aggiornamenti e commenti" raccoglie avanzamenti e collaborazione: con @ citi una persona del team. Lo storico mostra chi ha cambiato cosa e quando.',
      ],
    },
    {
      title: 'Viste',
      items: [
        'Elenco: task raggruppati per progetto (i senza progetto in fondo); prima gli aperti, poi quelli in ritardo e per scadenza. "Mostra chiusi" include fatti e annullati.',
        'Kanban: una colonna per stato; trascina una scheda in un’altra colonna per cambiarne lo stato. Le note restano nella vista Elenco.',
        'Viste salvate: con "Vista" salvi con un nome persona, vista, chiusi e ricerca attuali e li richiami dal menu; una vista può essere la predefinita e si apre da sola. Il pallino accanto al nome dice che hai cambiato qualcosa: "Aggiorna" la salva. "Vista standard" torna ai filtri di partenza. Le viste sono tue, per ogni pagina.',
        'Persona: di partenza la tua (se il tuo utente è collegato a una risorsa), oppure "Tutte le persone". La ricerca filtra mentre scrivi su titolo, descrizione, progetto e persona.',
      ],
    },
    {
      title: 'Promemoria',
      items: [
        'La campanella in alto mostra i tuoi task aperti in ritardo, in scadenza nei prossimi giorni o con il promemoria arrivato.',
        'Per e-mail arriva un riepilogo per persona con la frequenza scelta in Anagrafiche › Parametri generali (spento, ogni giorno lavorativo o il lunedì) all’ora indicata; serve l’indirizzo e-mail nella scheda della risorsa o dell’utente.',
      ],
    },
    {
      title: 'Chi può modificare',
      items: [
        'Tutti creano task; ognuno modifica quelli creati da lui o assegnati a lui; Admin e Project Manager tutti. Il Viewer legge e commenta.',
        'Chi vede cosa: Admin e Project Manager vedono tutti i task; gli altri ruoli solo quelli assegnati a loro o creati da loro, anche nei pallini del piano.',
        'Ognuno modifica ed elimina i propri commenti; l’Admin può eliminare anche quelli degli altri.',
      ],
    },
  ],
};

export const PARAMETERS_HELP: HelpContent = {
  title: 'Parametri generali',
  intro: 'Valori che valgono per tutta l’applicazione. Li modifica solo l’Admin.',
  sections: [
    {
      title: 'Promemoria dei task',
      items: [
        'Frequenza e-mail: OFF (nessuna e-mail), DAILY (ogni giorno lavorativo) o WEEKLY (il lunedì).',
        'Ora di invio: dalle 0 alle 23, ora italiana. Ogni persona riceve al massimo un riepilogo al giorno.',
        'Giorni di anticipo: un task entra nei promemoria (campanella ed e-mail) quando la scadenza è entro questi giorni.',
        'L’invio richiede il server di posta configurato sul backend (spring.mail.host); senza, i promemoria restano solo nella campanella.',
      ],
    },
  ],
};

export const TICKETS_HELP: HelpContent = {
  title: 'Ticket AMS',
  intro:
    'I ticket del service desk Jira (progetto IT): tutto ciò che passa da ticket conta come AMS. La pagina mostra quanto pesa su ogni persona, come scorrono i ticket e cosa conviene fare adesso.',
  sections: [
    {
      title: 'Da dove arrivano i dati',
      items: [
        'Il backend legge Jira con il token API scritto in config/local.yml e si aggiorna da solo ogni 15 minuti (i ticket cambiati); una volta al giorno rilegge tutto. "Aggiorna ora" (Admin e PM) lo fa subito.',
        'Si leggono gli aperti e i chiusi degli ultimi 180 giorni (parametro JIRA_HISTORY_DAYS); i progetti Jira sono nel parametro JIRA_PROJECT_KEYS (oggi MRLIT).',
        'La persona è l’assegnatario del ticket: si collega alla risorsa da sola quando il nome è uguale, altrimenti scrivi l’account Jira nella scheda della risorsa.',
        'Il progetto si aggancia con un’etichetta Jira uguale al codice del progetto (es. ICT26ERP127). L’area è il campo "Progetto Marlù" del service desk.',
      ],
    },
    {
      title: 'Pagine BI (come Power BI)',
      items: [
        'Le linguette in alto portano alle pagine: Operativa (azioni consigliate e carico), Panoramica, Trend, Aperti, Pending ed Elenco.',
        'I filtri in alto valgono per tutte le pagine BI e restano passando dall’una all’altra: Progetto Marlù, Assegnatario, Anno e Mese di creazione. Clic su una barra di area o assegnatario filtra tutto su quel valore; un secondo clic lo toglie. Le combinazioni si salvano con "Vista".',
        'Panoramica: ticket creati nel periodo, quanti sono ancora aperti (open lavorabili + pending) e quanti risolti, con le percentuali; creati e risolti per mese (i risolti nel mese di chiusura); ripartizione per area, assegnatario, stato e tipo di richiesta.',
        'Trend: per settimana creati e risolti e, sotto, i lavorabili a fine settimana; "Includi i Pending" li conta o li esclude. Giorni di backlog, come la misura di Power BI = lavorabili di oggi ÷ risolti per giorno lavorativo nelle ultime 3 settimane complete (risolti ÷ 3 settimane ÷ 5 giorni; la settimana in corso non conta). Il risultato è in giorni lavorativi. Il Pending è lo stato di oggi (lo storico degli stati non si legge).',
        'Aperti e Pending: i ticket aperti oggi (di qualunque periodo; contano area e assegnatario) per anzianità, area, priorità, assegnatario, richiedente e stato.',
        'Elenco: i ticket creati nel periodo con ricerca dal vivo, stato (aperti, pending, risolti, tutti), ordinamento per chiave, data o età e link a Jira.',
        'Gli stati "Pending" sono nel parametro TICKET_PENDING_STATUSES (oggi Pending); lo storico letto da Jira è di 2 anni (JIRA_HISTORY_DAYS).',
      ],
    },
    {
      title: 'Come si legge il carico',
      items: [
        'In Jira non ci sono ore registrate: il carico si misura con i conteggi (aperti, da fare, in corso, in attesa del cliente) e con i flussi (entrati e chiusi per settimana).',
        '"Chiusi a settimana" è la media delle ultime 4 settimane complete: dice quanti ticket la persona riesce a chiudere. Se entrano più ticket di quanti ne escono per 3 settimane il backlog è "in crescita".',
        '"Ultimi 7 gg" conta entrati e chiusi negli ultimi 7 giorni di calendario (da oggi indietro); "Ultime 4 sett." nelle ultime 4 settimane complete, da lunedì a domenica, esclusa quella in corso.',
        '"AMS pianificate" sono le giornate della settimana corrente sulle righe AMS del piano settimanale: confrontale con il numero di ticket aperti e con quanti ne arrivano.',
        'Il grafico mostra entrati e chiusi per settimana (barre) e gli aperti a fine settimana (linea); passandoci sopra vedi i numeri, "Dati" apre la tabella.',
      ],
    },
    {
      title: 'Azioni consigliate',
      items: [
        'Urgenti: ticket senza assegnatario da più di 4 ore; ticket con la scadenza passata.',
        'Da fare: ticket in attesa del cliente da più di 5 giorni (sollecitare o chiudere), fermi da più di 7 giorni, riaperti; backlog in crescita; ticket aperti ma nessuna giornata AMS nel piano.',
        'Suggerimenti: utenti Jira non collegati a una risorsa, persone con più del doppio dei ticket della mediana del team, ticket senza codice progetto.',
        'Viste salvate: con "Vista" salvi con un nome azioni mostrate e filtro dell’elenco attuali e li richiami dal menu; una vista può essere la predefinita e si apre da sola. Il pallino accanto al nome dice che hai cambiato qualcosa: "Aggiorna" la salva. "Vista standard" torna ai filtri di partenza. Le viste sono tue, per ogni pagina.',
        '"Per chi coordina" e "Per le persone" filtrano le azioni; "Apri in Jira" apre i ticket interessati, "Vedi i ticket" li elenca qui sotto. Le soglie sono nei parametri generali (TICKET_…).',
      ],
    },
  ],
};

export const PERSON_LOAD_HELP: HelpContent = {
  title: 'Carico per persona: come si calcola',
  intro:
    'Ogni ticket conta per il suo assegnatario di oggi in Jira. Le date sono quelle di Jira: creazione per gli entrati, chiusura per i chiusi.',
  sections: [
    {
      title: 'Ticket aperti oggi',
      items: [
        'Aperti = da fare + in corso + in attesa (cioè tutti i ticket non chiusi).',
        'Da fare: stato "da completare" di Jira (Aperto, Nuovo). In corso: stati in lavorazione, esclusa l’attesa del cliente. In attesa: stato "In attesa di risposta dal cliente".',
        'Scaduti: con la data di scadenza passata. Fermi: non in attesa del cliente e senza nessun aggiornamento in Jira da oltre i giorni indicati (parametro TICKET_STALE_DAYS).',
        'Più vecchio: giorni dalla creazione del suo ticket aperto più vecchio.',
      ],
    },
    {
      title: 'Ultimi 7 gg',
      items: [
        'Entrati: ticket creati negli ultimi 7 giorni di calendario, contando a ritroso da adesso (es. mercoledì 21 alle 10: da mercoledì 14 alle 10). Chiusi: ticket chiusi nello stesso intervallo.',
        'Sono gli stessi giorni dell’indicatore "entrati / chiusi in 7 giorni" in alto, quindi la somma delle persone torna con quel numero.',
      ],
    },
    {
      title: 'Ultime 4 settimane',
      items: [
        'Entrati e chiusi nelle ultime 4 settimane complete, ognuna da lunedì a domenica; la settimana in corso non conta (es. mercoledì 21/10: dal 21/09 al 18/10).',
        'Chiusi a settimana = chiusi delle ultime 4 settimane ÷ 4: il ritmo di chiusura della persona, non falsato dalla settimana ancora a metà.',
      ],
    },
    {
      title: 'AMS pianificate e tendenza',
      items: [
        'AMS pianificate: giornate della settimana corrente sulle righe AMS del piano settimanale della persona.',
        '"In crescita": nelle ultime 3 settimane complete sono entrati più ticket di quanti ne sono stati chiusi e gli aperti sono aumentati.',
      ],
    },
  ],
};

export const ALERTS_HELP: HelpContent = {
  title: 'Allerte: come si calcolano',
  intro:
    'Segnali da anticipare prima che diventino problemi. Sono conteggi sui ticket di Jira (non ci sono ore registrate): le soglie sono nei parametri generali (TICKET_…) e vanno tarate sui dati del team.',
  sections: [
    {
      title: 'Picco di richieste',
      items: [
        'Ticket entrati nelle ultime 48 ore confrontati con il normale: la media delle stesse 48 ore (stesso giorno e ora) nelle 8 settimane prima.',
        'Allerta se sono almeno 1,8 volte il normale (TICKET_SPIKE_FACTOR) e almeno 8 per il team o 4 per un’area ("Progetto Marlù"). Se uno stesso richiedente ne ha aperti 3 o più, lo indica: spesso dietro c’è un problema unico.',
      ],
    },
    {
      title: 'Saldo che peggiora',
      items: [
        'Entrati meno chiusi nelle ultime 4 settimane complete (da lunedì a domenica), diviso 4: di quanto cresce il backlog a settimana.',
        'Con la crescita indica quanti saranno gli aperti tra 4 settimane allo stesso ritmo; è "urgente" se negli ultimi 7 giorni va ancora peggio.',
      ],
    },
    {
      title: 'Scadenze vicine',
      items: [
        'Ticket aperti con la scadenza da oggi ai prossimi 2 giorni lavorativi (TICKET_DUE_SOON_DAYS), non ancora scaduti, divisi per persona. Urgente se tra questi ci sono priorità High o Highest.',
      ],
    },
    {
      title: 'Nuovi senza risposta',
      items: [
        'Ticket ancora "da fare" e mai aggiornati in Jira dopo la creazione, da oltre 8 ore lavorative (TICKET_NO_RESPONSE_HOURS; ore lavorative = lunedì-venerdì dalle 8 alle 18). Urgente da 10 ticket in su.',
        'I ticket già toccati ma poi rimasti fermi sono nelle azioni consigliate come "fermi".',
      ],
    },
    {
      title: 'Carico concentrato',
      items: [
        'Una persona con più del 30% dei ticket aperti assegnati del team (TICKET_CONCENTRATION_PCT).',
        'Non si segnala un’area seguita da una sola persona: è la norma, ogni progetto ha il suo referente.',
      ],
    },
  ],
};

export const PEOPLE_TREND_HELP: HelpContent = {
  title: 'KPI per persona: come si leggono',
  intro:
    'Per ogni persona: il suo backlog cresce o cala? Ogni ticket conta per l’assegnatario di oggi in Jira (lo storico delle assegnazioni non c’è). Valgono i filtri di area e persona; anni e mesi no.',
  sections: [
    {
      title: 'Saldo a settimana',
      items: [
        '(Entrati − chiusi) nelle ultime 4 settimane complete (da lunedì a domenica, esclusa quella in corso) ÷ 4.',
        'Positivo (freccia in su, "cresce"): entrano più ticket di quanti ne chiude, il backlog sale. Negativo ("cala"): sta smaltendo. Tra −0,5 e +0,5: stabile.',
        'Aperti 4 sett. fa e Aperti oggi mostrano lo stesso andamento in numeri assoluti.',
      ],
    },
    {
      title: 'Grafico della persona',
      items: [
        'Clic sul nome: entrati e chiusi per settimana nelle ultime 12 settimane, con la linea degli aperti a fine settimana.',
        'L’interruttore dei Pending decide se contare negli aperti i ticket che oggi sono in Pending.',
      ],
    },
  ],
};
