/**
 * Reine Maß-Berechnungen (ohne Geometrie-Kernel).
 *
 * Werden von Geometrie-Aufbau, Layout, Validierung und UI gemeinsam genutzt,
 * damit alle Stellen garantiert mit denselben Zahlen rechnen.
 */
import { effectiveCard } from './cards';
import type {
  BoxSettings,
  CardTrayModule,
  GridBoxModule,
  InsertModule,
  Layer,
  ModuleSize,
  Project,
} from './types';

// ---------------------------------------------------------------------------
// Konstanten für Verriegelung, Deckel und Zackenmuster

/** Grundplatte: Plattenstärke unter den Modulen. */
export const BASEPLATE_THICKNESS = 1.2;
/** Verriegelungsrippe: Höhe, Fußbreite, Kopfbreite (45°-Flanken, stützfrei). */
export const RIB_HEIGHT = 1.6;
export const RIB_BASE = 3.6;
export const RIB_TOP = 0.4;

/** Steckdeckel: Plattenstärke, Tiefe und Wandstärke der Steck-Lippe. */
export const LID_PLATE = 1.6;
export const LID_LIP_DEPTH = 4;
export const LID_LIP_WALL = 1.2;
/** Rastnase: Überstand und Höhe der Rastrippe. */
export const SNAP_DEPTH = 0.5;
export const SNAP_HEIGHT = 1.4;

/** Zackenmuster für rastende Trenner: Zahntiefe und Zahnbreite am Fuß. */
export const TOOTH_DEPTH = 1.0;
export const TOOTH_BASE = 1.6;

const EPS = 1e-6;

// ---------------------------------------------------------------------------
// Schachtel und Ebenen

/** Nutzbare Höhe: Innenhöhe minus Kopfraum. */
export function usableHeight(box: BoxSettings): number {
  return Math.max(0, box.innerHeight - box.headroom);
}

/** Außenmaße der Spielschachtel. */
export function outerBoxSize(box: BoxSettings): ModuleSize {
  return {
    width: box.innerWidth + 2 * box.wallThickness,
    depth: box.innerDepth + 2 * box.wallThickness,
    height: box.innerHeight + box.floorThickness,
  };
}

export interface LayerInfo {
  layer: Layer;
  index: number;
  /** Unterkante der Ebene. */
  z: number;
  height: number;
  /** Unterkante der Module (über der Grundplatte, falls vorhanden). */
  moduleZ: number;
  /** Für Module verfügbare Höhe (Ebenenhöhe minus Grundplatte). */
  available: number;
  /** Module haben Verriegelungsnuten im Boden. */
  interlock: boolean;
}

export function layerInfos(p: Pick<Project, 'box' | 'layers' | 'grid'>): LayerInfo[] {
  const usable = usableHeight(p.box);
  const fixed = p.layers.filter((l) => l.heightMode === 'fixed').reduce((s, l) => s + l.height, 0);
  const autoCount = p.layers.filter((l) => l.heightMode === 'auto').length;
  const autoHeight = autoCount > 0 ? Math.max(0, usable - fixed) / autoCount : 0;
  let z = 0;
  return p.layers.map((layer, index) => {
    const height = layer.heightMode === 'fixed' ? layer.height : autoHeight;
    const interlock = index === 0 && p.grid.enabled && p.grid.baseplate;
    const plate = interlock ? BASEPLATE_THICKNESS : 0;
    const info = { layer, index, z, height, moduleZ: z + plate, available: Math.max(0, height - plate), interlock };
    z += height;
    return info;
  });
}

export function layerInfoFor(p: Pick<Project, 'box' | 'layers' | 'grid'>, layerId: string): LayerInfo {
  const infos = layerInfos(p);
  return infos.find((l) => l.layer.id === layerId) ?? infos[0];
}

// ---------------------------------------------------------------------------
// Innenraster

export interface GridInfo {
  enabled: boolean;
  nx: number;
  ny: number;
  cellX: number;
  cellY: number;
  clearance: number;
}

export function gridInfo(p: Pick<Project, 'box' | 'grid' | 'print'>): GridInfo {
  const c = p.print.clearance;
  const target = Math.max(5, p.grid.targetCell);
  const nx = Math.max(1, Math.round((p.box.innerWidth - c) / target));
  const ny = Math.max(1, Math.round((p.box.innerDepth - c) / target));
  return {
    enabled: p.grid.enabled,
    nx,
    ny,
    cellX: (p.box.innerWidth - c) / nx,
    cellY: (p.box.innerDepth - c) / ny,
    clearance: c,
  };
}

/** Position der Rasterlinie i in X bzw. Y. */
export function gridLineX(g: GridInfo, i: number): number {
  return g.clearance / 2 + i * g.cellX;
}
export function gridLineY(g: GridInfo, i: number): number {
  return g.clearance / 2 + i * g.cellY;
}

/** Benötigte Zellen für eine Länge. */
export function cellsFor(length: number, cell: number, clearance: number): number {
  return Math.max(1, Math.ceil((length + clearance) / cell - EPS));
}

/** Außenmaß für n Zellen (Spaltmaß halbiert auf beiden Seiten). */
export function cellSpan(n: number, cell: number, clearance: number): number {
  return n * cell - clearance;
}

// ---------------------------------------------------------------------------
// Gemeinsame Modul-Infos

export interface ModuleContext {
  layer: LayerInfo;
  grid: GridInfo;
  /** Effektive Bodenstärke (inkl. Nutenhöhe bei Verriegelung). */
  floor: number;
  /** Höhe der Verriegelungsnuten im Boden (0 ohne Verriegelung). */
  grooveHeight: number;
}

export function moduleContext(m: InsertModule, p: Project): ModuleContext {
  const layer = layerInfoFor(p, m.layerId);
  const grooveHeight = layer.interlock ? RIB_HEIGHT + p.print.clearance : 0;
  return { layer, grid: gridInfo(p), floor: p.print.floorThickness + grooveHeight, grooveHeight };
}

export function lidThickness(m: InsertModule): number {
  return m.type === 'gridBox' && m.lid === 'snap' ? LID_PLATE : 0;
}

/** Höhe für `layer`/`custom` (Gesamthöhe inkl. Deckel). */
function totalHeightFor(m: InsertModule, ctx: ModuleContext): number {
  return m.heightMode === 'custom' ? m.customHeight : ctx.layer.available;
}

// ---------------------------------------------------------------------------
// Kartenfach

export interface CardTrayLayout {
  width: number;
  depth: number;
  height: number;
  floor: number;
  orientation: 'standing' | 'flat';
  rows: number;
  /** X-Start der Kavität jeder Reihe. */
  rowX: number[];
  /** Innenbreite einer Reihe (zwischen den Wandflächen). */
  rowInnerX: number;
  /** Kartenmaße in der Einbaulage (inkl. Hülle). */
  cardFaceW: number;
  cardFaceH: number;
  /** Neigung in Radiant. */
  tilt: number;
  /** Horizontale Kavitätslänge in Y (am Boden gemessen) – stehend. */
  cavityLength: number;
  /** Feste Fächer: Anzahl und horizontale Länge eines Fachs. */
  slots: number;
  slotLength: number;
  /** Separate Trenner. */
  rowCards: number;
  rowDividers: number;
  dividerWidth: number;
  dividerBodyHeight: number;
  /** Zackenmuster. */
  toothDepth: number;
  toothPitch: number;
  /** Liegend: Innenmaße eines Fachs. */
  slotInnerX: number;
  slotInnerY: number;
  /** Vom Kartenstapel benötigte Höhe über dem Fachboden (inkl. Lasche). */
  requiredInnerHeight: number;
  /** Höhe der Kavität (Außenhöhe minus Boden). */
  cavityHeight: number;
}

export function cardTrayLayout(m: CardTrayModule, p: Project): CardTrayLayout {
  const ctx = moduleContext(m, p);
  const c = p.print.clearance;
  const card = effectiveCard(m);
  const wall = p.print.wallThickness;
  const div = p.print.dividerThickness;
  const floor = ctx.floor;
  const rows = m.rows >= 2 ? 2 : 1;
  const portrait = m.format === 'portrait';
  const cardFaceW = portrait ? card.width : card.height;
  const cardFaceH = portrait ? card.height : card.width;
  const variable = m.orientation === 'standing' && m.dividerMode !== 'fixed';
  const toothed = m.orientation === 'standing' && m.dividerMode === 'toothed';
  const tilt = m.orientation === 'standing' ? (Math.min(45, Math.max(0, m.tilt)) * Math.PI) / 180 : 0;
  const cos = Math.cos(tilt);
  const tan = Math.tan(tilt);
  const slots = Math.max(1, Math.round(m.slots));
  const toothDepth = toothed ? TOOTH_DEPTH : 0;
  // Nutbreite horizontal gemessen; bei Neigung breiter, damit die Trenner senkrecht zur Platte passen.
  const toothPitch = (m.dividerPlateThickness + 2 * c + 0.2) / Math.cos(tilt) + TOOTH_BASE;

  const rowCards = Math.ceil(Math.max(0, m.totalCards) / rows);
  const rowDividers = Math.ceil(Math.max(0, m.dividerCount) / rows);
  const tabH = variable && m.tab ? m.tabHeight : 0;

  // Benötigte Höhe der Kavität
  const requiredInnerHeight =
    m.orientation === 'standing' ? (cardFaceH + tabH) * cos : m.cardsPerSlot * card.thickness;

  // Höhe
  let total =
    m.heightMode === 'auto'
      ? floor + requiredInnerHeight + (m.orientation === 'standing' ? 1 : 1.5)
      : totalHeightFor(m, ctx);
  if (m.heightMode === 'auto') total = Math.min(total, Math.max(ctx.layer.available, floor + 2));
  const height = total;
  const cavityHeight = Math.max(0, height - floor);

  let naturalW: number;
  let naturalD: number;
  let rowInnerX: number;
  let slotLength = 0;
  let cavityLength = 0;
  let slotInnerX = 0;
  let slotInnerY = 0;

  if (m.orientation === 'standing') {
    rowInnerX = cardFaceW + m.play + 2 * toothDepth;
    naturalW = rows * rowInnerX + (rows - 1) * div + 2 * wall;
    if (variable) {
      const stack = rowCards * card.thickness + rowDividers * (m.dividerPlateThickness + 0.3);
      cavityLength = (stack + m.play) / cos;
    } else {
      slotLength = (m.cardsPerSlot * card.thickness + m.play) / cos;
      cavityLength = slots * slotLength + ((slots - 1) * div) / cos;
    }
    naturalD = 2 * wall + cavityLength + cavityHeight * tan;
  } else {
    slotInnerX = cardFaceW + m.play;
    slotInnerY = cardFaceH + m.play;
    rowInnerX = slots * slotInnerX + (slots - 1) * div;
    naturalW = rowInnerX + 2 * wall;
    naturalD = rows * slotInnerY + (rows - 1) * div + 2 * wall;
  }

  // Auf Innenraster aufrunden
  let width = naturalW;
  let depth = naturalD;
  if (ctx.grid.enabled) {
    const cx = m.placement.rotated ? ctx.grid.cellY : ctx.grid.cellX;
    const cy = m.placement.rotated ? ctx.grid.cellX : ctx.grid.cellY;
    width = cellSpan(cellsFor(naturalW, cx, c), cx, c);
    depth = cellSpan(cellsFor(naturalD, cy, c), cy, c);
  }
  const extraX = width - naturalW;
  const extraY = depth - naturalD;

  // Zusätzlicher Platz in Y geht in die Kavität, in X in die Außenwände.
  if (m.orientation === 'standing') {
    if (variable) cavityLength += extraY;
    else {
      slotLength += extraY / slots;
      cavityLength += extraY;
    }
  } else {
    slotInnerY += extraY / rows;
  }
  const xStart = wall + extraX / 2;
  const rowX = Array.from({ length: m.orientation === 'standing' ? rows : 1 }, (_, i) => xStart + i * (rowInnerX + div));

  return {
    width,
    depth,
    height,
    floor,
    orientation: m.orientation,
    rows,
    rowX,
    rowInnerX,
    cardFaceW,
    cardFaceH,
    tilt,
    cavityLength,
    slots,
    slotLength,
    rowCards,
    rowDividers,
    dividerWidth: rowInnerX - 2 * c,
    dividerBodyHeight: cardFaceH,
    toothDepth,
    toothPitch,
    slotInnerX,
    slotInnerY,
    requiredInnerHeight,
    cavityHeight,
  };
}

// ---------------------------------------------------------------------------
// Rasterbox

export interface GridCell {
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  d: number;
}

export interface GridBoxLayout {
  width: number;
  depth: number;
  /** Höhe des Unterteils (ohne Deckel). */
  height: number;
  floor: number;
  cells: GridCell[];
  /** Tatsächliche Absenkung der Trennwände (Deckel-Lippe berücksichtigt). */
  dividerLowering: number;
  lid: boolean;
}

export function normalizedRows(m: GridBoxModule): { size: number; columns: number[] }[] {
  const rows = m.layout.filter((r) => r.size > 0 && r.columns.length > 0);
  if (rows.length === 0) return [{ size: 1, columns: [1] }];
  return rows.map((r) => ({ size: r.size, columns: r.columns.filter((c) => c > 0).length ? r.columns.filter((c) => c > 0) : [1] }));
}

export function gridBoxLayout(m: GridBoxModule, p: Project): GridBoxLayout {
  const ctx = moduleContext(m, p);
  const c = p.print.clearance;
  const wall = p.print.wallThickness;
  const div = p.print.dividerThickness;
  let width = m.width;
  let depth = m.depth;
  if (ctx.grid.enabled) {
    const cx = m.placement.rotated ? ctx.grid.cellY : ctx.grid.cellX;
    const cy = m.placement.rotated ? ctx.grid.cellX : ctx.grid.cellY;
    width = cellSpan(Math.max(1, Math.round(m.widthCells)), cx, c);
    depth = cellSpan(Math.max(1, Math.round(m.depthCells)), cy, c);
  }
  const lid = m.lid === 'snap';
  const height = totalHeightFor(m, ctx) - lidThickness(m);

  const rows = normalizedRows(m);
  const innerX = width - 2 * wall;
  const innerY = depth - 2 * wall;
  const rowSum = rows.reduce((s, r) => s + r.size, 0);
  const rowSpace = innerY - (rows.length - 1) * div;
  const cells: GridCell[] = [];
  let y = wall;
  rows.forEach((r, ri) => {
    const d = (rowSpace * r.size) / rowSum;
    const colSum = r.columns.reduce((s, v) => s + v, 0);
    const colSpace = innerX - (r.columns.length - 1) * div;
    let x = wall;
    r.columns.forEach((cw, ci) => {
      const w = (colSpace * cw) / colSum;
      cells.push({ row: ri, col: ci, x, y, w, d });
      x += w + div;
    });
    y += d + div;
  });

  const lipNeed = lid ? LID_LIP_DEPTH + c : 0;
  return {
    width,
    depth,
    height,
    floor: ctx.floor,
    cells,
    dividerLowering: Math.max(m.dividerLowering, lipNeed),
    lid,
  };
}

// ---------------------------------------------------------------------------

/** Außenmaße eines Moduls (unrotiert). `height` enthält einen Deckel. */
export function moduleSize(m: InsertModule, p: Project): ModuleSize {
  if (m.type === 'cardTray') {
    const l = cardTrayLayout(m, p);
    return { width: l.width, depth: l.depth, height: l.height };
  }
  const l = gridBoxLayout(m, p);
  return { width: l.width, depth: l.depth, height: l.height + lidThickness(m) };
}

/** Belegte Rasterzellen (unrotiert X × Y). */
export function moduleCells(m: InsertModule, p: Project): { nx: number; ny: number } {
  const g = gridInfo(p);
  const s = moduleSize(m, p);
  const cx = m.placement.rotated ? g.cellY : g.cellX;
  const cy = m.placement.rotated ? g.cellX : g.cellY;
  return { nx: cellsFor(s.width, cx, g.clearance), ny: cellsFor(s.depth, cy, g.clearance) };
}
