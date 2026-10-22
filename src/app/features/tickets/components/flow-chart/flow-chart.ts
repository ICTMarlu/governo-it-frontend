import { DecimalPipe } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';

import { WeekFlow, weekBalance } from '../../models/ticket.model';

const WIDTH = 640;
const HEIGHT = 200;
const PAD = { top: 12, right: 8, bottom: 24, left: 32 };
const LINE_HEIGHT = 120;

/** Barra con gli angoli superiori arrotondati (4px), appoggiata alla linea di base. */
function bar(x: number, y: number, width: number, height: number): string {
  if (height <= 0) {
    return '';
  }
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

/** Scala "pulita" dell'asse: 3 valori tondi fino al massimo. */
function ticks(max: number): number[] {
  const step = Math.max(1, Math.ceil(max / 3 / 5) * 5);
  return [0, step, step * 2, step * 3];
}

/**
 * Flussi settimanali dei ticket: entrati e chiusi (barre affiancate, due colori validati per
 * daltonici e tema scuro) e, sotto, gli aperti a fine settimana (linea). Due grafici con un
 * asse ciascuno: i valori hanno scale diverse. Passando sopra una settimana compaiono i numeri;
 * "Dati" mostra la tabella.
 */
@Component({
  selector: 'gov-flow-chart',
  imports: [DecimalPipe],
  templateUrl: './flow-chart.html',
  styleUrl: './flow-chart.scss',
})
export class FlowChart {
  readonly weeks = input.required<readonly WeekFlow[]>();

  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly lineHeight = LINE_HEIGHT;
  protected readonly pad = PAD;
  protected readonly hover = signal<number | null>(null);
  protected readonly balance = weekBalance;

  private readonly slot = computed(
    () => (WIDTH - PAD.left - PAD.right) / Math.max(1, this.weeks().length),
  );

  protected readonly flowTicks = computed(() =>
    ticks(Math.max(1, ...this.weeks().map((week) => Math.max(week.created, week.resolved)))),
  );

  protected readonly bars = computed(() => {
    const top = this.flowTicks()[this.flowTicks().length - 1];
    const plot = HEIGHT - PAD.top - PAD.bottom;
    const slot = this.slot();
    const barWidth = Math.max(3, (slot - 10) / 2);
    return this.weeks().map((week, index) => {
      const x = PAD.left + index * slot + (slot - barWidth * 2 - 2) / 2;
      const h1 = (week.created / top) * plot;
      const h2 = (week.resolved / top) * plot;
      return {
        week,
        index,
        slotX: PAD.left + index * slot,
        labelX: PAD.left + index * slot + slot / 2,
        created: bar(x, PAD.top + plot - h1, barWidth, h1),
        resolved: bar(x + barWidth + 2, PAD.top + plot - h2, barWidth, h2),
      };
    });
  });

  protected readonly flowY = computed(() => {
    const top = this.flowTicks()[this.flowTicks().length - 1];
    const plot = HEIGHT - PAD.top - PAD.bottom;
    return (value: number) => PAD.top + plot - (value / top) * plot;
  });

  protected readonly openTicks = computed(() =>
    ticks(Math.max(1, ...this.weeks().map((week) => week.openAtEnd))),
  );

  protected readonly openPoints = computed(() => {
    const top = this.openTicks()[this.openTicks().length - 1];
    const plot = LINE_HEIGHT - PAD.top - PAD.bottom;
    const slot = this.slot();
    return this.weeks().map((week, index) => ({
      x: PAD.left + index * slot + slot / 2,
      y: PAD.top + plot - (week.openAtEnd / top) * plot,
      week,
      index,
    }));
  });

  protected readonly openY = computed(() => {
    const top = this.openTicks()[this.openTicks().length - 1];
    const plot = LINE_HEIGHT - PAD.top - PAD.bottom;
    return (value: number) => PAD.top + plot - (value / top) * plot;
  });

  protected readonly openPath = computed(() =>
    this.openPoints()
      .map((point, i) => `${i === 0 ? 'M' : 'L'}${point.x},${point.y}`)
      .join(''),
  );

  protected readonly slotWidth = computed(() => this.slot());

  /** Etichetta corta della settimana: "19/10". */
  protected label(iso: string): string {
    const [, month, day] = iso.split('-');
    return `${day}/${month}`;
  }

  /** Posizione del riquadro con i numeri, in percentuale della larghezza. */
  protected tooltipLeft(index: number): number {
    const x = PAD.left + index * this.slot() + this.slot() / 2;
    return Math.min(80, Math.max(12, (x / WIDTH) * 100));
  }
}
