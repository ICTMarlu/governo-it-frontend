import { Component, input } from '@angular/core';

import { BackLink, BackLinkTarget } from '../../components/back-link/back-link';
import { PageHeader } from '../../components/page-header/page-header';
import { CrudSection } from '../crud-section/crud-section';
import { EntityConfig } from '../crud.model';

/**
 * Pagina di un'anagrafica: configurazione e, se presente, pagina superiore arrivano dai dati
 * della rotta (`data: { config, back }`).
 */
@Component({
  selector: 'gov-crud-page',
  imports: [BackLink, PageHeader, CrudSection],
  template: `
    @if (back(); as target) {
      <gov-back-link [target]="target" />
    }
    <gov-page-header
      [title]="config().title"
      [subtitle]="config().subtitle"
      [help]="config().help"
    />
    <gov-crud-section [config]="config()" />
  `,
})
export class CrudPage {
  readonly config = input.required<EntityConfig>();
  readonly back = input<BackLinkTarget>();
}
