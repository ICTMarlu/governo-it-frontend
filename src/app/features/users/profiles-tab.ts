import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';

import { AccessLevel, MODULES } from '../../core/auth/permissions';
import { errorMessage } from '../../shared/crud/crud-api.service';
import { LevelPicker } from './level-picker';
import { PermissionsService, Profile } from './permissions.service';

/**
 * Profili: una colonna per profilo, una riga per modulo. Le celle cambiate si evidenziano e si
 * salvano insieme; il cambio vale per tutti gli utenti del profilo (salvo le loro eccezioni).
 */
@Component({
  selector: 'gov-profiles-tab',
  imports: [LevelPicker, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <p class="intro">
      Ogni utente ha un profilo che dà i livelli di partenza. Cambiando un livello qui cambia per
      tutti gli utenti di quel profilo; per una sola persona usa le eccezioni nella scheda
      <em>Permessi</em>.
    </p>

    @if (loading()) {
      <p class="state" role="status">
        <mat-progress-spinner diameter="24" mode="indeterminate" aria-hidden="true" /> Caricamento…
      </p>
    } @else if (error(); as message) {
      <p class="state" role="alert">{{ message }}</p>
    } @else {
      <div class="scroll">
        <table class="grid">
          <thead>
            <tr>
              <th scope="col">Modulo</th>
              @for (profile of profiles(); track profile.id) {
                <th scope="col" class="prof">
                  {{ profile.label }}
                  <span class="sub"
                    >{{ profile.users }} {{ profile.users === 1 ? 'utente' : 'utenti' }}</span
                  >
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (module of modules; track module.key) {
              <tr>
                <th scope="row">
                  <mat-icon aria-hidden="true">{{ module.icon }}</mat-icon>
                  <span>
                    <strong>{{ module.label }}</strong>
                    <span class="sub">{{ module.hint }}</span>
                  </span>
                </th>
                @for (profile of profiles(); track profile.id) {
                  <td class="cell" [class.cell--changed]="changed(profile, module.key)">
                    <gov-level-picker
                      [compact]="true"
                      [label]="module.label + ' per ' + profile.label"
                      [value]="level(profile, module.key)"
                      [disabled]="locked(profile, module.key)"
                      (valueChange)="set(profile, module.key, $event)"
                    />
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="bar" [class.bar--on]="changes() > 0">
        @if (changes() > 0) {
          <span role="status"
            >{{ changes() }} {{ changes() === 1 ? 'modifica' : 'modifiche' }} da salvare</span
          >
          <button mat-button type="button" (click)="reset()">Annulla</button>
          <button mat-flat-button type="button" [disabled]="saving()" (click)="save()">
            @if (saving()) {
              <mat-progress-spinner diameter="18" mode="indeterminate" aria-hidden="true" />
            }
            Salva
          </button>
        } @else {
          <span class="muted">Nessuna modifica. Clic su un livello per cambiarlo.</span>
        }
      </div>
    }
  `,
  styles: `
    .intro {
      margin: 1rem 0;
      color: var(--mat-sys-on-surface-variant);
    }

    .scroll {
      overflow-x: auto;
    }

    .grid {
      width: 100%;
      border-collapse: collapse;
      font: var(--mat-sys-body-small);

      th,
      td {
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        text-align: start;
      }

      thead th {
        font: var(--mat-sys-label-large);
        vertical-align: bottom;
      }

      th.prof {
        text-align: center;
      }

      tbody th {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-weight: 400;
      }

      .sub {
        display: block;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-body-small);
      }

      .cell {
        text-align: center;
      }

      // Cella cambiata e non ancora salvata
      .cell--changed {
        background: color-mix(in srgb, var(--mat-sys-tertiary) 12%, transparent);
        box-shadow: inset 3px 0 0 var(--mat-sys-tertiary);
      }
    }

    .bar {
      position: sticky;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-block-start: 1rem;
      padding: 0.75rem;
      border-radius: 0.75rem;
      background: var(--mat-sys-surface-container);

      &--on {
        background: var(--mat-sys-tertiary-container);
        color: var(--mat-sys-on-tertiary-container);
      }
    }

    .muted,
    .state {
      color: var(--mat-sys-on-surface-variant);
    }

    .state {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
  `,
})
export class ProfilesTab {
  private readonly service = inject(PermissionsService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly modules = MODULES;
  protected readonly profiles = signal<Profile[]>([]);
  /** Modifiche non salvate: id del profilo → modulo → livello. */
  private readonly draft = signal<Readonly<Record<number, Readonly<Record<string, AccessLevel>>>>>(
    {},
  );
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly changes = computed(() =>
    Object.values(this.draft()).reduce((sum, perModule) => sum + Object.keys(perModule).length, 0),
  );

  constructor() {
    this.load();
  }

  private load(): void {
    this.service.profiles().subscribe({
      next: (profiles) => {
        this.profiles.set(profiles);
        this.draft.set({});
        this.loading.set(false);
        this.error.set(null);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  protected level(profile: Profile, module: string): AccessLevel {
    return this.draft()[profile.id]?.[module] ?? profile.permissions[module] ?? 'NONE';
  }

  protected changed(profile: Profile, module: string): boolean {
    return this.draft()[profile.id]?.[module] !== undefined;
  }

  /** L'Amministratore deve sempre poter modificare gli utenti: altrimenti nessuno potrebbe rimediare. */
  protected locked(profile: Profile, module: string): boolean {
    return profile.code === 'ADMIN' && module === 'USERS';
  }

  protected set(profile: Profile, module: string, level: AccessLevel | null): void {
    if (level === null) {
      return;
    }
    this.draft.update((current) => {
      const perModule = { ...(current[profile.id] ?? {}) };
      if (level === (profile.permissions[module] ?? 'NONE')) {
        delete perModule[module];
      } else {
        perModule[module] = level;
      }
      const next = { ...current, [profile.id]: perModule };
      if (Object.keys(perModule).length === 0) {
        delete next[profile.id];
      }
      return next;
    });
  }

  protected reset(): void {
    this.draft.set({});
  }

  protected save(): void {
    const requests = Object.entries(this.draft()).map(([id, perModule]) =>
      this.service.saveProfile(Number(id), { ...perModule }),
    );
    if (requests.length === 0) {
      return;
    }
    this.saving.set(true);
    forkJoin(requests).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackBar.open('Profili salvati', 'OK', { duration: 3000 });
        this.load();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.snackBar.open(errorMessage(error), 'Chiudi');
      },
    });
  }
}
