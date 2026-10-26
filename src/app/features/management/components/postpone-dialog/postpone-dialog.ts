import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { toIsoDate } from '../../../../shared/dates/italian-date-adapter';

export interface PostponeDialogData {
  readonly title: string;
}

/** Data da cui riproporre un punto spostato in uno stato "posticipato" (risultato: aaaa-mm-gg). */
@Component({
  selector: 'gov-postpone-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>Posticipa il punto</h2>
    <form (ngSubmit)="confirm()">
      <mat-dialog-content class="content">
        <p class="hint">“{{ data.title }}” rientra in agenda dalla data che scegli.</p>
        <mat-form-field appearance="outline">
          <mat-label>Riproponi dal</mat-label>
          <input
            matInput
            name="date"
            required
            placeholder="gg/mm/aaaa"
            autocomplete="off"
            [matDatepicker]="picker"
            [ngModel]="date()"
            (ngModelChange)="date.set($event)"
          />
          <mat-datepicker-toggle matIconSuffix [for]="picker" aria-label="Apri il calendario" />
          <mat-datepicker #picker />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit" [disabled]="!date()">Posticipa</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .content {
      display: flex;
      flex-direction: column;
    }

    .hint {
      margin: 0 0 1rem;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class PostponeDialog {
  private readonly dialogRef = inject<MatDialogRef<PostponeDialog, string>>(MatDialogRef);
  protected readonly data = inject<PostponeDialogData>(MAT_DIALOG_DATA);

  protected readonly date = signal<Date | null>(this.nextWeek());

  protected confirm(): void {
    const date = this.date();
    if (date) {
      this.dialogRef.close(toIsoDate(date));
    }
  }

  private nextWeek(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
  }
}
