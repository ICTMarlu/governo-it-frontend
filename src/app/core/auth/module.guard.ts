import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { ModuleKey, canView, moduleOfEndpoint } from './permissions';

/**
 * Consente la pagina solo a chi vede il modulo indicato in `data.module` (o, per le anagrafiche
 * generate dalla configurazione, quello del loro indirizzo API). Con `data.anyOf` basta uno dei
 * moduli. È solo una comodità di navigazione: i permessi veri li applica il backend.
 */
export const moduleGuard: CanActivateFn = (route) => {
  const permissions = inject(AuthService).currentUser()?.permissions;
  const data = route.data as {
    module?: ModuleKey;
    anyOf?: readonly ModuleKey[];
    config?: { endpoint: string };
  };
  const modules: readonly ModuleKey[] =
    data.anyOf ??
    [data.module ?? (data.config ? moduleOfEndpoint(data.config.endpoint) : null)].filter(
      (module): module is ModuleKey => module !== null,
    );
  return modules.length === 0 || modules.some((module) => canView(permissions, module))
    ? true
    : inject(Router).createUrlTree(['/home']);
};
