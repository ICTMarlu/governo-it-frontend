import { Component, DestroyRef, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { TicketSyncService } from './services/ticket-sync.service';

interface SectionPage {
  readonly link: string;
  readonly label: string;
  readonly icon: string;
  readonly exact: boolean;
}

/**
 * Sezione Ticket AMS (D-24, D-27): la pagina operativa (azioni consigliate e carico) e le pagine
 * di pura BI (panoramica, trend, aperti, pending, elenco), navigabili come le pagine di Power BI.
 */
@Component({
  selector: 'gov-tickets-section',
  imports: [MatIconModule, MatTabsModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <nav mat-tab-nav-bar class="tabs" [tabPanel]="panel" aria-label="Pagine dei ticket">
      @for (page of pages; track page.link) {
        <a
          mat-tab-link
          [routerLink]="page.link"
          routerLinkActive
          #active="routerLinkActive"
          [routerLinkActiveOptions]="{ exact: page.exact }"
          [active]="active.isActive"
        >
          <mat-icon class="tabs__icon" aria-hidden="true">{{ page.icon }}</mat-icon>
          {{ page.label }}
        </a>
      }
    </nav>
    <mat-tab-nav-panel #panel>
      <router-outlet />
    </mat-tab-nav-panel>
  `,
  styles: `
    .tabs {
      margin-bottom: 1rem;
    }

    .tabs__icon {
      margin-inline-end: 0.375rem;
    }
  `,
})
export class TicketsSection {
  constructor() {
    // Finché si è nella sezione, ogni minuto si controlla se Jira è stato aggiornato
    const sync = inject(TicketSyncService);
    sync.watch();
    inject(DestroyRef).onDestroy(() => sync.unwatch());
  }

  protected readonly pages: readonly SectionPage[] = [
    { link: '/tickets', label: 'Operativa', icon: 'support_agent', exact: true },
    { link: '/tickets/panoramica', label: 'Panoramica', icon: 'dashboard', exact: false },
    { link: '/tickets/trend', label: 'Trend', icon: 'show_chart', exact: false },
    { link: '/tickets/persone', label: 'Persone', icon: 'person_search', exact: false },
    { link: '/tickets/aperti', label: 'Aperti', icon: 'inbox', exact: false },
    { link: '/tickets/pending', label: 'Pending', icon: 'pause_circle', exact: false },
    { link: '/tickets/elenco', label: 'Elenco', icon: 'table_rows', exact: false },
  ];
}
