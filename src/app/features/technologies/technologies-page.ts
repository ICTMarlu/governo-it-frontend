import { Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';

import { AuthService } from '../../core/auth/auth.service';
import { canEdit } from '../../core/auth/permissions';
import { BackLink } from '../../shared/components/back-link/back-link';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { CrudApiService } from '../../shared/crud/crud-api.service';
import { CrudSection } from '../../shared/crud/crud-section/crud-section';
import { EntityRow } from '../../shared/crud/crud.model';
import {
  EntityFormDialog,
  EntityFormDialogData,
} from '../../shared/crud/entity-form-dialog/entity-form-dialog';
import { TECHNOLOGIES_HELP } from '../../shared/help/help-content';
import { TECHNOLOGIES_CONFIG, VULNERABILITIES_CONFIG } from './technologies.configs';
import { TechnologyPriorityList } from './technology-priority-list';

/**
 * Sistemi e tecnologie (D-34): in alto i numeri che contano, poi le tecnologie urgenti, quelle
 * da pianificare (senza notifiche), l'inventario completo, le vulnerabilità e le regole.
 */
@Component({
  selector: 'gov-technologies-page',
  imports: [
    BackLink,
    CrudSection,
    MatIconModule,
    MatTabsModule,
    PageHeader,
    TechnologyPriorityList,
  ],
  template: `
    <gov-back-link [target]="{ link: '/anagrafiche', label: 'Anagrafiche' }" />
    <gov-page-header
      title="Sistemi e tecnologie"
      subtitle="Cosa si usa, in che versione, fino a quando è supportato e quali vulnerabilità ha."
      [help]="help"
    />

    <ul class="kpis" aria-label="Riepilogo">
      <li class="kpi kpi--urgent">
        <span class="kpi__value">{{ summary().urgent }}</span>
        <span class="kpi__label">urgenti</span>
      </li>
      <li class="kpi kpi--plan">
        <span class="kpi__value">{{ summary().plan }}</span>
        <span class="kpi__label">da pianificare</span>
      </li>
      <li class="kpi kpi--watch">
        <span class="kpi__value">{{ summary().watch }}</span>
        <span class="kpi__label">da tenere d'occhio</span>
      </li>
      <li class="kpi">
        <span class="kpi__value">{{ summary().ended }}</span>
        <span class="kpi__label">fuori supporto</span>
      </li>
      <li class="kpi">
        <span class="kpi__value">{{ summary().vulnerabilities }}</span>
        <span class="kpi__label">vulnerabilità aperte</span>
      </li>
      <li class="kpi">
        <span class="kpi__value">{{ summary().unknown }}</span>
        <span class="kpi__label">senza fine supporto</span>
      </li>
    </ul>

    <mat-tab-group mat-stretch-tabs="false" dynamicHeight (selectedTabChange)="load()">
      <mat-tab [label]="'Attenzione (' + urgent().length + ')'">
        <p class="intro">
          Le tecnologie da trattare subito, con il motivo. Il resto è nella scheda “Da pianificare”.
        </p>
        <gov-technology-priority-list
          [items]="urgent()"
          [canEdit]="editable()"
          emptyText="Nessuna tecnologia urgente."
          (open)="edit($event)"
        />
      </mat-tab>
      <mat-tab [label]="'Da pianificare (' + toPlan().length + ')'">
        <p class="intro">Da programmare o da tenere d'occhio: nessuna urgenza, nessuna notifica.</p>
        <gov-technology-priority-list
          [items]="toPlan()"
          [canEdit]="editable()"
          emptyText="Niente da pianificare."
          (open)="edit($event)"
        />
      </mat-tab>
      <mat-tab label="Inventario">
        <ng-template matTabContent>
          <gov-crud-section [config]="technologies" />
        </ng-template>
      </mat-tab>
      <mat-tab label="Vulnerabilità">
        <ng-template matTabContent>
          <gov-crud-section [config]="vulnerabilities" />
        </ng-template>
      </mat-tab>
      <mat-tab label="Regole">
        <div class="rules">
          <h2>Come si decide la priorità</h2>
          @for (rule of rules; track rule.title) {
            <section class="rule" [style.--prio-color]="rule.color">
              <h3>{{ rule.title }}</h3>
              <ul>
                @for (item of rule.items; track $index) {
                  <li>{{ item }}</li>
                }
              </ul>
            </section>
          }
          <p class="note">
            Una vulnerabilità pesa finché è aperta, pianificata o mitigata; risolta o accettata no.
            Una versione più recente disponibile, da sola, non è mai urgente. Le tecnologie dismesse
            non contano.
          </p>
        </div>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: `
    .kpis {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
      gap: 0.75rem;
      margin: 0 0 1rem;
      padding: 0;
      list-style: none;
    }

    .kpi {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0.75rem;
      border: 2px solid var(--kpi-color, var(--mat-sys-outline-variant));
      border-radius: 0.75rem;
      text-align: center;

      &__value {
        font: var(--mat-sys-headline-medium);
      }

      &__label {
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-label-large);
      }

      &--urgent {
        --kpi-color: #c62828;
      }

      &--plan {
        --kpi-color: #ef6c00;
      }

      &--watch {
        --kpi-color: #1565c0;
      }
    }

    .intro {
      margin: 1rem 0 0;
      color: var(--mat-sys-on-surface-variant);
    }

    .rules {
      max-width: 52rem;
      padding-block: 1rem;

      h2 {
        margin: 0 0 0.75rem;
        font: var(--mat-sys-title-large);
      }

      h3 {
        margin: 0 0 0.25rem;
        color: var(--prio-color);
        font: var(--mat-sys-title-medium);
      }

      ul {
        margin: 0;
        padding-inline-start: 1.125rem;
      }
    }

    .rule {
      margin-block-end: 1rem;
      padding: 0.5rem 1rem;
      border-inline-start: 6px solid var(--prio-color);
      border-radius: 0.25rem;
      background: color-mix(in srgb, var(--prio-color) 6%, transparent);
    }

    .note {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class TechnologiesPage {
  private readonly api = inject(CrudApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly user = inject(AuthService).currentUser;

  protected readonly help = TECHNOLOGIES_HELP;
  protected readonly technologies = TECHNOLOGIES_CONFIG;
  protected readonly vulnerabilities = VULNERABILITIES_CONFIG;

  protected readonly items = signal<readonly EntityRow[]>([]);
  protected readonly editable = computed(() => canEdit(this.user()?.permissions, 'TECHNOLOGY'));

  protected readonly urgent = computed(() =>
    this.items().filter((item) => item['priority'] === 'URGENT'),
  );
  protected readonly toPlan = computed(() =>
    this.items().filter((item) => item['priority'] === 'PLAN' || item['priority'] === 'WATCH'),
  );

  protected readonly summary = computed(() => {
    const active = this.items().filter((item) => item['active'] !== false);
    const count = (priority: string) =>
      active.filter((item) => item['priority'] === priority).length;
    return {
      urgent: count('URGENT'),
      plan: count('PLAN'),
      watch: count('WATCH'),
      ended: active.filter((item) => item['supportStatus'] === 'ENDED').length,
      unknown: active.filter((item) => item['supportStatus'] === 'UNKNOWN').length,
      vulnerabilities: active.reduce(
        (sum, item) => sum + Number(item['openVulnerabilities'] ?? 0),
        0,
      ),
    };
  });

  protected readonly rules = [
    {
      title: 'Urgente',
      color: '#c62828',
      items: [
        'Vulnerabilità sfruttata attivamente, o critica non risolta.',
        'Vulnerabilità con la scadenza superata.',
        'Vulnerabilità alta su un sistema di criticità alta o critica.',
        'Fuori supporto su un sistema di criticità alta o critica.',
        'Fine supporto entro 90 giorni su un sistema critico.',
      ],
    },
    {
      title: 'Da pianificare',
      color: '#ef6c00',
      items: [
        'Fuori supporto su un sistema di criticità media o bassa.',
        'Fine supporto entro 180 giorni.',
        'Vulnerabilità alta non risolta.',
      ],
    },
    {
      title: "Da tenere d'occhio",
      color: '#1565c0',
      items: [
        'Fine supporto entro un anno.',
        'Vulnerabilità media, bassa o solo mitigata.',
        'Disponibile una versione più recente.',
        'Data di fine supporto non indicata.',
      ],
    },
    {
      title: 'Ok',
      color: '#2e7d32',
      items: ['Nessuno dei casi sopra.'],
    },
  ];

  constructor() {
    this.load();
  }

  protected load(): void {
    this.api.list(TECHNOLOGIES_CONFIG.endpoint).subscribe({
      next: (rows) => this.items.set(rows),
      error: () => undefined,
    });
  }

  /** Apre la scheda di una tecnologia dall'elenco di priorità. */
  protected edit(row: EntityRow): void {
    const data: EntityFormDialogData = { config: TECHNOLOGIES_CONFIG, row };
    this.dialog
      .open<EntityFormDialog, EntityFormDialogData, EntityRow>(EntityFormDialog, {
        data,
        width: '720px',
        maxWidth: '100vw',
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.snackBar.open('Tecnologia salvata', 'OK', { duration: 3000 });
          this.load();
        }
      });
  }
}
