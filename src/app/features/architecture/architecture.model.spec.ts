import {
  AppLink,
  AppNode,
  NODE_H,
  NODE_W,
  bundle,
  dependencies,
  layout,
  linkPath,
  reach,
} from './architecture.model';

function link(
  id: number,
  sourceId: number,
  targetId: number,
  direction: AppLink['direction'],
): AppLink {
  return {
    id,
    sourceId,
    sourceName: `A${sourceId}`,
    targetId,
    targetName: `A${targetId}`,
    direction,
    directionLabel: direction,
    protocolLabel: null,
    dataObjects: null,
    frequency: 'DAILY',
    frequencyLabel: 'Una volta al giorno',
    details: null,
    businessCriticality: 'MEDIUM',
    businessCriticalityLabel: 'Media',
    active: true,
  };
}

function app(id: number, layer: string, name: string, typeLabel = 'ERP e gestionali'): AppNode {
  return {
    id,
    systemId: id,
    name,
    type: 'ERP',
    typeLabel,
    layer,
    layerLabel: layer,
    lifecycle: 'ACTIVE',
    lifecycleLabel: 'In uso',
    deploymentLabel: 'In sede',
    vendorName: null,
    siteName: null,
    hosts: null,
    ownerName: null,
    businessOwner: null,
    businessCriticality: 'MEDIUM',
    businessCriticalityLabel: 'Media',
    exposure: 'INTERNAL',
    exposureLabel: 'Interna',
    notes: null,
    active: true,
    userAreaNames: [],
    technologyNames: [],
    technologyPriority: null,
    technologyPriorityLabel: null,
    technologyPriorityColor: null,
    technologyWarnings: [],
  };
}

describe('architettura IT: chi dipende da chi (D-38)', () => {
  // ERP (1) invia a WMS (2); BI (3) legge da ERP; E-commerce (4) sincronizza con ERP;
  // WMS invia al corriere (5)
  const links = [
    link(1, 1, 2, 'PUSH'),
    link(2, 3, 1, 'PULL'),
    link(3, 4, 1, 'SYNC'),
    link(4, 2, 5, 'PUSH'),
  ];
  const graph = dependencies(links);

  it('se si ferma l’ERP si fermano WMS, BI, e-commerce e, indirettamente, il corriere', () => {
    const impacted = reach(graph.dependents, 1, null);
    expect([...impacted.entries()].sort()).toEqual([
      [2, 1],
      [3, 1],
      [4, 1],
      [5, 2],
    ]);
  });

  it('con profondità 1 si vedono solo i diretti', () => {
    expect([...reach(graph.dependents, 1, 1).keys()].sort()).toEqual([2, 3, 4]);
  });

  it('chi legge dipende da chi è letto, non il contrario', () => {
    expect(reach(graph.dependents, 3, null).size).toBe(0);
    expect([...reach(graph.dependsOn, 3, null).keys()].sort()).toEqual([1, 4]);
  });

  it('sincronizza con vale nei due sensi e il giro non si ripete', () => {
    expect(reach(graph.dependents, 4, null).has(1)).toBe(true);
    expect(reach(graph.dependents, 1, null).has(1)).toBe(false);
  });
});

describe('architettura IT: disposizione della mappa', () => {
  it('una colonna per livello presente, nell’ordine dei livelli, applicativi per tipologia e nome', () => {
    const map = layout([
      app(1, 'DATA', 'BI'),
      app(2, 'CORE', 'WMS'),
      app(3, 'CORE', 'FM3'),
      app(4, 'CHANNELS', 'Casse'),
    ]);
    expect(map.columns.map((column) => column.layer)).toEqual(['CHANNELS', 'CORE', 'DATA']);
    const core = map.nodes.filter((node) => node.app.layer === 'CORE').map((node) => node.app.name);
    expect(core).toEqual(['FM3', 'WMS']);
  });

  it('nello stesso livello la freccia esce e rientra a destra, la scritta sta sull’arco', () => {
    const map = layout([app(1, 'CORE', 'ERP'), app(2, 'CORE', 'WMS')]);
    const [erp, wms] = map.nodes;
    const geometry = linkPath(erp, wms);
    const right = erp.x + NODE_W;
    expect(geometry.d.startsWith(`M ${right} `)).toBe(true);
    expect(geometry.d.endsWith(`${right} ${wms.y + NODE_H / 2}`)).toBe(true);
    expect(geometry.mx).toBeGreaterThan(right);
    expect(geometry.my).toBe((erp.y + wms.y) / 2 + NODE_H / 2);
  });

  it('i riquadri dei livelli sono alti uguali e contengono i loro applicativi', () => {
    const map = layout([app(1, 'CHANNELS', 'Casse'), app(2, 'CORE', 'ERP'), app(3, 'CORE', 'WMS')]);
    expect(new Set(map.columns.map((column) => column.height)).size).toBe(1);
    for (const node of map.nodes) {
      const lane = map.columns.find((column) => column.layer === node.app.layer)!;
      expect(node.x).toBeGreaterThan(lane.x);
      expect(node.x + NODE_W).toBeLessThan(lane.x + lane.width);
      expect(node.y + NODE_H).toBeLessThanOrEqual(lane.y + lane.height);
    }
  });

  it('un livello con molti applicativi si divide in più colonne, senza sovrapposizioni', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      app(i + 1, 'CORE', `App ${String(i).padStart(2, '0')}`, i < 12 ? 'ERP' : 'HR'),
    );
    const map = layout(many);
    const xs = new Set(map.nodes.map((node) => node.x));
    expect(xs.size).toBe(3);
    const lane = map.columns[0];
    for (const node of map.nodes) {
      expect(node.x + NODE_W).toBeLessThan(lane.x + lane.width);
      expect(node.y + node.h).toBeLessThanOrEqual(lane.y + lane.height);
    }
    const spots = new Set(map.nodes.map((node) => `${node.x},${node.y}`));
    expect(spots.size).toBe(25);
    // Due tipologie nello stesso livello: un sottotitolo per ognuna
    expect(map.groups.map((group) => group.label)).toEqual(['ERP', 'HR']);
  });

  it('con una sola tipologia nel livello non ci sono sottotitoli; i riquadri compatti sono più bassi', () => {
    const map = layout([app(1, 'CORE', 'ERP'), app(2, 'CORE', 'WMS')], true);
    expect(map.groups).toEqual([]);
    expect(map.nodes[0].h).toBeLessThan(NODE_H);
  });
});

describe('architettura IT: frecce raggruppate', () => {
  it('più flussi tra gli stessi due applicativi diventano una freccia sola', () => {
    const bundles = bundle([
      link(1, 1, 2, 'PUSH'),
      link(2, 2, 1, 'PUSH'),
      link(3, 1, 3, 'PULL'),
      link(4, 1, 3, 'PULL'),
    ]);
    expect(bundles.length).toBe(2);
    const erpWms = bundles.find((item) => item.key === '1-2')!;
    expect(erpWms.links.length).toBe(2);
    expect(erpWms.forward && erpWms.backward).toBe(true);
    expect(erpWms.direction).toBe('PUSH');
    const read = bundles.find((item) => item.key === '1-3')!;
    // "1 legge da 3": i dati vanno da 3 a 1
    expect(read.forward).toBe(false);
    expect(read.backward).toBe(true);
  });

  it('direzioni diverse sulla stessa coppia: freccia mista nei due sensi', () => {
    const [only] = bundle([link(1, 1, 2, 'PUSH'), link(2, 1, 2, 'SYNC')]);
    expect(only.direction).toBe('MIXED');
    expect(only.forward && only.backward).toBe(true);
  });
});
