import { Component, computed, input, signal } from '@angular/core';

/** Periodo del grafico: creati e risolti (barre) e aperti a fine periodo (linea). */
export interface PeriodChartPoint {
  readonly label: string;
  readonly title: string;
  readonly created: number;
  readonly resolved: number;
  readonly open: number;
  /** Periodo ancora in corso: barre più chiare, asterisco sull'asse e nota in legenda. */
  readonly partial?: boolean;
}

const WIDTH = 720;
const HEIGHT = 280;
const TALL_HEIGHT = 380;
const PAD = { top: 18, right: 16, bottom: 24, left: 36 };

function bar(x: number, y: number, width: number, height: number): string {
  if (height <= 0) {
    return '';
  }
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

function ticks(max: number): number[] {
  const raw = max / 3;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, raw)));
  const step = Math.max(1, Math.ceil(raw / magnitude) * magnitude);
  return [0, step, step * 2, step * 3];
}

/**
 * Creati e risolti per periodo (barre affiancate) e lavorabili a fine periodo (linea) nello
 * stesso grafico, come in Power BI: sono tutti numeri di ticket, quindi un solo asse (niente
 * doppio asse). Tre colori della palette validata per daltonici e tema scuro; la linea ha anche
 * forma diversa e l'etichetta col valore finale. Le etichette dei periodi si diradano quando
 * sono tanti; passando sopra un periodo compaiono i numeri, "Dati" apre la tabella.
 */
@Component({
  selector: 'gov-period-chart',
  template: `
    <div class="viz">
      <div class="viz__head">
        <h3 class="viz__title">{{ barsTitle() }}</h3>
        <ul class="legend" aria-label="Legenda">
          <li><span class="swatch swatch--created" aria-hidden="true"></span>Creati</li>
          <li><span class="swatch swatch--resolved" aria-hidden="true"></span>Risolti</li>
          <li><span class="swatch swatch--line" aria-hidden="true"></span>{{ lineTitle() }}</li>
          @if (hasPartial()) {
            <li class="legend__partial">* periodo in corso (parziale)</li>
          }
        </ul>
      </div>
      <div class="viz__plot" (mouseleave)="hover.set(null)">
        <svg
          [class.big]="slot() >= 60"
          [attr.viewBox]="'0 0 ' + width + ' ' + height"
          role="img"
          [attr.aria-label]="
            barsTitle() + ' e ' + lineTitle() + '; i numeri sono nella tabella Dati'
          "
        >
          @for (tick of yTicks(); track tick) {
            <line
              class="grid"
              [attr.x1]="pad.left"
              [attr.x2]="width - pad.right"
              [attr.y1]="y(tick)"
              [attr.y2]="y(tick)"
            />
            <text class="axis" [attr.x]="pad.left - 6" [attr.y]="y(tick) + 4" text-anchor="end">
              {{ tick }}
            </text>
          }
          @for (item of bars(); track $index) {
            <path
              class="bar bar--created"
              [class.bar--partial]="item.point.partial"
              [attr.d]="item.created"
            />
            <path
              class="bar bar--resolved"
              [class.bar--partial]="item.point.partial"
              [attr.d]="item.resolved"
            />
            @if (showValues()) {
              @if (item.point.created > 0) {
                <text
                  class="barval"
                  [attr.x]="item.createdCenter"
                  [attr.y]="item.createdTop - 3"
                  text-anchor="middle"
                >
                  {{ item.point.created }}
                </text>
              }
              @if (item.point.resolved > 0) {
                <text
                  class="barval"
                  [attr.x]="item.resolvedCenter"
                  [attr.y]="item.resolvedTop - 3"
                  text-anchor="middle"
                >
                  {{ item.point.resolved }}
                </text>
              }
            }
            @if (item.showLabel) {
              <text class="axis" [attr.x]="item.center" [attr.y]="height - 6" text-anchor="middle">
                {{ item.point.label }}{{ item.point.partial ? '*' : '' }}
              </text>
            }
          }
          <path class="line" [attr.d]="linePath()" />
          @for (item of bars(); track $index) {
            <circle
              class="dot"
              [class.dot--on]="hover() === $index"
              [attr.cx]="item.center"
              [attr.cy]="y(item.point.open)"
              r="3.5"
            />
            <rect
              class="hit"
              [class.hit--on]="hover() === $index"
              [attr.x]="item.x"
              [attr.y]="pad.top"
              [attr.width]="slot()"
              [attr.height]="height - pad.top - pad.bottom"
              (mouseenter)="hover.set($index)"
            />
          }
          @if (bars().length > 0) {
            @let last = bars()[bars().length - 1];
            <text
              class="value"
              [attr.x]="last.center"
              [attr.y]="y(last.point.open) - 10"
              text-anchor="end"
            >
              {{ last.point.open }}
            </text>
          }
        </svg>
        @if (hover() !== null) {
          @let point = points()[hover()!];
          <div class="tip" role="status" [style.left.%]="tipLeft(hover()!)">
            <strong>{{ point.title }}</strong>
            <span
              ><span class="swatch swatch--created" aria-hidden="true"></span>Creati
              {{ point.created }}</span
            >
            <span
              ><span class="swatch swatch--resolved" aria-hidden="true"></span>Risolti
              {{ point.resolved }}</span
            >
            <span
              ><span class="swatch swatch--line" aria-hidden="true"></span>{{ lineTitle() }}
              {{ point.open }}</span
            >
          </div>
        }
      </div>

      <details class="data">
        <summary>Dati</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Periodo</th>
              <th scope="col">Creati</th>
              <th scope="col">Risolti</th>
              <th scope="col">{{ lineTitle() }}</th>
            </tr>
          </thead>
          <tbody>
            @for (point of tableRows(); track $index) {
              <tr>
                <th scope="row">{{ point.title }}</th>
                <td>{{ point.created }}</td>
                <td>{{ point.resolved }}</td>
                <td>{{ point.open }}</td>
              </tr>
            }
          </tbody>
        </table>
      </details>
    </div>
  `,
  styles: `
    :host {
      --series-1: light-dark(#2a78d6, #3987e5);
      --series-2: light-dark(#eb6834, #d95926);
      --series-3: light-dark(#1baf7a, #199e70);
      display: block;
    }

    .viz__head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .viz__title {
      margin: 0 0 0.25rem;
      font: var(--mat-sys-title-small);
    }

    .viz__plot {
      position: relative;
    }

    svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1rem;
      margin: 0;
      padding: 0;
      list-style: none;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }

    .swatch {
      display: inline-block;
      width: 0.625rem;
      height: 0.625rem;
      margin-inline-end: 0.375rem;
      border-radius: 2px;
    }

    .swatch--created {
      background: var(--series-1);
    }

    .swatch--resolved {
      background: var(--series-2);
    }

    // La linea nella legenda è una linea, non un quadrato
    .swatch--line {
      width: 1rem;
      height: 2px;
      vertical-align: middle;
      background: var(--series-3);
    }

    .grid {
      stroke: var(--mat-sys-outline-variant);
    }

    .axis {
      fill: var(--mat-sys-on-surface-variant);
      font-size: 10px;
    }

    .value {
      fill: var(--mat-sys-on-surface);
      font-size: 12px;
      font-weight: 600;
    }

    // Numero in cima a ogni barra: si legge senza aprire il riquadro
    // Con pochi periodi (barre larghe) i numeri e gli assi si ingrandiscono
    .big {
      .barval {
        font-size: 14px;
      }

      .axis {
        font-size: 13px;
      }

      .value {
        font-size: 16px;
      }
    }

    .barval {
      fill: var(--mat-sys-on-surface);
      font-size: 10px;
      font-weight: 600;
      pointer-events: none;
    }

    .bar--created {
      fill: var(--series-1);
    }

    // Periodo in corso: barre più chiare con bordo tratteggiato
    .bar--partial {
      fill-opacity: 0.45;
      stroke: currentColor;
      stroke-dasharray: 3 2;
      stroke-width: 1;
    }

    .bar--created.bar--partial {
      stroke: var(--series-1);
    }

    .bar--resolved.bar--partial {
      stroke: var(--series-2);
    }

    .bar--resolved {
      fill: var(--series-2);
    }

    .line {
      fill: none;
      stroke: var(--series-3);
      stroke-width: 2;
    }

    // Anello del colore della superficie: il punto si stacca dalle barre sotto
    .dot {
      fill: var(--series-3);
      stroke: var(--mat-sys-surface);
      stroke-width: 2;
    }

    .dot--on {
      r: 6;
    }

    .hit {
      fill: transparent;
    }

    .hit--on {
      fill: color-mix(in srgb, var(--mat-sys-on-surface) 6%, transparent);
    }

    .tip {
      position: absolute;
      top: 0;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 0.125rem;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      background: var(--mat-sys-inverse-surface);
      color: var(--mat-sys-inverse-on-surface);
      font: var(--mat-sys-body-small);
      transform: translateX(-50%);
      pointer-events: none;
    }

    .data {
      margin-top: 0.5rem;
      font: var(--mat-sys-body-small);
    }

    .data summary {
      cursor: pointer;
      color: var(--mat-sys-primary);
    }

    .data table {
      margin-top: 0.5rem;
      border-collapse: collapse;
    }

    .data th,
    .data td {
      padding: 0.125rem 0.75rem 0.125rem 0;
      text-align: right;
    }

    .data th:first-child {
      text-align: left;
    }
  `,
})
export class PeriodChart {
  readonly points = input.required<readonly PeriodChartPoint[]>();
  readonly barsTitle = input('Creati e risolti');
  readonly lineTitle = input('Aperti a fine periodo');
  /** Righe della tabella "Dati" se più estese del grafico (es. 20 settimane contro 8); altrimenti i punti. */
  readonly dataPoints = input<readonly PeriodChartPoint[] | null>(null);
  protected readonly hasPartial = computed(() => this.points().some((point) => point.partial));
  protected readonly tableRows = computed(() => this.dataPoints() ?? this.points());

  protected readonly width = WIDTH;
  /** Grafico più alto (es. affiancato a una tabella): più spazio per barre e numeri. */
  readonly tall = input(false);

  protected get height(): number {
    return this.tall() ? TALL_HEIGHT : HEIGHT;
  }

  protected readonly pad = PAD;
  protected readonly hover = signal<number | null>(null);

  protected readonly slot = computed(
    () => (WIDTH - PAD.left - PAD.right) / Math.max(1, this.points().length),
  );

  /** Un solo asse per barre e linea: arriva al valore più alto dei tre. */
  protected readonly yTicks = computed(() =>
    ticks(Math.max(1, ...this.points().map((p) => Math.max(p.created, p.resolved, p.open)))),
  );

  /** Ogni quante etichette se ne mostra una (circa 14 al massimo). */
  private readonly labelEvery = computed(() => Math.max(1, Math.ceil(this.points().length / 14)));

  /** Con poche barre (fino a circa 30 periodi) il valore si scrive in cima a ognuna. */
  protected readonly showValues = computed(() => this.slot() >= 28);

  protected readonly bars = computed(() => {
    const slot = this.slot();
    const top = this.yTicks()[3];
    const plot = this.height - PAD.top - PAD.bottom;
    // Barre larghe quando i periodi sono pochi (fino a 40), sottili quando sono tanti
    const width = Math.max(2, Math.min(40, (slot * 0.72 - 2) / 2));
    return this.points().map((point, index) => {
      const x = PAD.left + index * slot;
      const start = x + (slot - width * 2 - 2) / 2;
      const h1 = (point.created / top) * plot;
      const h2 = (point.resolved / top) * plot;
      return {
        point,
        x,
        center: x + slot / 2,
        showLabel: index % this.labelEvery() === 0,
        createdCenter: start + width / 2,
        createdTop: PAD.top + plot - h1,
        resolvedCenter: start + width + 2 + width / 2,
        resolvedTop: PAD.top + plot - h2,
        created: bar(start, PAD.top + plot - h1, width, h1),
        resolved: bar(start + width + 2, PAD.top + plot - h2, width, h2),
      };
    });
  });

  protected readonly linePath = computed(() =>
    this.bars()
      .map((item, i) => `${i === 0 ? 'M' : 'L'}${item.center},${this.y(item.point.open)}`)
      .join(''),
  );

  protected y(value: number): number {
    const plot = this.height - PAD.top - PAD.bottom;
    return PAD.top + plot - (value / this.yTicks()[3]) * plot;
  }

  protected tipLeft(index: number): number {
    const x = PAD.left + index * this.slot() + this.slot() / 2;
    return Math.min(82, Math.max(14, (x / WIDTH) * 100));
  }
}
