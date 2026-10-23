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
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { Observable, finalize, of } from 'rxjs';

import { matchesTerms, searchTerms } from '../../util/text-search';
import { fromIsoDate, toIsoDate } from '../../dates/italian-date-adapter';
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
    MatAutocompleteModule,
    MatIconModule,
    MatCheckboxModule,
    MatDatepickerModule,
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

  /** Testo digitato nei campi con ricerca; assente = mostra l'etichetta del valore scelto. */
  private readonly searchTexts = signal<Record<string, string>>({});

  constructor() {
    // I campi nascosti non vengono validati
    this.form.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => {
      this.syncHiddenFields();
    });
    this.syncHiddenFields();
  }

  /** Testo mostrato nel campo con ricerca: quello digitato, o l'etichetta del valore scelto. */
  protected searchDisplay(field: FieldConfig): string {
    return this.searchTexts()[field.key] ?? this.labelOf(field, this.control(field.key).value);
  }

  /** Opzioni che contengono tutte le parole digitate (senza testo: tutte). */
  protected searchOptions(field: FieldConfig): SelectOption[] {
    const typed = this.searchTexts()[field.key];
    const selected = this.labelOf(field, this.control(field.key).value);
    // Con una scelta già fatta e testo non toccato si mostra l'elenco completo
    const terms = typed === undefined || typed === selected ? [] : searchTerms(typed);
    return this.optionsByKey[field.key]().filter((option) => matchesTerms(terms, [option.label]));
  }

  /** Scrivendo, la scelta precedente decade finché non se ne clicca una nuova. */
  protected searchType(field: FieldConfig, text: string): void {
    this.searchTexts.update((texts) => ({ ...texts, [field.key]: text }));
    const control = this.control(field.key);
    if (control.value !== null && text !== this.labelOf(field, control.value)) {
      control.setValue(null);
    }
    control.markAsDirty();
  }

  protected searchPick(field: FieldConfig, value: unknown): void {
    this.control(field.key).setValue(value);
    this.control(field.key).markAsDirty();
    this.searchTexts.update((texts) => {
      return Object.fromEntries(Object.entries(texts).filter(([key]) => key !== field.key));
    });
  }

  private readonly displayFns = new Map<string, (value: unknown) => string>();

  /** Etichetta da scrivere nel campo quando si sceglie un'opzione (altrimenti comparirebbe l'id). */
  protected searchDisplayFn(field: FieldConfig): (value: unknown) => string {
    let fn = this.displayFns.get(field.key);
    if (!fn) {
      fn = (value) => this.labelOf(field, value);
      this.displayFns.set(field.key, fn);
    }
    return fn;
  }

  protected searchClear(field: FieldConfig): void {
    this.searchPick(field, null);
  }

  /** All'uscita dal campo, il testo senza scelta corrispondente viene tolto. */
  protected searchLeave(field: FieldConfig): void {
    setTimeout(() => {
      if (this.control(field.key).value === null) {
        this.searchTexts.update((texts) => {
          return Object.fromEntries(Object.entries(texts).filter(([key]) => key !== field.key));
        });
      }
    }, 200);
  }

  private labelOf(field: FieldConfig, value: unknown): string {
    return this.optionsByKey[field.key]?.().find((option) => option.value === value)?.label ?? '';
  }

  protected isRequired(field: FieldConfig): boolean {
    return field.required === true || (field.requiredOnCreate === true && !this.isEdit);
  }

  protected control(key: string): FormControl {
    return this.form.controls[key] as FormControl;
  }

  protected inputType(field: FieldConfig): string {
    if (field.type === 'number' || field.type === 'password') {
      return field.type;
    }
    return 'text';
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
    const required = field.required === true || (field.requiredOnCreate === true && !this.isEdit);
    if (required && field.type !== 'checkbox') {
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
    if (field.type === 'password') {
      return null;
    }
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
    if (field.type === 'date') {
      return fromIsoDate(value);
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
      if (fieldValue instanceof Date) {
        fieldValue = toIsoDate(fieldValue);
      } else if (typeof fieldValue === 'string') {
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
