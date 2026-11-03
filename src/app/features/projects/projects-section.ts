import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface SectionPage {
  readonly link: string;
  readonly label: string;
  readonly icon: string;
  readonly exact: boolean;
}

/**
 * Sezione Progetti: la panoramica (dove sono i progetti, cosa è pianificato e cosa no) e l'elenco
 * per creare e modificare. Come la sezione Ticket: linguette in alto, una pagina per linguetta.
 */
@Component({
  selector: 'gov-projects-section',
  imports: [MatIconModule, MatTabsModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <nav mat-tab-nav-bar class="tabs" [tabPanel]="panel" aria-label="Pagine dei progetti">
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
export class ProjectsSection {
  protected readonly pages: readonly SectionPage[] = [
    { link: '/projects', label: 'Panoramica', icon: 'dashboard', exact: true },
    { link: '/projects/elenco', label: 'Elenco', icon: 'table_rows', exact: false },
  ];
}
