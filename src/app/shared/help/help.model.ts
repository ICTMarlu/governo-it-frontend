/** Guida di una pagina: funzioni principali e, se presenti, regole di calcolo. */
export interface HelpContent {
  /** Titolo della guida (di solito il nome della pagina). */
  readonly title: string;
  /** A cosa serve la pagina, in una o due frasi. */
  readonly intro: string;
  readonly sections: readonly HelpSection[];
}

export interface HelpSection {
  readonly title: string;
  /** Elenco puntato di funzioni o regole. */
  readonly items: readonly string[];
}
