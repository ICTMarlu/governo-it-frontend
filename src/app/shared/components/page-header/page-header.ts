import { Component, input } from '@angular/core';

import { HelpButton } from '../../help/help-button';
import { HelpContent } from '../../help/help.model';

/** Intestazione di pagina: titolo, eventuale sottotitolo e pulsante Guida. */
@Component({
  selector: 'gov-page-header',
  imports: [HelpButton],
  template: `
    <header class="page-header">
      <div class="page-header__row">
        <h1 class="page-header__title">{{ title() }}</h1>
        @if (help(); as content) {
          <gov-help-button class="page-header__help" [help]="content" />
        }
      </div>
      @if (subtitle(); as text) {
        <p class="page-header__subtitle">{{ text }}</p>
      }
    </header>
  `,
  styles: `
    .page-header {
      margin-block-end: 1.5rem;
    }

    .page-header__row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem 1rem;
    }

    .page-header__title {
      margin: 0;
      font: var(--mat-sys-headline-small);
    }

    .page-header__help {
      flex-shrink: 0;
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
  /** Guida della pagina: se presente compare il pulsante Guida. */
  readonly help = input<HelpContent>();
}
