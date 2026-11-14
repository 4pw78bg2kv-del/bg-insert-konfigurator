/**
 * Projekt-Standards, Modul-Fabriken, Dateinamen und JSON-(De)Serialisierung
 * inklusive Übernahme älterer Projektdateien.
 */
import { CARD_PRESETS, cardPresetShortName } from './cards';
import { BASEPLATE_THICKNESS } from './dimensions';
import { printerPreset } from './printers';
import { SHAPES, bounds, gripCenters, gripRadius, pocketOutline, shapeParams } from './shapes';
import {
  PROJECT_FORMAT_VERSION,
  type BoxSettings,
  type CardSpec,
  type CardTrayModule,
  type CellContent,
  type CellLeaf,
  type CellNode,
  type CellSplit,
  type GridBoxModule,
  type GridSettings,
  type InsertModule,
  type LabelStyle,
  type ModuleLabel,
  type Placement,
  type Pocket,
  type PrintSettings,
  type Project,
  type ShapeBoxModule,
  type ShapeKind,
  type SizeUnit,
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
  material: 'PLA',
  nozzle: 0.4,
  printer: 'bambu-p1',
  bedX: 256,
  bedY: 256,
  bedZ: 256,
  clearance: 0.2,
  wallThickness: 1.6,
  floorThickness: 1.2,
  dividerThickness: 1.2,
  bottomChamfer: 0.4,
};

export const DEFAULT_GRID: GridSettings = {
  enabled: true,
  pitch: 21,
  fit: 'stretch',
  grow: 'inner',
};

export const DEFAULT_LABELS: LabelStyle = { font: 'sans', depth: 2, raised: 0.6 };

/** Empfohlene Druckwerte je Material und Düse (Vielfache der Düse, stützfrei). */
export function recommendedPrint(material: PrintSettings['material'], nozzle: number): Pick<PrintSettings, 'clearance' | 'wallThickness' | 'floorThickness' | 'dividerThickness' | 'bottomChamfer'> {
  const r = (v: number) => Math.round(v * 100) / 100;
  return {
    clearance: material === 'PETG' ? 0.25 : 0.2,
    wallThickness: r(4 * nozzle),
    dividerThickness: r(3 * nozzle),
    floorThickness: r(Math.max(1.2, 3 * nozzle)),
    bottomChamfer: 0.4,
  };
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const defaultPlacement = (): Placement => ({ mode: 'auto', x: 0, y: 0, rotated: false });

export function defaultLabel(type: InsertModule['type']): ModuleLabel {
  return { text: '', onLid: true, sides: type === 'cardTray' ? 'none' : 'frontBack', size: 0 };
}

function base(type: InsertModule['type']) {
  return {
    id: newId(),
    quantity: 1,
    level: 1,
    placement: defaultPlacement(),
    customHeight: 40,
    fingerCutout: 'none' as const,
    floorHole: false,
    lid: 'none' as const,
    magnetDiameter: 6,
    magnetHeight: 2,
    label: defaultLabel(type),
  };
}

export const DEFAULT_CARD: CardSpec = { cardPreset: 'poker', customCardWidth: 60, customCardHeight: 90, sleeve: 'standard', cardThickness: 0.32 };

export function createCardTray(overrides: Partial<CardTrayModule> = {}): CardTrayModule {
  return {
    ...base('cardTray'),
    type: 'cardTray',
    name: 'Kartenfach Poker',
    heightMode: 'auto',
    fingerCutout: 'notch',
    ...DEFAULT_CARD,
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
    tabStyle: 'tab',
    tabHeight: 8,
    tabWidthPercent: 35,
    tabStaggered: true,
    play: 1,
    dividerLabels: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Aufteilungsbaum

export function leaf(content: CellContent = { type: 'empty' }, size = 1, unit: SizeUnit = 'fr'): CellLeaf {
  return { id: newId(), kind: 'leaf', size, unit, content };
}

export function split(dir: 'x' | 'y', children: CellNode[], size = 1, unit: SizeUnit = 'fr'): CellSplit {
  return { id: newId(), kind: 'split', dir, size, unit, children };
}

/** Gleichmäßiges Raster aus Spalten × Reihen. */
export function gridTree(columns: number, rows: number, content: () => CellContent = () => ({ type: 'empty' })): CellNode {
  const row = () => (columns <= 1 ? leaf(content()) : split('x', Array.from({ length: columns }, () => leaf(content()))));
  if (rows <= 1) return row();
  return split('y', Array.from({ length: rows }, row));
}

export function cardsContent(overrides: Partial<Extract<CellContent, { type: 'cards' }>> = {}): Extract<CellContent, { type: 'cards' }> {
  return { type: 'cards', orientation: 'flat', format: 'portrait', count: 30, raise: true, ...DEFAULT_CARD, ...overrides };
}

export function createGridBox(overrides: Partial<GridBoxModule> = {}): GridBoxModule {
  return {
    ...base('gridBox'),
    type: 'gridBox',
    name: 'Box 3x2',
    heightMode: 'fill',
    sizeMode: 'manual',
    width: 105,
    depth: 84,
    root: gridTree(3, 2),
    dividerLowering: 0,
    fingerSides: 'front',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Aufleger-Box

export function createPocket(shape: ShapeKind = 'ellipse', w = 30, h = 30, params: Record<string, number> = {}, overrides: Partial<Pocket> = {}): Pocket {
  return {
    id: newId(),
    shape,
    w,
    h,
    params: shapeParams(shape, w, h, params),
    x: 0,
    y: 0,
    rotation: 0,
    count: 8,
    thickness: 2,
    grip: 'one',
    gripAngle: 270,
    ...overrides,
  };
}

export interface PocketGenerator {
  shape: ShapeKind;
  w: number;
  h: number;
  params?: Record<string, number>;
  pockets: number;
  perStack: number;
  thickness: number;
  grip: Pocket['grip'];
  /** Spalten (0 = automatisch möglichst quadratisch). */
  columns?: number;
}

/** Abstand zwischen zwei Taschen (Wand) für die automatische Anordnung. */
export const POCKET_GAP = 2.4;

/** Erzeugt N gleiche Taschen im Raster (z. B. „9 Kreise für je 8 Aufleger“). */
export function generatePockets(g: PocketGenerator): Pocket[] {
  const n = Math.max(1, Math.round(g.pockets));
  const cols = g.columns && g.columns > 0 ? Math.round(g.columns) : Math.ceil(Math.sqrt(n));
  const list = Array.from({ length: n }, () => createPocket(g.shape, g.w, g.h, g.params ?? {}, { count: g.perStack, thickness: g.thickness, grip: g.grip }));
  return arrangePockets(list, cols);
}

/**
 * Ordnet Taschen in Reihen an (Regal-Packung nach Begrenzungsrechteck inkl.
 * Griffmulde). `columns` begrenzt die Taschen pro Reihe.
 */
export function arrangePockets(pockets: Pocket[], columns = 0, play = 0.5): Pocket[] {
  const cols = columns > 0 ? columns : Math.ceil(Math.sqrt(pockets.length));
  const out: Pocket[] = [];
  let y = 0;
  for (let r = 0; r * cols < pockets.length; r++) {
    const row = pockets.slice(r * cols, (r + 1) * cols);
    const ext = row.map((pk) => pocketExtent(pk, play));
    // Griffmulde zeigt nach vorne → unten mehr Platz
    const rowDown = Math.max(...ext.map((e) => e.down));
    const rowUp = Math.max(...ext.map((e) => e.up));
    let x = 0;
    row.forEach((pk, i) => {
      const e = ext[i];
      x += e.left;
      out.push({ ...pk, x, y: y + rowDown });
      x += e.right + POCKET_GAP;
    });
    y += rowDown + rowUp + POCKET_GAP;
  }
  return out;
}


/** Ausdehnung einer Tasche um ihren Mittelpunkt (inkl. Spiel und Griffmulden). */
export function pocketExtent(pk: Pocket, play: number) {
  const centered = { ...pk, x: 0, y: 0 };
  const o = pocketOutline(centered);
  const b = bounds(o);
  let left = -b.x0 + play, right = b.x1 + play, down = -b.y0 + play, up = b.y1 + play;
  const r = gripRadius(pk);
  for (const [gx, gy] of gripCenters(centered, o, play)) {
    left = Math.max(left, -(gx - r));
    right = Math.max(right, gx + r);
    down = Math.max(down, -(gy - r));
    up = Math.max(up, gy + r);
  }
  return { left, right, down, up };
}

export function createShapeBox(overrides: Partial<ShapeBoxModule> = {}): ShapeBoxModule {
  return {
    ...base('shapeBox'),
    type: 'shapeBox',
    name: 'Aufleger 9x Kreis',
    heightMode: 'auto',
    sizeMode: 'auto',
    width: 120,
    depth: 120,
    pockets: generatePockets({ shape: 'ellipse', w: 30, h: 30, pockets: 9, perStack: 8, thickness: 2, grip: 'one' }),
    pocketPlay: 0.3,
    ...overrides,
  };
}

export function duplicateModule(m: InsertModule): InsertModule {
  const copy = { ...structuredClone(m), id: newId(), name: `${m.name} Kopie` };
  copy.placement = { ...copy.placement, mode: 'auto' };
  return copy;
}

export function createDefaultProject(): Project {
  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    name: 'Mein Insert',
    box: { ...DEFAULT_BOX },
    print: { ...DEFAULT_PRINT },
    grid: { ...DEFAULT_GRID },
    baseplate: { enabled: true },
    labels: { ...DEFAULT_LABELS },
    modules: [
      createCardTray(),
      createGridBox({ name: 'Token-Box', width: 126, depth: 84, root: gridTree(3, 2, () => ({ type: 'scoop', sides: 'front' })), lid: 'snap', heightMode: 'custom', customHeight: 30 }),
      createGridBox({
        name: 'Ressourcen',
        width: 126,
        depth: 84,
        root: split('y', [split('x', [leaf(), leaf(), leaf()]), split('x', [leaf(undefined, 2), leaf()], 2)]),
        fingerCutout: 'toFloor',
        floorHole: true,
        label: { ...defaultLabel('gridBox'), sides: 'none' },
      }),
      createShapeBox({ level: 2, label: { ...defaultLabel('shapeBox'), sides: 'none' } }),
    ],
  };
}

/** Vorschlag für einen Modulnamen anhand der Parameter. */
export function suggestName(m: InsertModule): string {
  if (m.type === 'cardTray') return `Kartenfach ${cardPresetShortName(m)}`;
  if (m.type === 'shapeBox') {
    const kinds = [...new Set(m.pockets.map((pk) => pk.shape))];
    const label = kinds.length === 1 ? (SHAPES.find((s) => s.id === kinds[0])?.label.split(' ')[0] ?? 'Form') : 'Formen';
    return `Aufleger ${m.pockets.length}x ${label}`;
  }
  const r = m.root;
  if (r.kind === 'leaf') return 'Box 1 Fach';
  const uniform = (n: CellNode): [number, number] | null => {
    if (n.kind === 'leaf') return [1, 1];
    if (n.dir === 'x' && n.children.every((c) => c.kind === 'leaf' && c.unit === 'fr' && c.size === n.children[0].size)) return [n.children.length, 1];
    if (n.dir === 'y') {
      const rows = n.children.map(uniform);
      if (rows.every((x) => x && x[1] === 1 && x[0] === rows[0]![0]) && n.children.every((c) => c.size === n.children[0].size)) return [rows[0]![0], n.children.length];
    }
    return null;
  };
  const u = uniform(r);
  const count = (n: CellNode): number => (n.kind === 'leaf' ? 1 : n.children.reduce((s, c) => s + count(c), 0));
  return u ? `Box ${u[0]}x${u[1]}` : `Box ${count(r)} Faecher`;
}

/** Wandelt einen Teilnamen in einen Dateinamen mit Stückzahl, z. B. `2x_Kartenfach_Poker.stl`. */
export function fileNameFor(name: string, quantity: number, ext = 'stl'): string {
  const base =
    name
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
      .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'Teil';
  return `${Math.max(1, Math.round(quantity))}x_${base}.${ext}`;
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
// Dateien aus Version 1 und 2 (mit Ebenen) werden übernommen.

function num(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

const PRESET_IDS = [...CARD_PRESETS.map((c) => c.id), 'custom'] as const;

function parseCard(r: Record<string, unknown>, d: CardSpec): CardSpec {
  return {
    cardPreset: pick(r.cardPreset, PRESET_IDS, d.cardPreset),
    customCardWidth: num(r.customCardWidth, d.customCardWidth, 10, 400),
    customCardHeight: num(r.customCardHeight, d.customCardHeight, 10, 400),
    sleeve: pick(r.sleeve, ['none', 'standard', 'premium'] as const, d.sleeve),
    cardThickness: num(r.cardThickness, d.cardThickness, 0.1, 3),
  };
}

function parseContent(v: unknown): CellContent {
  const r = obj(v);
  if (r.type === 'scoop') return { type: 'scoop', sides: pick(r.sides, ['front', 'both'] as const, 'front') };
  if (r.type === 'cards') {
    const d = cardsContent();
    return {
      type: 'cards',
      orientation: pick(r.orientation, ['flat', 'standing'] as const, d.orientation),
      format: pick(r.format, ['portrait', 'landscape'] as const, d.format),
      count: Math.round(num(r.count, d.count, 1, 2000)),
      raise: typeof r.raise === 'boolean' ? r.raise : d.raise,
      ...parseCard(r, d),
    };
  }
  return { type: 'empty' };
}

function parseNode(v: unknown, depth = 0): CellNode {
  const r = obj(v);
  const size = num(r.size, 1, 0.01, 2000);
  const unit = pick(r.unit, ['fr', 'mm', 'auto'] as const, 'fr');
  const id = str(r.id) || newId();
  if (r.kind === 'split' && Array.isArray(r.children) && r.children.length > 0 && depth < 8) {
    return { id, kind: 'split', size, unit, dir: pick(r.dir, ['x', 'y'] as const, 'x'), children: r.children.slice(0, 40).map((c) => parseNode(c, depth + 1)) };
  }
  return { id, kind: 'leaf', size, unit, content: parseContent(r.content) };
}

/** Alte Rasterbox-Aufteilung (Reihen mit Spalten-Anteilen) als Baum. */
function treeFromRows(rows: { size: number; columns: number[] }[]): CellNode {
  const rowNode = (r: { size: number; columns: number[] }) =>
    r.columns.length <= 1 ? leaf({ type: 'empty' }, r.size) : split('x', r.columns.map((c) => leaf({ type: 'empty' }, c)), r.size);
  if (rows.length === 1) return { ...rowNode(rows[0]), size: 1 };
  return split('y', rows.map(rowNode));
}

function parsePocket(v: unknown): Pocket {
  const r = obj(v);
  const shape = pick(r.shape, SHAPES.map((s) => s.id), 'ellipse');
  const w = num(r.w, 30, 1, 1000);
  const h = num(r.h, 30, 1, 1000);
  const params: Record<string, number> = {};
  const rp = obj(r.params);
  for (const k of Object.keys(rp)) if (typeof rp[k] === 'number') params[k] = rp[k] as number;
  return {
    id: str(r.id) || newId(),
    shape,
    w,
    h,
    params: shapeParams(shape, w, h, params),
    x: num(r.x, 0, -2000, 2000),
    y: num(r.y, 0, -2000, 2000),
    rotation: num(r.rotation, 0, -360, 360),
    count: Math.round(num(r.count, 8, 1, 500)),
    thickness: num(r.thickness, 2, 0.2, 50),
    grip: pick(r.grip, ['none', 'one', 'two'] as const, 'one'),
    gripAngle: num(r.gripAngle, 270, -360, 360),
  };
}

interface Legacy {
  version: number;
  /** Ebenen-Index je alter Ebenen-ID. */
  layerIndex: Map<string, number>;
  /** Verfügbare Höhe je alter Ebene (für „volle Ebenenhöhe“). */
  layerAvail: Map<string, number>;
  layerCount: number;
  cellX: number;
  cellY: number;
  clearance: number;
  grid: boolean;
}

function parseModule(raw: unknown, lg: Legacy): InsertModule | null {
  const r = obj(raw);
  const pl = obj(r.placement);
  const v3 = lg.version >= 3;
  const legacyFinger = r.fingerCutout === true ? 'notch' : r.fingerCutout === false ? 'none' : undefined;
  const lb = obj(r.label);
  const type = r.type === 'cardTray' || r.type === 'gridBox' || r.type === 'shapeBox' ? r.type : null;
  if (!type) return null;
  const c = lg.clearance;
  let x = num(pl.x, 0, -2000, 2000);
  let y = num(pl.y, 0, -2000, 2000);
  if (!v3 && lg.grid) {
    x = c / 2 + Math.round(num(pl.gx, 0, 0, 500)) * lg.cellX + c / 2;
    y = c / 2 + Math.round(num(pl.gy, 0, 0, 500)) * lg.cellY + c / 2;
  }
  let level = Math.round(num(r.level, 1, 1, 20));
  let heightMode = pick(r.heightMode, ['auto', 'fill', 'custom'] as const, 'auto');
  let customHeight = num(r.customHeight, 30, 1, 1000);
  if (!v3) {
    const lid = str(r.layerId);
    level = (lg.layerIndex.get(lid) ?? 0) + 1;
    if (r.heightMode === 'layer' || (lg.version < 2 && r.heightMode === undefined)) {
      if (lg.layerCount <= 1) heightMode = 'fill';
      else {
        heightMode = 'custom';
        customHeight = lg.layerAvail.get(lid) ?? customHeight;
      }
    } else if (type === 'gridBox' && r.heightMode === 'auto') heightMode = 'fill';
  }
  const common = {
    id: str(r.id) || newId(),
    name: str(r.name),
    quantity: Math.round(num(r.quantity, 1, 1, 99)),
    level,
    placement: { mode: pick(pl.mode, ['auto', 'manual'] as const, 'auto'), x, y, rotated: pl.rotated === true },
    heightMode,
    customHeight,
    floorHole: r.floorHole === true,
    lid: pick(r.lid, ['none', 'lift', 'snap', 'slide', 'magnet', 'hinge'] as const, 'none'),
    magnetDiameter: num(r.magnetDiameter, 6, 2, 30),
    magnetHeight: num(r.magnetHeight, 2, 0.5, 10),
    label: {
      text: str(lb.text),
      onLid: typeof lb.onLid === 'boolean' ? lb.onLid : v3 ? true : false,
      sides: pick(lb.sides, ['none', 'frontBack', 'leftRight', 'front'] as const, v3 ? defaultLabel(type).sides : 'none'),
      size: num(lb.size, 0, 0, 100),
    },
  };
  if (type === 'cardTray') {
    const d = createCardTray();
    const slots = Math.round(num(r.slots, d.slots, 1, 50));
    const perSlot = Math.round(num(r.cardsPerSlot ?? r.cardCount, d.cardsPerSlot, 1, 1000));
    return {
      ...d,
      ...common,
      name: common.name || d.name,
      fingerCutout: legacyFinger ?? pick(r.fingerCutout, ['none', 'notch', 'toFloor'] as const, d.fingerCutout),
      ...parseCard(r, d),
      orientation: pick(r.orientation, ['standing', 'flat'] as const, d.orientation),
      format: pick(r.format, ['portrait', 'landscape'] as const, d.format),
      tilt: num(r.tilt, 0, 0, 45),
      rows: Math.round(num(r.rows, 1, 1, 2)),
      dividerMode: pick(r.dividerMode, ['fixed', 'loose', 'toothed'] as const, lg.version < 2 ? 'fixed' : d.dividerMode),
      slots,
      cardsPerSlot: perSlot,
      totalCards: Math.round(num(r.totalCards, slots * perSlot, 0, 5000)),
      dividerCount: Math.round(num(r.dividerCount, d.dividerCount, 0, 200)),
      dividerPlateThickness: num(r.dividerPlateThickness, d.dividerPlateThickness, 0.6, 5),
      tab: typeof r.tab === 'boolean' ? r.tab : d.tab,
      tabStyle: pick(r.tabStyle, ['tab', 'header'] as const, d.tabStyle),
      tabHeight: num(r.tabHeight, d.tabHeight, 2, 40),
      tabWidthPercent: num(r.tabWidthPercent, d.tabWidthPercent, 10, 100),
      tabStaggered: typeof r.tabStaggered === 'boolean' ? r.tabStaggered : d.tabStaggered,
      play: num(r.play, d.play, 0, 20),
      dividerLabels: Array.isArray(r.dividerLabels) ? r.dividerLabels.filter((s): s is string => typeof s === 'string').slice(0, 200) : [],
    };
  }
  if (type === 'gridBox') {
    const d = createGridBox();
    let root: CellNode;
    let sizeMode = pick(r.sizeMode, ['auto', 'manual'] as const, 'manual');
    let width = num(r.width, d.width, 5, 2000);
    let depth = num(r.depth, d.depth, 5, 2000);
    if (v3 && r.root) root = parseNode(r.root);
    else {
      sizeMode = 'manual';
      const rows = Array.isArray(r.layout)
        ? r.layout.map((row) => {
            const o = obj(row);
            const cols = Array.isArray(o.columns) ? o.columns.map((cc) => num(cc, 1, 0.01, 1000)) : [1];
            return { size: num(o.size, 1, 0.01, 1000), columns: cols.length ? cols.slice(0, 50) : [1] };
          })
        : Array.from({ length: Math.round(num(r.rows, 2, 1, 50)) }, () => ({ size: 1, columns: Array<number>(Math.round(num(r.columns, 3, 1, 50))).fill(1) }));
      root = treeFromRows(rows.length ? rows : [{ size: 1, columns: [1] }]);
      if (lg.grid) {
        const rot = pl.rotated === true;
        const cx = rot ? lg.cellY : lg.cellX;
        const cy = rot ? lg.cellX : lg.cellY;
        width = Math.round(num(r.widthCells, 5, 1, 100)) * cx - c;
        depth = Math.round(num(r.depthCells, 4, 1, 100)) * cy - c;
      }
    }
    return {
      ...d,
      ...common,
      name: common.name || d.name,
      fingerCutout: legacyFinger ?? pick(r.fingerCutout, ['none', 'notch', 'toFloor'] as const, d.fingerCutout),
      sizeMode,
      width,
      depth,
      root,
      dividerLowering: num(r.dividerLowering, d.dividerLowering, 0, 1000),
      fingerSides: pick(r.fingerSides, ['front', 'frontBack', 'leftRight'] as const, d.fingerSides),
    };
  }
  const d = createShapeBox();
  return {
    ...d,
    ...common,
    name: common.name || d.name,
    fingerCutout: 'none',
    sizeMode: pick(r.sizeMode, ['auto', 'manual'] as const, 'auto'),
    width: num(r.width, d.width, 5, 2000),
    depth: num(r.depth, d.depth, 5, 2000),
    pockets: Array.isArray(r.pockets) ? r.pockets.slice(0, 200).map(parsePocket) : [],
    pocketPlay: num(r.pocketPlay, d.pocketPlay, 0, 5),
  };
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
  const version = Math.round(num(r.formatVersion, 1));
  const b = obj(r.box);
  const p = obj(r.print);
  const g = obj(r.grid);
  const lab = obj(r.labels);

  const box: BoxSettings = {
    innerWidth: num(b.innerWidth, DEFAULT_BOX.innerWidth, 10, 2000),
    innerDepth: num(b.innerDepth, DEFAULT_BOX.innerDepth, 10, 2000),
    innerHeight: num(b.innerHeight, DEFAULT_BOX.innerHeight, 5, 1000),
    wallThickness: num(b.wallThickness, DEFAULT_BOX.wallThickness, 0, 50),
    floorThickness: num(b.floorThickness, DEFAULT_BOX.floorThickness, 0, 50),
    headroom: num(b.headroom, DEFAULT_BOX.headroom, 0, 1000),
  };
  const printerId = str(p.printer, DEFAULT_PRINT.printer);
  const preset = printerPreset(printerId);
  const print: PrintSettings = {
    material: pick(p.material, ['PLA', 'PETG'] as const, 'PLA'),
    nozzle: num(p.nozzle, DEFAULT_PRINT.nozzle, 0.1, 2),
    printer: preset || printerId === 'custom' ? printerId : DEFAULT_PRINT.printer,
    bedX: num(p.bedX, preset?.bedX ?? DEFAULT_PRINT.bedX, 20, 2000),
    bedY: num(p.bedY, preset?.bedY ?? DEFAULT_PRINT.bedY, 20, 2000),
    bedZ: num(p.bedZ, preset?.bedZ ?? DEFAULT_PRINT.bedZ, 20, 2000),
    clearance: num(p.clearance, DEFAULT_PRINT.clearance, 0, 5),
    wallThickness: num(p.wallThickness, DEFAULT_PRINT.wallThickness, 0.4, 20),
    floorThickness: num(p.floorThickness, DEFAULT_PRINT.floorThickness, 0.2, 20),
    dividerThickness: num(p.dividerThickness, DEFAULT_PRINT.dividerThickness, 0.4, 20),
    bottomChamfer: num(p.bottomChamfer, DEFAULT_PRINT.bottomChamfer, 0, 3),
  };
  const gridEnabled = typeof g.enabled === 'boolean' ? g.enabled : version >= 2;
  const grid: GridSettings = {
    enabled: gridEnabled,
    pitch: num(g.pitch ?? g.targetCell, DEFAULT_GRID.pitch, 2, 500),
    fit: pick(g.fit, ['stretch', 'exact'] as const, 'stretch'),
    grow: pick(g.grow, ['inner', 'wall'] as const, 'inner'),
  };
  const baseplateEnabled = version >= 3 ? obj(r.baseplate).enabled === true : gridEnabled && g.baseplate !== false && version >= 2;

  // Alte Ebenen auswerten (Version 1/2)
  const c = print.clearance;
  const legacyLayers = (Array.isArray(r.layers) ? r.layers : []).map((l) => obj(l));
  const usable = Math.max(0, box.innerHeight - box.headroom);
  const fixed = legacyLayers.filter((l) => l.heightMode === 'fixed').reduce((s, l) => s + num(l.height, 40), 0);
  const autoCount = legacyLayers.filter((l) => l.heightMode !== 'fixed').length;
  const autoH = autoCount ? Math.max(0, usable - fixed) / autoCount : 0;
  const layerIndex = new Map<string, number>();
  const layerAvail = new Map<string, number>();
  legacyLayers.forEach((l, i) => {
    const h = l.heightMode === 'fixed' ? num(l.height, 40) : autoH;
    const plate = i === 0 && baseplateEnabled ? BASEPLATE_THICKNESS : 0;
    layerIndex.set(str(l.id), i);
    layerAvail.set(str(l.id), Math.max(5, h - plate));
  });
  const aw = box.innerWidth - c;
  const ad = box.innerDepth - c;
  const nx = Math.max(1, Math.round(aw / Math.max(5, grid.pitch)));
  const ny = Math.max(1, Math.round(ad / Math.max(5, grid.pitch)));
  const lg: Legacy = { version, layerIndex, layerAvail, layerCount: Math.max(1, legacyLayers.length), cellX: aw / nx, cellY: ad / ny, clearance: c, grid: gridEnabled };

  const seenIds = new Set<string>();
  const modules = (r.modules as unknown[])
    .map((m) => parseModule(m, lg))
    .filter((m): m is InsertModule => m !== null)
    .map((m) => {
      if (seenIds.has(m.id)) m = { ...m, id: newId() };
      seenIds.add(m.id);
      return m;
    });

  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    name: str(r.name, 'Mein Insert'),
    box,
    print,
    grid,
    baseplate: { enabled: baseplateEnabled },
    labels: {
      font: pick(lab.font, ['sans', 'serif', 'optimer'] as const, DEFAULT_LABELS.font),
      depth: num(lab.depth, DEFAULT_LABELS.depth, 0.4, 5),
      raised: num(lab.raised, DEFAULT_LABELS.raised, 0.2, 3),
    },
    modules,
  };
}
