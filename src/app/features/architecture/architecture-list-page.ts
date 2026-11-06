import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PageHeader } from '../../shared/components/page-header/page-header';
import { CrudSection } from '../../shared/crud/crud-section/crud-section';
import { ArchitectureData } from './architecture-data';
import { APPLICATIONS_CONFIG, CONNECTIONS_CONFIG } from './architecture.configs';
import { ARCHITECTURE_HELP } from './architecture.help';

/**
 * Elenco degli applicativi o delle connessioni di Architettura IT (D-38), per compilare la
 * mappa: nuovi, modifiche, import ed export in CSV. Quale dei due lo dice la rotta.
 */
@Component({
  selector: 'gov-architecture-list-page',
  imports: [CrudSection, MatButtonModule, MatIconModule, MatTooltipModule, PageHeader, RouterLink],
  template: `
    <gov-page-header [title]="title" [subtitle]="subtitle" [help]="help" />

    <div class="actions">
      <a mat-stroked-button routerLink="/architecture">
        <mat-icon aria-hidden="true">hub</mat-icon>
        Apri la mappa
      </a>
      @if (data.editable()) {
        <button mat-stroked-button type="button" (click)="importFiles()">
          <mat-icon aria-hidden="true">upload</mat-icon>
          Importa
        </button>
      }
      <button
        mat-stroked-button
        type="button"
        matTooltip="Due file CSV per Excel: Applicativi e Connessioni (anche come modello)"
        (click)="data.exportFiles()"
      >
        <mat-icon aria-hidden="true">download</mat-icon>
        Esporta
      </button>
    </div>

    <gov-crud-section [config]="config" [refresh]="refresh()" [leadActions]="true" />
  `,
  styles: `
    .actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-block-end: 1rem;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .actions > * {
      flex: none;
    }
  `,
})
export class ArchitectureListPage {
  protected readonly data = inject(ArchitectureData);
  private readonly connections = inject(ActivatedRoute).snapshot.data['kind'] === 'connections';

  protected readonly help = ARCHITECTURE_HELP;
  protected readonly config = this.connections ? CONNECTIONS_CONFIG : APPLICATIONS_CONFIG;
  protected readonly title = this.connections ? 'Connessioni' : 'Applicativi';
  protected readonly subtitle = this.connections
    ? 'I flussi di dati tra gli applicativi: chi invia, chi legge, cosa, quando e come.'
    : 'Gli applicativi che il business usa e i partner con cui si scambiano dati.';
  protected readonly refresh = signal(0);

  protected importFiles(): void {
    this.data.importFiles().subscribe(() => this.refresh.update((value) => value + 1));
  }
}
