import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';

/**
 * Preferenze dell'interfaccia salvate sul server per l'utente (es. colonne degli elenchi):
 * seguono l'utente su qualsiasi PC o browser.
 */
@Injectable({ providedIn: 'root' })
export class UserPreferencesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/auth/me/preferences`;

  /** Valore salvato, oppure null se l'utente non ha mai personalizzato. */
  get<T>(key: string): Observable<T | null> {
    return this.http
      .get<T>(`${this.url}/${key}`, { observe: 'response' })
      .pipe(map((response) => (response.status === 204 ? null : response.body)));
  }

  save<T>(key: string, value: T): Observable<void> {
    return this.http.put<void>(`${this.url}/${key}`, value);
  }

  reset(key: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${key}`);
  }
}
