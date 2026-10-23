import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AccessLevel, LEVEL_ICONS, LEVEL_LABELS, MODULES } from '../../core/auth/permissions';
import { errorMessage } from '../../shared/crud/crud-api.service';
import { matchesTerms, searchTerms } from '../../shared/util/text-search';
import { PermissionsService, Profile, UserPermissions } from './permissions.service';
import { UserPermissionsDialog, UserPermissionsDialogData } from './user-permissions-dialog';

/** Chi può cosa: una riga per utente, una colonna per modulo. Clic su una riga per modificarla. */
@Component({
  selector: 'gov-permissions-tab',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  template: `
    <div class="tools">
      <label class="inline-search">
        <mat-icon aria-hidden="true">search</mat-icon>
        <input
          class="inline-search__input"
          type="search"
          placeholder="Cerca un utente…"
          aria-label="Cerca un utente"
          [value]="search()"
          (input)="search.set($any($event.target).value)"
        />
      </label>
      <mat-slide-toggle [checked]="onlyExceptions()" (change)="onlyExceptions.set($event.checked)">
        Solo chi ha eccezioni
      </mat-slide-toggle>
      <span class="legend" aria-label="Legenda">
        @for (level of levels; track level) {
          <span class="chip chip--{{ level }}">
            <mat-icon aria-hidden="true">{{ icons[level] }}</mat-icon
            >{{ labels[level] }}
          </span>
        }
        <span class="legend__dot"
          ><span class="dot" aria-hidden="true"></span> eccezione al profilo</span
        >
      </span>
    </div>

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
              <th scope="col">Utente</th>
              <th scope="col">Profilo</th>
              @for (module of modules; track module.key) {
                <th scope="col" class="mod" [matTooltip]="module.hint">
                  <mat-icon aria-hidden="true">{{ module.icon }}</mat-icon>
                  <span>{{ module.label }}</span>
                </th>
              }
              <th scope="col" class="act"><span class="visually-hidden">Azioni</span></th>
            </tr>
          </thead>
          <tbody>
            @for (user of rows(); track user.id) {
              <tr [class.inactive]="!user.active" (click)="open(user)">
                <th scope="row">
                  <strong>{{ user.displayName }}</strong>
                  <span class="sub"
                    >{{ user.username }}{{ user.active ? '' : ' · disattivato' }}</span
                  >
                </th>
                <td>{{ user.profileLabel }}</td>
                @for (module of modules; track module.key) {
                  <td class="cell">
                    <span
                      class="chip chip--{{ user.effective[module.key] }}"
                      [matTooltip]="tip(user, module.key)"
                    >
                      <mat-icon aria-hidden="true">{{
                        icons[user.effective[module.key]]
                      }}</mat-icon>
                      {{ labels[user.effective[module.key]] }}
                      @if (user.overrides[module.key]) {
                        <span class="dot" aria-label="eccezione al profilo"></span>
                      }
                    </span>
                  </td>
                }
                <td class="act">
                  <button
                    mat-icon-button
                    type="button"
                    [attr.aria-label]="'Modifica i permessi di ' + user.displayName"
                    matTooltip="Modifica i permessi"
                    (click)="$event.stopPropagation(); open(user)"
                  >
                    <mat-icon aria-hidden="true">edit</mat-icon>
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td [attr.colspan]="modules.length + 3" class="empty">Nessun utente.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    :host {
      --lv-none: light-dark(#5f6672, #9aa1ad);
      --lv-view: light-dark(#2a78d6, #5ba0f0);
      --lv-edit: light-dark(#2e7d32, #7cc683);
      display: block;
    }

    .tools {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem 1.25rem;
      margin-block: 1rem;
    }

    .legend {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-inline-start: auto;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
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
        padding: 0.5rem 0.5rem;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
        text-align: start;
        white-space: nowrap;
      }

      thead th {
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-label-medium);
        vertical-align: bottom;
      }

      th.mod {
        text-align: center;
        white-space: normal;
        min-width: 5.5rem;

        mat-icon {
          display: block;
          margin: 0 auto 0.125rem;
        }
      }

      tbody tr {
        cursor: pointer;

        &:hover {
          background: var(--mat-sys-surface-container-low);
        }

        &.inactive {
          opacity: 0.6;
        }
      }

      .sub {
        display: block;
        color: var(--mat-sys-on-surface-variant);
        font-weight: 400;
      }

      .cell {
        text-align: center;
      }

      .act {
        width: 3rem;
        text-align: end;
      }

      .empty {
        padding: 1.5rem;
        text-align: center;
        color: var(--mat-sys-on-surface-variant);
      }
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.5rem 0.125rem 0.375rem;
      border-radius: 1rem;
      font: var(--mat-sys-label-medium);
      white-space: nowrap;

      mat-icon {
        width: 1rem;
        height: 1rem;
        font-size: 1rem;
      }

      &--NONE {
        background: color-mix(in srgb, var(--lv-none) 14%, transparent);
        color: var(--lv-none);
      }

      &--VIEW {
        background: color-mix(in srgb, var(--lv-view) 16%, transparent);
        color: var(--lv-view);
      }

      &--EDIT {
        background: color-mix(in srgb, var(--lv-edit) 16%, transparent);
        color: var(--lv-edit);
        font-weight: 700;
      }
    }

    .dot {
      display: inline-block;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 50%;
      background: var(--mat-sys-tertiary);
    }

    .state {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class PermissionsTab {
  private readonly service = inject(PermissionsService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly modules = MODULES;
  protected readonly levels: readonly AccessLevel[] = ['NONE', 'VIEW', 'EDIT'];
  protected readonly labels = LEVEL_LABELS;
  protected readonly icons = LEVEL_ICONS;

  protected readonly users = signal<UserPermissions[]>([]);
  private profiles: Profile[] = [];
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly onlyExceptions = signal(false);

  protected readonly rows = computed(() => {
    const terms = searchTerms(this.search());
    return this.users().filter(
      (user) =>
        (!this.onlyExceptions() || Object.keys(user.overrides).length > 0) &&
        matchesTerms(terms, [user.displayName, user.username, user.profileLabel]),
    );
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.service.profiles().subscribe({
      next: (profiles) => (this.profiles = profiles),
      error: () => undefined,
    });
    this.service.users().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
        this.error.set(null);
      },
      error: (error: unknown) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  protected tip(user: UserPermissions, module: string): string {
    const override = user.overrides[module];
    return override
      ? `${LEVEL_LABELS[override]}: eccezione al profilo ${user.profileLabel}`
      : `Come il profilo ${user.profileLabel}`;
  }

  protected open(user: UserPermissions): void {
    const data: UserPermissionsDialogData = { user, profiles: this.profiles };
    this.dialog
      .open<UserPermissionsDialog, UserPermissionsDialogData, boolean>(UserPermissionsDialog, {
        data,
        maxWidth: '100vw',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open(`Permessi di ${user.displayName} salvati`, 'OK', { duration: 3000 });
          this.load();
        }
      });
  }
}
