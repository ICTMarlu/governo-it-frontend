import { Component, DestroyRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { KpiSettingsDialog } from './components/kpi-settings-dialog/kpi-settings-dialog';
import { KpiSettingsService } from './services/kpi-settings.service';
import { TicketSyncService } from './services/ticket-sync.service';

interface SectionPage {
  readonly link: string;
  readonly label: string;
  readonly icon: string;
  readonly exact: boolean;
}

/**
 * Sezione Ticket AMS (D-24, D-27): la pagina operativa (azioni consigliate e carico) e le pagine
 * di pura BI (panoramica, trend, persone, aperti, pending, elenco), navigabili come le pagine di
 * Power BI. "Personalizza KPI" nasconde o riattiva i KPI per l'utente (D-32).
 */
@Component({
  selector: 'gov-tickets-section',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  template: `
    <div class="bar">
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
      <button mat-button type="button" class="bar__kpi" (click)="customize()">
        <mat-icon aria-hidden="true">tune</mat-icon>
        Personalizza KPI
        @if (kpis.hiddenCount() > 0) {
          <span class="bar__hidden">({{ kpis.hiddenCount() }} nascosti)</span>
        }
      </button>
    </div>
    <mat-tab-nav-panel #panel>
      <router-outlet />
    </mat-tab-nav-panel>
  `,
  styles: `
    // Linguette e "Personalizza KPI" sulla stessa riga; su schermi stretti il pulsante va sotto
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0 0.5rem;
      margin-bottom: 1rem;
    }

    .tabs {
      flex: 1 1 28rem;
      min-width: 0;
    }

    .bar__hidden {
      margin-inline-start: 0.25rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .tabs__icon {
      margin-inline-end: 0.375rem;
    }
  `,
})
export class TicketsSection {
  private readonly dialog = inject(MatDialog);
  protected readonly kpis = inject(KpiSettingsService);

  constructor() {
    this.kpis.load();
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

  /** KPI da mostrare o nascondere, solo per l'utente collegato. */
  protected customize(): void {
    this.dialog.open(KpiSettingsDialog, { width: '32rem', maxWidth: '95vw', autoFocus: false });
  }
}
