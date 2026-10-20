import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ExportDialogData {
  readonly title: string;
  readonly text: string;
}

/** Anteprima di agenda o riepilogo, da copiare in una mail o stampare (anche in PDF). */
@Component({
  selector: 'gov-export-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <pre class="text" tabindex="0" aria-label="Testo da copiare">{{ data.text }}</pre>
      @if (copied()) {
        <p class="copied" role="status">Copiato: incollalo nella mail.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Chiudi</button>
      <button mat-stroked-button type="button" (click)="print()">
        <mat-icon aria-hidden="true">print</mat-icon>
        Stampa o PDF
      </button>
      <button mat-flat-button type="button" cdkFocusInitial (click)="copy()">
        <mat-icon aria-hidden="true">content_copy</mat-icon>
        Copia testo
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .text {
      margin: 0;
      padding: 0.75rem;
      max-height: 60vh;
      overflow: auto;
      border-radius: 0.5rem;
      background: var(--mat-sys-surface-container);
      font: var(--mat-sys-body-medium);
      white-space: pre-wrap;
    }

    .copied {
      margin: 0.5rem 0 0;
      color: var(--mat-sys-primary);
    }
  `,
})
export class ExportDialog {
  protected readonly data = inject<ExportDialogData>(MAT_DIALOG_DATA);
  protected readonly copied = signal(false);

  protected copy(): void {
    void navigator.clipboard.writeText(this.data.text).then(() => this.copied.set(true));
  }

  /** Apre una pagina pulita con il solo testo e avvia la stampa (da lì si salva in PDF). */
  protected print(): void {
    const page = window.open('', '_blank', 'noopener=no');
    if (!page) {
      return;
    }
    const escape = (value: string) =>
      value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    page.document.write(
      `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${escape(this.data.title)}</title>` +
        '<style>body{font:14px/1.5 system-ui,sans-serif;margin:2rem;color:#000}' +
        'pre{white-space:pre-wrap;font:inherit}</style></head>' +
        `<body><pre>${escape(this.data.text)}</pre></body></html>`,
    );
    page.document.close();
    page.focus();
    page.print();
  }
}
