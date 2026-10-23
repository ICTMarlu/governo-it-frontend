import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { BackLink } from '../../shared/components/back-link/back-link';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { LOOKUP_CONFIGS } from './master-data.configs';
import { MASTER_DATA_HELP } from '../../shared/help/help-content';

interface Shortcut {
  readonly label: string;
  readonly hint: string;
  readonly icon: string;
  readonly link: string;
}

/** Punto di accesso alle anagrafiche di base e alle liste valori configurabili. */
@Component({
  selector: 'gov-master-data-page',
  imports: [BackLink, RouterLink, MatCardModule, MatIconModule, PageHeader],
  template: `
    <gov-back-link [target]="{ link: '/anagrafiche', label: 'Anagrafiche' }" />
    <gov-page-header
      title="Anagrafiche e liste"
      subtitle="Dati di base usati da progetti e risorse. Le modifiche sono riservate agli amministratori."
      [help]="help"
    />

    @for (group of groups; track group.title) {
      <section class="group" [attr.aria-labelledby]="group.id">
        <h2 class="group__title" [id]="group.id">{{ group.title }}</h2>
        <div class="shortcuts">
          @for (item of group.items; track item.link) {
            <a class="shortcut" [routerLink]="item.link">
              <mat-card appearance="outlined" class="shortcut__card">
                <mat-card-content class="shortcut__content">
                  <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
                  <span>
                    <strong>{{ item.label }}</strong>
                    <span class="shortcut__hint">{{ item.hint }}</span>
                  </span>
                </mat-card-content>
              </mat-card>
            </a>
          }
        </div>
      </section>
    }
  `,
  styles: `
    // Mobile first: una colonna; tablet due, desktop tre
    .group {
      margin-block-end: 2rem;
    }

    .group__title {
      margin: 0 0 0.75rem;
      font: var(--mat-sys-title-large);
    }

    .shortcuts {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .shortcut {
      color: inherit;
      text-decoration: none;
      border-radius: 0.75rem;
    }

    .shortcut__card {
      height: 100%;
    }

    .shortcut__content {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .shortcut__hint {
      display: block;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    @media (min-width: 600px) {
      .shortcuts {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (min-width: 1024px) {
      .shortcuts {
        grid-template-columns: repeat(3, 1fr);
      }
    }
  `,
})
export class MasterDataPage {
  protected readonly help = MASTER_DATA_HELP;
  protected readonly groups: readonly {
    readonly id: string;
    readonly title: string;
    readonly items: readonly Shortcut[];
  }[] = [
    {
      id: 'master-data-records',
      title: 'Anagrafiche',
      items: [
        {
          label: 'Società del gruppo',
          hint: 'Legal entity',
          icon: 'domain',
          link: '/master-data/legal-entities',
        },
        {
          label: 'Fornitori',
          hint: 'Fornitori e consulenze',
          icon: 'storefront',
          link: '/master-data/vendors',
        },
        {
          label: 'Sedi',
          hint: 'Sedi e calendari',
          icon: 'location_on',
          link: '/master-data/sites',
        },
        {
          label: 'Calendari festività',
          hint: 'Festività di San Marino e degli altri paesi',
          icon: 'event',
          link: '/master-data/holiday-calendars',
        },
        {
          label: 'Codici progetto',
          hint: 'Contatore unico e prossimo codice per sistema',
          icon: 'tag',
          link: '/master-data/project-codes',
        },
        {
          label: 'Parametri generali',
          hint: 'Ore per giornata, soglie, promemoria e-mail dei task',
          icon: 'settings',
          link: '/master-data/parameters',
        },
      ],
    },
    {
      id: 'master-data-lookups',
      title: 'Liste valori',
      items: LOOKUP_CONFIGS.map((config) => ({
        label: config.title,
        hint: config.subtitle ?? '',
        icon: 'list',
        link: `/master-data/lookups/${config.slug}`,
      })),
    },
  ];
}
