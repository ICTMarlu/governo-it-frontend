import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { fromIsoDate, toIsoDate } from '../../../../shared/dates/italian-date-adapter';
import { parseDays } from '../../models/plan.model';

export interface FillDialogData {
  readonly rowLabel: string;
  readonly fromWeek: string;
  readonly toWeek: string;
}

export interface FillDialogResult {
  readonly fromWeek: string;
  readonly toWeek: string;
  readonly days: number;
}

/** Lunedì della settimana di una data. */
function monday(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy;
}

/** Riempi intervallo (D-18): stesse giornate su tutte le settimane scelte di una riga. */
@Component({
  selector: 'gov-fill-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>Riempi intervallo</h2>
    <form (ngSubmit)="confirm()">
      <mat-dialog-content class="content">
        <p class="hint">{{ data.rowLabel }}</p>
        <div class="grid">
          <mat-form-field appearance="outline">
            <mat-label>Dalla settimana del</mat-label>
            <input
              matInput
              name="from"
              required
              placeholder="gg/mm/aaaa"
              autocomplete="off"
              [matDatepicker]="fromPicker"
              [ngModel]="from()"
              (ngModelChange)="from.set($event)"
            />
            <mat-datepicker-toggle
              matIconSuffix
              [for]="fromPicker"
              aria-label="Apri il calendario"
            />
            <mat-datepicker #fromPicker />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Alla settimana del</mat-label>
            <input
              matInput
              name="to"
              required
              placeholder="gg/mm/aaaa"
              autocomplete="off"
              [matDatepicker]="toPicker"
              [ngModel]="to()"
              (ngModelChange)="to.set($event)"
            />
            <mat-datepicker-toggle matIconSuffix [for]="toPicker" aria-label="Apri il calendario" />
            <mat-datepicker #toPicker />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Giornate a settimana</mat-label>
            <input
              matInput
              name="days"
              inputmode="decimal"
              autocomplete="off"
              placeholder="1,5"
              [ngModel]="daysText()"
              (ngModelChange)="daysText.set($event)"
            />
            <mat-hint>0 svuota le settimane (le note restano)</mat-hint>
          </mat-form-field>
        </div>
        @if (summary(); as text) {
          <p class="summary" role="status">{{ text }}</p>
        }
        @if (error(); as message) {
          <p class="error" role="alert">{{ message }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Annulla</button>
        <button mat-flat-button type="submit">Riempi</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .hint {
      margin: 0 0 1rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0 1rem;
    }

    .summary {
      margin: 0.5rem 0 0;
    }

    .error {
      margin: 0.5rem 0 0;
      color: var(--mat-sys-error);
    }

    @media (min-width: 600px) {
      .grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class FillDialog {
  protected readonly data = inject<FillDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<FillDialog, FillDialogResult>>(MatDialogRef);

  protected readonly from = signal<Date | null>(fromIsoDate(this.data.fromWeek));
  protected readonly to = signal<Date | null>(fromIsoDate(this.data.toWeek));
  protected readonly daysText = signal('');
  protected readonly error = signal<string | null>(null);

  /** Quante settimane verranno scritte, contate dal lunedì. */
  protected readonly summary = computed(() => {
    const from = this.from();
    const to = this.to();
    if (!from || !to || to < from) {
      return null;
    }
    const weeks =
      Math.round((monday(to).getTime() - monday(from).getTime()) / (7 * 86_400_000)) + 1;
    return `${weeks} ${weeks === 1 ? 'settimana' : 'settimane'}, dal lunedì ${monday(from).toLocaleDateString('it-IT')}`;
  });

  protected confirm(): void {
    const from = this.from();
    const to = this.to();
    const days = parseDays(this.daysText());
    if (!from || !to) {
      this.error.set('Indica le due settimane');
    } else if (to < from) {
      this.error.set('L’ultima settimana non può precedere la prima');
    } else if (days === null || this.daysText().trim() === '') {
      this.error.set('Giornate da 0 a 7, al massimo due decimali (es. 0,25)');
    } else {
      this.dialogRef.close({
        fromWeek: toIsoDate(monday(from)),
        toWeek: toIsoDate(monday(to)),
        days,
      });
    }
  }
}
