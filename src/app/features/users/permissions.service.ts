import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../../core/config/api.config';
import { AccessLevel } from '../../core/auth/permissions';

/** Un profilo con il livello di ogni modulo e quanti utenti attivi lo usano. */
export interface Profile {
  readonly id: number;
  readonly code: string;
  readonly label: string;
  readonly permissions: Readonly<Record<string, AccessLevel>>;
  readonly users: number;
}

/** Permessi di un utente: le eccezioni al profilo e i livelli che ha davvero. */
export interface UserPermissions {
  readonly id: number;
  readonly username: string;
  readonly displayName: string;
  readonly active: boolean;
  readonly profileId: number;
  readonly profileLabel: string;
  readonly overrides: Readonly<Record<string, AccessLevel>>;
  readonly effective: Readonly<Record<string, AccessLevel>>;
}

export interface AuditEntry {
  readonly at: string;
  readonly by: string | null;
  readonly targetType: 'ROLE' | 'USER';
  readonly target: string | null;
  readonly module: string | null;
  readonly from: string | null;
  readonly to: string | null;
  readonly note: string | null;
}

/** Profili, permessi per modulo e storico (solo per chi gestisce gli utenti). */
@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(API_BASE_URL)}/permissions`;

  profiles(): Observable<Profile[]> {
    return this.http.get<Profile[]>(`${this.base}/profiles`);
  }

  saveProfile(id: number, permissions: Record<string, AccessLevel>): Observable<void> {
    return this.http.put<void>(`${this.base}/profiles/${id}`, { permissions });
  }

  users(): Observable<UserPermissions[]> {
    return this.http.get<UserPermissions[]>(`${this.base}/users`);
  }

  /** {@code overrides}: modulo → livello; un modulo con valore vuoto torna a quello del profilo. */
  saveUser(
    id: number,
    profileId: number,
    overrides: Record<string, AccessLevel | ''>,
  ): Observable<void> {
    return this.http.put<void>(`${this.base}/users/${id}`, { profileId, overrides });
  }

  audit(limit = 100): Observable<AuditEntry[]> {
    return this.http.get<AuditEntry[]>(`${this.base}/audit`, { params: { limit } });
  }
}
