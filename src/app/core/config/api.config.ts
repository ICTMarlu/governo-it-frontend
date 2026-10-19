import { InjectionToken } from '@angular/core';

/**
 * URL base delle API REST versionate. In sviluppo le chiamate a /api passano
 * dal proxy di `ng serve` (proxy.conf.json) verso il backend su localhost:8080.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api/v1',
});
