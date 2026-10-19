import { Component, DestroyRef, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Observable, finalize, of } from 'rxjs';

import { CrudApiService, errorMessage } from '../crud-api.service';
import { EntityConfig, EntityRow, FieldConfig, SelectOption } from '../crud.model';

export interface EntityFormDialogData {
  readonly config: EntityConfig;
  /** Riga da modificare; assente in creazione. */
  readonly row?: EntityRow;
}

/**
 * Form di creazione/modifica generato dalla configurazione dell'anagrafica.
 * - Mobile: a tutto schermo, campi su una colonna.
 * - Da tablet: finestra centrata, campi su due colonne.
 */
@Component({
  selector: 'gov-entity-form-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './entity-form-dialog.html',
  styleUrl: './entity-form-dialog.scss',
})
export class EntityFormDialog {
  private readonly api = inject(CrudApiService);
  private readonly dialogRef = inject<MatDialogRef<EntityFormDialog, EntityRow>>(MatDialogRef);
  private readonly data = inject<EntityFormDialogData>(MAT_DIALOG_DATA);

  protected readonly config = this.data.config;
  protected readonly isEdit = this.data.row !== undefined;
  protected readonly title = `${this.isEdit ? 'Modifica' : 'Nuovo'}: ${this.config.singular}`;
  protected readonly form = new FormGroup<Record<string, AbstractControl>>(
    Object.fromEntries(this.config.fields.map((field) => [field.key, this.createControl(field)])),
  );
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** Campi visibili in base ai valori correnti (es. data o trimestre per l'impegno). */
  protected readonly visibleFields = computed(() => {
    const value = { ...this.form.getRawValue(), ...this.formValue() };
    return this.config.fields.filter((field) => !field.visibleWhen || field.visibleWhen(value));
  });

  /** Opzioni delle tendine, caricate una volta all'apertura. */
  protected readonly optionsByKey: Record<string, Signal<SelectOption[]>> = Object.fromEntries(
    this.config.fields
      .filter((field) => field.options)
      .map((field) => [field.key, this.loadOptions(field)]),
  );

  constructor() {
    // I campi nascosti non vengono validati
    this.form.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => {
      this.syncHiddenFields();
    });
    this.syncHiddenFields();
  }

  protected control(key: string): FormControl {
    return this.form.controls[key] as FormControl;
  }

  protected inputType(field: FieldConfig): string {
    return field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Controlla i campi evidenziati.');
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    const body = this.buildBody();
    const request$ = this.isEdit
      ? this.api.update(this.config.endpoint, this.data.row!.id!, body)
      : this.api.create(this.config.endpoint, body);

    request$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => this.dialogRef.close(saved),
      error: (error: unknown) => this.errorMessage.set(errorMessage(error)),
    });
  }

  private createControl(field: FieldConfig): FormControl {
    const row = this.data.row;
    const initial = row ? this.initialValue(field, row) : this.defaultValue(field);
    const validators: ValidatorFn[] = [];
    if (field.required && field.type !== 'checkbox') {
      // Per le scelte multiple "required" rifiuta anche l'elenco vuoto
      validators.push(Validators.required);
    }
    if (field.maxLength) {
      validators.push(Validators.maxLength(field.maxLength));
    }
    if (field.pattern) {
      validators.push(Validators.pattern(field.pattern.regex));
    }
    if (field.min !== undefined) {
      validators.push(Validators.min(field.min));
    }
    if (field.max !== undefined) {
      validators.push(Validators.max(field.max));
    }
    const disabled = field.readonly === true || (this.isEdit && field.readonlyOnEdit === true);
    return new FormControl({ value: initial, disabled }, validators);
  }

  private initialValue(field: FieldConfig, row: EntityRow): unknown {
    if (field.initialValue) {
      return field.initialValue(row);
    }
    const source = field.attribute
      ? (row['attributes'] as Record<string, unknown> | undefined)
      : row;
    const value = source?.[field.key];
    if (field.type === 'multiselect') {
      return Array.isArray(value) ? value : [];
    }
    if (field.type === 'checkbox') {
      return value === true;
    }
    return value ?? null;
  }

  private defaultValue(field: FieldConfig): unknown {
    if (field.defaultValue !== undefined) {
      return field.defaultValue;
    }
    return field.type === 'multiselect' ? [] : field.type === 'checkbox' ? false : null;
  }

  private loadOptions(field: FieldConfig): Signal<SelectOption[]> {
    const current = this.control(field.key).value as unknown;
    const keep = Array.isArray(current) ? current : current === null ? [] : [current];
    const source$: Observable<SelectOption[]> = field.options
      ? this.api.options(field.options, keep)
      : of([]);
    return toSignal(source$, { initialValue: [] });
  }

  private syncHiddenFields(): void {
    const value = this.form.getRawValue();
    for (const field of this.config.fields) {
      if (!field.visibleWhen || field.readonly) {
        continue;
      }
      const control = this.form.controls[field.key];
      const visible = field.visibleWhen(value);
      if (visible && control.disabled) {
        control.enable({ emitEvent: false });
      } else if (!visible && control.enabled) {
        control.disable({ emitEvent: false });
      }
    }
  }

  private buildBody(): Record<string, unknown> {
    const value = this.form.getRawValue();
    const row = this.data.row;
    const attributes: Record<string, unknown> = {
      ...((row?.['attributes'] as Record<string, unknown> | undefined) ?? {}),
    };
    const body: Record<string, unknown> = { version: row?.version ?? null };
    for (const field of this.config.fields) {
      const visible = !field.visibleWhen || field.visibleWhen(value);
      let fieldValue = visible ? value[field.key] : null;
      if (typeof fieldValue === 'string') {
        fieldValue = fieldValue.trim() === '' ? null : fieldValue.trim();
      }
      if (field.attribute) {
        attributes[field.key] = fieldValue;
      } else {
        body[field.key] = fieldValue;
      }
    }
    if (this.config.fields.some((field) => field.attribute)) {
      body['attributes'] = attributes;
    }
    return body;
  }
}
