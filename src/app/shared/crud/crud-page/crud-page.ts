import { Component, input } from '@angular/core';

import { PageHeader } from '../../components/page-header/page-header';
import { CrudSection } from '../crud-section/crud-section';
import { EntityConfig } from '../crud.model';

/** Pagina di un'anagrafica: la configurazione arriva dai dati della rotta (`data: { config }`). */
@Component({
  selector: 'gov-crud-page',
  imports: [PageHeader, CrudSection],
  template: `
    <gov-page-header [title]="config().title" [subtitle]="config().subtitle" />
    <gov-crud-section [config]="config()" />
  `,
})
export class CrudPage {
  readonly config = input.required<EntityConfig>();
}
