import { Component, ElementRef, input, output, viewChild } from '@angular/core';

import {
  LAYER_COLORS,
  LinkBundle,
  MapLayout,
  NODE_W,
  PlacedNode,
  TYPE_ICONS,
  criticalityColor,
} from './architecture.model';

export type NodeState = 'selected' | 'impacted' | 'upstream' | 'dim' | 'normal';
export type LinkState = 'impact' | 'upstream' | 'dim' | 'normal';

/** Freccia da disegnare: uno o più flussi tra la stessa coppia di applicativi. */
export interface DrawnLink {
  readonly bundle: LinkBundle;
  readonly d: string;
  readonly mx: number;
  readonly my: number;
  readonly state: LinkState;
  readonly width: number;
  readonly label: boolean;
  /** Prima e seconda riga della scritta. */
  readonly lines: readonly string[];
  readonly title: string;
}

/** Proprietà copiate nell'immagine esportata, che non ha i fogli di stile della pagina. */
const EXPORTED_STYLE = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'letter-spacing',
  'text-anchor',
  'paint-order',
];

function cut(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

/**
 * Disegno della mappa degli applicativi (D-38): riquadri dei livelli, frecce con scritta e
 * schede degli applicativi. Lo spostamento e lo zoom arrivano da fuori in {@code transform}.
 */
@Component({
  selector: 'gov-architecture-map-canvas',
  template: `
    <svg #svg class="svg" role="img" aria-label="Mappa degli applicativi e dei flussi">
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
      <g #viewport [attr.transform]="transform()">
        @for (column of layout().columns; track column.layer) {
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
        @for (group of layout().groups; track group.x + ',' + group.y) {
          <text class="group" [attr.x]="group.x" [attr.y]="group.y">
            {{ group.label.toUpperCase() }}
          </text>
        }

        @for (drawn of links(); track drawn.bundle.key) {
          <path
            [class]="'link link--' + drawn.bundle.direction + ' link--' + drawn.state"
            [attr.d]="drawn.d"
            [attr.stroke-width]="drawn.width"
            [attr.marker-end]="drawn.bundle.forward ? markerOf(drawn) : null"
            [attr.marker-start]="drawn.bundle.backward ? markerOf(drawn) : null"
          >
            <title>{{ drawn.title }}</title>
          </path>
        }
        @for (drawn of links(); track drawn.bundle.key) {
          @if (drawn.label) {
            <text
              [class]="'edge edge--' + drawn.bundle.direction + ' edge--' + drawn.state"
              [attr.x]="drawn.mx"
              [attr.y]="drawn.my - 3"
            >
              @for (line of drawn.lines; track $index) {
                <tspan [attr.x]="drawn.mx" [attr.dy]="$index === 0 ? 0 : 11">{{ line }}</tspan>
              }
            </text>
          }
        }

        @for (placed of layout().nodes; track placed.app.id) {
          <g
            [class]="'node node--' + (states().get(placed.app.id) ?? 'normal')"
            [class.node--match]="matches().has(placed.app.id)"
            [attr.transform]="'translate(' + placed.x + ',' + placed.y + ')'"
            role="button"
            tabindex="0"
            [attr.aria-label]="placed.app.name + ', ' + placed.app.typeLabel"
            (click)="pick($event, placed.app.id)"
            (keydown.enter)="pick($event, placed.app.id)"
            (dblclick)="centered.emit(placed.app.id)"
          >
            <title>{{ tooltip(placed) }}</title>
            <rect
              class="box"
              [attr.width]="nodeW"
              [attr.height]="placed.h"
              rx="10"
              [attr.stroke-dasharray]="placed.app.lifecycle === 'ACTIVE' ? null : '5 3'"
            />
            <rect
              width="4"
              [attr.height]="placed.h - 16"
              x="0"
              y="8"
              rx="2"
              [attr.fill]="critColor(placed.app.businessCriticality)"
            />
            @if (compact()) {
              <rect
                x="12"
                y="6"
                width="22"
                height="22"
                rx="6"
                [style.fill]="layerColor(placed.app.layer)"
              />
              <text
                class="glyph glyph--small"
                [class.glyph--dark]="placed.app.layer === 'DATA'"
                x="23"
                y="23"
              >
                {{ icon(placed.app.type) }}
              </text>
              <text class="name" x="42" y="22">{{ short(placed.app.name, 21) }}</text>
            } @else {
              <rect
                x="12"
                y="9"
                width="32"
                height="32"
                rx="8"
                [style.fill]="layerColor(placed.app.layer)"
              />
              <text class="glyph" [class.glyph--dark]="placed.app.layer === 'DATA'" x="28" y="34">
                {{ icon(placed.app.type) }}
              </text>
              <text class="name" x="54" y="22">{{ short(placed.app.name, 19) }}</text>
              <text class="sub" x="54" y="38">
                {{ short(placed.app.hosts ?? placed.app.typeLabel, 24) }}
              </text>
            }
            @if (placed.app.technologyWarnings.length > 0) {
              <path
                [attr.transform]="'translate(' + (nodeW - 52) + ',' + (placed.h / 2 - 7) + ')'"
                d="M 7 0 L 14 13 L 0 13 z"
                [attr.fill]="placed.app.technologyPriorityColor ?? 'var(--gi-warning)'"
              />
            }
            <circle
              class="badge"
              [attr.cx]="nodeW - 20"
              [attr.cy]="placed.h / 2"
              r="11"
              [style.fill]="badgeFill(placed.app.layer)"
            />
            <text class="badge-text" [attr.x]="nodeW - 20" [attr.y]="placed.h / 2 + 4">
              {{ degree().get(placed.app.id) ?? 0 }}
            </text>
          </g>
        }
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: block;
    }
    .svg {
      display: block;
      width: 100%;
      height: 100%;
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
    .group {
      font:
        600 10px/1 Roboto,
        sans-serif;
      letter-spacing: 0.06em;
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
    .link--SYNC,
    .link--MIXED {
      stroke: var(--mat-sys-outline);
      stroke-dasharray: 2 4;
      stroke-linecap: round;
    }
    .link--MIXED {
      stroke-dasharray: none;
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
      fill: var(--mat-sys-on-surface-variant);
    }
    .edge--PUSH {
      fill: var(--arch-push);
    }
    .edge--PULL {
      fill: var(--arch-pull);
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
    .glyph--small {
      font-size: 16px;
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
  `,
})
export class ArchitectureMapCanvas {
  readonly layout = input.required<MapLayout>();
  readonly links = input.required<readonly DrawnLink[]>();
  readonly states = input.required<ReadonlyMap<number, NodeState>>();
  readonly matches = input.required<ReadonlySet<number>>();
  readonly degree = input.required<ReadonlyMap<number, number>>();
  readonly compact = input(false);
  readonly transform = input('');

  /** Clic su un applicativo. */
  readonly picked = output<number>();
  /** Doppio clic: centrare la vista sull'applicativo. */
  readonly centered = output<number>();

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly viewport = viewChild.required<ElementRef<SVGGElement>>('viewport');

  protected readonly nodeW = NODE_W;
  protected readonly markers = [
    { id: 'arrow-PUSH', color: 'var(--arch-push)' },
    { id: 'arrow-PULL', color: 'var(--arch-pull)' },
    { id: 'arrow-SYNC', color: 'var(--mat-sys-outline)' },
    { id: 'arrow-impact', color: 'var(--gi-critical)' },
    { id: 'arrow-upstream', color: 'var(--mat-sys-primary)' },
  ];

  /**
   * La mappa intera come immagine a sé (SVG): stili copiati sugli elementi, niente zoom, sfondo
   * pieno. Le icone delle tipologie restano fuori perché il loro font non va nel file.
   */
  snapshot(background: string): {
    readonly svg: string;
    readonly width: number;
    readonly height: number;
  } {
    const source = this.svg().nativeElement;
    const { width, height } = this.layout();
    const clone = source.cloneNode(true) as SVGSVGElement;
    const from = [source, ...Array.from(source.querySelectorAll('*'))];
    const to = [clone, ...Array.from(clone.querySelectorAll('*'))];
    const drop: Element[] = [];
    from.forEach((element, index) => {
      const copy = to[index];
      if (element.classList.contains('glyph')) {
        drop.push(copy);
        return;
      }
      const style = getComputedStyle(element);
      copy.setAttribute(
        'style',
        EXPORTED_STYLE.map((name) => `${name}:${style.getPropertyValue(name)}`).join(';'),
      );
      copy.removeAttribute('class');
      if (element === this.viewport().nativeElement) {
        copy.removeAttribute('transform');
      }
    });
    drop.forEach((element) => element.remove());
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const fill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    fill.setAttribute('width', '100%');
    fill.setAttribute('height', '100%');
    fill.setAttribute('fill', background);
    clone.insertBefore(fill, clone.firstChild);
    return { svg: new XMLSerializer().serializeToString(clone), width, height };
  }

  protected pick(event: Event, id: number): void {
    event.stopPropagation();
    this.picked.emit(id);
  }

  protected markerOf(drawn: DrawnLink): string {
    const state = drawn.state;
    const direction = drawn.bundle.direction === 'MIXED' ? 'SYNC' : drawn.bundle.direction;
    return `url(#arrow-${state === 'impact' || state === 'upstream' ? state : direction})`;
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

  protected icon(type: string | null): string {
    return TYPE_ICONS[type ?? ''] ?? 'apps';
  }

  protected short(text: string, max: number): string {
    return cut(text, max);
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
}
