import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  input,
  output,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ArchitectureMapPanel, ReachedApp } from './architecture-map-panel';
import {
  AppLink,
  AppNode,
  LAYER_COLORS,
  NODE_H,
  NODE_W,
  PlacedNode,
  TYPE_ICONS,
  criticalityColor,
  dependencies,
  layout,
  linkPath,
  linkWidth,
  reach,
} from './architecture.model';

type NodeState = 'selected' | 'impacted' | 'upstream' | 'dim' | 'normal';
type LinkState = 'impact' | 'upstream' | 'dim' | 'normal';

interface DrawnLink {
  readonly link: AppLink;
  readonly d: string;
  readonly mx: number;
  readonly my: number;
  readonly state: LinkState;
  readonly width: number;
  readonly start: boolean;
  readonly end: boolean;
  readonly label: boolean;
  readonly title: string;
}

/** Quanti passaggi seguire per impatto e dipendenze. */
const DEPTHS: readonly { readonly value: number | null; readonly label: string }[] = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: null, label: 'Tutta' },
];

/** Oltre questo numero di flussi le scritte sulle frecce si mostrano solo per l'applicativo scelto. */
const LABELS_ALWAYS_UP_TO = 30;

function cut(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

/**
 * Mappa a livelli degli applicativi (D-38): un riquadro per livello, schede con icona e server,
 * frecce che seguono i dati con scritta (direzione e protocollo). Cliccando un applicativo si
 * vede cosa si ferma se lui si ferma (impatto) e da cosa dipende.
 */
@Component({
  selector: 'gov-architecture-map',
  imports: [
    ArchitectureMapPanel,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  template: `
    <div class="bar" role="toolbar" aria-label="Comandi della mappa">
      <input
        class="search"
        type="search"
        placeholder="Cerca applicativo, server, sistema"
        aria-label="Cerca applicativo"
        [ngModel]="query()"
        (ngModelChange)="query.set($event)"
        (keydown.enter)="selectFirstMatch()"
      />
      <span class="label">Profondità</span>
      <mat-button-toggle-group
        hideSingleSelectionIndicator
        aria-label="Profondità"
        [value]="depth()"
        (change)="depth.set($event.value)"
      >
        @for (option of depths; track option.label) {
          <mat-button-toggle [value]="option.value">{{ option.label }}</mat-button-toggle>
        }
      </mat-button-toggle-group>
      <mat-slide-toggle [checked]="onlyLinked()" (change)="onlyLinked.set($event.checked)">
        Solo i collegati
      </mat-slide-toggle>
      <mat-slide-toggle [checked]="showRetired()" (change)="showRetired.set($event.checked)">
        Dismessi
      </mat-slide-toggle>
    </div>

    <div class="body">
      <div class="stage" #stage>
        <div class="tools" role="toolbar" aria-label="Zoom e vista">
          <button
            type="button"
            [class.on]="labelsOn()"
            [matTooltip]="
              labelsOn() ? 'Nascondi le scritte sulle frecce' : 'Mostra le scritte sulle frecce'
            "
            matTooltipPosition="right"
            (click)="labels.set(!labelsOn())"
          >
            <mat-icon>label</mat-icon>
          </button>
          <button
            type="button"
            matTooltip="Ingrandisci"
            matTooltipPosition="right"
            (click)="zoomBy(0.15)"
          >
            <mat-icon>add</mat-icon>
          </button>
          <button
            type="button"
            matTooltip="Rimpicciolisci"
            matTooltipPosition="right"
            (click)="zoomBy(-0.15)"
          >
            <mat-icon>remove</mat-icon>
          </button>
          <button
            type="button"
            matTooltip="Adatta allo spazio"
            matTooltipPosition="right"
            (click)="fit()"
          >
            <mat-icon>fit_screen</mat-icon>
          </button>
          <button
            type="button"
            [matTooltip]="fullscreen() ? 'Esci da schermo intero' : 'Schermo intero'"
            matTooltipPosition="right"
            (click)="toggleFullscreen()"
          >
            <mat-icon>{{ fullscreen() ? 'fullscreen_exit' : 'fullscreen' }}</mat-icon>
          </button>
        </div>
        <div class="canvas" #canvas tabindex="-1" (click)="clear()" (keydown.escape)="clear()">
          @if (map().nodes.length === 0) {
            <p class="empty">
              Nessun applicativo da mostrare. Aggiungili nella scheda Applicativi o importa il file.
            </p>
          } @else {
            <svg
              [attr.viewBox]="'0 0 ' + map().width + ' ' + map().height"
              [attr.width]="map().width * zoom()"
              [attr.height]="map().height * zoom()"
              role="img"
              aria-label="Mappa degli applicativi e dei flussi"
            >
              <defs>
                @for (marker of markers; track marker.id) {
                  <marker
                    [attr.id]="marker.id"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="8"
                    markerHeight="8"
                    orient="auto-start-reverse"
                    markerUnits="userSpaceOnUse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" [attr.fill]="marker.color" />
                  </marker>
                }
              </defs>

              @for (column of map().columns; track column.layer) {
                <g class="lane">
                  <rect
                    [attr.x]="column.x"
                    [attr.y]="column.y"
                    [attr.width]="column.width"
                    [attr.height]="column.height"
                    rx="18"
                  />
                  <text class="lane-title" [attr.x]="column.x + 18" [attr.y]="column.y + 28">
                    {{ column.label }}
                  </text>
                  <text class="lane-count" [attr.x]="column.x + 18" [attr.y]="column.y + 46">
                    {{ column.count }} {{ column.count === 1 ? 'applicativo' : 'applicativi' }}
                  </text>
                </g>
              }

              @for (drawn of links(); track drawn.link.id) {
                <path
                  [class]="'link link--' + drawn.link.direction + ' link--' + drawn.state"
                  [attr.d]="drawn.d"
                  [attr.stroke-width]="drawn.width"
                  [attr.marker-end]="drawn.end ? markerOf(drawn) : null"
                  [attr.marker-start]="drawn.start ? markerOf(drawn) : null"
                >
                  <title>{{ drawn.title }}</title>
                </path>
              }
              @for (drawn of links(); track drawn.link.id) {
                @if (drawn.label) {
                  <text
                    [class]="'edge edge--' + drawn.link.direction + ' edge--' + drawn.state"
                    [attr.x]="drawn.mx"
                    [attr.y]="drawn.my - 3"
                  >
                    <tspan [attr.x]="drawn.mx">{{ drawn.link.directionLabel.toUpperCase() }}</tspan>
                    @if (drawn.link.protocolLabel) {
                      <tspan [attr.x]="drawn.mx" dy="11">
                        {{ short(drawn.link.protocolLabel, 26) }}
                      </tspan>
                    }
                  </text>
                }
              }

              @for (placed of map().nodes; track placed.app.id) {
                <g
                  [class]="'node node--' + nodeState(placed.app.id)"
                  [class.node--match]="matches().has(placed.app.id)"
                  [attr.transform]="'translate(' + placed.x + ',' + placed.y + ')'"
                  role="button"
                  tabindex="0"
                  [attr.aria-label]="placed.app.name + ', ' + placed.app.typeLabel"
                  (click)="select(placed.app.id, $event)"
                  (keydown.enter)="select(placed.app.id, $event)"
                >
                  <title>{{ tooltip(placed) }}</title>
                  <rect
                    class="box"
                    [attr.width]="nodeW"
                    [attr.height]="nodeH"
                    rx="10"
                    [attr.stroke-dasharray]="placed.app.lifecycle === 'ACTIVE' ? null : '5 3'"
                  />
                  <rect
                    width="4"
                    [attr.height]="nodeH - 16"
                    x="0"
                    y="8"
                    rx="2"
                    [attr.fill]="critColor(placed.app.businessCriticality)"
                  />
                  <rect
                    class="tile"
                    x="12"
                    y="9"
                    width="32"
                    height="32"
                    rx="8"
                    [style.fill]="layerColor(placed.app.layer)"
                  />
                  <text
                    class="glyph"
                    [class.glyph--dark]="placed.app.layer === 'DATA'"
                    x="28"
                    y="34"
                  >
                    {{ icon(placed.app.type ?? '') }}
                  </text>
                  <text class="name" x="54" y="22">{{ short(placed.app.name, 19) }}</text>
                  <text class="sub" x="54" y="38">{{ subtitle(placed.app) }}</text>
                  @if (placed.app.technologyWarnings.length > 0) {
                    <path
                      [attr.transform]="'translate(' + (nodeW - 52) + ',17)'"
                      d="M 7 0 L 14 13 L 0 13 z"
                      [attr.fill]="placed.app.technologyPriorityColor ?? 'var(--gi-warning)'"
                    />
                  }
                  <circle
                    class="badge"
                    [attr.cx]="nodeW - 20"
                    [attr.cy]="nodeH / 2"
                    r="11"
                    [style.fill]="badgeFill(placed.app.layer)"
                  />
                  <text class="badge-text" [attr.x]="nodeW - 20" [attr.y]="nodeH / 2 + 4">
                    {{ degree().get(placed.app.id) ?? 0 }}
                  </text>
                </g>
              }
            </svg>
          }
        </div>
      </div>

      <gov-architecture-map-panel
        class="panel"
        aria-live="polite"
        [app]="selected()"
        [impacted]="impactedList()"
        [upstream]="upstreamList()"
        [flows]="flows()"
        [editable]="editable()"
        [totals]="{ apps: visibleApps().length, links: visibleLinks().length }"
        [mostConnected]="mostConnected()"
        (picked)="selectedId.set($event)"
        (edited)="edit.emit($event)"
        (closed)="clear()"
      />
    </div>
  `,
  styles: `
    :host {
      display: block;
      --arch-push: light-dark(#12865d, #34c08f);
      --arch-pull: light-dark(#6250d6, #9085e9);
    }
    .bar {
      display: flex;
      align-items: center;
      gap: var(--gi-space-2);
      /* Su schermi stretti scorre di lato, senza barra */
      overflow-x: auto;
      scrollbar-width: none;
      padding-block: var(--gi-space-2);
    }
    .bar > * {
      flex: 0 0 auto;
      white-space: nowrap;
    }
    .search {
      flex: 0 1 18rem;
      min-width: 8rem;
      height: var(--gi-control-h, 36px);
      padding-inline: 10px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--gi-radius-md);
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
      font: inherit;
    }
    .label {
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .body {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: var(--gi-space-3);
    }
    .stage {
      position: relative;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--gi-radius-lg);
      overflow: hidden;
      /* Sfondo a puntini */
      background-color: var(--mat-sys-surface-container-lowest);
      background-image: radial-gradient(var(--mat-sys-outline-variant) 1px, transparent 1.2px);
      background-size: 18px 18px;
    }
    .canvas {
      overflow: auto;
      height: calc(100vh - 250px);
      min-height: 420px;
      padding-left: 52px;
      outline: none;
    }
    .stage:fullscreen .canvas {
      height: 100vh;
    }
    .tools {
      position: absolute;
      top: 12px;
      left: 10px;
      z-index: 1;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--gi-radius-md);
      background: var(--mat-sys-surface);
      overflow: hidden;
    }
    .tools button {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border: 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      background: none;
      color: var(--mat-sys-on-surface-variant);
      cursor: pointer;
    }
    .tools button:last-child {
      border-bottom: 0;
    }
    .tools button:hover,
    .tools .on {
      color: var(--mat-sys-primary);
      background: var(--mat-sys-surface-container);
    }
    .tools mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    svg {
      display: block;
    }
    .lane rect {
      fill: color-mix(in srgb, var(--mat-sys-surface-container) 85%, transparent);
      stroke: var(--mat-sys-outline-variant);
    }
    .lane-title {
      font: var(--mat-sys-title-medium);
      fill: var(--mat-sys-on-surface);
    }
    .lane-count {
      font: var(--mat-sys-label-medium);
      fill: var(--mat-sys-on-surface-variant);
    }
    .link {
      fill: none;
      opacity: 0.85;
    }
    .link--PUSH {
      stroke: var(--arch-push);
    }
    .link--PULL {
      stroke: var(--arch-pull);
      stroke-dasharray: 7 5;
    }
    .link--SYNC {
      stroke: var(--mat-sys-outline);
      stroke-dasharray: 2 4;
      stroke-linecap: round;
    }
    .link--impact {
      stroke: var(--gi-critical);
      opacity: 1;
    }
    .link--upstream {
      stroke: var(--mat-sys-primary);
      opacity: 1;
    }
    .link--dim,
    .edge--dim {
      opacity: 0.12;
    }
    .edge {
      font:
        600 9px/1 Roboto,
        sans-serif;
      letter-spacing: 0.02em;
      text-anchor: middle;
      paint-order: stroke;
      stroke: var(--mat-sys-surface-container-lowest);
      stroke-width: 4px;
      stroke-linejoin: round;
      pointer-events: none;
    }
    .edge--PUSH {
      fill: var(--arch-push);
    }
    .edge--PULL {
      fill: var(--arch-pull);
    }
    .edge--SYNC {
      fill: var(--mat-sys-on-surface-variant);
    }
    .edge--impact {
      fill: var(--gi-critical);
    }
    .edge--upstream {
      fill: var(--mat-sys-primary);
    }
    .node {
      cursor: pointer;
      outline: none;
    }
    .box {
      fill: var(--mat-sys-surface);
      stroke: var(--mat-sys-outline-variant);
      filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.12));
    }
    .node:hover .box,
    .node:focus-visible .box {
      stroke: var(--mat-sys-primary);
      stroke-width: 2;
    }
    .node--selected .box {
      stroke: var(--mat-sys-primary);
      stroke-width: 3;
    }
    .node--impacted .box {
      stroke: var(--gi-critical);
      stroke-width: 2;
      fill: var(--mat-sys-error-container);
    }
    .node--upstream .box {
      stroke: var(--mat-sys-primary);
      stroke-width: 2;
      fill: var(--mat-sys-secondary-container);
    }
    .node--dim {
      opacity: 0.3;
    }
    .node--match .box {
      stroke: var(--gi-warning);
      stroke-width: 3;
    }
    .glyph {
      font-family: 'Material Symbols Outlined';
      font-size: 20px;
      text-anchor: middle;
      fill: #fff;
    }
    .glyph--dark {
      fill: #1a1a19;
    }
    .name {
      font: var(--mat-sys-label-large);
      font-weight: 600;
      fill: var(--mat-sys-on-surface);
    }
    .sub {
      font: var(--mat-sys-body-small);
      fill: var(--mat-sys-on-surface-variant);
    }
    .badge-text {
      font: var(--mat-sys-label-small);
      font-weight: 600;
      text-anchor: middle;
      fill: var(--mat-sys-on-surface);
    }
    .empty {
      padding: var(--gi-space-4);
      color: var(--mat-sys-on-surface-variant);
    }
    .panel {
      height: calc(100vh - 250px);
      min-height: 420px;
    }
    @media (max-width: 1023px) {
      .body {
        grid-template-columns: 1fr;
      }
      .panel {
        height: auto;
      }
    }
  `,
})
export class ArchitectureMap {
  readonly apps = input.required<readonly AppNode[]>();
  readonly connections = input.required<readonly AppLink[]>();
  readonly editable = input(false);
  /** Applicativo da aprire all'arrivo (es. da un task collegato). */
  readonly initialId = input<number | null>(null);
  readonly edit = output<number>();

  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly canvas = viewChild<ElementRef<HTMLElement>>('canvas');

  protected readonly depths = DEPTHS;
  protected readonly nodeW = NODE_W;
  protected readonly nodeH = NODE_H;
  protected readonly markers = [
    { id: 'arrow-PUSH', color: 'var(--arch-push)' },
    { id: 'arrow-PULL', color: 'var(--arch-pull)' },
    { id: 'arrow-SYNC', color: 'var(--mat-sys-outline)' },
    { id: 'arrow-impact', color: 'var(--gi-critical)' },
    { id: 'arrow-upstream', color: 'var(--mat-sys-primary)' },
  ];

  protected readonly selectedId = signal<number | null>(null);
  protected readonly depth = signal<number | null>(null);
  protected readonly onlyLinked = signal(false);
  protected readonly showRetired = signal(false);
  protected readonly query = signal('');
  protected readonly zoom = signal(1);
  /** Scritte sulle frecce: null = automatico (sì finché i flussi sono pochi). */
  protected readonly labels = signal<boolean | null>(null);
  protected readonly fullscreen = signal(false);

  constructor() {
    effect(() => {
      const id = this.initialId();
      if (id !== null) {
        this.selectedId.set(id);
      }
    });
    const onFullscreen = () =>
      this.fullscreen.set(document.fullscreenElement === this.stage()?.nativeElement);
    document.addEventListener('fullscreenchange', onFullscreen);
    inject(DestroyRef).onDestroy(() =>
      document.removeEventListener('fullscreenchange', onFullscreen),
    );
  }

  protected readonly visibleApps = computed(() =>
    this.apps().filter((app) => this.showRetired() || (app.active && app.lifecycle !== 'RETIRED')),
  );

  protected readonly visibleLinks = computed(() => {
    const ids = new Set(this.visibleApps().map((app) => app.id));
    return this.connections().filter(
      (link) =>
        (this.showRetired() || link.active) && ids.has(link.sourceId) && ids.has(link.targetId),
    );
  });

  protected readonly labelsOn = computed(
    () => this.labels() ?? this.visibleLinks().length <= LABELS_ALWAYS_UP_TO,
  );

  /** Connessioni di ogni applicativo (in entrata e in uscita), per il numero sulla scheda. */
  protected readonly degree = computed(() => {
    const counts = new Map<number, number>();
    for (const link of this.visibleLinks()) {
      counts.set(link.sourceId, (counts.get(link.sourceId) ?? 0) + 1);
      counts.set(link.targetId, (counts.get(link.targetId) ?? 0) + 1);
    }
    return counts;
  });

  private readonly graph = computed(() => dependencies(this.visibleLinks()));

  protected readonly selected = computed(
    () => this.visibleApps().find((app) => app.id === this.selectedId()) ?? null,
  );

  protected readonly impacted = computed(() => {
    const app = this.selected();
    return app ? reach(this.graph().dependents, app.id, this.depth()) : new Map<number, number>();
  });

  protected readonly upstream = computed(() => {
    const app = this.selected();
    return app ? reach(this.graph().dependsOn, app.id, this.depth()) : new Map<number, number>();
  });

  protected readonly map = computed(() => {
    const app = this.selected();
    if (!app || !this.onlyLinked()) {
      return layout(this.visibleApps());
    }
    const keep = new Set([app.id, ...this.impacted().keys(), ...this.upstream().keys()]);
    return layout(this.visibleApps().filter((other) => keep.has(other.id)));
  });

  protected readonly links = computed<DrawnLink[]>(() => {
    const placed = new Map(this.map().nodes.map((node) => [node.app.id, node]));
    const app = this.selected();
    const impact = new Set([...(app ? [app.id] : []), ...this.impacted().keys()]);
    const up = new Set([...(app ? [app.id] : []), ...this.upstream().keys()]);
    const drawn: DrawnLink[] = [];
    for (const link of this.visibleLinks()) {
      const from = placed.get(link.sourceId);
      const to = placed.get(link.targetId);
      if (!from || !to) {
        continue;
      }
      // Chi fornisce i dati e chi li usa, nei due sensi per "sincronizza con"
      const pairs: [number, number][] = [];
      if (link.direction !== 'PULL') pairs.push([link.sourceId, link.targetId]);
      if (link.direction !== 'PUSH') pairs.push([link.targetId, link.sourceId]);
      let state: LinkState = 'normal';
      if (app) {
        if (pairs.some(([provider, user]) => impact.has(provider) && this.impacted().has(user))) {
          state = 'impact';
        } else if (
          pairs.some(([provider, user]) => up.has(user) && this.upstream().has(provider))
        ) {
          state = 'upstream';
        } else {
          state = 'dim';
        }
      }
      const touchesSelected = !!app && (link.sourceId === app.id || link.targetId === app.id);
      const geometry = linkPath(from, to);
      drawn.push({
        link,
        ...geometry,
        state,
        width: linkWidth(link.businessCriticality),
        // La freccia segue i dati: "legge da" li porta dall'arrivo alla partenza
        end: link.direction !== 'PULL',
        start: link.direction !== 'PUSH',
        label: this.labelsOn() ? state !== 'dim' : touchesSelected,
        title: [
          `${link.sourceName} ${link.directionLabel} ${link.targetName}`,
          link.dataObjects,
          [link.frequencyLabel, link.protocolLabel].filter(Boolean).join(' · '),
        ]
          .filter(Boolean)
          .join('\n'),
      });
    }
    // Le evidenziate sopra le altre
    const order: Record<LinkState, number> = { dim: 0, normal: 1, upstream: 2, impact: 3 };
    return drawn.sort((a, b) => order[a.state] - order[b.state]);
  });

  protected readonly matches = computed(() => {
    const text = this.query().trim().toLowerCase();
    if (!text) {
      return new Set<number>();
    }
    return new Set(
      this.visibleApps()
        .filter((app) =>
          [app.name, app.typeLabel, app.vendorName, app.hosts, app.siteName]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(text)),
        )
        .map((app) => app.id),
    );
  });

  protected readonly impactedList = computed(() => this.listOf(this.impacted()));
  protected readonly upstreamList = computed(() => this.listOf(this.upstream()));

  protected readonly flows = computed(() => {
    const id = this.selectedId();
    return this.visibleLinks().filter((link) => link.sourceId === id || link.targetId === id);
  });

  protected readonly mostConnected = computed<ReachedApp[]>(() =>
    this.visibleApps()
      .map((app) => ({ app, steps: this.degree().get(app.id) ?? 0 }))
      .filter((item) => item.steps > 0)
      .sort((a, b) => b.steps - a.steps || a.app.name.localeCompare(b.app.name, 'it'))
      .slice(0, 5),
  );

  protected nodeState(id: number): NodeState {
    const app = this.selected();
    if (!app) {
      return 'normal';
    }
    if (id === app.id) return 'selected';
    if (this.impacted().has(id)) return 'impacted';
    if (this.upstream().has(id)) return 'upstream';
    return 'dim';
  }

  protected markerOf(drawn: DrawnLink): string {
    const key =
      drawn.state === 'impact' || drawn.state === 'upstream' ? drawn.state : drawn.link.direction;
    return `url(#arrow-${key})`;
  }

  protected select(id: number, event: Event): void {
    event.stopPropagation();
    this.selectedId.set(this.selectedId() === id ? null : id);
  }

  protected clear(): void {
    this.selectedId.set(null);
  }

  protected selectFirstMatch(): void {
    const first = this.visibleApps().find((app) => this.matches().has(app.id));
    if (first) {
      this.selectedId.set(first.id);
    }
  }

  protected zoomBy(delta: number): void {
    this.setZoom(this.zoom() + delta);
  }

  /** Tutta la mappa nello spazio visibile (senza ingrandire oltre il naturale). */
  protected fit(): void {
    const box = this.canvas()?.nativeElement;
    if (!box) {
      return;
    }
    const map = this.map();
    this.setZoom(
      Math.min((box.clientWidth - 64) / map.width, (box.clientHeight - 8) / map.height, 1),
    );
  }

  protected toggleFullscreen(): void {
    const stage = this.stage()?.nativeElement;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else if (stage) {
      void stage.requestFullscreen();
    }
  }

  protected critColor(code: string): string {
    return criticalityColor(code);
  }

  protected layerColor(layer: string): string {
    return LAYER_COLORS[layer] ?? 'var(--mat-sys-outline)';
  }

  protected badgeFill(layer: string): string {
    return `color-mix(in srgb, ${this.layerColor(layer)} 20%, var(--mat-sys-surface))`;
  }

  protected icon(type: string): string {
    return TYPE_ICONS[type] ?? 'apps';
  }

  protected short(text: string, max: number): string {
    return cut(text, max);
  }

  /** Sotto il nome: il server se c'è, altrimenti la tipologia. */
  protected subtitle(app: AppNode): string {
    return cut(app.hosts ?? app.typeLabel, 24);
  }

  protected tooltip(placed: PlacedNode): string {
    const app = placed.app;
    return [
      app.name,
      `${app.typeLabel} · ${app.lifecycleLabel} · criticità ${app.businessCriticalityLabel.toLowerCase()}`,
      app.hosts ? `Server: ${app.hosts}` : null,
      ...app.technologyWarnings,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private setZoom(value: number): void {
    this.zoom.set(Math.min(1.6, Math.max(0.35, Math.round(value * 100) / 100)));
  }

  private listOf(found: Map<number, number>): ReachedApp[] {
    const byId = new Map(this.apps().map((app) => [app.id, app]));
    return [...found.entries()]
      .map(([id, steps]) => ({ app: byId.get(id)!, steps }))
      .filter((item) => item.app)
      .sort((a, b) => a.steps - b.steps || a.app.name.localeCompare(b.app.name, 'it'));
  }
}
