import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, shareReplay } from 'rxjs';

import { API_BASE_URL } from '../../core/config/api.config';
import { EntityRow, OptionsSource, SelectOption } from './crud.model';

/** Accesso generico alle API CRUD (elenco, creazione, modifica, cancellazione) e alle opzioni delle tendine. */
@Injectable({ providedIn: 'root' })
export class CrudApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  list(endpoint: string): Observable<EntityRow[]> {
    return this.http.get<EntityRow[]>(this.url(endpoint));
  }

  get(endpoint: string, id: number): Observable<EntityRow> {
    return this.http.get<EntityRow>(`${this.url(endpoint)}/${id}`);
  }

  create(endpoint: string, body: Record<string, unknown>): Observable<EntityRow> {
    return this.http.post<EntityRow>(this.url(endpoint), body);
  }

  update(endpoint: string, id: number, body: Record<string, unknown>): Observable<EntityRow> {
    return this.http.put<EntityRow>(`${this.url(endpoint)}/${id}`, body);
  }

  delete(endpoint: string, id: number): Observable<void> {
    return this.http.delete<void>(`${this.url(endpoint)}/${id}`);
  }

  /** Opzioni di una tendina; con `keepValues` restano visibili anche i valori disattivati già scelti. */
  options(source: OptionsSource, keepValues: readonly unknown[] = []): Observable<SelectOption[]> {
    if (source.static) {
      return of([...source.static]);
    }
    const valueKey = source.valueKey ?? 'id';
    const labelOf = (row: EntityRow): string =>
      typeof source.labelKey === 'function'
        ? source.labelKey(row)
        : String(row[source.labelKey ?? 'label'] ?? '');
    return this.list(source.endpoint!).pipe(
      map((rows) =>
        rows
          .filter(
            (row) => !source.filter || source.filter(row) || keepValues.includes(row[valueKey]),
          )
          .filter(
            (row) =>
              source.activeOnly === false ||
              row['active'] !== false ||
              keepValues.includes(row[valueKey]),
          )
          .map((row) => ({ value: row[valueKey], label: labelOf(row) })),
      ),
      shareReplay(1),
    );
  }

  private url(endpoint: string): string {
    return `${this.apiBaseUrl}${endpoint}`;
  }
}

/** Messaggio leggibile da una risposta di errore delle API (ProblemDetail). */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'Il server non risponde. Verifica che il backend sia avviato.';
    }
    if (error.status === 403) {
      return 'Non hai i permessi per questa operazione.';
    }
    const problem = error.error as { detail?: string; errors?: Record<string, string> } | null;
    if (problem?.errors) {
      return Object.values(problem.errors).join(' · ');
    }
    if (problem?.detail) {
      return problem.detail;
    }
  }
  return 'Operazione non riuscita. Riprova tra qualche istante.';
}
