import { Component, computed, input, output } from '@angular/core';

export interface HBarItem {
  readonly label: string;
  readonly value: number;
}

/**
 * Barre orizzontali con il valore in fondo a ogni barra (come Power BI). Una sola serie, quindi
 * senza legenda: il titolo dice cosa si conta. Con {@code selectable} il clic su una barra la
 * emette per filtrare le altre viste; la barra scelta resta evidenziata.
 */
@Component({
  selector: 'gov-hbar-chart',
  template: `
    <figure class="chart">
      <figcaption class="chart__title">{{ title() }}</figcaption>
      @if (items().length === 0) {
        <p class="chart__empty">Nessun dato con i filtri scelti.</p>
      }
      <ul class="bars" [style.max-height]="maxHeight()" [attr.aria-label]="title()">
        @for (item of items(); track item.label) {
          <li class="bars__row">
            @if (selectable() || drillable()) {
              <button
                type="button"
                class="bars__label bars__label--button"
                [class.bars__label--on]="selected()?.includes(item.label)"
                [title]="
                  item.label +
                  ': ' +
                  item.value +
                  (selectable() ? ' · clic per filtrare' : ' · clic per vedere i ticket')
                "
                [attr.aria-pressed]="
                  selectable() ? (selected()?.includes(item.label) ?? false) : null
                "
                (click)="selectable() ? pick.emit(item.label) : drill.emit(item.label)"
              >
                {{ item.label }}
              </button>
            } @else {
              <span class="bars__label" [title]="item.label">{{ item.label }}</span>
            }
            <span
              class="bars__track"
              [class.bars__track--link]="clickable()"
              [attr.aria-hidden]="clickable() ? null : true"
              [attr.role]="clickable() ? 'button' : null"
              [attr.tabindex]="clickable() ? 0 : null"
              [attr.aria-label]="clickable() ? barHint(item) : null"
              [title]="clickable() ? barHint(item) : ''"
              (click)="clickable() && act(item.label)"
              (keydown.enter)="clickable() && act(item.label)"
            >
              <span
                class="bars__bar"
                [class.bars__bar--alt]="color() === 'alt'"
                [class.bars__bar--dim]="selected() && !selected()!.includes(item.label)"
                [style.width.%]="(item.value / max()) * 100"
              ></span>
            </span>
            @if (clickable()) {
              <button
                type="button"
                class="bars__value bars__value--link"
                [title]="barHint(item)"
                (click)="act(item.label)"
              >
                {{ item.value }}
              </button>
            } @else {
              <span class="bars__value">{{ item.value }}</span>
            }
          </li>
        }
      </ul>
    </figure>
  `,
  styles: `
    :host {
      --series-1: light-dark(#2a78d6, #3987e5);
      --series-2: light-dark(#eb6834, #d95926);
      display: block;
    }

    .chart {
      margin: 0;

      &__title {
        margin-bottom: 0.5rem;
        font: var(--mat-sys-title-small);
      }

      &__empty {
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-body-small);
      }
    }

    .bars {
      margin: 0;
      padding: 0;
      overflow-y: auto;
      list-style: none;

      &__row {
        display: grid;
        grid-template-columns: minmax(6rem, 11rem) 1fr 2.75rem;
        align-items: center;
        gap: 0.5rem;
        height: 1.5rem;
      }

      &__label {
        overflow: hidden;
        color: var(--mat-sys-on-surface);
        font: var(--mat-sys-body-small);
        text-align: end;
        text-overflow: ellipsis;
        white-space: nowrap;

        &--button {
          padding: 0;
          border: 0;
          background: none;
          cursor: pointer;

          &:hover {
            color: var(--mat-sys-primary);
            text-decoration: underline;
          }
        }

        &--on {
          color: var(--mat-sys-primary);
          font-weight: 700;
        }
      }

      &__track {
        display: block;
        height: 0.875rem;

        &--link {
          cursor: pointer;

          &:hover .bars__bar,
          &:focus-visible .bars__bar {
            filter: brightness(1.15);
          }
        }
      }

      // Barra sottile con l'estremità arrotondata (4px), appoggiata all'asse
      &__bar {
        display: block;
        min-width: 2px;
        height: 100%;
        border-radius: 0 4px 4px 0;
        background: var(--series-1);

        &--alt {
          background: var(--series-2);
        }

        &--dim {
          opacity: 0.35;
        }
      }

      &__value {
        color: var(--mat-sys-on-surface-variant);
        font: var(--mat-sys-label-medium);

        &--link {
          padding: 0;
          border: 0;
          background: none;
          text-align: start;
          cursor: pointer;

          &:hover {
            color: var(--mat-sys-primary);
            text-decoration: underline;
          }
        }
      }
    }
  `,
})
export class HBarChart {
  readonly title = input.required<string>();
  readonly items = input.required<readonly HBarItem[]>();
  /** 'main' (blu) o 'alt' (arancio, es. i ticket aperti come in Power BI). */
  readonly color = input<'main' | 'alt'>('main');
  readonly selectable = input(false);
  readonly selected = input<readonly string[] | null>(null);
  /** Altezza massima (di partenza 10 barre da 1,5rem): oltre, l'elenco scorre. */
  readonly maxHeight = input('15rem');

  /** Barre cliccabili (anche sul valore) per arrivare all'elenco dei ticket. */
  readonly drillable = input(false);
  /** Con {@code selectable}: anche il clic sulla barra o sul valore filtra (come l'etichetta). */
  readonly pickOnBar = input(false);

  protected readonly clickable = computed(
    () => this.drillable() || (this.selectable() && this.pickOnBar()),
  );

  protected barHint(item: HBarItem): string {
    return this.drillable()
      ? `Vedi i ${item.value} ticket: ${item.label}`
      : `Filtra gli altri grafici su: ${item.label}`;
  }

  /** Clic su barra o valore: apre l'elenco (drill) oppure filtra (pick). */
  protected act(label: string): void {
    if (this.drillable()) {
      this.drill.emit(label);
    } else {
      this.pick.emit(label);
    }
  }

  readonly pick = output<string>();
  readonly drill = output<string>();

  protected readonly max = computed(() => Math.max(1, ...this.items().map((item) => item.value)));
}
