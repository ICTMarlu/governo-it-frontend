import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import {
  FormGroupDirective,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { errorMessage } from '../../shared/crud/crud-api.service';
import { API_BASE_URL } from '../config/api.config';

/** Porta del backend: Claude si collega direttamente al server MCP, non passa dal frontend. */
const BACKEND_PORT = 8080;

interface McpToken {
  readonly id: number;
  readonly name: string;
  readonly prefix: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly lastUsedAt: string | null;
  readonly revokedAt: string | null;
  readonly active: boolean;
}

interface CreatedMcpToken {
  readonly info: McpToken;
  readonly token: string;
}

/**
 * Accesso da Claude (D-MCP-05): token personali per collegare Claude Code al server MCP con i
 * propri permessi, senza usare la password. Il token si vede una volta sola, appena creato.
 */
@Component({
  selector: 'gov-mcp-tokens-dialog',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
  ],
  template: `
    <h2 mat-dialog-title>Accesso da Claude</h2>
    <mat-dialog-content class="content">
      <p class="intro">
        Con un token personale colleghi Claude Code a Governo IT: Claude potrà leggere e modificare
        i dati con i tuoi stessi permessi. Il token sostituisce la password e si può revocare quando
        vuoi.
      </p>

      @if (created(); as fresh) {
        <section class="fresh" aria-labelledby="fresh-title">
          <h3 id="fresh-title">Token creato: copialo adesso</h3>
          <p>Non sarà più visibile dopo la chiusura di questo riquadro.</p>
          <code class="value">{{ fresh.token }}</code>
          <p>
            Comando da incollare in PowerShell sul PC su cui usi Claude (serve Node.js); poi apri
            una nuova sessione di Claude:
          </p>
          <code class="value">{{ command(fresh.token) }}</code>
          <div class="fresh-actions">
            <button mat-stroked-button type="button" (click)="copy(fresh.token, 'Token copiato')">
              <mat-icon aria-hidden="true">content_copy</mat-icon> Copia token
            </button>
            <button
              mat-flat-button
              type="button"
              (click)="copy(command(fresh.token), 'Comando copiato')"
            >
              <mat-icon aria-hidden="true">terminal</mat-icon> Copia comando
            </button>
          </div>
        </section>
      }

      <form
        class="new"
        #formDirective="ngForm"
        [formGroup]="form"
        (ngSubmit)="create(formDirective)"
        novalidate
      >
        <mat-form-field appearance="outline">
          <mat-label>Nome del token</mat-label>
          <input matInput formControlName="name" maxlength="80" required />
          <mat-hint>Per riconoscerlo, es. "PC ufficio"</mat-hint>
          @if (form.controls.name.hasError('required')) {
            <mat-error>Dai un nome al token</mat-error>
          }
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Durata</mat-label>
          <mat-select formControlName="validDays">
            @for (option of durations; track option.days) {
              <mat-option [value]="option.days">{{ option.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <button mat-flat-button type="submit" [disabled]="saving()">Crea token</button>
      </form>

      @if (errorMessage(); as message) {
        <p class="error" role="alert">{{ message }}</p>
      }

      <h3 class="list-title">I tuoi token</h3>
      @if (tokens().length === 0) {
        <p class="empty">Nessun token creato.</p>
      } @else {
        <ul class="tokens">
          @for (token of tokens(); track token.id) {
            <li [class.inactive]="!token.active">
              <div class="token-main">
                <strong>{{ token.name }}</strong>
                <code>{{ token.prefix }}…</code>
              </div>
              <div class="token-meta">
                @if (token.revokedAt) {
                  <span>Revocato il {{ token.revokedAt | date: 'dd/MM/yyyy' }}</span>
                } @else if (!token.active) {
                  <span>Scaduto il {{ token.expiresAt | date: 'dd/MM/yyyy' }}</span>
                } @else {
                  <span>Scade il {{ token.expiresAt | date: 'dd/MM/yyyy' }}</span>
                }
                <span>
                  Ultimo uso:
                  {{ token.lastUsedAt ? (token.lastUsedAt | date: 'dd/MM/yyyy HH:mm') : 'mai' }}
                </span>
              </div>
              @if (token.active) {
                <button
                  mat-button
                  type="button"
                  class="revoke"
                  [attr.aria-label]="'Revoca il token ' + token.name"
                  (click)="revoke(token)"
                >
                  Revoca
                </button>
              }
            </li>
          }
        </ul>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Chiudi</button>
    </mat-dialog-actions>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding-block-start: 0.5rem;
    }

    .intro,
    .empty {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }

    h3 {
      margin: 0;
      font: var(--mat-sys-title-small);
    }

    .fresh {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
      border-radius: 0.5rem;
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);

      p {
        margin: 0;
      }
    }

    .value {
      display: block;
      padding: 0.5rem;
      border-radius: 0.25rem;
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
      overflow-wrap: anywhere;
      user-select: all;
    }

    .fresh-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .new {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.5rem;
      align-items: start;
    }

    @media (min-width: 600px) {
      .new {
        grid-template-columns: 2fr 1fr auto;

        button {
          margin-block-start: 0.5rem;
        }
      }
    }

    .tokens {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;

      li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.25rem 1rem;
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 0.5rem;
      }

      li.inactive {
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .token-main {
      display: flex;
      gap: 0.5rem;
      align-items: baseline;
      flex: 1 1 12rem;
    }

    .token-meta {
      display: flex;
      flex-direction: column;
      font: var(--mat-sys-body-small);
    }

    .revoke {
      color: var(--mat-sys-error);
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
export class McpTokensDialog implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/auth/me/mcp-tokens`;
  private readonly clipboard = inject(Clipboard);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly durations = [
    { days: 30, label: '30 giorni' },
    { days: 90, label: '90 giorni' },
    { days: 180, label: '6 mesi' },
    { days: 365, label: '1 anno' },
  ];
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    validDays: [90],
  });
  protected readonly tokens = signal<readonly McpToken[]>([]);
  protected readonly created = signal<CreatedMcpToken | null>(null);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  /**
   * Comando che registra il server MCP con il token. Usa npx.cmd: funziona anche senza la CLI di
   * Claude installata (basta Node.js) e in PowerShell, dove npx.ps1 è bloccato dai criteri di esecuzione.
   */
  protected command(token: string): string {
    const url = `${location.protocol}//${location.hostname}:${BACKEND_PORT}/mcp`;
    return `npx.cmd -y @anthropic-ai/claude-code mcp add --transport http --scope user governo-it ${url} --header "Authorization: Bearer ${token}"`;
  }

  protected create(formDirective: FormGroupDirective): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    this.http
      .post<CreatedMcpToken>(this.url, this.form.getRawValue())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (created) => {
          this.created.set(created);
          // resetForm azzera anche lo stato "inviato": il campo vuoto non mostra subito l'errore
          formDirective.resetForm({ name: '', validDays: 90 });
          this.load();
        },
        error: (error: unknown) => this.errorMessage.set(errorMessage(error)),
      });
  }

  protected revoke(token: McpToken): void {
    this.errorMessage.set(null);
    this.http.delete<void>(`${this.url}/${token.id}`).subscribe({
      next: () => {
        this.snackBar.open(`Token "${token.name}" revocato`, 'OK', { duration: 3000 });
        this.load();
      },
      error: (error: unknown) => this.errorMessage.set(errorMessage(error)),
    });
  }

  protected copy(text: string, message: string): void {
    if (this.clipboard.copy(text)) {
      this.snackBar.open(message, 'OK', { duration: 2000 });
    }
  }

  private load(): void {
    this.http.get<McpToken[]>(this.url).subscribe({
      next: (tokens) => this.tokens.set(tokens),
      error: (error: unknown) => this.errorMessage.set(errorMessage(error)),
    });
  }
}
