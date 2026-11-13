/**
 * Projekt-Standards, Modul-Fabriken, Dateinamen und JSON-(De)Serialisierung.
 */
import { CARD_PRESETS, cardPresetShortName } from './cards';
import {
  PROJECT_FORMAT_VERSION,
  type BoxSettings,
  type CardTrayModule,
  type GridBoxModule,
  type GridRow,
  type GridSettings,
  type InsertModule,
  type Layer,
  type Placement,
  type PrintSettings,
  type Project,
} from './types';

export const DEFAULT_BOX: BoxSettings = {
  innerWidth: 290,
  innerDepth: 290,
  innerHeight: 100,
  wallThickness: 2,
  floorThickness: 2,
  headroom: 5,
};

export const DEFAULT_PRINT: PrintSettings = {
  clearance: 0.2,
  wallThickness: 1.6,
  floorThickness: 1.2,
  dividerThickness: 1.2,
};

export const DEFAULT_GRID: GridSettings = {
  enabled: true,
  targetCell: 21,
  baseplate: true,
  maxTileSize: 220,
};

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createLayer(index: number, overrides: Partial<Layer> = {}): Layer {
  return { id: newId(), name: `Ebene ${index + 1}`, heightMode: 'auto', height: 40, visible: true, ...overrides };
}

const defaultPlacement = (): Placement => ({ mode: 'auto', x: 0, y: 0, gx: 0, gy: 0, rotated: false });

export function createCardTray(overrides: Partial<CardTrayModule> = {}): CardTrayModule {
  return {
    id: newId(),
    type: 'cardTray',
    name: 'Kartenfach Poker',
    quantity: 1,
    layerId: '',
    placement: defaultPlacement(),
    heightMode: 'auto',
    customHeight: 40,
    fingerCutout: 'notch',
    floorHole: false,
    cardPreset: 'poker',
    customCardWidth: 60,
    customCardHeight: 90,
    sleeve: 'standard',
    cardThickness: 0.32,
    orientation: 'standing',
    format: 'landscape',
    tilt: 0,
    rows: 1,
    dividerMode: 'toothed',
    slots: 2,
    cardsPerSlot: 60,
    totalCards: 120,
    dividerCount: 4,
    dividerPlateThickness: 1.2,
    tab: true,
    tabHeight: 8,
    tabWidthPercent: 35,
    tabStaggered: true,
    play: 1,
    ...overrides,
  };
}

export function gridRows(columns: number, rows: number): GridRow[] {
  return Array.from({ length: Math.max(1, rows) }, () => ({ size: 1, columns: Array<number>(Math.max(1, columns)).fill(1) }));
}

export function createGridBox(overrides: Partial<GridBoxModule> = {}): GridBoxModule {
  return {
    id: newId(),
    type: 'gridBox',
    name: 'Box 3x2',
    quantity: 1,
    layerId: '',
    placement: defaultPlacement(),
    heightMode: 'layer',
    customHeight: 30,
    fingerCutout: 'none',
    floorHole: false,
    width: 100,
    depth: 70,
    widthCells: 5,
    depthCells: 4,
    layout: gridRows(3, 2),
    dividerLowering: 0,
    fingerSides: 'front',
    lid: 'none',
    ...overrides,
  };
}

export function duplicateModule(m: InsertModule): InsertModule {
  return { ...structuredClone(m), id: newId(), name: `${m.name} Kopie` };
}

export function createDefaultProject(): Project {
  const layer = createLayer(0);
  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    name: 'Mein Insert',
    box: { ...DEFAULT_BOX },
    print: { ...DEFAULT_PRINT },
    grid: { ...DEFAULT_GRID },
    layers: [layer],
    modules: [
      createCardTray({ layerId: layer.id }),
      createGridBox({ name: 'Token-Box', layerId: layer.id, widthCells: 6, depthCells: 4, lid: 'snap' }),
      createGridBox({
        name: 'Ressourcen',
        layerId: layer.id,
        widthCells: 6,
        depthCells: 4,
        layout: [
          { size: 1, columns: [1, 1, 1] },
          { size: 2, columns: [2, 1] },
        ],
        fingerCutout: 'toFloor',
        floorHole: true,
      }),
    ],
  };
}

/** Vorschlag für einen Modulnamen anhand der Parameter. */
export function suggestName(m: InsertModule): string {
  if (m.type === 'cardTray') return `Kartenfach ${cardPresetShortName(m)}`;
  const rows = m.layout.length;
  const cols = Math.max(...m.layout.map((r) => r.columns.length), 1);
  const uniform = m.layout.every((r) => r.columns.length === cols && r.columns.every((c) => c === r.columns[0]));
  return uniform ? `Box ${cols}x${rows}` : `Box ${m.layout.reduce((s, r) => s + r.columns.length, 0)} Faecher`;
}

/** Wandelt einen Teilnamen in einen Dateinamen mit Stückzahl, z. B. `2x_Kartenfach_Poker.stl`. */
export function fileNameFor(name: string, quantity: number): string {
  const base =
    name
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
      .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'Teil';
  return `${Math.max(1, Math.round(quantity))}x_${base}.stl`;
}

export function partFileName(m: InsertModule): string {
  return fileNameFor(m.name || suggestName(m), m.quantity);
}

/** Macht Dateinamen innerhalb eines Exports eindeutig. */
export function uniqueFileNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const count = seen.get(n) ?? 0;
    seen.set(n, count + 1);
    return count === 0 ? n : n.replace(/\.stl$/, `_${count + 1}.stl`);
  });
}

export function serializeProject(p: Project): string {
  return JSON.stringify({ ...p, formatVersion: PROJECT_FORMAT_VERSION }, null, 2);
}

// ---------------------------------------------------------------------------
// Einlesen mit Validierung: fehlende Felder werden mit Standardwerten ergänzt,
// Dateien aus Version 1 werden übernommen (ohne Raster, wie damals).

function num(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function parseRows(v: unknown, fallback: GridRow[]): GridRow[] {
  if (!Array.isArray(v)) return fallback;
  const rows = v
    .map((r) => {
      const o = obj(r);
      const cols = Array.isArray(o.columns) ? o.columns.map((c) => num(c, 1, 0.01, 1000)) : [1];
      return { size: num(o.size, 1, 0.01, 1000), columns: cols.length ? cols.slice(0, 50) : [1] };
    })
    .slice(0, 50);
  return rows.length ? rows : fallback;
}

function parseModule(raw: unknown, v1: boolean, layerIds: string[]): InsertModule | null {
  const r = obj(raw);
  const pl = obj(r.placement);
  const layerId = typeof r.layerId === 'string' && layerIds.includes(r.layerId) ? r.layerId : layerIds[0];
  const legacyFinger = r.fingerCutout === true ? 'notch' : r.fingerCutout === false ? 'none' : undefined;
  const base = {
    id: typeof r.id === 'string' && r.id ? r.id : newId(),
    name: typeof r.name === 'string' ? r.name : '',
    quantity: Math.round(num(r.quantity, 1, 1, 99)),
    layerId,
    placement: {
      mode: pick(pl.mode, ['auto', 'manual'] as const, 'auto'),
      x: num(pl.x, 0),
      y: num(pl.y, 0),
      gx: Math.round(num(pl.gx, 0, 0, 500)),
      gy: Math.round(num(pl.gy, 0, 0, 500)),
      rotated: pl.rotated === true,
    },
    heightMode: pick(r.heightMode, ['auto', 'layer', 'custom'] as const, v1 ? 'layer' : 'auto'),
    customHeight: num(r.customHeight, 30, 1, 1000),
    floorHole: r.floorHole === true,
  };
  if (r.type === 'cardTray') {
    const d = createCardTray();
    const slots = Math.round(num(r.slots, d.slots, 1, 50));
    const perSlot = Math.round(num(r.cardsPerSlot ?? r.cardCount, d.cardsPerSlot, 1, 1000));
    return {
      ...d,
      ...base,
      name: base.name || d.name,
      fingerCutout: legacyFinger ?? pick(r.fingerCutout, ['none', 'notch', 'toFloor'] as const, d.fingerCutout),
      cardPreset: pick(r.cardPreset, [...CARD_PRESETS.map((c) => c.id), 'custom'] as const, d.cardPreset),
      customCardWidth: num(r.customCardWidth, d.customCardWidth, 10, 400),
      customCardHeight: num(r.customCardHeight, d.customCardHeight, 10, 400),
      sleeve: pick(r.sleeve, ['none', 'standard', 'premium'] as const, d.sleeve),
      cardThickness: num(r.cardThickness, d.cardThickness, 0.1, 3),
      orientation: pick(r.orientation, ['standing', 'flat'] as const, d.orientation),
      format: pick(r.format, ['portrait', 'landscape'] as const, d.format),
      tilt: num(r.tilt, 0, 0, 45),
      rows: Math.round(num(r.rows, 1, 1, 2)),
      dividerMode: pick(r.dividerMode, ['fixed', 'loose', 'toothed'] as const, v1 ? 'fixed' : d.dividerMode),
      slots,
      cardsPerSlot: perSlot,
      totalCards: Math.round(num(r.totalCards, slots * perSlot, 0, 5000)),
      dividerCount: Math.round(num(r.dividerCount, d.dividerCount, 0, 200)),
      dividerPlateThickness: num(r.dividerPlateThickness, d.dividerPlateThickness, 0.6, 5),
      tab: typeof r.tab === 'boolean' ? r.tab : d.tab,
      tabHeight: num(r.tabHeight, d.tabHeight, 2, 40),
      tabWidthPercent: num(r.tabWidthPercent, d.tabWidthPercent, 10, 100),
      tabStaggered: typeof r.tabStaggered === 'boolean' ? r.tabStaggered : d.tabStaggered,
      play: num(r.play, d.play, 0, 20),
    };
  }
  if (r.type === 'gridBox') {
    const d = createGridBox();
    const legacyRows = gridRows(Math.round(num(r.columns, 3, 1, 50)), Math.round(num(r.rows, 2, 1, 50)));
    return {
      ...d,
      ...base,
      name: base.name || d.name,
      heightMode: base.heightMode === 'auto' ? 'layer' : base.heightMode,
      fingerCutout: legacyFinger ?? pick(r.fingerCutout, ['none', 'notch', 'toFloor'] as const, d.fingerCutout),
      width: num(r.width, d.width, 5, 2000),
      depth: num(r.depth, d.depth, 5, 2000),
      widthCells: Math.round(num(r.widthCells, d.widthCells, 1, 100)),
      depthCells: Math.round(num(r.depthCells, d.depthCells, 1, 100)),
      layout: parseRows(r.layout, legacyRows),
      dividerLowering: num(r.dividerLowering, d.dividerLowering, 0, 1000),
      fingerSides: pick(r.fingerSides, ['front', 'frontBack', 'leftRight'] as const, d.fingerSides),
      lid: pick(r.lid, ['none', 'snap'] as const, d.lid),
    };
  }
  return null;
}

export function parseProject(json: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.');
  }
  const r = obj(raw);
  if (!Array.isArray(r.modules) || !r.box) throw new Error('Die Datei ist keine Konfigurator-Projektdatei.');
  const v1 = num(r.formatVersion, 1) < 2;
  const b = obj(r.box);
  const p = obj(r.print);
  const g = obj(r.grid);

  const layers: Layer[] = (Array.isArray(r.layers) ? r.layers : [])
    .map((l, i) => {
      const o = obj(l);
      return createLayer(i, {
        id: typeof o.id === 'string' && o.id ? o.id : newId(),
        name: typeof o.name === 'string' ? o.name : `Ebene ${i + 1}`,
        heightMode: pick(o.heightMode, ['auto', 'fixed'] as const, 'auto'),
        height: num(o.height, 40, 1, 1000),
        visible: o.visible !== false,
      });
    })
    .slice(0, 20);
  if (layers.length === 0) layers.push(createLayer(0));
  const layerIds = layers.map((l) => l.id);

  const seenIds = new Set<string>();
  const modules = (r.modules as unknown[])
    .map((m) => parseModule(m, v1, layerIds))
    .filter((m): m is InsertModule => m !== null)
    .map((m) => {
      if (seenIds.has(m.id)) m = { ...m, id: newId() };
      seenIds.add(m.id);
      return m;
    });

  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    name: typeof r.name === 'string' ? r.name : 'Mein Insert',
    box: {
      innerWidth: num(b.innerWidth, DEFAULT_BOX.innerWidth, 10, 2000),
      innerDepth: num(b.innerDepth, DEFAULT_BOX.innerDepth, 10, 2000),
      innerHeight: num(b.innerHeight, DEFAULT_BOX.innerHeight, 5, 1000),
      wallThickness: num(b.wallThickness, DEFAULT_BOX.wallThickness, 0, 50),
      floorThickness: num(b.floorThickness, DEFAULT_BOX.floorThickness, 0, 50),
      headroom: num(b.headroom, DEFAULT_BOX.headroom, 0, 1000),
    },
    print: {
      clearance: num(p.clearance, DEFAULT_PRINT.clearance, 0, 5),
      wallThickness: num(p.wallThickness, DEFAULT_PRINT.wallThickness, 0.4, 20),
      floorThickness: num(p.floorThickness, DEFAULT_PRINT.floorThickness, 0.2, 20),
      dividerThickness: num(p.dividerThickness, DEFAULT_PRINT.dividerThickness, 0.4, 20),
    },
    grid: {
      enabled: typeof g.enabled === 'boolean' ? g.enabled : !v1,
      targetCell: num(g.targetCell, DEFAULT_GRID.targetCell, 5, 500),
      baseplate: typeof g.baseplate === 'boolean' ? g.baseplate : DEFAULT_GRID.baseplate,
      maxTileSize: num(g.maxTileSize, DEFAULT_GRID.maxTileSize, 20, 2000),
    },
    layers,
    modules,
  };
}
