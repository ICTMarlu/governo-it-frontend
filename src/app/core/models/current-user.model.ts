/** Utente autenticato, restituito da GET /api/v1/auth/me. */
export interface CurrentUser {
  readonly id: number;
  readonly username: string;
  readonly displayName: string;
  readonly role: string;
  readonly roleLabel: string;
  readonly canViewCosts: boolean;
  /** Risorsa del team collegata all'utente (es. per "i miei task"), se c'è. */
  readonly resourceId: number | null;
}
