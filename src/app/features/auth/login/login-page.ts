import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService, MICROSOFT_LOGIN_URL } from '../../../core/auth/auth.service';

/** Motivi di rifiuto del login Microsoft (codice `?errore=` scritto dal backend). */
const MICROSOFT_ERRORS: Record<string, string> = {
  UTENTE_NON_ABILITATO:
    'Il tuo account Microsoft non è abilitato a Governo IT. Chiedi l’accesso a un amministratore.',
  UTENTE_DISATTIVATO:
    'Il tuo utente di Governo IT è disattivato. Chiedi a un amministratore di riattivarlo.',
  TENANT_ERRATO: 'Questo account Microsoft non appartiene a Marlù. Entra con l’account aziendale.',
  ACCOUNT_IN_CONFLITTO:
    'La tua e-mail è già collegata a un altro account Microsoft. Chiedi a un amministratore di verificare l’utente.',
  ACCESSO_NON_RIUSCITO: 'Accesso con Microsoft non riuscito. Riprova tra qualche istante.',
};

/**
 * Pagina di login (smart component). Due modi di accesso, mostrati solo se attivi sul backend:
 * account Microsoft (progetto login Entra) e utente e password locali (D-02).
 */
@Component({
  selector: 'gov-login-page',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly form = inject(NonNullableFormBuilder).group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(microsoftError(this.route));
  protected readonly passwordVisible = signal(false);
  protected readonly options = toSignal(this.authService.loginOptions());
  protected readonly redirecting = signal(false);

  /** Login Microsoft: si lascia l'app, si torna dopo l'accesso (o con il motivo del rifiuto). */
  protected loginWithMicrosoft(): void {
    this.redirecting.set(true);
    window.location.assign(MICROSOFT_LOGIN_URL);
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { username, password } = this.form.getRawValue();
    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService
      .login(username, password)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => void this.router.navigateByUrl(this.returnUrl()),
        error: (error: unknown) => this.errorMessage.set(toMessage(error)),
      });
  }

  private returnUrl(): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    // Solo percorsi interni: evita redirect verso siti esterni
    return returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/home';
  }
}

function microsoftError(route: ActivatedRoute): string | null {
  const code = route.snapshot.queryParamMap.get('errore');
  return code ? (MICROSOFT_ERRORS[code] ?? MICROSOFT_ERRORS['ACCESSO_NON_RIUSCITO']) : null;
}

function toMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.status === 401) {
    return 'Utente o password non corretti.';
  }
  if (error instanceof HttpErrorResponse && error.status === 0) {
    return 'Il server non risponde. Verifica che il backend sia avviato.';
  }
  return 'Accesso non riuscito. Riprova tra qualche istante.';
}
