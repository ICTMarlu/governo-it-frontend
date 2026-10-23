import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { HBarChart } from '../../../shared/charts/hbar-chart';
import { BiFilters } from './bi-filters';
import {
  DrillDimension,
  agingBuckets,
  areaOf,
  assigneeOf,
  countBy,
  countByPriority,
  isOpen,
} from './bi.model';
import { BiStore } from './bi-store.service';

/**
 * Ticket aperti oggi (come le pagine Open Ticket e Pending Ticket di Power BI): quanti, da
 * quanto (fasce di anzianità), per area, priorità, assegnatario e richiedente. Con
 * {@code mode} = "pending" solo quelli in Pending. Valgono area e assegnatario; anno e mesi no
 * (conta quanto è aperto oggi, di qualunque periodo).
 */
@Component({
  selector: 'gov-bi-open-page',
  imports: [BiFilters, HBarChart, MatProgressSpinnerModule],
  template: `
    <div class="bi-page">
      <gov-bi-filters />
      @if (store.error(); as error) {
        <p class="bi-state" role="alert">{{ error }}</p>
      } @else if (!store.data()) {
        <p class="bi-state" role="status">
          <mat-progress-spinner diameter="24" mode="indeterminate" aria-hidden="true" /> Caricamento
          dei ticket…
        </p>
      } @else {
        <div class="head">
          <ul class="bi-kpis" aria-label="Ticket di oggi">
            <li
              class="bi-kpi bi-kpi--link"
              [class.bi-kpi--alert]="!pendingOnly()"
              [class.bi-kpi--warn]="pendingOnly()"
              role="link"
              tabindex="0"
              (click)="openAll()"
              (keydown.enter)="openAll()"
            >
              <span class="bi-kpi__value">{{ tickets().length }}</span>
              <span class="bi-kpi__label">{{
                pendingOnly() ? 'ticket in Pending' : 'ticket aperti'
              }}</span>
            </li>
          </ul>
          <p class="note">
            Ticket {{ pendingOnly() ? 'in Pending' : 'aperti' }} oggi, di qualunque periodo: qui
            contano i filtri di area e assegnatario, non anno e mese.
          </p>
        </div>
        <div class="bi-grid bi-grid--3">
          <section class="bi-card">
            <gov-hbar-chart
              title="Per anzianità"
              color="alt"
              [items]="aging()"
              [drillable]="true"
              (drill)="drill('aging', $event)"
            />
          </section>
          <section class="bi-card">
            <gov-hbar-chart
              title="Per Progetto Marlù"
              color="alt"
              [items]="byArea()"
              [selectable]="true"
              [selected]="store.areas()"
              [drillable]="true"
              (pick)="store.toggle('areas', $event)"
              (drill)="drill('area', $event)"
            />
          </section>
          <section class="bi-card">
            <gov-hbar-chart
              title="Per priorità"
              color="alt"
              [items]="byPriority()"
              [drillable]="true"
              (drill)="drill('priority', $event)"
            />
          </section>
          <section class="bi-card">
            <gov-hbar-chart
              title="Per assegnatario"
              color="alt"
              [items]="byAssignee()"
              [selectable]="true"
              [selected]="store.assignees()"
              [drillable]="true"
              (pick)="store.toggle('assignees', $event)"
              (drill)="drill('assignee', $event)"
            />
          </section>
          <section class="bi-card">
            <gov-hbar-chart
              title="Per richiedente"
              color="alt"
              [items]="byReporter()"
              [drillable]="true"
              (drill)="drill('reporter', $event)"
            />
          </section>
          <section class="bi-card">
            <gov-hbar-chart
              title="Per stato"
              color="alt"
              [items]="byStatus()"
              [drillable]="true"
              (drill)="drill('status', $event)"
            />
          </section>
        </div>
      }
    </div>
  `,
  styles: `
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1rem;

      .bi-kpis {
        flex: 0 1 12rem;
      }
    }

    .note {
      flex: 1;
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
  `,
})
export class BiOpenPage {
  protected readonly store = inject(BiStore);
  private readonly router = inject(Router);

  /** Dalla rotta: "open" (tutti gli aperti) o "pending". */
  readonly mode = input<'open' | 'pending'>('open');

  protected readonly pendingOnly = computed(() => this.mode() === 'pending');
  protected readonly tickets = computed(() =>
    this.store.scoped().filter((t) => isOpen(t) && (!this.pendingOnly() || t.pending)),
  );
  protected readonly aging = computed(() => agingBuckets(this.tickets(), new Date()));
  protected readonly byArea = computed(() => countBy(this.tickets(), areaOf));
  protected readonly byPriority = computed(() => countByPriority(this.tickets()));
  protected readonly byAssignee = computed(() => countBy(this.tickets(), assigneeOf));
  protected readonly byReporter = computed(() =>
    countBy(this.tickets(), (t) => t.reporter ?? '(non indicato)'),
  );
  protected readonly byStatus = computed(() => countBy(this.tickets(), (t) => t.status));

  constructor() {
    this.store.load();
  }

  /** Clic sul numero in alto: tutti i ticket della pagina. */
  protected openAll(): void {
    void this.router.navigate(['/tickets/dettaglio'], { queryParams: { scope: this.mode() } });
  }

  /** Clic su una barra: elenco dei ticket di quella barra. */
  protected drill(dim: DrillDimension, value: string): void {
    void this.router.navigate(['/tickets/dettaglio'], {
      queryParams: { scope: this.mode(), dim, value },
    });
  }
}
