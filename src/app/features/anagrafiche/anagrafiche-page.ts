import { Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { canView } from '../../core/auth/permissions';
import { ANAGRAFICHE } from '../../core/layout/anagrafiche';
import { PageHeader } from '../../shared/components/page-header/page-header';

/** Home delle anagrafiche: da qui si arriva a ognuna (le voci stanno in `ANAGRAFICHE`). */
@Component({
  selector: 'gov-anagrafiche-page',
  imports: [RouterLink, MatCardModule, MatIconModule, PageHeader],
  template: `
    <gov-page-header
      title="Anagrafiche"
      subtitle="Persone, richiedenti e liste di base: scegli quale aprire."
    />
    <div class="shortcuts">
      @for (item of items(); track item.route) {
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
  `,
  styles: `
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
export class AnagrafichePage {
  private readonly user = inject(AuthService).currentUser;
  protected readonly items = computed(() =>
    ANAGRAFICHE.filter((item) => canView(this.user()?.permissions, item.module)),
  );
}
