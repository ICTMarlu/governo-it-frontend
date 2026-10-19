import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { PageHeader } from '../../shared/components/page-header/page-header';

@Component({
  selector: 'gov-home-page',
  imports: [RouterLink, MatCardModule, MatIconModule, PageHeader],
  template: `
    <gov-page-header
      [title]="'Benvenuto, ' + (currentUser()?.displayName ?? '')"
      subtitle="Master Plan IT: portafoglio, piano settimanale e capacità del team"
    />

    <section class="shortcuts" aria-label="Accessi rapidi">
      <a class="shortcut" routerLink="/project-statuses">
        <mat-card appearance="outlined" class="shortcut__card">
          <mat-card-content class="shortcut__content">
            <mat-icon aria-hidden="true">flag</mat-icon>
            <span>
              <strong>Stati progetto</strong>
              <span class="shortcut__hint">Lista valori letta dal backend</span>
            </span>
          </mat-card-content>
        </mat-card>
      </a>
    </section>
  `,
  styles: `
    // Mobile first: una colonna; tablet due, desktop tre (CSS Grid fluido)
    .shortcuts {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;
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
export class HomePage {
  protected readonly currentUser = inject(AuthService).currentUser;
}
