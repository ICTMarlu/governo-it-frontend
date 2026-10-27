import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../../core/config/api.config';

/** Vista salvata di una pagina (D-26): filtri, colonne e ordinamento con un nome. */
export interface SavedView {
  readonly id: number;
  readonly pageKey: string;
  readonly name: string;
  readonly state: unknown;
  readonly defaultView: boolean;
}

/** Viste salvate dell'utente, per pagina. */
@Injectable({ providedIn: 'root' })
export class SavedViewsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/auth/me/views`;

  list(pageKey: string): Observable<SavedView[]> {
    return this.http.get<SavedView[]>(this.base, { params: { page: pageKey } });
  }

  /** Con lo stesso nome di una vista esistente la sovrascrive. */
  save(pageKey: string, name: string, state: unknown, defaultView: boolean): Observable<SavedView> {
    return this.http.post<SavedView>(this.base, { pageKey, name, state, defaultView });
  }

  update(id: number, name: string, state?: unknown): Observable<SavedView> {
    // Senza stato si rinomina soltanto: la chiave non va mandata, altrimenti cancellerebbe la vista
    return this.http.put<SavedView>(
      `${this.base}/${id}`,
      state === undefined ? { name } : { name, state },
    );
  }

  setDefault(id: number, defaultView: boolean): Observable<SavedView> {
    return this.http.put<SavedView>(`${this.base}/${id}/default`, { defaultView });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
