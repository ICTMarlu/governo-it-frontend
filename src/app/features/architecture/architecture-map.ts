import { Location } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute } from '@angular/router';

import { CRITICALITIES } from '../technologies/technologies.configs';
import { ArchitectureMapCanvas, DrawnLink, LinkState, NodeState } from './architecture-map-canvas';
import { ArchitectureMapPanel, ReachedApp } from './architecture-map-panel';
import { LAYERS } from './architecture.configs';
import {
  AppLink,
  AppNode,
  NODE_W,
  bundle,
  dependencies,
  layout,
  linkPath,
  linkWidth,
  reach,
} from './architecture.model';

interface Option {
  readonly value: string;
  readonly label: string;
}

type FilterKey = 'types' | 'layers' | 'crits' | 'areas';

/** Quanti passaggi seguire per impatto e dipendenze. */
const DEPTHS: readonly { readonly value: number | null; readonly label: string }[] = [
  { value: 1, label: 'Profondità 1: solo i diretti' },
  { value: 2, label: 'Profondità 2' },
  { value: null, label: 'Profondità: tutta la catena' },
];

/** Oltre questo numero di frecce le scritte si mostrano solo per l'applicativo scelto. */
const LABELS_ALWAYS_UP_TO = 30;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2.5;
/** Spazio a sinistra per i pulsanti di zoom e a destra per la scheda. */
const TOOLS_W = 56;
const PANEL_W = 360;

/** Parametri dell'indirizzo per filtri e vista (link da condividere). */
const PARAMS: Record<FilterKey, string> = {
  types: 'tipo',
  layers: 'livello',
  crits: 'crit',
  areas: 'area',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Mappa a livelli degli applicativi (D-38), pensata per occupare tutta la pagina: una barra
 * con ricerca, filtri e vista; il disegno con zoom (rotella) e spostamento (trascinamento);
 * la scheda dell'applicativo scelto sopra la mappa; in fondo comandi e conteggi. Filtri, vista
 * e applicativo scelto stanno nell'indirizzo: il link riapre la stessa mappa.
 */
@Component({
  selector: 'gov-architecture-map',
  imports: [
    ArchitectureMapCanvas,
    ArchitectureMapPanel,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
  ],
  templateUrl: './architecture-map.html',
  styleUrl: './architecture-map.scss',
})
export class ArchitectureMap {
  readonly apps = input.required<readonly AppNode[]>();
  readonly connections = input.required<readonly AppLink[]>();
  /** false finché i dati non sono arrivati: intanto niente "nessun applicativo". */
  readonly loaded = input(true);
  readonly editable = input(false);
  readonly edit = output<number>();
  readonly create = output<'app' | 'link'>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly location = inject(Location);
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly canvas = viewChild(ArchitectureMapCanvas);

  protected readonly depths = DEPTHS;
  protected readonly layerOptions: readonly Option[] = LAYERS.map((layer) => ({
    value: String(layer.value),
    label: layer.label,
  }));
  protected readonly critOptions: readonly Option[] = CRITICALITIES;

  // Stato iniziale dall'indirizzo (es. ?app=12 da un task collegato)
  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;
  private readonly initialApp = Number(this.params.get('app'));

  protected readonly selectedId = signal<number | null>(
    Number.isInteger(this.initialApp) && this.initialApp > 0 ? this.initialApp : null,
  );
  protected readonly depth = signal<number | null>(
    this.params.get('prof') ? Number(this.params.get('prof')) : null,
  );
  protected readonly onlyLinked = signal(this.params.get('solo') === '1');
  protected readonly showRetired = signal(this.params.get('dismessi') === '1');
  protected readonly compact = signal(this.params.get('compatta') === '1');
  /** Scritte sulle frecce: null = automatico (sì finché le frecce sono poche). */
  protected readonly labels = signal<boolean | null>(
    this.params.get('scritte') === 'si' ? true : this.params.get('scritte') === 'no' ? false : null,
  );
  protected readonly filters = signal<Record<FilterKey, ReadonlySet<string>>>({
    types: this.paramSet('types'),
    layers: this.paramSet('layers'),
    crits: this.paramSet('crits'),
    areas: this.paramSet('areas'),
  });
  protected readonly query = signal('');
  protected readonly legendOpen = signal(false);
  protected readonly fullscreen = signal(false);

  // Vista: spostamento e zoom
  protected readonly tx = signal(TOOLS_W);
  protected readonly ty = signal(16);
  protected readonly zoom = signal(1);
  protected readonly dragging = signal(false);
  protected readonly transform = computed(
    () => `translate(${this.tx()},${this.ty()}) scale(${this.zoom()})`,
  );
  private drag: {
    id: number;
    x: number;
    y: number;
    tx: number;
    ty: number;
    moved: boolean;
  } | null = null;
  private fittedSize = '';
  private centeredInitial = false;

  constructor() {
    const onFullscreen = () => {
      this.fullscreen.set(document.fullscreenElement === this.host.nativeElement);
      setTimeout(() => this.fit());
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    inject(DestroyRef).onDestroy(() =>
      document.removeEventListener('fullscreenchange', onFullscreen),
    );

    // Quando cambia la forma della mappa (dati, filtri, solo i collegati) la si rimette in vista
    effect(() => {
      const map = this.map();
      const size = `${map.width}x${map.height}`;
      if (map.nodes.length === 0 || size === this.fittedSize) {
        return;
      }
      this.fittedSize = size;
      setTimeout(() => {
        this.fit();
        const id = untracked(this.selectedId);
        if (!this.centeredInitial && id !== null) {
          this.centeredInitial = true;
          this.centerOn(id, false);
        }
      });
    });

    // Filtri, vista e applicativo scelto nell'indirizzo, senza ricaricare la pagina
    effect(() => {
      const values: [string, string | null][] = [
        ['app', this.selectedId()?.toString() ?? null],
        ['prof', this.depth()?.toString() ?? null],
        ['solo', this.onlyLinked() ? '1' : null],
        ['dismessi', this.showRetired() ? '1' : null],
        ['compatta', this.compact() ? '1' : null],
        ['scritte', this.labels() === null ? null : this.labels() ? 'si' : 'no'],
        ...(Object.keys(PARAMS) as FilterKey[]).map((key): [string, string | null] => [
          PARAMS[key],
          [...this.filters()[key]].join(',') || null,
        ]),
      ];
      const query = values
        .filter(([, value]) => value !== null)
        .map(([key, value]) => `${key}=${encodeURIComponent(value!).replace(/%2C/g, ',')}`)
        .join('&');
      this.location.replaceState(this.location.path().split('?')[0], query);
    });
  }

  // Opzioni dei filtri, da quello che c'è
  protected readonly typeOptions = computed<Option[]>(() =>
    this.distinct(this.apps().map((app) => ({ value: app.type ?? '', label: app.typeLabel }))),
  );
  protected readonly areaOptions = computed<Option[]>(() =>
    this.distinct(
      this.apps().flatMap((app) => app.userAreaNames.map((name) => ({ value: name, label: name }))),
    ),
  );
  protected readonly activeFilters = computed(() =>
    Object.values(this.filters()).reduce((sum, set) => sum + set.size, 0),
  );

  /** Applicativi mostrati: in uso (o anche dismessi) e che passano i filtri. */
  protected readonly visibleApps = computed(() => {
    const { types, layers, crits, areas } = this.filters();
    return this.apps().filter(
      (app) =>
        (this.showRetired() || (app.active && app.lifecycle !== 'RETIRED')) &&
        (types.size === 0 || types.has(app.type ?? '')) &&
        (layers.size === 0 || layers.has(app.layer)) &&
        (crits.size === 0 || crits.has(app.businessCriticality)) &&
        (areas.size === 0 || app.userAreaNames.some((name) => areas.has(name))),
    );
  });

  protected readonly visibleLinks = computed(() => {
    const ids = new Set(this.visibleApps().map((app) => app.id));
    return this.connections().filter(
      (link) =>
        (this.showRetired() || link.active) && ids.has(link.sourceId) && ids.has(link.targetId),
    );
  });

  private readonly bundles = computed(() => bundle(this.visibleLinks()));

  protected readonly labelsOn = computed(
    () => this.labels() ?? this.bundles().length <= LABELS_ALWAYS_UP_TO,
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
  protected readonly panelOpen = computed(() => this.selected() !== null || this.legendOpen());

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
      return layout(this.visibleApps(), this.compact());
    }
    const keep = new Set([app.id, ...this.impacted().keys(), ...this.upstream().keys()]);
    return layout(
      this.visibleApps().filter((other) => keep.has(other.id)),
      this.compact(),
    );
  });

  protected readonly states = computed(() => {
    const app = this.selected();
    const states = new Map<number, NodeState>();
    if (app) {
      for (const node of this.map().nodes) {
        const id = node.app.id;
        states.set(
          id,
          id === app.id
            ? 'selected'
            : this.impacted().has(id)
              ? 'impacted'
              : this.upstream().has(id)
                ? 'upstream'
                : 'dim',
        );
      }
    }
    return states;
  });

  protected readonly links = computed<DrawnLink[]>(() => {
    const placed = new Map(this.map().nodes.map((node) => [node.app.id, node]));
    const app = this.selected();
    const impact = new Set([...(app ? [app.id] : []), ...this.impacted().keys()]);
    const up = new Set([...(app ? [app.id] : []), ...this.upstream().keys()]);
    const order: Record<LinkState, number> = { dim: 0, normal: 1, upstream: 2, impact: 3 };
    const drawn: DrawnLink[] = [];
    for (const group of this.bundles()) {
      const from = placed.get(group.from);
      const to = placed.get(group.to);
      if (!from || !to) {
        continue;
      }
      let state: LinkState = app ? 'dim' : 'normal';
      if (app) {
        for (const link of group.links) {
          // Chi fornisce i dati e chi li usa, nei due sensi per "sincronizza con"
          const pairs: [number, number][] = [];
          if (link.direction !== 'PULL') pairs.push([link.sourceId, link.targetId]);
          if (link.direction !== 'PUSH') pairs.push([link.targetId, link.sourceId]);
          const linkState: LinkState = pairs.some(
            ([provider, user]) => impact.has(provider) && this.impacted().has(user),
          )
            ? 'impact'
            : pairs.some(([provider, user]) => up.has(user) && this.upstream().has(provider))
              ? 'upstream'
              : 'dim';
          if (order[linkState] > order[state]) state = linkState;
        }
      }
      const touchesSelected = !!app && (group.from === app.id || group.to === app.id);
      const single = group.links.length === 1 ? group.links[0] : null;
      drawn.push({
        bundle: group,
        ...linkPath(from, to),
        state,
        width: Math.max(...group.links.map((link) => linkWidth(link.businessCriticality))),
        label: this.labelsOn() ? state !== 'dim' : touchesSelected,
        lines: single
          ? [
              single.directionLabel.toUpperCase(),
              ...(single.protocolLabel ? [cutText(single.protocolLabel, 26)] : []),
            ]
          : [`${group.links.length} FLUSSI`],
        title: group.links
          .map((link) =>
            [
              `${link.sourceName} ${link.directionLabel} ${link.targetName}`,
              link.dataObjects,
              [link.frequencyLabel, link.protocolLabel].filter(Boolean).join(' · '),
            ]
              .filter(Boolean)
              .join(' — '),
          )
          .join('\n'),
      });
    }
    // Le evidenziate sopra le altre
    return drawn.sort((a, b) => order[a.state] - order[b.state]);
  });

  protected readonly shownLinks = computed(() =>
    this.links().reduce((sum, drawn) => sum + drawn.bundle.links.length, 0),
  );

  protected readonly matches = computed(() => {
    const text = this.query().trim().toLowerCase();
    if (!text) {
      return new Set<number>();
    }
    return new Set(
      this.map()
        .nodes.map((node) => node.app)
        .filter((app) =>
          [app.name, app.typeLabel, app.vendorName, app.hosts, app.siteName, ...app.userAreaNames]
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

  // ——— Filtri e vista ———

  protected has(key: FilterKey, value: string): boolean {
    return this.filters()[key].has(value);
  }

  protected toggle(event: Event, key: FilterKey, value: string): void {
    event.stopPropagation(); // il menu resta aperto
    this.filters.update((current) => {
      const next = new Set(current[key]);
      if (!next.delete(value)) next.add(value);
      return { ...current, [key]: next };
    });
  }

  protected clearFilters(event?: Event): void {
    event?.stopPropagation();
    this.filters.set({ types: new Set(), layers: new Set(), crits: new Set(), areas: new Set() });
  }

  protected keepOpen(event: Event, apply: () => void): void {
    event.stopPropagation();
    apply();
  }

  protected setDepth(event: Event, value: number | null): void {
    this.keepOpen(event, () => this.depth.set(value));
  }

  protected toggleOnlyLinked(event: Event): void {
    this.keepOpen(event, () => this.onlyLinked.update((value) => !value));
  }

  protected toggleRetired(event: Event): void {
    this.keepOpen(event, () => this.showRetired.update((value) => !value));
  }

  protected toggleCompact(event: Event): void {
    this.keepOpen(event, () => this.compact.update((value) => !value));
  }

  protected toggleLabels(event: Event): void {
    this.keepOpen(event, () => this.labels.set(!this.labelsOn()));
  }

  // ——— Scelta ———

  protected select(id: number): void {
    this.selectedId.set(id);
    this.legendOpen.set(false);
  }

  protected pickFromPanel(id: number): void {
    this.select(id);
    // Se il vicino non è nella mappa (es. "solo i collegati"), la mappa si ridisegna
    setTimeout(() => this.centerOn(id, false));
  }

  protected clear(): void {
    this.selectedId.set(null);
    this.legendOpen.set(false);
  }

  protected selectFirstMatch(): void {
    const first = this.map().nodes.find((node) => this.matches().has(node.app.id));
    if (first) {
      this.select(first.app.id);
      this.centerOn(first.app.id, true);
    }
  }

  // ——— Zoom e spostamento ———

  protected onWheel(event: WheelEvent): void {
    if ((event.target as Element).closest('.panel')) {
      return;
    }
    event.preventDefault();
    const box = this.stage()!.nativeElement.getBoundingClientRect();
    this.zoomAt(
      this.zoom() * Math.exp(-event.deltaY * 0.0015),
      event.clientX - box.left,
      event.clientY - box.top,
    );
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0 || (event.target as Element).closest('.panel, .tools')) {
      return;
    }
    this.drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      tx: this.tx(),
      ty: this.ty(),
      moved: false,
    };
  }

  protected onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || drag.id !== event.pointerId) {
      return;
    }
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 4) {
        return;
      }
      // Da qui è uno spostamento: il clic finale non sceglie l'applicativo sotto il mouse
      drag.moved = true;
      this.dragging.set(true);
      this.stage()!.nativeElement.setPointerCapture(event.pointerId);
    }
    this.tx.set(drag.tx + dx);
    this.ty.set(drag.ty + dy);
  }

  protected onPointerUp(event: PointerEvent): void {
    if (this.drag?.moved) {
      this.stage()!.nativeElement.releasePointerCapture(event.pointerId);
    }
    this.drag = null;
    this.dragging.set(false);
  }

  protected zoomBy(factor: number): void {
    const box = this.stage()!.nativeElement;
    this.zoomAt(this.zoom() * factor, box.clientWidth / 2, box.clientHeight / 2);
  }

  /** Tutta la mappa nello spazio visibile (con la scheda aperta, a sinistra della scheda). */
  protected fit(): void {
    const box = this.stage()?.nativeElement;
    const map = this.map();
    if (!box || box.clientWidth === 0) {
      return;
    }
    const pad = 16;
    const width = box.clientWidth - TOOLS_W - pad - this.panelRoom(box);
    const height = box.clientHeight - pad * 2;
    const zoom = clamp(Math.min(width / map.width, height / map.height, 1.1), MIN_ZOOM, MAX_ZOOM);
    this.zoom.set(zoom);
    this.tx.set(TOOLS_W + Math.max(0, (width - map.width * zoom) / 2));
    this.ty.set(pad + Math.max(0, (height - map.height * zoom) / 2));
  }

  /** Porta l'applicativo al centro dello spazio libero (a sinistra della scheda). */
  protected centerOn(id: number, zoomIn: boolean): void {
    const box = this.stage()?.nativeElement;
    const node = this.map().nodes.find((placed) => placed.app.id === id);
    if (!box || !node) {
      return;
    }
    const zoom = zoomIn ? Math.max(this.zoom(), 1) : this.zoom();
    const cx = TOOLS_W + (box.clientWidth - TOOLS_W - this.panelRoom(box)) / 2;
    this.zoom.set(zoom);
    this.tx.set(cx - (node.x + NODE_W / 2) * zoom);
    this.ty.set(box.clientHeight / 2 - (node.y + node.h / 2) * zoom);
  }

  protected onCentered(id: number): void {
    this.select(id);
    this.centerOn(id, true);
  }

  protected toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void this.host.nativeElement.requestFullscreen();
    }
  }

  // ——— Immagine ———

  protected exportImage(format: 'svg' | 'png'): void {
    const canvas = this.canvas();
    const stage = this.stage()?.nativeElement;
    if (!canvas || !stage) {
      return;
    }
    const image = canvas.snapshot(getComputedStyle(stage).backgroundColor);
    const name = `architettura-mappa-${new Date().toISOString().slice(0, 10)}`;
    if (format === 'svg') {
      save(new Blob([image.svg], { type: 'image/svg+xml' }), `${name}.svg`);
      return;
    }
    const picture = new Image();
    picture.onload = () => {
      const scale = 2;
      const paper = document.createElement('canvas');
      paper.width = image.width * scale;
      paper.height = image.height * scale;
      const context = paper.getContext('2d')!;
      context.scale(scale, scale);
      context.drawImage(picture, 0, 0);
      paper.toBlob((blob) => blob && save(blob, `${name}.png`), 'image/png');
    };
    picture.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(image.svg);
  }

  /** Spazio coperto dalla scheda a destra (sugli schermi stretti la scheda copre comunque). */
  private panelRoom(box: HTMLElement): number {
    return this.panelOpen() && box.clientWidth > 800 ? PANEL_W : 0;
  }

  private zoomAt(value: number, x: number, y: number): void {
    const zoom = clamp(value, MIN_ZOOM, MAX_ZOOM);
    const ratio = zoom / this.zoom();
    this.tx.set(x - (x - this.tx()) * ratio);
    this.ty.set(y - (y - this.ty()) * ratio);
    this.zoom.set(zoom);
  }

  private paramSet(key: FilterKey): ReadonlySet<string> {
    return new Set((this.params.get(PARAMS[key]) ?? '').split(',').filter(Boolean));
  }

  private distinct(options: readonly Option[]): Option[] {
    const byValue = new Map(options.map((option) => [option.value, option]));
    return [...byValue.values()].sort((a, b) => a.label.localeCompare(b.label, 'it'));
  }

  private listOf(found: Map<number, number>): ReachedApp[] {
    const byId = new Map(this.apps().map((app) => [app.id, app]));
    return [...found.entries()]
      .map(([id, steps]) => ({ app: byId.get(id)!, steps }))
      .filter((item) => item.app)
      .sort((a, b) => a.steps - b.steps || a.app.name.localeCompare(b.app.name, 'it'));
  }
}

function cutText(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function save(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
