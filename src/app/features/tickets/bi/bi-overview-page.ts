import { Component, computed, inject } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { HBarChart } from '../../../shared/charts/hbar-chart';
import { PeriodChart } from '../../../shared/charts/period-chart';
import { BiFilters } from './bi-filters';
import { areaOf, assigneeOf, countBy, monthly, overview } from './bi.model';
import { BiStore } from './bi-store.service';

/**
 * Panoramica dei ticket (come la pagina Overview di Power BI): creati nel periodo, aperti,
 * open, pending e risolti; creati e risolti per mese; ripartizione per area, assegnatario,
 * stato e tipo di richiesta. Clic su area o assegnatario per filtrare tutto.
 */
@Component({
  selector: 'gov-bi-overview-page',
  imports: [BiFilters, HBarChart, MatProgressSpinnerModule, PeriodChart],
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
        @let n = numbers();
        <ul class="bi-kpis" aria-label="Numeri del periodo">
          <li class="bi-kpi bi-kpi--info">
            <span class="bi-kpi__value">{{ n.created }}</span
            ><span class="bi-kpi__label">ticket creati</span>
          </li>
          <li class="bi-kpi bi-kpi--alert">
            <span class="bi-kpi__value">{{ n.open }}</span
            ><span class="bi-kpi__label">aperti</span>
            <span class="bi-kpi__meta">{{ n.openPct }}%</span>
          </li>
          <li class="bi-kpi bi-kpi--alert">
            <span class="bi-kpi__value">{{ n.openWorkable }}</span
            ><span class="bi-kpi__label">open (lavorabili)</span>
            <span class="bi-kpi__meta">{{ n.openWorkablePct }}%</span>
          </li>
          <li class="bi-kpi bi-kpi--warn">
            <span class="bi-kpi__value">{{ n.pending }}</span
            ><span class="bi-kpi__label">pending</span>
            <span class="bi-kpi__meta">{{ n.pendingPct }}%</span>
          </li>
          <li class="bi-kpi bi-kpi--good">
            <span class="bi-kpi__value">{{ n.resolved }}</span
            ><span class="bi-kpi__label">risolti</span>
            <span class="bi-kpi__meta">{{ n.resolvedPct }}%</span>
          </li>
        </ul>

        <div class="bi-grid bi-grid--2">
          <section class="bi-card">
            <gov-period-chart
              barsTitle="Ticket creati e risolti per mese"
              lineTitle="Aperti a fine mese"
              [points]="months()"
            />
          </section>
          <section class="bi-card">
            <gov-hbar-chart
              title="Ticket per Progetto Marlù"
              [items]="byArea()"
              [selectable]="true"
              [selected]="store.areas()"
              (pick)="store.toggle('areas', $event)"
            />
          </section>
        </div>
        <div class="bi-grid bi-grid--3">
          <section class="bi-card">
            <gov-hbar-chart
              title="Ticket per assegnatario"
              [items]="byAssignee()"
              [selectable]="true"
              [selected]="store.assignees()"
              (pick)="store.toggle('assignees', $event)"
            />
          </section>
          <section class="bi-card">
            <gov-hbar-chart title="Ticket per stato" [items]="byStatus()" />
          </section>
          <section class="bi-card">
            <gov-hbar-chart title="Ticket per tipo di richiesta" [items]="byRequestType()" />
          </section>
        </div>
      }
    </div>
  `,
})
export class BiOverviewPage {
  protected readonly store = inject(BiStore);

  protected readonly numbers = computed(() => overview(this.store.createdInPeriod()));
  protected readonly months = computed(() =>
    monthly(this.store.scoped(), this.store.year(), new Date()),
  );
  protected readonly byArea = computed(() => countBy(this.store.createdInPeriod(), areaOf));
  protected readonly byAssignee = computed(() => countBy(this.store.createdInPeriod(), assigneeOf));
  protected readonly byStatus = computed(() =>
    countBy(this.store.createdInPeriod(), (t) => t.status),
  );
  protected readonly byRequestType = computed(() =>
    countBy(this.store.createdInPeriod(), (t) => t.requestType ?? '(non indicato)'),
  );

  constructor() {
    this.store.load();
  }
}
