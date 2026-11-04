import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { API_BASE_URL } from '../../core/config/api.config';
import { errorMessage } from '../../shared/crud/crud-api.service';
import { CsvKind, detectKind, parseCsv, toImportRows } from './architecture-csv';

interface ImportReport {
  readonly applied: boolean;
  readonly applicationsCreated: number;
  readonly applicationsUpdated: number;
  readonly connectionsCreated: number;
  readonly connectionsUpdated: number;
  readonly errors: readonly string[];
}

interface LoadedFile {
  readonly name: string;
  readonly kind: CsvKind;
  readonly rows: readonly Record<string, unknown>[];
}

/**
 * Import di applicativi e connessioni da CSV (D-38): si scelgono i file, si guarda l'anteprima
 * (cosa si crea, cosa si aggiorna, cosa si scarta e perché) e solo dopo si conferma.
 */
@Component({
  selector: 'gov-architecture-import-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Importa applicativi e connessioni</h2>
    <mat-dialog-content>
      <p class="hint">
        Scegli il file Applicativi, il file Connessioni o entrambi (CSV salvato da Excel, come
        quelli di Esporta). Prima vedi l'anteprima, poi confermi.
      </p>
      <input
        #picker
        type="file"
        accept=".csv,text/csv"
        multiple
        hidden
        (change)="read(picker.files); picker.value = ''"
      />
      <button mat-stroked-button type="button" (click)="picker.click()">
        <mat-icon aria-hidden="true">upload_file</mat-icon>
        Scegli i file
      </button>

      @for (file of files(); track file.name) {
        <p class="file">
          <mat-icon aria-hidden="true">description</mat-icon>
          {{ file.name }}: {{ file.kind === 'applications' ? 'Applicativi' : 'Connessioni' }},
          {{ file.rows.length }} righe
        </p>
      }
      @for (problem of problems(); track $index) {
        <p class="error" role="alert">{{ problem }}</p>
      }

      @if (busy()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (report(); as result) {
        <h3>{{ result.applied ? 'Fatto' : 'Anteprima' }}</h3>
        <ul class="totals">
          <li>
            Applicativi: {{ result.applicationsCreated }}
            {{ result.applied ? 'creati' : 'da creare' }}, {{ result.applicationsUpdated }}
            {{ result.applied ? 'aggiornati' : 'da aggiornare' }}
          </li>
          <li>
            Connessioni: {{ result.connectionsCreated }}
            {{ result.applied ? 'create' : 'da creare' }}, {{ result.connectionsUpdated }}
            {{ result.applied ? 'aggiornate' : 'da aggiornare' }}
          </li>
        </ul>
        @if (result.errors.length) {
          <h3 class="error">
            {{ result.errors.length }}
            {{ result.errors.length === 1 ? 'riga scartata' : 'righe scartate' }}
          </h3>
          <ul class="errors">
            @for (error of result.errors; track $index) {
              <li>{{ error }}</li>
            }
          </ul>
          @if (!result.applied) {
            <p class="hint">
              Correggi il file e riprova, oppure importa: le righe scartate restano fuori.
            </p>
          }
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (report()?.applied) {
        <button mat-flat-button type="button" (click)="close(true)">Chiudi</button>
      } @else {
        <button mat-button type="button" (click)="close(false)">Annulla</button>
        <button
          mat-flat-button
          type="button"
          [disabled]="busy() || !report() || nothingToDo()"
          (click)="send(true)"
        >
          Importa
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .hint {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .file {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 8px 0 0;
    }
    .error {
      color: var(--gi-critical);
    }
    h3 {
      font: var(--mat-sys-title-small);
      margin: 16px 0 4px;
    }
    .totals,
    .errors {
      margin: 0;
      padding-left: 20px;
      font: var(--mat-sys-body-medium);
    }
    .errors {
      max-height: 240px;
      overflow: auto;
      font: var(--mat-sys-body-small);
    }
  `,
})
export class ArchitectureImportDialog {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_BASE_URL);
  private readonly ref = inject<MatDialogRef<ArchitectureImportDialog, boolean>>(MatDialogRef);

  protected readonly files = signal<LoadedFile[]>([]);
  protected readonly problems = signal<string[]>([]);
  protected readonly report = signal<ImportReport | null>(null);
  protected readonly busy = signal(false);

  protected nothingToDo(): boolean {
    const result = this.report();
    return (
      !result ||
      result.applicationsCreated +
        result.applicationsUpdated +
        result.connectionsCreated +
        result.connectionsUpdated ===
        0
    );
  }

  protected async read(list: FileList | null): Promise<void> {
    if (!list || list.length === 0) {
      return;
    }
    const loaded = new Map(this.files().map((file) => [file.kind, file]));
    const problems: string[] = [];
    for (const file of Array.from(list)) {
      const rows = parseCsv(await file.text());
      const kind = rows.length ? detectKind(rows[0]) : null;
      if (!kind) {
        problems.push(
          `${file.name}: non riconosco il file. La prima riga deve avere le intestazioni (Nome, Tipo… oppure Da, Direzione, A…).`,
        );
        continue;
      }
      loaded.set(kind, { name: file.name, kind, rows: toImportRows(kind, rows) });
    }
    this.files.set([...loaded.values()]);
    this.problems.set(problems);
    if (loaded.size > 0) {
      this.send(false);
    }
  }

  protected send(apply: boolean): void {
    const of = (kind: CsvKind) => this.files().find((file) => file.kind === kind)?.rows ?? [];
    this.busy.set(true);
    this.http
      .post<ImportReport>(`${this.api}/applications/import`, {
        applications: of('applications'),
        connections: of('connections'),
        apply,
      })
      .subscribe({
        next: (result) => {
          this.report.set(result);
          this.busy.set(false);
        },
        error: (error: unknown) => {
          this.problems.set([errorMessage(error)]);
          this.busy.set(false);
        },
      });
  }

  protected close(changed: boolean): void {
    this.ref.close(changed);
  }
}
