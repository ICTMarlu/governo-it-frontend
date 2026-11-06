import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { canView } from '../../core/auth/permissions';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ArchitectureData } from './architecture-data';
import { ARCHITECTURE_HELP } from './architecture.help';
import { AppNode, dependencies } from './architecture.model';

interface Check {
  readonly id: string;
  readonly title: string;
  readonly hint: string;
  readonly icon: string;
  readonly apps: readonly { readonly app: AppNode; readonly note: string }[];
}

/**
 * Panoramica di Architettura IT (D-38): i numeri della mappa e cosa sistemare, con il
 * collegamento all'applicativo nella mappa.
 */
@Component({
  selector: 'gov-architecture-overview-page',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, PageHeader, RouterLink],
  template: `
    <gov-page-header
      title="Panoramica dell'architettura"
      subtitle="I numeri della mappa e cosa sistemare: clicca un applicativo per vederlo nella mappa."
      [help]="help"
    />

    <div class="actions">
      <a mat-stroked-button routerLink="/architecture">
        <mat-icon aria-hidden="true">hub</mat-icon>
        Apri la mappa
      </a>
      @if (seesTechnologies()) {
        <a mat-button routerLink="/technologies">
          <mat-icon aria-hidden="true">memory</mat-icon>
          Tecnologie e vulnerabilità
        </a>
      }
    </div>

    <ul class="gi-kpis" aria-label="Riepilogo">
      <li class="gi-kpi">
        <span class="gi-kpi__value">{{ summary().apps }}</span>
        <span class="gi-kpi__label">applicativi in uso</span>
      </li>
      <li class="gi-kpi">
        <span class="gi-kpi__value">{{ summary().links }}</span>
        <span class="gi-kpi__label">connessioni</span>
      </li>
      <li class="gi-kpi gi-kpi--critical">
        <span class="gi-kpi__value">{{ summary().critical }}</span>
        <span class="gi-kpi__label">critici per il business</span>
      </li>
      <li
        class="gi-kpi gi-kpi--warning"
        matTooltip="Applicativi che girano su tecnologie fuori supporto o con vulnerabilità aperte"
      >
        <span class="gi-kpi__value">{{ summary().techWarnings }}</span>
        <span class="gi-kpi__label">con tecnologie da trattare</span>
      </li>
      <li
        class="gi-kpi gi-kpi--info"
        matTooltip="Applicativi da cui dipendono direttamente almeno 3 altri: se si fermano, il fermo si allarga"
      >
        <span class="gi-kpi__value">{{ summary().hubs }}</span>
        <span class="gi-kpi__label">snodi (3+ dipendenti)</span>
      </li>
      <li class="gi-kpi" matTooltip="Applicativi senza nessuna connessione: da completare">
        <span class="gi-kpi__value">{{ summary().isolated }}</span>
        <span class="gi-kpi__label">senza connessioni</span>
      </li>
    </ul>

    <div class="checks">
      @for (check of checks(); track check.id) {
        <section class="check" [attr.aria-labelledby]="'check-' + check.id">
          <h2 [id]="'check-' + check.id">
            <mat-icon aria-hidden="true">{{ check.icon }}</mat-icon>
            {{ check.title }} <span class="count">{{ check.apps.length }}</span>
          </h2>
          <p class="hint">{{ check.hint }}</p>
          <ul>
            @for (item of check.apps; track item.app.id) {
              <li>
                <a routerLink="/architecture" [queryParams]="{ app: item.app.id }">
                  {{ item.app.name }}
                </a>
                @if (item.note) {
                  <span class="note">{{ item.note }}</span>
                }
              </li>
            } @empty {
              <li class="note">Nessuno.</li>
            }
          </ul>
        </section>
      }
    </div>
  `,
  styles: `
    .actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-block-end: 1rem;
    }
    .gi-kpis {
      margin-block-end: 1.5rem;
    }
    .checks {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
      gap: 1rem;
    }
    .check {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--gi-radius-lg);
      padding: 1rem;
      background: var(--mat-sys-surface);
    }
    h2 {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    .count,
    .hint,
    .note {
      color: var(--mat-sys-on-surface-variant);
    }
    .count {
      font: var(--mat-sys-label-large);
    }
    .hint {
      margin: 0.25rem 0 0.5rem;
      font: var(--mat-sys-body-small);
    }
    .check ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .check li {
      padding: 3px 0;
    }
    .note {
      margin-inline-start: 0.5rem;
      font: var(--mat-sys-body-small);
    }
  `,
})
export class ArchitectureOverviewPage {
  private readonly data = inject(ArchitectureData);
  private readonly user = inject(AuthService).currentUser;

  protected readonly help = ARCHITECTURE_HELP;
  protected readonly seesTechnologies = computed(() =>
    canView(this.user()?.permissions, 'TECHNOLOGY'),
  );

  /** Applicativi in uso e connessioni attive tra loro. */
  private readonly current = computed(() => {
    const apps = this.data.apps().filter((app) => app.active && app.lifecycle !== 'RETIRED');
    const ids = new Set(apps.map((app) => app.id));
    const links = this.data
      .links()
      .filter((link) => link.active && ids.has(link.sourceId) && ids.has(link.targetId));
    const graph = dependencies(links);
    const connected = new Set(links.flatMap((link) => [link.sourceId, link.targetId]));
    const dependents = (id: number) => graph.dependents.get(id)?.size ?? 0;
    return { apps, links, connected, dependents };
  });

  protected readonly summary = computed(() => {
    const { apps, links, connected, dependents } = this.current();
    return {
      apps: apps.length,
      links: links.length,
      critical: apps.filter((app) => app.businessCriticality === 'CRITICAL').length,
      techWarnings: apps.filter((app) => app.technologyWarnings.length > 0).length,
      hubs: apps.filter((app) => dependents(app.id) >= 3).length,
      isolated: apps.filter((app) => !connected.has(app.id)).length,
    };
  });

  protected readonly checks = computed<Check[]>(() => {
    const { apps, connected, dependents } = this.current();
    const byName = (a: AppNode, b: AppNode) => a.name.localeCompare(b.name, 'it');
    const sorted = [...apps].sort(byName);
    return [
      {
        id: 'tech',
        title: 'Tecnologie da trattare',
        hint: 'Girano su tecnologie fuori supporto o con vulnerabilità aperte.',
        icon: 'warning',
        apps: sorted
          .filter((app) => app.technologyWarnings.length > 0)
          .map((app) => ({ app, note: app.technologyPriorityLabel ?? '' })),
      },
      {
        id: 'hubs',
        title: 'Snodi',
        hint: 'Se si fermano, si fermano almeno altri 3 applicativi.',
        icon: 'device_hub',
        apps: [...apps]
          .filter((app) => dependents(app.id) >= 3)
          .sort((a, b) => dependents(b.id) - dependents(a.id) || byName(a, b))
          .map((app) => ({ app, note: `${dependents(app.id)} dipendenti` })),
      },
      {
        id: 'critical',
        title: 'Critici per il business',
        hint: 'Criticità critica: da proteggere per primi.',
        icon: 'priority_high',
        apps: sorted
          .filter((app) => app.businessCriticality === 'CRITICAL')
          .map((app) => ({ app, note: app.typeLabel })),
      },
      {
        id: 'isolated',
        title: 'Senza connessioni',
        hint: 'Nessun flusso registrato: da completare o da verificare.',
        icon: 'link_off',
        apps: sorted
          .filter((app) => !connected.has(app.id))
          .map((app) => ({ app, note: app.typeLabel })),
      },
      {
        id: 'owner',
        title: 'Senza referente',
        hint: 'Né referente IT né referente business: chi chiamare se si ferma?',
        icon: 'person_off',
        apps: sorted
          .filter((app) => !app.ownerName && !app.businessOwner)
          .map((app) => ({ app, note: '' })),
      },
    ];
  });

  constructor() {
    this.data.load();
  }
}
