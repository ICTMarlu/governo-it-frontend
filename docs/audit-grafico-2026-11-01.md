# Audit grafico Governo IT — 1 novembre 2026

Giro completo dell'app nel browser (larghezza ~800 px "tablet" e 1280 px desktop, tema chiaro e scuro) con misura degli stili calcolati sulla pagina, più un controllo dei sorgenti.
Pagine viste: Accesso, Home, Piano, Consuntivo ore, Anagrafiche, Anagrafiche e liste, Telefonia, Sistemi e tecnologie, Ticket AMS, Task, Direzione, Utenti e permessi, Progetti (elenco e finestra di modifica).

## La causa di fondo

Non esiste una scala condivisa di arrotondamenti, spaziature, testi e colori: ogni componente decide da sé.

| Cosa | Situazione misurata |
|---|---|
| Arrotondamenti | 11 valori diversi nei sorgenti (0.125 / 0.25 / 0.375 / 0.5 / 0.75 / 1 / 1.25 rem, 2px, 3px, 50%, 0); a schermo convivono riquadri da 4, 8, 12, 16 e 28 px |
| Variabili CSS proprie | 5 in tutto `styles.scss` |
| Colori scritti a mano | 60 codici esadecimali diversi (es. `#2e7d32`, `#e9b44c`, `#b26a00`) al posto dei colori di sistema `--mat-sys-*` |
| Dimensioni testo | 14 dichiarazioni diverse, mescolando `rem` e `px` (10px, 11px, 0.6875rem, 0.8125rem…) |
| Stili dentro i componenti | 48 componenti hanno stili inline in `styles: [...]` oltre ai 23 file `.scss` |

Finché manca questa scala, ogni correzione puntuale si perde alla funzione successiva.

## Problemi trovati, per tipo

### 1. Riquadri dei numeri (KPI): 4 stili diversi per la stessa cosa
- **Home**: sfondo grigio, testo a sinistra, nessun bordo.
- **Consuntivo ore**: sfondo grigio, testo centrato.
- **Telefonia / Sistemi e tecnologie**: sfondo bianco, bordo colorato (blu, verde, rosso, arancio, grigio), numero centrato.
- **Ticket AMS**: sfondo bianco, bordo grigio o rosso, numero a sinistra, link blu sottolineati dentro.

Proposta: un unico componente condiviso `kpi-tile` con varianti di stato (normale / attenzione / critico) e allineamento fisso.

### 2. Link con il blu di default del browser
- Ticket AMS: **273 link** in `rgb(0,0,238)` sottolineato (il blu del browser, non quello del tema); in Home 72.
- Nel tema scuro alcuni link sono sottolineati ("Apri in Jira") e altri accanto no ("Vedi i ticket", "Piano").

Proposta: una regola globale per `a` con il colore primario del tema e sottolineatura solo al passaggio del mouse.

### 3. Campi di ricerca e filtri: 3 realizzazioni e 2 altezze
- Ricerca "a mano" piccola (Anagrafiche, Task, Piano) con il testo d'esempio tagliato ("Cerca un'anagrafica (es. fornitori, se").
- Ricerca Material alta 56 px a tutta larghezza (Direzione, Utenti).
- In Task, sulla stessa riga, ci sono campi alti 40 px e campi alti 56 px; alcuni con l'etichetta sopra ("Persona", "Tipo") e altri senza.
- Nel login il bordo dei campi si interrompe male accanto all'etichetta.

Proposta: un solo componente di ricerca e un'altezza unica per i filtri (40 px, densità -2); nei moduli 56 px.

### 4. Bottoni: gerarchia poco chiara
- Bottone principale ("+ Nuovo", "+ Riga", "Inizia riunione") a volte alto 48 px e a volte 40 px.
- In Utenti, a ~800 px, "Colonne" e "+ Nuovo" diventano barre a tutta larghezza: pesanti, e "Colonne" non serve con la vista a schede.
- Bottoni a pillola, bottoni di testo e chip-filtro con raggio 8 px si mescolano sulla stessa riga (Piano: "Stato: Aperti", "Sistema", "standard", "Oggi").
- Progetti: matita e cestino su ogni riga (circa 200 icone): rumore visivo e cancellazione a un clic dalla modifica.

Proposta: tre livelli fissi (principale pieno, secondario con bordo, di testo), tutti alti 40 px; le azioni di riga in un menu "⋮" o al passaggio del mouse.

### 5. Testi e lingua
- Stati in inglese in un'interfaccia italiana: "Approved", "To Start", "In Progress", "Awaiting approval", "Authorize".
- Nomi incoerenti: "Vista: standard" / "Vista: Default" / "Vista: Aperti per Priorità"; "standard" in minuscolo da solo nel Piano.
- Telefonia: "1372 €" senza separatore delle migliaia accanto a "16.458 €".
- Home: la frase "Il punto di oggi" è tagliata con i puntini anche quando c'è spazio sotto.

### 6. Disposizione a larghezza tablet (~800 px)
- **Barra in alto**: il nome utente "Amministratore (test)" si sovrappone alle icone del menu (Piano).
- **Barra in alto**: solo icone senza etichetta per tutti i moduli, difficili da riconoscere.
- **Consuntivo ore**: i giorni vanno a capo e "dom 01/11" resta da solo su una riga; l'intestazione "Da inserire" è tagliata.
- **Piano**: l'icona "?" resta da sola su una riga.
- **Task**: la colonna Titolo è così stretta che i titoli vanno su 4-5 righe mentre le altre colonne restano larghe; doppia casella di spunta (selezione + "Fatto").
- **Home**: la sezione Intuizioni esce a destra con una barra di scorrimento orizzontale.

### 7. Struttura e navigazione
- "Anagrafiche" e "Anagrafiche e liste" ripetono le stesse voci (Società, Fornitori, Sedi, Calendari festività).
- Il link "← Anagrafiche" c'è in alcune pagine e non in altre di pari livello.
- I titoli di sezione usano 22 px in alcune pagine e 18 px in altre.

## Proposta di valori comuni (da approvare prima di applicarli)

Da aggiungere in `styles.scss`, sopra il tema Material:

```scss
:root {
  // Arrotondamenti: 4 valori al posto di 11
  --gi-radius-sm: 4px;    // badge, chip piccoli, celle
  --gi-radius-md: 8px;    // campi, chip-filtro, menu
  --gi-radius-lg: 12px;   // riquadri, KPI, pannelli
  --gi-radius-xl: 28px;   // finestre di dialogo (valore Material)
  --gi-radius-pill: 9999px; // bottoni

  // Spaziature: scala a passi di 4px
  --gi-space-1: 4px;  --gi-space-2: 8px;  --gi-space-3: 12px;
  --gi-space-4: 16px; --gi-space-5: 24px; --gi-space-6: 32px;

  // Testi: si usano i ruoli Material, niente px sparsi
  //   titolo pagina  -> --mat-sys-headline-small (24px)
  //   titolo sezione -> --mat-sys-title-large   (22px)
  //   titolo riquadro-> --mat-sys-title-medium  (16px/500)
  //   testo          -> --mat-sys-body-medium   (14px)
  //   note/etichette -> --mat-sys-body-small / label-small (12px / 11px)

  // Colori di stato, basati sul tema (funzionano anche nello scuro)
  --gi-ok:       light-dark(#2e7d32, #81c784);
  --gi-warning:  light-dark(#b26a00, #ffb74d);
  --gi-critical: var(--mat-sys-error);
  --gi-info:     var(--mat-sys-primary);

  // Altezze dei controlli
  --gi-control-h: 40px;   // bottoni e filtri
}
```

## Ordine di lavoro proposto

1. **Fondamenta** (un'unica modifica): valori comuni sopra, regola globale dei link, densità dei filtri.
2. **Componenti condivisi**: `kpi-tile`, campo di ricerca, barra filtri, etichetta di stato tradotta in italiano.
3. **Modulo per modulo**: sostituire valori scritti a mano e stili inline con quelli comuni, rispettando la regola delle tabelle (intestazioni e valori centrati, prima colonna a sinistra).
4. **Seconda fase, cambio di oggetti**: barra di navigazione con etichette o menu laterale, azioni di riga nel menu "⋮", unione delle due pagine Anagrafiche.

Nota: al momento dell'audit ci sono modifiche non committate di un'altra sessione su Home, Consuntivo e rotte; vanno chiuse prima di toccare quei file.
