import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize, switchMap } from 'rxjs';

import { errorMessage } from '../../shared/crud/crud-api.service';
import { API_BASE_URL } from '../config/api.config';
import { AuthService } from './auth.service';

const MIN_LENGTH = 10;

/** La conferma deve coincidere con la nuova password. */
function samePassword(group: AbstractControl): ValidationErrors | null {
  const value = group.value as { newPassword: string; confirmPassword: string };
  return value.newPassword === value.confirmPassword ? null : { mismatch: true };
}

/** Cambio della propria password (login locale, fase di test D-02). */
@Component({
  selector: 'gov-change-password-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>Cambia password</h2>
    <form [formGroup]="form" (ngSubmit)="save()" novalidate>
      <mat-dialog-content class="content">
        <mat-form-field appearance="outline">
          <mat-label>Password attuale</mat-label>
          <input
            matInput
            type="password"
            formControlName="currentPassword"
            autocomplete="current-password"
            required
          />
          @if (form.controls.currentPassword.hasError('required')) {
            <mat-error>Inserisci la password attuale</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Nuova password</mat-label>
          <input
            matInput
            type="password"
            formControlName="newPassword"
            autocomplete="new-password"
            required
          />
          <mat-hint>Almeno {{ minLength }} caratteri</mat-hint>
          @if (form.controls.newPassword.hasError('minlength')) {
            <mat-error>Almeno {{ minLength }} caratteri</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Conferma nuova password</mat-label>
          <input
            matInput
            type="password"
            formControlName="confirmPassword"
            autocomplete="new-password"
            required
          />
        </mat-form-field>
        @if (form.hasError('mismatch') && form.controls.confirmPassword.touched) {
          <p class="error" role="alert">Le due password non coincidono.</p>
        }
        @if (errorMessage(); as message) {
          <p class="error" role="alert">{{ message }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit" [disabled]="saving()">Salva</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding-block-start: 0.5rem;
    }

    .error {
      margin: 0;
      padding: 0.75rem;
      border-radius: 0.25rem;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class ChangePasswordDialog {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/auth/me/password`;
  private readonly authService = inject(AuthService);
  private readonly dialogRef = inject<MatDialogRef<ChangePasswordDialog, boolean>>(MatDialogRef);

  protected readonly minLength = MIN_LENGTH;
  protected readonly form = inject(NonNullableFormBuilder).group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(MIN_LENGTH)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: samePassword },
  );
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { currentPassword, newPassword } = this.form.getRawValue();
    const username = this.authService.currentUser()?.username ?? '';
    this.saving.set(true);
    this.errorMessage.set(null);
    this.http
      .put<void>(this.url, { currentPassword, newPassword })
      .pipe(
        // La sessione usa le credenziali: si riapre con la nuova password
        switchMap(() => this.authService.login(username, newPassword)),
        finalize(() => this.saving.set(false)),
      )
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (error: unknown) => this.errorMessage.set(errorMessage(error)),
      });
  }
}
