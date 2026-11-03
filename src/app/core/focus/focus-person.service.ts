import { Injectable, computed, inject, signal } from '@angular/core';

import { AuthService } from '../auth/auth.service';
import { ROLES } from '../../shared/crud/crud.model';

/** Chiave in sessionStorage: la scelta vale per la sessione del browser (si perde chiudendolo). */
const STORAGE_KEY = 'governo-it.focus-person';

/**
 * "Persona in vista", una sola per tutta l'app: Admin e PM la scelgono in una pagina (Home, Progetti,
 * Ticket, Consuntivo, Task) e la ritrovano nelle altre; null = tutti. Per gli altri ruoli è fissa sulla
 * propria persona e il selettore non si mostra (il limite vero lo applica il backend).
 */
@Injectable({ providedIn: 'root' })
export class FocusPersonService {
  private readonly user = inject(AuthService).currentUser;
  private readonly chosen = signal<number | null>(readStored());

  /** Admin e PM scelgono la persona; gli altri vedono solo se stessi. */
  readonly canChoose = computed(() => {
    const role = this.user()?.role;
    return role === ROLES.admin || role === ROLES.pm;
  });

  /** Persona da mostrare: la scelta (null = tutti) per Admin e PM, la propria per gli altri. */
  readonly resourceId = computed<number | null>(() =>
    this.canChoose() ? this.chosen() : (this.user()?.resourceId ?? null),
  );

  /** Cambia la persona in vista (ignorato per chi non può scegliere). */
  set(resourceId: number | null): void {
    if (!this.canChoose() || this.chosen() === resourceId) {
      return;
    }
    this.chosen.set(resourceId);
    try {
      if (resourceId === null) {
        sessionStorage.removeItem(STORAGE_KEY);
      } else {
        sessionStorage.setItem(STORAGE_KEY, String(resourceId));
      }
    } catch {
      // Memoria del browser non disponibile: la scelta vale finché non si ricarica la pagina
    }
  }
}

function readStored(): number | null {
  try {
    const value = Number(sessionStorage.getItem(STORAGE_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}
