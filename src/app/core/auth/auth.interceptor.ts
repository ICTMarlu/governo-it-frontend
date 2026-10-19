import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import { AuthService } from './auth.service';

/**
 * Per le chiamate alle API:
 * - aggiunge `X-Requested-With`, così il backend risponde 401 senza aprire il popup di login del browser;
 * - allega le credenziali della sessione, se presenti;
 * - su 401 chiude la sessione e porta alla pagina di login.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const apiBaseUrl = inject(API_BASE_URL);
  if (!request.url.startsWith(apiBaseUrl)) {
    return next(request);
  }

  const authService = inject(AuthService);
  const router = inject(Router);
  const authorization = authService.authorizationHeader();
  const isLoginAttempt = request.headers.has('Authorization');

  const setHeaders: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
  if (authorization && !isLoginAttempt) {
    setHeaders['Authorization'] = authorization;
  }

  return next(request.clone({ setHeaders })).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !isLoginAttempt) {
        authService.logout();
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
