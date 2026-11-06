import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { MonthlyAverage, RECENT_MONTHS } from './bi-averages';

/**
 * Riquadro con la media mensile dell'anno in corso e il trend: la media degli ultimi mesi completi contro
 * quella dei mesi prima. {@code goodWhenUp}: salire è un bene (i risolti); altrimenti il trend è solo
 * un'indicazione.
 */
@Component({
  selector: 'gov-bi-average-card',
  imports: [DecimalPipe, MatIconModule],
  template: `
    @let a = average();
    <h3 class="avg__title">{{ title() }}</h3>
    <p class="avg__value">
      <span class="avg__number">{{ a.average | number: '1.0-1' }}</span>
      <span class="avg__unit">al mese · {{ a.year }} · tutti i ticket, non filtrato</span>
    </p>
    @if (a.months === 0) {
      <p class="avg__note">Nessun mese completo nell'anno: la media parte da febbraio.</p>
    } @else {
      <p class="avg__trend avg__trend--{{ tone() }}" role="status" [title]="explanation()">
        <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
        <span>{{ trendOf(a) }}</span>
      </p>
      @if (compareOf(a); as compare) {
        <p class="avg__compare" [title]="explanation()">{{ compare }}</p>
      }
      <p class="avg__note" [title]="explanation()">
        Media sui {{ a.months }} {{ a.months === 1 ? 'mese completo' : 'mesi completi' }} ({{
          a.from
        }}–{{ a.to }}). {{ a.currentMonthLabel }} finora: {{ a.currentMonthSoFar }}.
      </p>
    }
    @if (filtered(); as f) {
      <p class="avg__filtered" [title]="explanation()">
        <strong>Con i filtri scelti:</strong>
        {{ f.average | number: '1.0-1' }} al mese
        @if (f.trend !== null) {
          · {{ trendOf(f) }}
        }
      </p>
      @if (compareOf(f); as compare) {
        <p class="avg__compare">{{ compare }}</p>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .avg__title {
      margin: 0 0 0.5rem;
      font: var(--mat-sys-title-small);
    }
    .avg__value {
      display: flex;
      align-items: baseline;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 0;
    }
    .avg__number {
      font: var(--mat-sys-display-small);
    }
    .avg__unit {
      color: var(--mat-sys-on-surface-variant);
    }
    .avg__trend {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      margin: 0.5rem 0 0;
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
      cursor: help;
    }
    .avg__trend--ok {
      color: var(--gi-ok, #2e7d32);
    }
    .avg__trend--warning {
      color: var(--gi-warning, #b26a00);
    }
    .avg__compare {
      margin: 0.25rem 0 0;
      font: var(--mat-sys-body-medium);
    }
    .avg__filtered {
      margin: 0.75rem 0 0;
      padding-top: 0.5rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
      font: var(--mat-sys-body-medium);
    }
    .avg__note {
      margin: 0.5rem 0 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
  `,
})
export class BiAverageCard {
  readonly title = input.required<string>();
  readonly average = input.required<MonthlyAverage>();
  /** La stessa media sulla sola selezione di area e assegnatario; null senza filtri. */
  readonly filtered = input<MonthlyAverage | null>(null);
  readonly goodWhenUp = input(false);

  protected readonly icon = computed(() => {
    switch (this.average().trend) {
      case 'up':
        return 'trending_up';
      case 'down':
        return 'trending_down';
      default:
        return 'trending_flat';
    }
  });

  protected readonly tone = computed(() => {
    const trend = this.average().trend;
    if (!this.goodWhenUp() || trend === null || trend === 'flat') {
      return 'neutral';
    }
    return trend === 'up' ? 'ok' : 'warning';
  });

  /** Come si legge il trend, al passaggio del mouse. */
  protected readonly explanation = computed(
    () =>
      `Trend: la media degli ultimi ${RECENT_MONTHS} mesi completi confrontata con la media dei mesi ` +
      `precedenti dello stesso anno. Il mese in corso non conta perché è parziale. Sotto l'1% di ` +
      `differenza è "stabile". Servono almeno ${RECENT_MONTHS + 1} mesi completi. ` +
      `Il numero grande è il totale di tutti i ticket: filtri e vista non lo cambiano.`,
  );

  protected trendOf(a: MonthlyAverage): string {
    if (a.trend === null || a.delta === null || a.recentFrom === null || a.earlierTo === null) {
      return `Trend dal ${RECENT_MONTHS + 1}° mese completo`;
    }
    if (a.trend === 'flat') {
      return 'Stabile';
    }
    const sign = a.delta > 0 ? '+' : '−';
    const amount = Math.abs(a.delta).toLocaleString('it-IT', { maximumFractionDigits: 1 });
    const pct =
      a.deltaPct === null
        ? ''
        : ` (${sign}${Math.abs(a.deltaPct).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%)`;
    return `${a.trend === 'up' ? 'In crescita' : 'In calo'} ${sign}${amount} al mese${pct}`;
  }

  /** I due valori che si confrontano, in assoluto: es. "248,3 al mese (ago–ott) contro 224,3 al mese (gen–lug)". */
  protected compareOf(a: MonthlyAverage): string | null {
    if (a.recentAverage === null || a.earlierAverage === null) {
      return null;
    }
    const n = (value: number) => value.toLocaleString('it-IT', { maximumFractionDigits: 1 });
    return (
      `${n(a.recentAverage)} al mese (ultimi ${RECENT_MONTHS} mesi, ${a.recentFrom}–${a.to}) contro ` +
      `${n(a.earlierAverage)} al mese (${a.from}–${a.earlierTo})`
    );
  }
}
