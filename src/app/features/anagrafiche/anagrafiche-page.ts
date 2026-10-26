import { Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ModuleKey, canView } from '../../core/auth/permissions';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { matchesTerms, searchTerms } from '../../shared/util/text-search';
import { LOOKUP_CONFIGS } from '../master-data/master-data.configs';

interface Card {
  readonly label: string;
  readonly hint: string;
  readonly icon: string;
  readonly route: string;
  /** Modulo che l'utente deve vedere per trovare la scheda. */
  readonly module: ModuleKey;
}

interface Group {
  readonly id: string;
  readonly title: string;
  readonly cards: readonly Card[];
}

/** Scheda di una lista valori, con il sottotitolo dalla sua configurazione. */
function lookup(slug: string, label: string, icon: string): Card {
  const config = LOOKUP_CONFIGS.find((item) => item.slug === slug);
  return {
    label,
    hint: config?.subtitle ?? '',
    icon,
    route: `/master-data/lookups/${slug}`,
    module: 'MASTER_DATA',
  };
}

/** Tutte le anagrafiche, divise per gruppo: da qui si arriva a ognuna. */
const GROUPS: readonly Group[] = [
  {
    id: 'people',
    title: 'Persone e organizzazione',
    cards: [
      {
        label: 'Risorse',
        hint: 'Persone del team: capacità, sedi, competenze',
        icon: 'groups',
        route: '/resources',
        module: 'RESOURCES',
      },
      {
        label: 'Richiedenti',
        hint: 'Chi chiede: referenti e membri della direzione',
        icon: 'contact_mail',
        route: '/requesters',
        module: 'REQUESTERS',
      },
      lookup('team-roles', 'Ruoli nel team', 'badge'),
      lookup('business-areas', 'Aree aziendali', 'apartment'),
      {
        label: 'Società del gruppo',
        hint: 'Le società del gruppo (legal entity)',
        icon: 'domain',
        route: '/master-data/legal-entities',
        module: 'MASTER_DATA',
      },
      {
        label: 'Fornitori',
        hint: 'Fornitori e società di consulenza',
        icon: 'storefront',
        route: '/master-data/vendors',
        module: 'MASTER_DATA',
      },
      {
        label: 'Sedi',
        hint: 'Sedi di lavoro e calendario festività',
        icon: 'location_on',
        route: '/master-data/sites',
        module: 'MASTER_DATA',
      },
      {
        label: 'Calendari festività',
        hint: 'Festività di San Marino e degli altri paesi',
        icon: 'event',
        route: '/master-data/holiday-calendars',
        module: 'MASTER_DATA',
      },
    ],
  },
  {
    id: 'technology',
    title: 'Sistemi e tecnologie',
    cards: [
      {
        label: 'Sistemi e tecnologie',
        hint: 'Cosa si usa, versioni, fine supporto e vulnerabilità: cosa è urgente e cosa si pianifica',
        icon: 'memory',
        route: '/technologies',
        module: 'TECHNOLOGY',
      },
      lookup('main-systems', 'Sistemi (elenco)', 'hub'),
    ],
  },
  {
    id: 'projects',
    title: 'Progetti e task',
    cards: [
      lookup('work-types', 'Tipi di progetto', 'category'),
      lookup('project-statuses', 'Stati progetto', 'flag'),
      lookup('priority-levels', 'Priorità', 'priority_high'),
      lookup('streams', 'Stream', 'stream'),
      lookup('expense-types', 'Capex / Opex', 'payments'),
      lookup('task-statuses', 'Stati dei task', 'view_kanban'),
      lookup('management-states', 'Stati della direzione', 'account_balance'),
      {
        label: 'Codici progetto',
        hint: 'Contatore unico e prossimo codice per sistema',
        icon: 'tag',
        route: '/master-data/project-codes',
        module: 'MASTER_DATA',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Impostazioni',
    cards: [
      {
        label: 'Parametri generali',
        hint: 'Ore per giornata, soglie, promemoria e-mail dei task',
        icon: 'settings',
        route: '/master-data/parameters',
        module: 'MASTER_DATA',
      },
    ],
  },
];

/** Home delle anagrafiche: tutte, per gruppo, con una ricerca. */
@Component({
  selector: 'gov-anagrafiche-page',
  imports: [RouterLink, MatCardModule, MatIconModule, PageHeader],
  template: `
    <gov-page-header
      title="Anagrafiche"
      subtitle="Tutte le anagrafiche e le liste di base, per gruppo: cerca o scegli quale aprire."
    />

    <label class="inline-search">
      <mat-icon aria-hidden="true">search</mat-icon>
      <input
        class="inline-search__input"
        type="search"
        placeholder="Cerca un’anagrafica (es. fornitori, sedi, priorità)…"
        aria-label="Cerca un’anagrafica"
        [value]="search()"
        (input)="search.set($any($event.target).value)"
      />
    </label>

    @for (group of groups(); track group.id) {
      <section class="group" [attr.aria-labelledby]="'group-' + group.id">
        <h2 class="group__title" [id]="'group-' + group.id">
          {{ group.title }} <span class="group__count">{{ group.cards.length }}</span>
        </h2>
        <div class="shortcuts">
          @for (item of group.cards; track item.route) {
            <a class="shortcut" [routerLink]="item.route">
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
    } @empty {
      <p class="empty">Nessuna anagrafica trovata.</p>
    }
  `,
  styles: `
    .inline-search {
      margin-block-end: 1.25rem;
    }

    .group {
      margin-block-end: 1.75rem;
    }

    .group__title {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      margin: 0 0 0.75rem;
      font: var(--mat-sys-title-large);
    }

    .group__count {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-large);
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

    .empty {
      color: var(--mat-sys-on-surface-variant);
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
export class AnagrafichePage {
  private readonly user = inject(AuthService).currentUser;

  protected readonly search = signal('');

  /** Gruppi con le sole schede che l'utente può aprire e che corrispondono alla ricerca. */
  protected readonly groups = computed(() => {
    const permissions = this.user()?.permissions;
    const terms = searchTerms(this.search());
    return GROUPS.map((group) => ({
      ...group,
      cards: group.cards.filter(
        (card) =>
          canView(permissions, card.module) &&
          matchesTerms(terms, [card.label, card.hint, group.title]),
      ),
    })).filter((group) => group.cards.length > 0);
  });
}
