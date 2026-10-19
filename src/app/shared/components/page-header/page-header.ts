import { Component, input } from '@angular/core';

/** Intestazione di pagina (componente di presentazione): titolo ed eventuale sottotitolo. */
@Component({
  selector: 'gov-page-header',
  template: `
    <header class="page-header">
      <h1 class="page-header__title">{{ title() }}</h1>
      @if (subtitle(); as text) {
        <p class="page-header__subtitle">{{ text }}</p>
      }
    </header>
  `,
  styles: `
    .page-header {
      margin-block-end: 1.5rem;
    }

    .page-header__title {
      margin: 0;
      font: var(--mat-sys-headline-small);
    }

    .page-header__subtitle {
      margin: 0.25rem 0 0;
      color: var(--mat-sys-on-surface-variant);
    }

    @media (min-width: 1024px) {
      .page-header__title {
        font: var(--mat-sys-headline-medium);
      }
    }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
