import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AuthService } from '../../core/auth/auth.service';
import { canEdit } from '../../core/auth/permissions';
import { API_BASE_URL } from '../../core/config/api.config';
import { BackLink } from '../../shared/components/back-link/back-link';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { errorMessage } from '../../shared/crud/crud-api.service';
import { PARAMETERS_HELP } from '../../shared/help/help-content';

interface Parameter {
  readonly code: string;
  readonly value: string | null;
  readonly valueType: 'DECIMAL' | 'INT' | 'BOOL' | 'TEXT';
  readonly description: string | null;
  readonly allowedValues: readonly string[];
  readonly version: string;
}

/** Etichette leggibili dei valori a scelta. */
const CHOICE_LABELS: Readonly<Record<string, string>> = {
  OFF: 'Spenti',
  DAILY: 'Ogni giorno lavorativo',
  WEEKLY: 'Il lunedì',
};

/** Parametri generali: elenco con modifica in linea, riservata all'Admin. */
@Component({
  selector: 'gov-parameters-page',
  imports: [BackLink, MatButtonModule, MatSelectModule, PageHeader],
  template: `
    <gov-back-link [target]="{ link: '/master-data', label: 'Anagrafiche e liste' }" />
    <gov-page-header
      title="Parametri generali"
      subtitle="Valori validi per tutta l’applicazione. Li modifica solo l’Admin."
      [help]="help"
    />
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    <table class="params">
      <thead>
        <tr>
          <th scope="col">Parametro</th>
          <th scope="col">Valore</th>
          @if (canEdit()) {
            <th scope="col"><span class="visually-hidden">Azioni</span></th>
          }
        </tr>
      </thead>
      <tbody>
        @for (parameter of parameters(); track parameter.code) {
          <tr>
            <th scope="row">
              <code>{{ parameter.code }}</code>
              <span class="params__description">{{ parameter.description }}</span>
            </th>
            <td>
              @if (parameter.allowedValues.length > 0) {
                <mat-select
                  class="params__input"
                  [attr.aria-label]="parameter.code"
                  [disabled]="!canEdit()"
                  [value]="draft()[parameter.code] ?? parameter.value"
                  (valueChange)="setDraft(parameter.code, $event)"
                >
                  @for (choice of parameter.allowedValues; track choice) {
                    <mat-option [value]="choice">{{ choiceLabel(choice) }}</mat-option>
                  }
                </mat-select>
              } @else {
                <input
                  class="params__input"
                  [attr.aria-label]="parameter.code"
                  [attr.inputmode]="parameter.valueType === 'TEXT' ? null : 'decimal'"
                  [readOnly]="!canEdit()"
                  [value]="draft()[parameter.code] ?? parameter.value ?? ''"
                  (input)="setDraft(parameter.code, $any($event.target).value)"
                  (keydown.enter)="save(parameter)"
                />
              }
            </td>
            @if (canEdit()) {
              <td>
                <button
                  mat-flat-button
                  type="button"
                  [disabled]="!isChanged(parameter)"
                  (click)="save(parameter)"
                >
                  Salva
                </button>
              </td>
            }
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    .params {
      width: 100%;
      max-width: 60rem;
      border-collapse: collapse;

      th,
      td {
        padding: 0.5rem;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        text-align: start;
        vertical-align: middle;
      }

      thead th {
        font: var(--mat-sys-label-large);
        color: var(--mat-sys-on-surface-variant);
      }

      tbody th {
        font-weight: normal;
      }

      &__description {
        display: block;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-body-small);
      }

      &__input {
        box-sizing: border-box;
        width: 14rem;
        height: 2.25rem;
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--mat-sys-outline);
        border-radius: 0.5rem;
        background: var(--mat-sys-surface);
        color: var(--mat-sys-on-surface);
        font: var(--mat-sys-body-medium);
        align-content: center;
      }
    }

    .error {
      color: var(--mat-sys-error);
    }
  `,
})
export class ParametersPage {
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);
  private readonly url = `${inject(API_BASE_URL)}/parameters`;
  private readonly currentUser = inject(AuthService).currentUser;

  protected readonly help = PARAMETERS_HELP;
  protected readonly parameters = signal<Parameter[]>([]);
  protected readonly draft = signal<Readonly<Record<string, string>>>({});
  protected readonly error = signal<string | null>(null);
  protected readonly canEdit = computed(() =>
    canEdit(this.currentUser()?.permissions, 'MASTER_DATA'),
  );

  constructor() {
    this.load();
  }

  protected choiceLabel(choice: string): string {
    return CHOICE_LABELS[choice] ? `${CHOICE_LABELS[choice]} (${choice})` : choice;
  }

  protected setDraft(code: string, value: string): void {
    this.draft.update((draft) => ({ ...draft, [code]: value }));
  }

  protected isChanged(parameter: Parameter): boolean {
    const value = this.draft()[parameter.code];
    return value !== undefined && value !== (parameter.value ?? '');
  }

  protected save(parameter: Parameter): void {
    if (!this.isChanged(parameter)) {
      return;
    }
    this.http
      .put<Parameter>(`${this.url}/${parameter.code}`, {
        value: this.draft()[parameter.code],
        version: parameter.version,
      })
      .subscribe({
        next: (saved) => {
          this.parameters.update((list) => list.map((p) => (p.code === saved.code ? saved : p)));
          this.draft.update((draft) =>
            Object.fromEntries(Object.entries(draft).filter(([code]) => code !== saved.code)),
          );
          this.snackBar.open('Parametro salvato', undefined, { duration: 2000 });
        },
        error: (error: unknown) =>
          this.snackBar.open(errorMessage(error), 'OK', { duration: 6000 }),
      });
  }

  private load(): void {
    this.http.get<Parameter[]>(this.url).subscribe({
      next: (parameters) => this.parameters.set(parameters),
      error: (error: unknown) => this.error.set(errorMessage(error)),
    });
  }
}
