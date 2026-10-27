import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { EntityRow } from './crud.model';

/**
 * Task collegati ai record di un elenco (D-36): il tipo di record (es. MOBILE_LINE) e come si
 * chiama la riga nel task ("Linea 3208071238 · CC Merlata Bloom").
 */
export interface TaskSourceConfig {
  readonly type: string;
  readonly label: (row: EntityRow) => string;
}

/** Task aperti e totali di un record. */
export interface RecordTaskCount {
  readonly open: number;
  readonly total: number;
}

/**
 * Cosa serve alla tabella degli elenchi per i task dei record, senza dipendere dalla funzione
 * Task: la fornisce la parte Task (vedi app.config).
 */
export interface RecordTasksPort {
  /** Conteggi per id del record (come stringa). */
  counts(type: string): Observable<ReadonlyMap<string, RecordTaskCount>>;
  /** Apre i task del record; emette true se ne sono stati creati o modificati. */
  open(type: string, id: string, label: string): Observable<boolean>;
}

export const RECORD_TASKS = new InjectionToken<RecordTasksPort>('RECORD_TASKS');
