import { Component, inject } from '@angular/core';

import { ArchitectureData } from './architecture-data';
import { ArchitectureMap } from './architecture-map';
import { APPLICATIONS_CONFIG, CONNECTIONS_CONFIG } from './architecture.configs';

/**
 * Mappa di Architettura IT (D-38): una pagina tutta per il disegno, che con molti applicativi
 * ha bisogno di spazio. Elenchi e numeri stanno nelle altre voci del menu Architettura.
 */
@Component({
  selector: 'gov-architecture-map-page',
  imports: [ArchitectureMap],
  template: `
    <h1 class="visually-hidden">Mappa dell'architettura IT</h1>
    <gov-architecture-map
      class="map"
      [apps]="data.apps()"
      [connections]="data.links()"
      [loaded]="data.loaded()"
      [editable]="data.editable()"
      (edit)="data.editApp($event).subscribe()"
      (create)="create($event)"
    />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
    }
    .map {
      flex: 1 1 auto;
      min-height: calc(100dvh - 96px);
    }
    @media (min-width: 600px) {
      .map {
        min-height: 0;
      }
    }
  `,
})
export class ArchitectureMapPage {
  protected readonly data = inject(ArchitectureData);

  constructor() {
    this.data.load();
  }

  protected create(kind: 'app' | 'link'): void {
    this.data.edit(kind === 'app' ? APPLICATIONS_CONFIG : CONNECTIONS_CONFIG).subscribe();
  }
}
