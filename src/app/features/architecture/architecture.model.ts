import { LAYERS } from './architecture.configs';

/** Applicativo come arriva da /applications (solo i campi che servono alla mappa). */
export interface AppNode {
  readonly id: number;
  readonly name: string;
  readonly type: string;
  readonly typeLabel: string;
  readonly layer: string;
  readonly layerLabel: string;
  readonly lifecycle: string;
  readonly lifecycleLabel: string;
  readonly deploymentLabel: string;
  readonly systemName: string | null;
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
/** Margine interno del riquadro di un livello. */
const LANE_PAD = 18;
/** Spazio tra i livelli: ci stanno le scritte sulle frecce. */
const COL_GAP = 140;
const ROW_GAP = 14;
/** Titolo e conteggio in testa al riquadro del livello. */
const HEADER_H = 62;
const PAD = 24;

export interface PlacedNode {
  readonly app: AppNode;
  readonly x: number;
  readonly y: number;
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

export interface MapLayout {
  readonly nodes: readonly PlacedNode[];
  readonly columns: readonly MapColumn[];
  readonly width: number;
  readonly height: number;
}

/**
 * Un riquadro per livello (solo quelli con almeno un applicativo), tutti alti uguali; dentro,
 * gli applicativi per sistema e poi per nome, così quelli dello stesso sistema stanno vicini.
 */
export function layout(apps: readonly AppNode[]): MapLayout {
  const groups = LAYERS.map((layer) => ({
    layer,
    apps: apps
      .filter((app) => app.layer === layer.value)
      .sort(
        (a, b) =>
          (a.systemName ?? '~').localeCompare(b.systemName ?? '~', 'it') ||
          a.name.localeCompare(b.name, 'it'),
      ),
  })).filter((group) => group.apps.length > 0);
  const tallest = Math.max(1, ...groups.map((group) => group.apps.length));
  const laneW = NODE_W + LANE_PAD * 2;
  const laneH = HEADER_H + tallest * (NODE_H + ROW_GAP) - ROW_GAP + LANE_PAD;
  const columns: MapColumn[] = [];
  const nodes: PlacedNode[] = [];
  groups.forEach((group, index) => {
    const x = PAD + index * (laneW + COL_GAP);
    columns.push({
      layer: String(group.layer.value),
      label: group.layer.label,
      x,
      y: PAD,
      width: laneW,
      height: laneH,
      count: group.apps.length,
    });
    group.apps.forEach((app, row) => {
      nodes.push({ app, x: x + LANE_PAD, y: PAD + HEADER_H + row * (NODE_H + ROW_GAP) });
    });
  });
  return {
    nodes,
    columns,
    width: Math.max(PAD * 2 + groups.length * (laneW + COL_GAP) - COL_GAP, 320),
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
 * Dal lato destro del riquadro di sinistra al lato sinistro di quello di destra; nello stesso
 * livello esce a destra e rientra con un arco.
 */
export function linkPath(from: PlacedNode, to: PlacedNode): LinkGeometry {
  const fy = from.y + NODE_H / 2;
  const ty = to.y + NODE_H / 2;
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

/** Icona (Material Symbols) del tipo di applicativo. */
export const TYPE_ICONS: Readonly<Record<string, string>> = {
  STORE: 'storefront',
  ONLINE: 'shopping_cart',
  MOBILE: 'smartphone',
  COLLABORATION: 'groups',
  BUSINESS: 'business_center',
  INTEGRATION: 'sync_alt',
  BATCH: 'schedule',
  DATA: 'database',
  ANALYTICS: 'monitoring',
  EXTERNAL: 'handshake',
  INFRASTRUCTURE: 'dns',
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
