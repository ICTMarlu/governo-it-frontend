import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';

import { errorMessage } from '../../shared/crud/crud-api.service';
import { AccessLevel, LEVEL_LABELS, MODULES } from '../../core/auth/permissions';
import { LevelPicker } from './level-picker';
import { PermissionsService, Profile, UserPermissions } from './permissions.service';

export interface UserPermissionsDialogData {
  readonly user: UserPermissions;
  readonly profiles: readonly Profile[];
}

/**
 * Permessi di un utente: il profilo e, modulo per modulo, "Come il profilo" oppure
 * un'eccezione (Nascosto, Vista, Modifica). Le eccezioni sono evidenziate e contate.
 */
@Component({
  selector: 'gov-user-permissions-dialog',
  imports: [
    LevelPicker,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>Permessi di {{ data.user.displayName }}</h2>
    <mat-dialog-content class="content">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="profile">
        <mat-label>Profilo</mat-label>
        <mat-select [value]="profileId()" (valueChange)="profileId.set($event)">
          @for (profile of data.profiles; track profile.id) {
            <mat-option [value]="profile.id">{{ profile.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <p class="summary" role="status">
        <strong>{{ summary().visible }}</strong> moduli visibili ·
        <strong>{{ summary().edit }}</strong> in modifica ·
        <strong>{{ summary().overrides }}</strong>
        {{ summary().overrides === 1 ? 'eccezione' : 'eccezioni' }} al profilo
      </p>

      @for (group of groups; track group.title) {
        <section class="group" [attr.aria-label]="group.title">
          <h3 class="group__title">{{ group.title }}</h3>
          @for (module of group.items; track module.key) {
            <div class="row" [class.row--override]="overrides()[module.key] !== undefined">
              <div class="row__name">
                <mat-icon aria-hidden="true">{{ module.icon }}</mat-icon>
                <span>
                  <strong>{{ module.label }}</strong>
                  <span class="row__hint">{{ module.hint }}</span>
                </span>
              </div>
              <gov-level-picker
                [label]="'Livello di ' + module.label"
                [allowInherit]="true"
                [inheritLabel]="levelLabel(profileLevel(module.key))"
                [value]="overrides()[module.key] ?? null"
                (valueChange)="setOverride(module.key, $event)"
              />
            </div>
          }
        </section>
      }

      @if (error(); as message) {
        <p class="error" role="alert">{{ message }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Annulla</button>
      <button mat-flat-button type="button" [disabled]="saving()" (click)="save()">
        @if (saving()) {
          <mat-progress-spinner diameter="18" mode="indeterminate" aria-hidden="true" />
        }
        Salva
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      min-width: min(44rem, 92vw);
    }

    .profile {
      max-width: 22rem;
    }

    .summary {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
    }

    .group__title {
      margin: 0.5rem 0 0.25rem;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-large);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem 1rem;
      padding: 0.5rem 0.75rem;
      border-inline-start: 4px solid transparent;
      border-bottom: 1px solid var(--mat-sys-outline-variant);

      // Eccezione al profilo: barra a sinistra e sfondo leggero
      &--override {
        border-inline-start-color: var(--mat-sys-tertiary);
        background: color-mix(in srgb, var(--mat-sys-tertiary) 8%, transparent);
      }

      &__name {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      &__hint {
        display: block;
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-body-small);
      }
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
export class UserPermissionsDialog {
  protected readonly data = inject<UserPermissionsDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<UserPermissionsDialog, boolean>>(MatDialogRef);
  private readonly service = inject(PermissionsService);

  protected readonly profileId = signal(this.data.user.profileId);
  protected readonly overrides = signal<Readonly<Record<string, AccessLevel>>>({
    ...this.data.user.overrides,
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly groups = [...new Set(MODULES.map((module) => module.group))].map((title) => ({
    title,
    items: MODULES.filter((module) => module.group === title),
  }));

  private readonly profile = computed(
    () => this.data.profiles.find((profile) => profile.id === this.profileId()) ?? null,
  );

  protected readonly summary = computed(() => {
    const levels = MODULES.map((module) => this.effective(module.key));
    return {
      visible: levels.filter((level) => level !== 'NONE').length,
      edit: levels.filter((level) => level === 'EDIT').length,
      overrides: Object.keys(this.overrides()).length,
    };
  });

  protected profileLevel(module: string): AccessLevel {
    return this.profile()?.permissions[module] ?? 'NONE';
  }

  protected levelLabel(level: AccessLevel): string {
    return LEVEL_LABELS[level];
  }

  private effective(module: string): AccessLevel {
    return this.overrides()[module] ?? this.profileLevel(module);
  }

  protected setOverride(module: string, level: AccessLevel | null): void {
    this.overrides.update((current) => {
      const next = { ...current };
      if (level === null) {
        delete next[module];
      } else {
        next[module] = level;
      }
      return next;
    });
  }

  protected save(): void {
    this.saving.set(true);
    this.error.set(null);
    // Una eccezione uguale al livello del profilo non serve: la tolgo
    const overrides: Record<string, AccessLevel | ''> = {};
    for (const module of MODULES) {
      const level = this.overrides()[module.key];
      overrides[module.key] = level && level !== this.profileLevel(module.key) ? level : '';
    }
    this.service
      .saveUser(this.data.user.id, this.profileId(), overrides)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (error: unknown) => this.error.set(errorMessage(error)),
      });
  }
}
