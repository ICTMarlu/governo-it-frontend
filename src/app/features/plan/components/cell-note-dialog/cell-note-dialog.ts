import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface CellNoteData {
  readonly title: string;
  readonly note: string | null;
}

/** Nota su una cella del piano (al posto dei commenti di cella dell'Excel). Restituisce il testo, '' = togli. */
@Component({
  selector: 'gov-cell-note-dialog',
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Nota della cella</h2>
    <form (ngSubmit)="dialogRef.close(text().trim())">
      <mat-dialog-content>
        <p class="hint">{{ data.title }}</p>
        <mat-form-field appearance="outline" class="field">
          <mat-label>Nota</mat-label>
          <textarea
            matInput
            name="note"
            rows="4"
            maxlength="500"
            cdkFocusInitial
            placeholder="Es. verifica versione Tomcat, poi analisi"
            [ngModel]="text()"
            (ngModelChange)="text.set($event)"
          ></textarea>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        @if (data.note) {
          <button mat-button type="button" (click)="dialogRef.close('')">Togli nota</button>
        }
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit">Salva</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .hint {
      margin: 0 0 1rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .field {
      width: 100%;
    }
  `,
})
export class CellNoteDialog {
  protected readonly data = inject<CellNoteData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject<MatDialogRef<CellNoteDialog, string>>(MatDialogRef);
  protected readonly text = signal(this.data.note ?? '');
}
