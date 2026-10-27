import { Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { canView } from '../../core/auth/permissions';
import { BackLink, BackLinkTarget } from '../../shared/components/back-link/back-link';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { TelephonyDashboard } from './telephony-dashboard';

interface Block {
  readonly label: string;
  readonly hint: string;
  readonly icon: string;
  readonly route: string;
}

/** Ritorno alla home di Telefonia e device dalle sue anagrafiche. */
export const BACK_TO_TELEPHONY: BackLinkTarget = {
  link: '/telephony',
  label: 'Telefonia e device',
};

const BLOCKS: readonly Block[] = [
  {
    label: 'Linee mobili',
    hint: 'Numeri di cellulare divisi per società, con profilo e assegnatario',
    icon: 'sim_card',
    route: '/mobile-lines',
  },
  {
    label: 'Profili tariffari',
    hint: 'Cosa include ogni profilo SIM e quanto costa',
    icon: 'request_quote',
    route: '/tariff-plans',
  },
  {
    label: 'Opzioni operatore',
    hint: 'Opzioni attivabili solo con un operatore (es. Voce UE di TIM)',
    icon: 'add_circle',
    route: '/operator-options',
  },
  {
    label: 'Smartphone',
    hint: 'Telefoni aziendali: a chi sono assegnati, IMEI, garanzia',
    icon: 'smartphone',
    route: '/smartphones',
  },
  {
    label: 'Tablet',
    hint: 'Tablet aziendali e a chi sono assegnati',
    icon: 'tablet_mac',
    route: '/tablets',
  },
];

/** Home di Telefonia e device: i quattro blocchi da cui si entra nel dettaglio. */
@Component({
  selector: 'gov-telephony-page',
  imports: [RouterLink, MatCardModule, MatIconModule, PageHeader, BackLink, TelephonyDashboard],
  template: `
    <gov-back-link [target]="back" />
    <gov-page-header
      title="Telefonia e device"
      subtitle="Linee mobili per società, profili tariffari, smartphone e tablet: scegli cosa aprire."
    />

    @if (allowed()) {
      <div class="blocks">
        @for (item of blocks; track item.route) {
          <a class="block" [routerLink]="item.route">
            <mat-card appearance="outlined" class="block__card">
              <mat-card-content class="block__content">
                <mat-icon aria-hidden="true">{{ item.icon }}</mat-icon>
                <span>
                  <strong>{{ item.label }}</strong>
                  <span class="block__hint">{{ item.hint }}</span>
                </span>
              </mat-card-content>
            </mat-card>
          </a>
        }
      </div>
      <gov-telephony-dashboard />
    }
  `,
  styles: `
    .blocks {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .block {
      color: inherit;
      text-decoration: none;
      border-radius: 0.75rem;
    }

    .block__card {
      height: 100%;
    }

    .block__content {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .block__hint {
      display: block;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    @media (min-width: 600px) {
      .blocks {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `,
})
export class TelephonyPage {
  private readonly user = inject(AuthService).currentUser;

  protected readonly back: BackLinkTarget = { link: '/anagrafiche', label: 'Anagrafiche' };
  protected readonly blocks = BLOCKS;
  protected readonly allowed = computed(() => canView(this.user()?.permissions, 'TELEPHONY'));
}
