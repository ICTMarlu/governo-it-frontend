import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import { CurrentUser } from '../models/current-user.model';

const STORAGE_KEY = 'governo-it.auth';

/**
 * Autenticazione con utente e password locali (fase di test, decisione D-02).
 * Le credenziali restano solo nella sessione del browser (sessionStorage):
 * chiudendo la scheda si esce. In fase 2 sarà sostituita dal login Microsoft Entra ID
 * senza cambiare il resto dell'applicazione.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  private readonly currentUserState = signal<CurrentUser | null>(null);
  private authorization: string | null = readStoredAuthorization();

  readonly currentUser = this.currentUserState.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserState() !== null);

  /** Verifica le credenziali sul backend e, se valide, apre la sessione. */
  login(username: string, password: string): Observable<CurrentUser> {
    const authorization = `Basic ${toBase64(`${username}:${password}`)}`;
    return this.fetchCurrentUser(authorization).pipe(
      tap((user) => this.openSession(authorization, user)),
    );
  }

  /** Riprende la sessione salvata (es. dopo un ricaricamento della pagina). */
  restoreSession(): Observable<boolean> {
    if (this.isAuthenticated()) {
      return of(true);
    }
    const authorization = this.authorization;
    if (!authorization) {
      return of(false);
    }
    return this.fetchCurrentUser(authorization).pipe(
      tap((user) => this.openSession(authorization, user)),
      map(() => true),
      catchError(() => {
        this.logout();
        return of(false);
      }),
    );
  }

  logout(): void {
    this.authorization = null;
    this.currentUserState.set(null);
    removeStoredAuthorization();
  }

  /** Header Authorization da allegare alle chiamate API, se l'utente è autenticato. */
  authorizationHeader(): string | null {
    return this.authorization;
  }

  private fetchCurrentUser(authorization: string): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${this.apiBaseUrl}/auth/me`, {
      headers: new HttpHeaders({ Authorization: authorization }),
    });
  }

  private openSession(authorization: string, user: CurrentUser): void {
    this.authorization = authorization;
    this.currentUserState.set(user);
    storeAuthorization(authorization);
  }
}

/** Base64 compatibile con caratteri non ASCII (es. lettere accentate nella password). */
function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return btoa(String.fromCharCode(...bytes));
}

function readStoredAuthorization(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeAuthorization(authorization: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, authorization);
  } catch {
    // sessionStorage non disponibile (es. navigazione privata): la sessione resta solo in memoria
  }
}

function removeStoredAuthorization(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // niente da rimuovere
  }
}
