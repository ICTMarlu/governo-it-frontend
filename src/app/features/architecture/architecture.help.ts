import { HelpContent } from '../../shared/help/help.model';

/** Guida della pagina Architettura IT (D-38). */
export const ARCHITECTURE_HELP: HelpContent = {
  title: 'Architettura IT',
  intro:
    'La mappa degli applicativi di Marlù e dei flussi di dati tra loro: chi parla con chi, cosa si passano e cosa si ferma se un sistema va giù.',
  sections: [
    {
      title: 'Come si compila',
      items: [
        'Applicativi: uno per ogni cosa che il business usa (ERP, casse, e-commerce, WMS, BI, posta…) e per ogni partner esterno con cui si scambiano dati (corrieri, banche, marketplace).',
        'Gli applicativi sono le stesse voci che si scelgono nei progetti (Anagrafiche › Liste › Applicativi e ambiti): nome, tipologia e aree si modificano da una parte o dall’altra. Gli ambiti senza applicativo (es. Infrastruttura, Telefonia) non vanno nella mappa.',
        'La tipologia decide la colonna della mappa: canali e postazioni, gestionali, integrazioni, dati e analisi, partner esterni, infrastruttura. Le tipologie si modificano in Anagrafiche › Liste › Tipologie di sistema.',
        '"Gira su" collega l’applicativo alle tecnologie dell’inventario: se una tecnologia va fuori supporto o ha una vulnerabilità, l’avviso compare sull’applicativo e nella mappa.',
        '"Chi lo usa" sono le aree aziendali: servono a capire chi chiamare se si ferma.',
        'Connessioni: una riga per ogni flusso, letta da sinistra a destra. “ERP invia a WMS ordini e articoli, ogni pochi minuti, via SFTP”. “BI legge da ERP”. “E-commerce sincronizza con ERP”.',
        'I protocolli si modificano in Anagrafiche › Liste › Protocolli di integrazione.',
      ],
    },
    {
      title: 'La mappa',
      items: [
        'Colonne per livello; le frecce seguono i dati. Le connessioni critiche sono più spesse, quelle a richiesta tratteggiate.',
        'Clicca un applicativo: a destra trovi la scheda con i flussi in entrata e in uscita e l’elenco di cosa si ferma se lui si ferma.',
        'Impatto: chi dipende da lui, anche indirettamente. Si dipende da chi ci invia i dati (invia a) e da chi andiamo a leggere (legge da); “sincronizza con” vale nei due sensi.',
        'Il menu Architettura ha quattro voci: Mappa (tutta per il disegno), Applicativi e Connessioni (gli elenchi per compilare, importare ed esportare) e Panoramica (i numeri e cosa sistemare).',
        'Ci si muove come su una cartina: rotella per lo zoom, trascinamento per spostarsi, doppio clic su un applicativo per centrarlo, il pulsante “Tutta la mappa in vista” per ripartire. Esc chiude la scheda.',
        'Filtri: tipologia, livello, criticità e aree che lo usano. Visualizza: profondità (1, 2 o tutta la catena), solo i collegati all’applicativo scelto, scritte sulle frecce, riquadri compatti, dismessi.',
        'Un livello con più di 10 applicativi si divide in colonne; dentro, gli applicativi stanno raggruppati per tipologia. Più flussi tra gli stessi due applicativi diventano una freccia sola con il numero (“3 flussi”): il dettaglio è nella scheda.',
        'Filtri, vista e applicativo scelto restano nell’indirizzo della pagina: mandando il link a un collega, vede la stessa mappa.',
        'Immagine scarica la mappa in PNG (per le presentazioni) o in SVG (si ingrandisce senza perdere qualità).',
        'Il bordo colorato è la criticità per il business; il triangolo segnala tecnologie da trattare (fine supporto, vulnerabilità).',
      ],
    },
    {
      title: 'Importare ed esportare',
      items: [
        'Esporta scarica due file CSV (Applicativi e Connessioni) che Excel apre direttamente: è anche il modello per compilare.',
        'Importa: scegli uno o entrambi i file. Prima vedi l’anteprima (cosa verrà creato, aggiornato o scartato e perché), poi confermi.',
        'Gli applicativi si riconoscono dal nome, le connessioni da partenza e arrivo. Una cella vuota lascia il valore com’è.',
        'Tipologia, stato, direzione, frequenza e criticità si scrivono come nel menu (es. “ERP e gestionali”, “invia a”, “Una volta al giorno”, “Alta”). Più aree o tecnologie si separano con la virgola.',
      ],
    },
  ],
};
