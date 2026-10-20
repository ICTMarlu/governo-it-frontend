import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

import { HelpContent } from './help.model';

/** Finestra della guida di pagina: funzioni principali e regole di calcolo. */
@Component({
  selector: 'gov-help-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="title">
      <mat-icon aria-hidden="true">help</mat-icon>
      Guida · {{ help.title }}
    </h2>
    <mat-dialog-content>
      <p class="intro">{{ help.intro }}</p>
      @for (section of help.sections; track section.title) {
        <section class="section">
          <h3 class="section__title">{{ section.title }}</h3>
          <ul class="section__list">
            @for (item of section.items; track $index) {
              <li>{{ item }}</li>
            }
          </ul>
        </section>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" mat-dialog-close cdkFocusInitial>Ho capito</button>
    </mat-dialog-actions>
  `,
  styles: `
    .title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .intro {
      margin: 0 0 1rem;
    }

    .section {
      margin-block-end: 1rem;
    }

    .section__title {
      margin: 0 0 0.25rem;
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-primary);
    }

    .section__list {
      margin: 0;
      padding-inline-start: 1.25rem;

      li {
        margin-block-end: 0.25rem;
      }
    }
  `,
})
export class HelpDialog {
  protected readonly help = inject<HelpContent>(MAT_DIALOG_DATA);
}
