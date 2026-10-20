import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { toIsoDate } from '../../../../shared/dates/italian-date-adapter';

export interface StartMeetingResult {
  readonly meetingDate: string;
  readonly title: string | null;
}

/** Data e titolo della nuova riunione: l'agenda si compone da sola con i punti dovuti. */
@Component({
  selector: 'gov-start-meeting-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>Inizia riunione</h2>
    <form (ngSubmit)="confirm()">
      <mat-dialog-content class="content">
        <p class="hint">
          L’agenda si prepara da sola: aggiornamenti sulle azioni aperte, punti da discutere e
          posticipati la cui data è arrivata. Potrai aggiungere o togliere punti.
        </p>
        <mat-form-field appearance="outline">
          <mat-label>Data</mat-label>
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
        <mat-form-field appearance="outline">
          <mat-label>Titolo (facoltativo)</mat-label>
          <input
            matInput
            name="title"
            maxlength="200"
            placeholder="Es. Allineamento mensile"
            [ngModel]="title()"
            (ngModelChange)="title.set($event)"
          />
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit" [disabled]="!date()">Inizia</button>
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
export class StartMeetingDialog {
  private readonly dialogRef =
    inject<MatDialogRef<StartMeetingDialog, StartMeetingResult>>(MatDialogRef);

  protected readonly date = signal<Date | null>(new Date());
  protected readonly title = signal('');

  protected confirm(): void {
    const date = this.date();
    if (date) {
      this.dialogRef.close({ meetingDate: toIsoDate(date), title: this.title().trim() || null });
    }
  }
}
