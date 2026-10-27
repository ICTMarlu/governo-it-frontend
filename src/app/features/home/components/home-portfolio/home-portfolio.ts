import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';

import { API_BASE_URL } from '../../../../core/config/api.config';
import { errorMessage } from '../../../../shared/crud/crud-api.service';
import {
  MOVEMENT_SERIES,
  MovementPeriod,
  Portfolio,
  ProjectRef,
  movementPoints,
  movementTotals,
} from '../../portfolio.model';

/** Misure del grafico del movimento (SVG in unità del viewBox). */
const CHART = { width: 640, height: 180, left: 28, bottom: 22, top: 8 } as const;
const LINE = { height: 90, top: 12, bottom: 20 } as const;

/** Stati messi in evidenza nella fotografia (colore + etichetta, mai solo colore). */
const HIGHLIGHT: Readonly<Record<string, string>> = {
  IN_PROGRESS: 'accent',
  PENDING: 'warn',
  COMPLETED: 'good',
};

/**
 * Dashboard dei progetti di tipo Project nella home (D-34): fotografia per stato, coerenza tra
 * stato e piano, progetti in parallelo per persona e movimento nel tempo dallo storico degli stati.
 */
@Component({
  selector: 'gov-home-portfolio',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  templateUrl: './home-portfolio.html',
  styleUrl: './home-portfolio.scss',
})
export class HomePortfolio {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/home/portfolio`;
  /** Parametri "vedi come" dell'Admin (asUser o asResource); vuoto = chi è collegato. */
  readonly params = input<Record<string, string>>({});
  protected readonly series = MOVEMENT_SERIES;
  protected readonly chart = CHART;
  protected readonly line = LINE;
  protected readonly highlight = HIGHLIGHT;

  protected readonly data = signal<Portfolio | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly period = signal<MovementPeriod>('week');

  protected readonly points = computed(() =>
    movementPoints(this.data()?.movement ?? [], this.period()),
  );
  protected readonly totals = computed(() => movementTotals(this.data()?.movement ?? []));
  /** Nessun movimento ancora registrato: lo storico è appena partito. */
  protected readonly empty = computed(() =>
    Object.values(this.totals()).every((value) => value === 0),
  );
  protected readonly maxBar = computed(() =>
    Math.max(1, ...this.points().flatMap((point) => this.series.map((serie) => point[serie.key]))),
  );
  protected readonly maxLine = computed(() =>
    Math.max(1, ...this.points().map((point) => point.inProgressAtEnd)),
  );
  /** I tre controlli tra stato e piano, con icona e tono (mai solo colore). */
  protected readonly checks = computed(() => {
    const coherence = this.data()?.coherence;
    return [
      {
        icon: 'warning',
        tone: 'warn',
        label: 'in corso senza giornate nel piano: in corso solo sulla carta',
        list: coherence?.inProgressWithoutPlan ?? [],
      },
      {
        icon: 'play_circle',
        tone: 'accent',
        label: 'da avviare o approvati con giornate già nel piano: di fatto partiti',
        list: coherence?.startedNotInProgress ?? [],
      },
      {
        icon: 'event_busy',
        tone: 'bad',
        label: 'chiusi, abortiti o respinti con giornate ancora nel piano',
        list: coherence?.closedWithPlan ?? [],
      },
    ];
  });
  protected readonly maxParallel = computed(() =>
    Math.max(this.data()?.wipLimit ?? 1, ...(this.data()?.parallel ?? []).map((p) => p.count)),
  );

  constructor() {
    effect(() => {
      const params = this.params();
      untracked(() => {
        this.data.set(null);
        this.error.set(null);
        this.http.get<Portfolio>(this.url, { params }).subscribe({
          next: (data) => this.data.set(data),
          error: (e) => this.error.set(errorMessage(e)),
        });
      });
    });
  }

  /** Larghezza di un gruppo di barre (un periodo) nel grafico. */
  protected slot(): number {
    return (CHART.width - CHART.left) / Math.max(1, this.points().length);
  }

  protected barWidth(): number {
    return Math.min(18, (this.slot() * 0.8) / this.series.length);
  }

  protected barX(index: number, serie: number): number {
    const group = this.barWidth() * this.series.length;
    return CHART.left + index * this.slot() + (this.slot() - group) / 2 + serie * this.barWidth();
  }

  protected barHeight(value: number): number {
    return ((CHART.height - CHART.bottom - CHART.top) * value) / this.maxBar();
  }

  protected lineY(value: number): number {
    return LINE.top + (LINE.height - LINE.top - LINE.bottom) * (1 - value / this.maxLine());
  }

  protected lineX(index: number): number {
    return CHART.left + index * this.slot() + this.slot() / 2;
  }

  protected linePath(): string {
    return this.points()
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'}${this.lineX(index)},${this.lineY(point.inProgressAtEnd)}`,
      )
      .join(' ');
  }

  protected percent(count: number): number {
    return Math.round((count / this.maxParallel()) * 100);
  }

  protected refLabel(project: ProjectRef): string {
    return project.code ? `${project.code} · ${project.name}` : project.name;
  }
}
