import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

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
  matchesDimension,
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
  imports: [BiFilters, HBarChart, MatProgressSpinnerModule, MatTooltipModule],
  template: `
    <div class="bi-page">
      <gov-bi-filters>
        <!-- Il numero sta nella barra dei filtri, dopo il Mese: si clicca per l'elenco di dettaglio -->
        @if (store.data()) {
          <button
            type="button"
            class="count"
            [class.count--warn]="pendingOnly()"
            [matTooltip]="note()"
            (click)="openAll()"
          >
            <strong class="count__value">{{ tickets().length }}</strong>
            {{ pendingOnly() ? 'ticket in Pending' : 'ticket aperti (senza Pending)' }}
            @if (agingFilter(); as bucket) {
              <span class="count__filter">· {{ bucket }}</span>
            }
          </button>
        }
      </gov-bi-filters>
      @if (store.error(); as error) {
        <p class="bi-state" role="alert">{{ error }}</p>
      } @else if (!store.data()) {
        <p class="bi-state" role="status">
          <mat-progress-spinner diameter="24" mode="indeterminate" aria-hidden="true" /> Caricamento
          dei ticket…
        </p>
      } @else {
        <div class="bi-grid bi-grid--3">
          <section class="bi-card">
            <gov-hbar-chart
              title="Per anzianità"
              color="alt"
              [items]="aging()"
              [selectable]="true"
              [pickOnBar]="true"
              [selected]="agingSelected()"
              (pick)="toggleAging($event)"
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
    // Numero in evidenza nella barra dei filtri, alto come i filtri
    .count {
      display: inline-flex;
      align-items: baseline;
      gap: 0.375rem;
      height: 2rem;
      padding: 0 0.75rem;
      border: 2px solid var(--mat-sys-error);
      border-radius: 0.5rem;
      background: transparent;
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-label-large);
      line-height: 1.75rem;
      white-space: nowrap;
      cursor: pointer;

      &--warn {
        border-color: light-dark(#b26a00, #e9b44c);
      }

      &:hover {
        background: var(--mat-sys-surface-container);
      }

      &__value {
        font: var(--mat-sys-title-large);
      }

      &__filter {
        color: var(--mat-sys-primary);
        font-weight: 700;
      }
    }
  `,
})
export class BiOpenPage {
  protected readonly store = inject(BiStore);
  private readonly router = inject(Router);

  /** Dalla rotta: "open" (tutti gli aperti) o "pending". */
  readonly mode = input<'open' | 'pending'>('open');

  protected readonly pendingOnly = computed(() => this.mode() === 'pending');

  /** Cosa conta il numero (suggerimento sul pulsante). */
  protected readonly note = computed(
    () =>
      `Ticket ${
        this.pendingOnly() ? 'in Pending' : 'aperti, esclusi i Pending (hanno la loro pagina),'
      } oggi, di qualunque periodo: contano i filtri di area e assegnatario, non anno e mese. Clic per l'elenco.`,
  );

  /** Elenco di dettaglio coerente con la pagina: aperti senza i Pending, oppure solo i Pending. */
  private readonly scope = computed(() => (this.pendingOnly() ? 'pending' : 'workable'));
  /** Fascia di anzianità scelta con un clic sul primo grafico: filtra tutti gli altri riquadri. */
  protected readonly agingFilter = signal<string | null>(null);
  protected readonly agingSelected = computed(() => {
    const bucket = this.agingFilter();
    return bucket === null ? null : [bucket];
  });

  /** Aperti = lavorabili (i Pending hanno la loro pagina), prima del filtro per anzianità. */
  private readonly base = computed(() =>
    this.store.scoped().filter((t) => isOpen(t) && t.pending === this.pendingOnly()),
  );

  /** Ticket dopo il filtro per anzianità: sono quelli che contano gli altri riquadri e il numero in alto. */
  protected readonly tickets = computed(() => {
    const bucket = this.agingFilter();
    const now = new Date();
    return bucket === null
      ? this.base()
      : this.base().filter((t) => matchesDimension(t, 'aging', bucket, now));
  });

  /** Le fasce restano sempre tutte visibili, con quella scelta evidenziata. */
  protected readonly aging = computed(() => agingBuckets(this.base(), new Date()));
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

  /** Clic su una fascia: filtra gli altri riquadri; di nuovo sulla stessa la toglie, su un'altra la cambia. */
  protected toggleAging(bucket: string): void {
    this.agingFilter.update((current) => (current === bucket ? null : bucket));
  }

  /** Clic sul numero in alto: tutti i ticket della pagina. */
  protected openAll(): void {
    void this.router.navigate(['/tickets/dettaglio'], { queryParams: this.params({}) });
  }

  /** Parametri dell'elenco di dettaglio, con la fascia di anzianità se è scelta. */
  private params(extra: Record<string, string>): Record<string, string> {
    const bucket = this.agingFilter();
    return { scope: this.scope(), ...extra, ...(bucket === null ? {} : { aging: bucket }) };
  }

  /** Clic su una barra: elenco dei ticket di quella barra. */
  protected drill(dim: DrillDimension, value: string): void {
    void this.router.navigate(['/tickets/dettaglio'], {
      queryParams: this.params({ dim, value }),
    });
  }
}
