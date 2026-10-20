import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Consente l'accesso solo ai ruoli indicati in `data.roles` (da usare dopo authGuard).
 * È solo una comodità di navigazione: i permessi veri li applica il backend.
 */
export const roleGuard: CanActivateFn = (route) => {
  const roles = (route.data['roles'] as readonly string[] | undefined) ?? [];
  const role = inject(AuthService).currentUser()?.role;
  return role !== undefined && roles.includes(role)
    ? true
    : inject(Router).createUrlTree(['/home']);
};
