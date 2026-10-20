import { Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { HelpDialog } from './help-dialog';
import { HelpContent } from './help.model';

/** Pulsante "Guida" che apre la spiegazione della pagina. */
@Component({
  selector: 'gov-help-button',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <button
      mat-stroked-button
      type="button"
      matTooltip="Come funziona questa pagina"
      aria-haspopup="dialog"
      (click)="open()"
    >
      <mat-icon aria-hidden="true">help_outline</mat-icon>
      Guida
    </button>
  `,
})
export class HelpButton {
  private readonly dialog = inject(MatDialog);

  readonly help = input.required<HelpContent>();

  protected open(): void {
    this.dialog.open(HelpDialog, {
      data: this.help(),
      width: '40rem',
      maxWidth: '95vw',
      autoFocus: 'dialog',
    });
  }
}
