import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin } from 'rxjs';

import { API_BASE_URL } from '../../../../core/config/api.config';
import { errorMessage } from '../../../../shared/crud/crud-api.service';

/** Chi si può scegliere: un utente ("u<id>") o una persona del team senza utente ("r<id>"). */
export interface ViewAsOption {
  readonly key: string;
  readonly name: string;
  readonly hint: string;
}

interface UserRow {
  readonly id: number;
  readonly displayName: string;
  readonly roleLabel: string;
  readonly resourceId: number | null;
  readonly resourceName: string | null;
  readonly active: boolean;
}

interface ResourceRow {
  readonly id: number;
  readonly fullName: string;
  readonly active: boolean;
}

/**
 * "Vedi la home come…" (D-35), solo per l'Admin: sceglie un utente o una persona del team e la
 * home si apre come la vede lei. Vuoto = la propria home (vista generale).
 */
@Component({
  selector: 'gov-home-view-as',
  imports: [MatFormFieldModule, MatIconModule, MatSelectModule],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic" class="view-as">
      <mat-label>Vedi la home come…</mat-label>
      <mat-icon matIconPrefix aria-hidden="true">visibility</mat-icon>
      <mat-select [value]="selected() ?? ''" (valueChange)="choose($event)">
        <mat-option value="">La mia home (vista generale)</mat-option>
        @if (users().length > 0) {
          <mat-optgroup label="Utenti">
            @for (option of users(); track option.key) {
              <mat-option [value]="option.key">
                {{ option.name }} <span class="hint">· {{ option.hint }}</span>
              </mat-option>
            }
          </mat-optgroup>
        }
        @if (people().length > 0) {
          <mat-optgroup label="Persone del team senza utente">
            @for (option of people(); track option.key) {
              <mat-option [value]="option.key">
                {{ option.name }} <span class="hint">· {{ option.hint }}</span>
              </mat-option>
            }
          </mat-optgroup>
        }
      </mat-select>
      @if (error(); as message) {
        <mat-hint class="error">{{ message }}</mat-hint>
      }
    </mat-form-field>
  `,
  styles: `
    .view-as {
      width: min(22rem, 100%);
    }

    .hint {
      color: var(--mat-sys-on-surface-variant);
    }

    .error {
      color: var(--mat-sys-error);
    }
  `,
})
export class HomeViewAs {
  /** Utente collegato: non compare tra le scelte. */
  readonly currentUserId = input.required<number>();
  /** Scelta attuale ("u<id>" o "r<id>"), null = la propria home. */
  readonly selected = input<string | null>(null);
  /** Scelta nuova; null = la propria home. */
  readonly changed = output<ViewAsOption | null>();
  /** Nome di chi è già scelto (es. dall'indirizzo), appena l'elenco è caricato. */
  readonly selectedName = output<string | null>();

  private readonly options = signal<{ users: ViewAsOption[]; people: ViewAsOption[] }>({
    users: [],
    people: [],
  });
  protected readonly users = computed(() => this.options().users);
  protected readonly people = computed(() => this.options().people);
  protected readonly error = signal<string | null>(null);

  constructor() {
    const base = inject(API_BASE_URL);
    const http = inject(HttpClient);
    forkJoin({
      users: http.get<UserRow[]>(`${base}/users`),
      resources: http.get<ResourceRow[]>(`${base}/resources`),
    }).subscribe({
      next: ({ users, resources }) => {
        this.options.set(viewAsOptions(users, resources, this.currentUserId()));
        this.selectedName.emit(this.find(this.selected())?.name ?? null);
      },
      error: (e) => this.error.set(`Elenco non disponibile: ${errorMessage(e)}`),
    });
  }

  protected choose(key: string): void {
    this.changed.emit(this.find(key) ?? null);
  }

  private find(key: string | null): ViewAsOption | undefined {
    return key
      ? [...this.users(), ...this.people()].find((option) => option.key === key)
      : undefined;
  }
}

/** Utenti attivi (escluso chi guarda) e persone attive del team che non hanno un utente. */
export function viewAsOptions(
  users: readonly UserRow[],
  resources: readonly ResourceRow[],
  currentUserId: number,
): { users: ViewAsOption[]; people: ViewAsOption[] } {
  const byName = (a: ViewAsOption, b: ViewAsOption): number => a.name.localeCompare(b.name, 'it');
  const linked = new Set(users.map((user) => user.resourceId).filter((id) => id !== null));
  return {
    users: users
      .filter((user) => user.active && user.id !== currentUserId)
      .map((user) => ({
        key: `u${user.id}`,
        name: user.displayName,
        hint: user.resourceName ? user.roleLabel : `${user.roleLabel}, senza persona collegata`,
      }))
      .sort(byName),
    people: resources
      .filter((resource) => resource.active && !linked.has(resource.id))
      .map((resource) => ({
        key: `r${resource.id}`,
        name: resource.fullName,
        hint: 'senza utente',
      }))
      .sort(byName),
  };
}

/** Parametri delle chiamate della home per la scelta: asUser o asResource. */
export function viewAsParams(key: string | null | undefined): Record<string, string> {
  if (!key || key.length < 2) {
    return {};
  }
  const id = key.slice(1);
  return key.startsWith('u') ? { asUser: id } : key.startsWith('r') ? { asResource: id } : {};
}
