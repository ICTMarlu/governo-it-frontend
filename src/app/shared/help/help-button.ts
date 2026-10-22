import { Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { HelpDialog } from './help-dialog';
import { HelpContent } from './help.model';

/** Pulsante "Guida" che apre la spiegazione della pagina; {@code compact}: solo l'icona "?" (es. accanto a un titolo). */
@Component({
  selector: 'gov-help-button',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  styles: `
    .compact {
      --mat-icon-button-state-layer-size: 2rem;
      padding: 0.25rem;
      width: 2rem;
      height: 2rem;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  template: `
    @if (compact()) {
      <button
        mat-icon-button
        type="button"
        class="compact"
        [matTooltip]="label()"
        [attr.aria-label]="label()"
        aria-haspopup="dialog"
        (click)="open()"
      >
        <mat-icon aria-hidden="true">help_outline</mat-icon>
      </button>
    } @else {
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
    }
  `,
})
export class HelpButton {
  private readonly dialog = inject(MatDialog);

  readonly help = input.required<HelpContent>();
  readonly compact = input(false);
  /** Testo del pulsante compatto (tooltip e lettori di schermo). */
  readonly label = input('Come si calcola');

  protected open(): void {
    this.dialog.open(HelpDialog, {
      data: this.help(),
      width: '40rem',
      maxWidth: '95vw',
      autoFocus: 'dialog',
    });
  }
}
