import { LAYERS } from './architecture.configs';

/** Applicativo come arriva da /applications (solo i campi che servono alla mappa). */
export interface AppNode {
  readonly id: number;
  readonly systemId: number;
  readonly name: string;
  /** Codice della tipologia (ERP, WEB, DATA…), null se manca. */
  readonly type: string | null;
  readonly typeLabel: string;
  readonly layer: string;
  readonly layerLabel: string;
  readonly lifecycle: string;
  readonly lifecycleLabel: string;
  readonly deploymentLabel: string;
  readonly vendorName: string | null;
  readonly siteName: string | null;
  readonly hosts: string | null;
  readonly ownerName: string | null;
  readonly businessOwner: string | null;
  readonly businessCriticality: string;
  readonly businessCriticalityLabel: string;
  readonly exposure: string;
  readonly exposureLabel: string;
  readonly notes: string | null;
  readonly active: boolean;
  readonly userAreaNames: readonly string[];
  readonly technologyNames: readonly string[];
  readonly technologyPriority: string | null;
  readonly technologyPriorityLabel: string | null;
  readonly technologyPriorityColor: string | null;
  readonly technologyWarnings: readonly string[];
}

/** Connessione come arriva da /app-connections. */
export interface AppLink {
  readonly id: number;
  readonly sourceId: number;
  readonly sourceName: string;
  readonly targetId: number;
  readonly targetName: string;
  readonly direction: 'PUSH' | 'PULL' | 'SYNC';
  readonly directionLabel: string;
  readonly protocolLabel: string | null;
  readonly dataObjects: string | null;
  readonly frequency: string;
  readonly frequencyLabel: string;
  readonly details: string | null;
  readonly businessCriticality: string;
  readonly businessCriticalityLabel: string;
  readonly active: boolean;
}

/**
 * Chi dipende da chi. "A dipende da B" se A ha bisogno dei dati di B: con "invia a" l'arrivo
 * dipende dalla partenza, con "legge da" è la partenza a dipendere dall'arrivo, con
 * "sincronizza con" valgono entrambe.
 */
export interface Dependencies {
  /** id -> applicativi che dipendono da lui (si fermano se lui si ferma). */
  readonly dependents: ReadonlyMap<number, ReadonlySet<number>>;
  /** id -> applicativi da cui dipende. */
  readonly dependsOn: ReadonlyMap<number, ReadonlySet<number>>;
}

export function dependencies(links: readonly AppLink[]): Dependencies {
  const dependents = new Map<number, Set<number>>();
  const dependsOn = new Map<number, Set<number>>();
  const add = (provider: number, consumer: number) => {
    if (!dependents.has(provider)) dependents.set(provider, new Set());
    if (!dependsOn.has(consumer)) dependsOn.set(consumer, new Set());
    dependents.get(provider)!.add(consumer);
    dependsOn.get(consumer)!.add(provider);
  };
  for (const link of links) {
    if (link.direction === 'PUSH' || link.direction === 'SYNC') {
      add(link.sourceId, link.targetId);
    }
    if (link.direction === 'PULL' || link.direction === 'SYNC') {
      add(link.targetId, link.sourceId);
    }
  }
  return { dependents, dependsOn };
}

/**
 * Applicativi raggiunti seguendo il grafo da {@code start}, con il numero di passaggi.
 * {@code depth} = null: senza limite. L'applicativo di partenza non è nel risultato.
 */
export function reach(
  graph: ReadonlyMap<number, ReadonlySet<number>>,
  start: number,
  depth: number | null,
): Map<number, number> {
  const found = new Map<number, number>();
  let frontier = [start];
  let step = 0;
  while (frontier.length > 0 && (depth === null || step < depth)) {
    step++;
    const next: number[] = [];
    for (const id of frontier) {
      for (const other of graph.get(id) ?? []) {
        if (other !== start && !found.has(other)) {
          found.set(other, step);
          next.push(other);
        }
      }
    }
    frontier = next;
  }
  return found;
}

/** Dimensioni della mappa (in unità SVG). */
export const NODE_W = 216;
export const NODE_H = 50;
/** Altezza dei riquadri compatti (solo icona e nome). */
export const NODE_H_COMPACT = 34;
/** Margine interno del riquadro di un livello. */
const LANE_PAD = 18;
/** Spazio tra i livelli: ci stanno le scritte sulle frecce. */
const COL_GAP = 140;
/** Spazio tra le colonne dentro lo stesso livello. */
const INNER_GAP = 28;
const ROW_GAP = 14;
/** Titolo e conteggio in testa al riquadro del livello. */
const HEADER_H = 62;
/** Sottotitolo della tipologia dentro il livello. */
const GROUP_H = 22;
const PAD = 24;
/** Oltre questi applicativi un livello si allarga di una colonna (fino a {@link MAX_COLS}). */
export const MAX_ROWS = 10;
const MAX_COLS = 3;

export interface PlacedNode {
  readonly app: AppNode;
  readonly x: number;
  readonly y: number;
  /** Altezza del riquadro (normale o compatto). */
  readonly h: number;
}

/** Riquadro di un livello: posizione, misure, titolo e quanti applicativi contiene. */
export interface MapColumn {
  readonly layer: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly count: number;
}

/** Sottotitolo di una tipologia dentro un livello. */
export interface MapGroupLabel {
  readonly label: string;
  readonly x: number;
  readonly y: number;
}

export interface MapLayout {
  readonly nodes: readonly PlacedNode[];
  readonly columns: readonly MapColumn[];
  readonly groups: readonly MapGroupLabel[];
  readonly width: number;
  readonly height: number;
}

type LaneItem = { readonly head: string } | { readonly app: AppNode };

/**
 * Un riquadro per livello (solo quelli con almeno un applicativo), tutti alti uguali; dentro,
 * gli applicativi per tipologia e poi per nome, con il nome della tipologia sopra ogni gruppo
 * quando nel livello ce n'è più d'una. Oltre {@link MAX_ROWS} applicativi il livello si divide
 * in più colonne invece di diventare altissimo.
 */
export function layout(apps: readonly AppNode[], compact = false): MapLayout {
  const nodeH = compact ? NODE_H_COMPACT : NODE_H;
  const step = nodeH + ROW_GAP;
  const size = (item: LaneItem) => ('head' in item ? GROUP_H : step);
  const lanes = LAYERS.map((layer) => {
    const sorted = apps
      .filter((app) => app.layer === layer.value)
      .sort(
        (a, b) =>
          a.typeLabel.localeCompare(b.typeLabel, 'it') || a.name.localeCompare(b.name, 'it'),
      );
    const types = new Set(sorted.map((app) => app.typeLabel));
    const items: LaneItem[] = [];
    sorted.forEach((app, index) => {
      if (types.size > 1 && (index === 0 || sorted[index - 1].typeLabel !== app.typeLabel)) {
        items.push({ head: app.typeLabel });
      }
      items.push({ app });
    });
    const cols = Math.min(MAX_COLS, Math.max(1, Math.ceil(sorted.length / MAX_ROWS)));
    const target = items.reduce((sum, item) => sum + size(item), 0) / cols;
    // Riempie le colonne una dopo l'altra; un titolo non resta mai da solo in fondo
    const placed: { item: LaneItem; col: number; y: number }[] = [];
    let col = 0;
    let y = 0;
    for (const item of items) {
      const needed = 'head' in item ? GROUP_H + step : step;
      if (col < cols - 1 && y > 0 && y + needed > target + step / 2) {
        col++;
        y = 0;
      }
      placed.push({ item, col, y });
      y += size(item);
    }
    const height = Math.max(0, ...placed.map((p) => p.y + size(p.item)));
    return { layer, count: sorted.length, cols, placed, height };
  }).filter((lane) => lane.count > 0);

  const innerH = Math.max(step, ...lanes.map((lane) => lane.height)) - ROW_GAP;
  const laneH = HEADER_H + innerH + LANE_PAD;
  const columns: MapColumn[] = [];
  const nodes: PlacedNode[] = [];
  const groups: MapGroupLabel[] = [];
  let x = PAD;
  for (const lane of lanes) {
    const width = LANE_PAD * 2 + lane.cols * NODE_W + (lane.cols - 1) * INNER_GAP;
    columns.push({
      layer: String(lane.layer.value),
      label: lane.layer.label,
      x,
      y: PAD,
      width,
      height: laneH,
      count: lane.count,
    });
    for (const { item, col, y } of lane.placed) {
      const nx = x + LANE_PAD + col * (NODE_W + INNER_GAP);
      const ny = PAD + HEADER_H + y;
      if ('head' in item) {
        groups.push({ label: item.head, x: nx + 2, y: ny + 14 });
      } else {
        nodes.push({ app: item.app, x: nx, y: ny, h: nodeH });
      }
    }
    x += width + COL_GAP;
  }
  return {
    nodes,
    columns,
    groups,
    width: Math.max(x - COL_GAP + PAD, 320),
    height: PAD * 2 + laneH,
  };
}

/** Tracciato di una connessione e il suo punto di mezzo, dove va la scritta. */
export interface LinkGeometry {
  readonly d: string;
  readonly mx: number;
  readonly my: number;
}

/** Punto a metà di una curva di Bézier cubica. */
function middle(p0: number, p1: number, p2: number, p3: number): number {
  return (p0 + 3 * p1 + 3 * p2 + p3) / 8;
}

/**
 * Dal lato destro del riquadro di sinistra al lato sinistro di quello di destra; nella stessa
 * colonna esce a destra e rientra con un arco.
 */
export function linkPath(from: PlacedNode, to: PlacedNode): LinkGeometry {
  const fy = from.y + from.h / 2;
  const ty = to.y + to.h / 2;
  if (from.x === to.x) {
    const x = from.x + NODE_W;
    const bulge = 40 + Math.min(Math.abs(ty - fy) / 4, 60);
    return {
      d: `M ${x} ${fy} C ${x + bulge} ${fy}, ${x + bulge} ${ty}, ${x} ${ty}`,
      mx: middle(x, x + bulge, x + bulge, x),
      my: (fy + ty) / 2,
    };
  }
  const leftToRight = from.x < to.x;
  const fx = leftToRight ? from.x + NODE_W : from.x;
  const tx = leftToRight ? to.x : to.x + NODE_W;
  const mid = (fx + tx) / 2;
  return {
    d: `M ${fx} ${fy} C ${mid} ${fy}, ${mid} ${ty}, ${tx} ${ty}`,
    mx: middle(fx, mid, mid, tx),
    my: middle(fy, fy, ty, ty),
  };
}

/**
 * Flussi tra la stessa coppia di applicativi, disegnati come una sola freccia. {@code from} e
 * {@code to} seguono il primo flusso; {@code forward} e {@code backward} dicono se i dati vanno
 * da {@code from} a {@code to}, al contrario o in entrambi i sensi.
 */
export interface LinkBundle {
  readonly key: string;
  readonly from: number;
  readonly to: number;
  readonly links: readonly AppLink[];
  readonly forward: boolean;
  readonly backward: boolean;
  /** Direzione comune a tutti i flussi, o MIXED se sono diverse. */
  readonly direction: AppLink['direction'] | 'MIXED';
}

export function bundle(links: readonly AppLink[]): LinkBundle[] {
  const byPair = new Map<string, AppLink[]>();
  for (const link of links) {
    const key = [link.sourceId, link.targetId].sort((a, b) => a - b).join('-');
    byPair.set(key, [...(byPair.get(key) ?? []), link]);
  }
  return [...byPair.entries()].map(([key, group]) => {
    const from = group[0].sourceId;
    const to = group[0].targetId;
    let forward = false;
    let backward = false;
    for (const link of group) {
      // I dati vanno dalla partenza all'arrivo con "invia a", al contrario con "legge da"
      const same = link.sourceId === from;
      if (link.direction !== 'PULL') {
        forward ||= same;
        backward ||= !same;
      }
      if (link.direction !== 'PUSH') {
        backward ||= same;
        forward ||= !same;
      }
    }
    const directions = new Set(group.map((link) => link.direction));
    const direction = directions.size === 1 ? group[0].direction : 'MIXED';
    return { key, from, to, links: group, forward, backward, direction };
  });
}

/**
 * Colore di ogni livello, nell'ordine fisso della palette categoriale (validata anche per i
 * daltonici); il livello si riconosce anche dal titolo del riquadro e dall'icona.
 */
export const LAYER_COLORS: Readonly<Record<string, string>> = {
  CHANNELS: 'light-dark(#2a78d6, #3987e5)',
  CORE: 'light-dark(#eb6834, #d95926)',
  INTEGRATION: 'light-dark(#1baf7a, #199e70)',
  DATA: 'light-dark(#eda100, #c98500)',
  EXTERNAL: 'light-dark(#e87ba4, #d55181)',
  INFRASTRUCTURE: 'light-dark(#008300, #008300)',
};

/** Icona (Material Symbols) della tipologia (codici della lista Tipologie di sistema). */
export const TYPE_ICONS: Readonly<Record<string, string>> = {
  ERP: 'business_center',
  HR: 'badge',
  STORE: 'storefront',
  WEB: 'language',
  MOBILE: 'smartphone',
  OFFICE: 'groups',
  INTEGRATION: 'sync_alt',
  DATA: 'monitoring',
  EXTERNAL: 'handshake',
  INFRA: 'dns',
  OTHER: 'apps',
};

/** Colore della criticità per il business (bordo dei riquadri, spessore delle frecce). */
export function criticalityColor(code: string): string {
  switch (code) {
    case 'CRITICAL':
      return 'var(--gi-critical)';
    case 'HIGH':
      return 'var(--gi-warning)';
    case 'MEDIUM':
      return 'var(--gi-info)';
    default:
      return 'var(--mat-sys-outline)';
  }
}

export function linkWidth(code: string): number {
  return code === 'CRITICAL' ? 3 : code === 'HIGH' ? 2.25 : 1.5;
}
