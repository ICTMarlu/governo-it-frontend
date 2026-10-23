import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { HBarChart } from '../../../shared/charts/hbar-chart';
import { PeriodChart } from '../../../shared/charts/period-chart';
import { KpiDirective } from '../components/kpi.directive';
import { BiFilters } from './bi-filters';
import { DrillDimension, areaOf, assigneeOf, countBy, monthly, overview } from './bi.model';
import { BiStore } from './bi-store.service';

/**
 * Panoramica dei ticket (come la pagina Overview di Power BI): creati nel periodo, aperti,
 * open, pending e risolti; creati e risolti per mese; ripartizione per area, assegnatario,
 * stato e tipo di richiesta. Clic su area o assegnatario per filtrare tutto.
 */
@Component({
  selector: 'gov-bi-overview-page',
  imports: [BiFilters, HBarChart, KpiDirective, MatProgressSpinnerModule, PeriodChart],
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
          <li
            *govKpi="'bi.created'"
            class="bi-kpi bi-kpi--link bi-kpi--info"
            role="link"
            tabindex="0"
            (click)="open('created')"
            (keydown.enter)="open('created')"
          >
            <span class="bi-kpi__value">{{ n.created }}</span
            ><span class="bi-kpi__label">ticket creati</span>
          </li>
          <li
            *govKpi="'bi.open'"
            class="bi-kpi bi-kpi--link bi-kpi--alert"
            role="link"
            tabindex="0"
            (click)="open('created-open')"
            (keydown.enter)="open('created-open')"
          >
            <span class="bi-kpi__value">{{ n.open }}</span
            ><span class="bi-kpi__label">aperti</span>
            <span class="bi-kpi__meta">{{ n.openPct }}%</span>
          </li>
          <li
            *govKpi="'bi.workable'"
            class="bi-kpi bi-kpi--link bi-kpi--alert"
            role="link"
            tabindex="0"
            (click)="open('created-workable')"
            (keydown.enter)="open('created-workable')"
          >
            <span class="bi-kpi__value">{{ n.openWorkable }}</span
            ><span class="bi-kpi__label">open (lavorabili)</span>
            <span class="bi-kpi__meta">{{ n.openWorkablePct }}%</span>
          </li>
          <li
            *govKpi="'bi.pending'"
            class="bi-kpi bi-kpi--link bi-kpi--warn"
            role="link"
            tabindex="0"
            (click)="open('created-pending')"
            (keydown.enter)="open('created-pending')"
          >
            <span class="bi-kpi__value">{{ n.pending }}</span
            ><span class="bi-kpi__label">pending</span>
            <span class="bi-kpi__meta">{{ n.pendingPct }}%</span>
          </li>
          <li
            *govKpi="'bi.resolved'"
            class="bi-kpi bi-kpi--link bi-kpi--good"
            role="link"
            tabindex="0"
            (click)="open('created-resolved')"
            (keydown.enter)="open('created-resolved')"
          >
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
              [drillable]="true"
              (pick)="store.toggle('areas', $event)"
              (drill)="drill('area', $event)"
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
              [drillable]="true"
              (pick)="store.toggle('assignees', $event)"
              (drill)="drill('assignee', $event)"
            />
          </section>
          <section class="bi-card">
            <gov-hbar-chart
              title="Ticket per stato"
              [items]="byStatus()"
              [drillable]="true"
              (drill)="drill('status', $event)"
            />
          </section>
          <section class="bi-card">
            <gov-hbar-chart
              title="Ticket per tipo di richiesta"
              [items]="byRequestType()"
              [drillable]="true"
              (drill)="drill('requestType', $event)"
            />
          </section>
        </div>
      }
    </div>
  `,
})
export class BiOverviewPage {
  protected readonly store = inject(BiStore);
  private readonly router = inject(Router);

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

  /** Clic su un numero: elenco dei ticket che lo compongono. */
  protected open(scope: string): void {
    void this.router.navigate(['/tickets/dettaglio'], { queryParams: { scope } });
  }

  /** Clic su una barra: elenco dei ticket creati nel periodo di quella barra. */
  protected drill(dim: DrillDimension, value: string): void {
    void this.router.navigate(['/tickets/dettaglio'], {
      queryParams: { scope: 'created', dim, value },
    });
  }
}
