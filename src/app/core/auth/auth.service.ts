import { HttpClient, HttpContext, HttpContextToken, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import { CurrentUser } from '../models/current-user.model';

const STORAGE_KEY = 'governo-it.auth';

/** Chiamata che può rispondere 401 senza che l'interceptor porti alla pagina di login (es. verifica della sessione). */
export const SILENT_401 = new HttpContextToken<boolean>(() => false);

/** Modi di accesso attivi sul backend. */
export interface LoginOptions {
  microsoft: boolean;
  localLogin: boolean;
}

/** Indirizzo che avvia il login Microsoft sul backend (inoltrato dal proxy in sviluppo). */
export const MICROSOFT_LOGIN_URL = '/oauth2/authorization/entra';

/**
 * Autenticazione, con due modi di accesso anche insieme (doppio binario del progetto login Entra):
 * - account Microsoft: il backend apre una sessione e il browser riceve solo un cookie HttpOnly,
 *   qui non resta nessuna credenziale;
 * - utente e password locali (fase di test, D-02): l'header Basic resta solo nella sessione del browser
 *   (sessionStorage), chiudendo la scheda si esce.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  private readonly currentUserState = signal<CurrentUser | null>(null);
  private readonly microsoftSessionState = signal(false);
  private authorization: string | null = readStoredAuthorization();
  private options$?: Observable<LoginOptions>;

  readonly currentUser = this.currentUserState.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserState() !== null);
  /** L'utente è entrato con Microsoft: niente cambio password, il logout passa da Microsoft. */
  readonly microsoftSession = this.microsoftSessionState.asReadonly();

  /** Modi di accesso attivi (login Microsoft e/o utente e password), chiesti una volta sola. */
  loginOptions(): Observable<LoginOptions> {
    this.options$ ??= this.http.get<LoginOptions>(`${this.apiBaseUrl}/auth/options`).pipe(
      // Backend non raggiungibile: si mostra il login classico, l'errore arriva al primo tentativo
      catchError(() => of({ microsoft: false, localLogin: true })),
      shareReplay(1),
    );
    return this.options$;
  }

  /** Verifica le credenziali sul backend e, se valide, apre la sessione. */
  login(username: string, password: string): Observable<CurrentUser> {
    const authorization = `Basic ${toBase64(`${username}:${password}`)}`;
    return this.fetchCurrentUser(authorization).pipe(
      tap((user) => this.openSession(authorization, user)),
    );
  }

  /**
   * Riprende la sessione (es. dopo un ricaricamento o al ritorno da Microsoft): prima le credenziali
   * salvate, altrimenti il cookie della sessione Microsoft.
   */
  restoreSession(): Observable<boolean> {
    if (this.isAuthenticated()) {
      return of(true);
    }
    const authorization = this.authorization;
    if (!authorization) {
      return this.fetchCurrentUser(null).pipe(
        tap((user) => {
          this.microsoftSessionState.set(true);
          this.currentUserState.set(user);
        }),
        map(() => true),
        catchError(() => of(false)),
      );
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

  /** Chiude la sessione nell'app (credenziali locali e utente in memoria). */
  logout(): void {
    this.authorization = null;
    this.microsoftSessionState.set(false);
    this.currentUserState.set(null);
    removeStoredAuthorization();
  }

  /**
   * Uscita dal pulsante "Esci". Con Microsoft chiude la sessione sul backend e poi passa dal logout di
   * Microsoft, che riporta alla pagina di login; restituisce l'indirizzo da aprire.
   */
  signOut(): Observable<string> {
    if (!this.microsoftSession()) {
      this.logout();
      return of('/login');
    }
    return this.http.post<{ redirectUrl: string }>('/logout', null).pipe(
      map((response) => response.redirectUrl || '/login'),
      catchError(() => of('/login')),
      tap(() => this.logout()),
    );
  }

  /** Header Authorization da allegare alle chiamate API, se l'utente è entrato con utente e password. */
  authorizationHeader(): string | null {
    return this.authorization;
  }

  private fetchCurrentUser(authorization: string | null): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${this.apiBaseUrl}/auth/me`, {
      headers: authorization ? new HttpHeaders({ Authorization: authorization }) : undefined,
      context: new HttpContext().set(SILENT_401, true),
    });
  }

  private openSession(authorization: string, user: CurrentUser): void {
    this.authorization = authorization;
    this.microsoftSessionState.set(false);
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
