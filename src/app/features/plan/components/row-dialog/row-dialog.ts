import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { CrudApiService } from '../../../../shared/crud/crud-api.service';
import { EntityRow } from '../../../../shared/crud/crud.model';
import { PlanRow } from '../../models/plan.model';
import { RowBody } from '../../services/plan.service';

export interface RowDialogData {
  /** Riga da modificare; assente in creazione. */
  readonly row?: PlanRow;
  readonly resourceId?: number;
  readonly resources: readonly { readonly id: number; readonly name: string }[];
  /** Progetti che non si scelgono a mano (festività). */
  readonly excludedProjectIds: readonly number[];
}

const label = (project: EntityRow): string =>
  project['code']
    ? `${String(project['code'])} · ${String(project['name'])}`
    : String(project['name']);

/** Nuova riga del piano (risorsa, progetto, nota) o modifica di nota, progetto e archiviazione. */
@Component({
  selector: 'gov-row-dialog',
  imports: [
    FormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.row ? 'Modifica riga' : 'Nuova riga del piano' }}</h2>
    <form (ngSubmit)="confirm()">
      <mat-dialog-content class="content">
        <mat-form-field appearance="outline">
          <mat-label>Risorsa</mat-label>
          <mat-select
            name="resource"
            required
            [disabled]="!!data.row"
            [ngModel]="resourceId()"
            (ngModelChange)="resourceId.set($event)"
          >
            @for (resource of data.resources; track resource.id) {
              <mat-option [value]="resource.id">{{ resource.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (!data.row?.vacation) {
          <mat-form-field appearance="outline">
            <mat-label>Progetto</mat-label>
            <input
              matInput
              name="project"
              required
              placeholder="Cerca per codice o nome"
              [matAutocomplete]="auto"
              [ngModel]="projectText()"
              (ngModelChange)="onProjectInput($event)"
            />
            <mat-autocomplete #auto="matAutocomplete" [displayWith]="displayProject">
              @for (project of matches(); track project.id) {
                <mat-option [value]="project.id">
                  {{ projectLabel(project) }}
                  <small class="option-meta"
                    >· {{ project['workTypeLabel'] }} · {{ project['statusLabel'] }}</small
                  >
                </mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>
        }
        <mat-form-field appearance="outline">
          <mat-label>Nota della riga</mat-label>
          <input
            matInput
            name="note"
            maxlength="500"
            placeholder="Cosa fa la persona sul progetto in questo periodo"
            [ngModel]="note()"
            (ngModelChange)="note.set($event)"
          />
        </mat-form-field>
        @if (data.row) {
          <mat-checkbox
            name="archived"
            [ngModel]="archived()"
            (ngModelChange)="archived.set($event)"
          >
            Archiviata (non compare più nel piano, le giornate restano)
          </mat-checkbox>
        }
        @if (error(); as message) {
          <p class="error" role="alert">{{ message }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit">Salva</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
    }

    .option-meta {
      color: var(--mat-sys-on-surface-variant);
    }

    .error {
      margin: 0.5rem 0 0;
      color: var(--mat-sys-error);
    }
  `,
})
export class RowDialog {
  protected readonly data = inject<RowDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<RowDialog, RowBody>>(MatDialogRef);
  private readonly projects = toSignal(inject(CrudApiService).list('/projects'), {
    initialValue: [],
  });

  protected readonly resourceId = signal<number | null>(
    this.data.row?.resourceId ?? this.data.resourceId ?? null,
  );
  protected readonly projectId = signal<number | null>(this.data.row?.projectId ?? null);
  protected readonly projectText = signal(
    this.data.row
      ? this.data.row.projectCode
        ? `${this.data.row.projectCode} · ${this.data.row.projectName}`
        : this.data.row.projectName
      : '',
  );
  protected readonly note = signal(this.data.row?.rowNote ?? '');
  protected readonly archived = signal(this.data.row?.archived ?? false);
  protected readonly error = signal<string | null>(null);
  protected readonly projectLabel = label;

  /** Progetti attivi che corrispondono al testo, al massimo 30. */
  protected readonly matches = computed(() => {
    const text = this.projectText().toLowerCase().trim();
    return this.projects()
      .filter(
        (project) =>
          project['active'] !== false && !this.data.excludedProjectIds.includes(project.id!),
      )
      .filter((project) => !text || label(project).toLowerCase().includes(text))
      .slice(0, 30);
  });

  /** Mostra l'etichetta del progetto scelto (il valore dell'opzione è l'id). */
  protected readonly displayProject = (value: number | string | null): string => {
    if (typeof value !== 'number') {
      return value ?? '';
    }
    const project = this.projects().find((candidate) => candidate.id === value);
    return project ? label(project) : this.projectText();
  };

  /** Scrivendo si cerca; scegliendo un'opzione arriva l'id del progetto. */
  protected onProjectInput(value: number | string): void {
    if (typeof value === 'number') {
      this.projectId.set(value);
      this.projectText.set(this.displayProject(value));
    } else {
      this.projectText.set(value);
      this.projectId.set(null);
    }
  }

  protected confirm(): void {
    const resourceId = this.resourceId();
    const projectId = this.projectId();
    if (resourceId === null) {
      this.error.set('Scegli la risorsa');
    } else if (projectId === null) {
      this.error.set('Scegli il progetto dall’elenco');
    } else {
      this.dialogRef.close({
        resourceId,
        projectId,
        rowNote: this.note().trim() || null,
        archived: this.archived(),
        version: this.data.row?.version ?? null,
      });
    }
  }
}
