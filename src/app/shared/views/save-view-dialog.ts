import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface SaveViewDialogData {
  readonly title: string;
  readonly name: string;
  /** Mostra "Usala come vista predefinita" (non serve per rinominare). */
  readonly askDefault: boolean;
  readonly existingNames: readonly string[];
}

export interface SaveViewDialogResult {
  readonly name: string;
  readonly defaultView: boolean;
}

/** Nome della vista da salvare o rinominare, e se usarla come predefinita. */
@Component({
  selector: 'gov-save-view-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form (ngSubmit)="confirm()">
      <mat-dialog-content class="content">
        <mat-form-field appearance="outline">
          <mat-label>Nome della vista</mat-label>
          <input
            matInput
            name="name"
            required
            maxlength="80"
            autocomplete="off"
            placeholder="Es. Progetti BI aperti"
            cdkFocusInitial
            [ngModel]="name()"
            (ngModelChange)="name.set($event)"
          />
          @if (overwrites()) {
            <mat-hint>Sostituisce la vista con lo stesso nome</mat-hint>
          }
        </mat-form-field>
        @if (data.askDefault) {
          <mat-checkbox
            name="default"
            [ngModel]="defaultView()"
            (ngModelChange)="defaultView.set($event)"
          >
            Usala come vista predefinita (si apre da sola)
          </mat-checkbox>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit" [disabled]="!name().trim()">Salva</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
      min-width: min(22rem, 80vw);
    }
  `,
})
export class SaveViewDialog {
  protected readonly data = inject<SaveViewDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<SaveViewDialog, SaveViewDialogResult>>(MatDialogRef);

  protected readonly name = signal(this.data.name);
  protected readonly defaultView = signal(false);

  protected overwrites(): boolean {
    const name = this.name().trim().toLowerCase();
    return (
      this.data.name.toLowerCase() !== name &&
      this.data.existingNames.some((n) => n.toLowerCase() === name)
    );
  }

  protected confirm(): void {
    const name = this.name().trim();
    if (name) {
      this.dialogRef.close({ name, defaultView: this.defaultView() });
    }
  }
}
