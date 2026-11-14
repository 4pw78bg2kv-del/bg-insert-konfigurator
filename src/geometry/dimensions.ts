/**
 * Reine Maß-Berechnungen (ohne Geometrie-Kernel).
 *
 * Werden von Geometrie-Aufbau, Layout, Validierung und UI gemeinsam genutzt,
 * damit alle Stellen garantiert mit denselben Zahlen rechnen.
 *
 * Die Funktionen hier bekommen die verfügbare Höhe (`avail`, vom Modulboden
 * bis unter den Schachteldeckel) explizit übergeben; sie wird vom Stapel-Löser
 * in `layout.ts` bestimmt.
 */
import { effectiveCard } from './cards';
import { bounds, gripCenters, gripRadius, pocketOutline, type Pt } from './shapes';
import type {
  BoxSettings,
  CardSpec,
  CardTrayModule,
  CellLeaf,
  CellNode,
  GridBoxModule,
  InsertModule,
  LidType,
  ModuleSize,
  Pocket,
  Project,
  ShapeBoxModule,
} from './types';

// ---------------------------------------------------------------------------
// Konstanten

/** Grundplatte: Plattenstärke unter den Modulen. */
export const BASEPLATE_THICKNESS = 1.2;
/** Fase an der Unterkante der Module, in die die Rippen der Grundplatte greifen. */
export const LOCK_CHAMFER = 1.6;

/** Auflege- und Rastdeckel: Plattenstärke, Tiefe und Wandstärke der Steck-Lippe. */
export const LID_PLATE = 1.6;
export const LID_LIP_DEPTH = 4;
export const LID_LIP_WALL = 1.2;
/** Rastnase: Überstand und Höhe der Rastrippe. */
export const SNAP_DEPTH = 0.5;
export const SNAP_HEIGHT = 1.4;
/** Schiebedeckel: Plattenstärke (= Nuttiefe) und Restwand hinter der Nut. */
export const SLIDE_PLATE = 2;
export const SLIDE_BACKING = 1.2;
/** Klappdeckel: Radius der Scharnierknöchel, Bohrung für 1,75-mm-Filament als Stift. */
export const HINGE_RADIUS = 2.6;
export const HINGE_PIN_HOLE = 2.0;
export const HINGE_PLATE = 2;
/** Magnetdeckel: Material über/unter dem Magneten und Wand um die Tasche. */
export const MAGNET_SKIN = 0.8;
export const MAGNET_WALL = 1.2;
export const MAGNET_PLAY = 0.2;

/** Zackenmuster für rastende Trenner: Zahntiefe und Zahnbreite am Fuß. */
export const TOOTH_DEPTH = 1.0;
export const TOOTH_BASE = 1.6;

/** Material hinter vertiefter Schrift. */
export const LABEL_BACKING = 1.0;

const EPS = 1e-6;

// ---------------------------------------------------------------------------
// Schachtel

/** Nutzbare Höhe: Innenhöhe minus Kopfraum. */
export function usableHeight(box: BoxSettings): number {
  return Math.max(0, box.innerHeight - box.headroom);
}

/** Unterkante der untersten Module (über der Grundplatte, falls vorhanden). */
export function floorZ(p: Pick<Project, 'baseplate'>): number {
  return p.baseplate.enabled ? BASEPLATE_THICKNESS : 0;
}

/** Außenmaße der Spielschachtel. */
export function outerBoxSize(box: BoxSettings): ModuleSize {
  return {
    width: box.innerWidth + 2 * box.wallThickness,
    depth: box.innerDepth + 2 * box.wallThickness,
    height: box.innerHeight + box.floorThickness,
  };
}

// ---------------------------------------------------------------------------
// Innenraster

export interface GridInfo {
  enabled: boolean;
  nx: number;
  ny: number;
  cellX: number;
  cellY: number;
  /** Position der ersten Rasterlinie. */
  x0: number;
  y0: number;
  clearance: number;
}

export function gridInfo(p: Pick<Project, 'box' | 'grid' | 'print'>): GridInfo {
  const c = p.print.clearance;
  const pitch = Math.max(2, p.grid.pitch);
  const aw = p.box.innerWidth - c;
  const ad = p.box.innerDepth - c;
  if (p.grid.fit === 'exact') {
    const nx = Math.max(1, Math.floor(aw / pitch + EPS));
    const ny = Math.max(1, Math.floor(ad / pitch + EPS));
    return { enabled: p.grid.enabled, nx, ny, cellX: pitch, cellY: pitch, x0: c / 2 + (aw - nx * pitch) / 2, y0: c / 2 + (ad - ny * pitch) / 2, clearance: c };
  }
  const nx = Math.max(1, Math.round(aw / pitch));
  const ny = Math.max(1, Math.round(ad / pitch));
  return { enabled: p.grid.enabled, nx, ny, cellX: aw / nx, cellY: ad / ny, x0: c / 2, y0: c / 2, clearance: c };
}

/** Position der Rasterlinie i in X bzw. Y. */
export function gridLineX(g: GridInfo, i: number): number {
  return g.x0 + i * g.cellX;
}
export function gridLineY(g: GridInfo, i: number): number {
  return g.y0 + i * g.cellY;
}

/** Benötigte Zellen für eine Länge. */
export function cellsFor(length: number, cell: number, clearance: number): number {
  return Math.max(1, Math.ceil((length + clearance) / cell - EPS));
}

/** Außenmaß für n Zellen (Spaltmaß halbiert auf beiden Seiten). */
export function cellSpan(n: number, cell: number, clearance: number): number {
  return n * cell - clearance;
}

/** Zellgrößen in Modulrichtung (bei gedrehtem Modul vertauscht). */
export function moduleCellSize(m: InsertModule, g: GridInfo): { cx: number; cy: number } {
  return m.placement.rotated ? { cx: g.cellY, cy: g.cellX } : { cx: g.cellX, cy: g.cellY };
}

/** Rundet natürliche Außenmaße auf das Raster auf. */
export function snapSize(m: InsertModule, p: Project, w: number, d: number): { width: number; depth: number } {
  const g = gridInfo(p);
  if (!g.enabled) return { width: w, depth: d };
  const { cx, cy } = moduleCellSize(m, g);
  return { width: cellSpan(cellsFor(w, cx, g.clearance), cx, g.clearance), depth: cellSpan(cellsFor(d, cy, g.clearance), cy, g.clearance) };
}

// ---------------------------------------------------------------------------
// Wände, Deckel, Beschriftung

export interface Walls {
  front: number;
  back: number;
  left: number;
  right: number;
}

/** Welche Seiten tragen eine Beschriftung? */
export function labelSides(m: InsertModule): { front: boolean; back: boolean; left: boolean; right: boolean } {
  const s = m.label.sides;
  const tilted = m.type === 'cardTray' && m.orientation === 'standing' && m.tilt > 0;
  return {
    front: (s === 'frontBack' || s === 'front') && !tilted,
    back: s === 'frontBack' && !tilted,
    left: s === 'leftRight',
    right: s === 'leftRight',
  };
}

/** Wandstärken eines Moduls (beschriftete Wände werden verstärkt). */
export function baseWalls(m: InsertModule, p: Project): Walls {
  const w = p.print.wallThickness;
  const t = Math.max(w, p.labels.depth + LABEL_BACKING);
  const s = labelSides(m);
  if (m.type === 'shapeBox') return { front: w, back: w, left: w, right: w };
  return { front: s.front ? t : w, back: s.back ? t : w, left: s.left ? t : w, right: s.right ? t : w };
}

export interface LidInfo {
  type: LidType;
  /** Stärke der Deckelplatte (0 ohne Deckel). */
  plate: number;
  /** Freiraum, den der Deckel innen oben braucht (Lippe). */
  innerReserve: number;
}

/** Unterstützt das Modul einen Deckel? */
export function lidAllowed(m: InsertModule): boolean {
  if (m.type !== 'cardTray') return true;
  return !(m.orientation === 'standing' && m.tilt > 0);
}

export function lidInfo(m: InsertModule, p: Project): LidInfo {
  const type: LidType = lidAllowed(m) ? m.lid : 'none';
  const text = m.label.onLid ? p.labels.depth + 0.8 : 0;
  const c = p.print.clearance;
  switch (type) {
    case 'none':
      return { type, plate: 0, innerReserve: 0 };
    case 'lift':
    case 'snap':
      return { type, plate: Math.max(LID_PLATE, text), innerReserve: LID_LIP_DEPTH + c + 0.5 };
    case 'slide':
      return { type, plate: Math.max(SLIDE_PLATE, text), innerReserve: 0.5 };
    case 'magnet':
      return { type, plate: Math.max(m.magnetHeight + MAGNET_PLAY + MAGNET_SKIN, text), innerReserve: 0.5 };
    case 'hinge':
      return { type, plate: Math.max(HINGE_PLATE, text), innerReserve: 0.5 };
  }
}

/** Kantenlänge der Magnet-Eckpfeiler. */
export function magnetPostSize(m: InsertModule): number {
  return m.magnetDiameter + MAGNET_PLAY + 2 * MAGNET_WALL;
}

/** Höhe aus Höhenmodus (Gesamthöhe inkl. Deckel). */
function totalHeight(m: InsertModule, natural: number, avail: number): number {
  if (m.heightMode === 'custom') return m.customHeight;
  if (m.heightMode === 'fill') return avail;
  return natural;
}

/** Bodenfase (Verriegelung mit der Grundplatte oder gegen Elefantenfuß). */
export function bottomChamfer(p: Project): number {
  return p.baseplate.enabled ? LOCK_CHAMFER : Math.max(0, p.print.bottomChamfer);
}

// ---------------------------------------------------------------------------
// Karten

export interface CardFace {
  /** Maße in Einbaulage (inkl. Hülle). */
  faceW: number;
  faceH: number;
  thickness: number;
}

export function cardFace(spec: CardSpec, format: 'portrait' | 'landscape'): CardFace {
  const card = effectiveCard(spec);
  return format === 'portrait'
    ? { faceW: card.width, faceH: card.height, thickness: card.thickness }
    : { faceW: card.height, faceH: card.width, thickness: card.thickness };
}

// ---------------------------------------------------------------------------
// Kartenfach

export interface CardTrayLayout {
  width: number;
  depth: number;
  /** Höhe des Unterteils (ohne Deckel). */
  height: number;
  /** Gesamthöhe inkl. Deckel. */
  total: number;
  floor: number;
  walls: Walls;
  lid: LidInfo;
  orientation: 'standing' | 'flat';
  rows: number;
  /** X-Start der Kavität jeder Reihe. */
  rowX: number[];
  /** Y-Start der Kavität (vorne). */
  cavityY: number;
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
  /** Höhe der Kavität (Unterteil minus Boden). */
  cavityHeight: number;
}

/** Anzahl separater Trenner (bei beschrifteten Trennern = Anzahl Einträge). */
export function dividerTotal(m: CardTrayModule): number {
  const labels = m.dividerLabels.filter((s) => s.trim() !== '');
  return labels.length > 0 ? labels.length : m.dividerCount;
}

export function cardTrayDims(m: CardTrayModule, p: Project, avail: number): CardTrayLayout {
  const c = p.print.clearance;
  const face = cardFace(m, m.format);
  const div = p.print.dividerThickness;
  const floor = p.print.floorThickness;
  const lid = lidInfo(m, p);
  const walls0 = baseWalls(m, p);
  const rows = m.rows >= 2 ? 2 : 1;
  const variable = m.orientation === 'standing' && m.dividerMode !== 'fixed';
  const toothed = m.orientation === 'standing' && m.dividerMode === 'toothed';
  const tilt = m.orientation === 'standing' ? (Math.min(45, Math.max(0, m.tilt)) * Math.PI) / 180 : 0;
  const cos = Math.cos(tilt);
  const tan = Math.tan(tilt);
  const slots = Math.max(1, Math.round(m.slots));
  const toothDepth = toothed ? TOOTH_DEPTH : 0;
  // Nutbreite horizontal gemessen; bei Neigung breiter, damit die Trenner senkrecht zur Platte passen.
  const toothPitch = (m.dividerPlateThickness + 2 * c + 0.2) / Math.cos(tilt) + TOOTH_BASE;

  const dividers = variable ? dividerTotal(m) : 0;
  const rowCards = Math.ceil(Math.max(0, m.totalCards) / rows);
  const rowDividers = Math.ceil(dividers / rows);
  const tabH = variable && m.tab ? m.tabHeight : 0;

  const requiredInnerHeight = m.orientation === 'standing' ? (face.faceH + tabH) * cos : m.cardsPerSlot * face.thickness;
  const natural = floor + requiredInnerHeight + (m.orientation === 'standing' ? 1 : 1.5) + lid.innerReserve + lid.plate;
  const total = totalHeight(m, natural, avail);
  const height = Math.max(floor + 1, total - lid.plate);
  const cavityHeight = Math.max(0, height - floor);

  let naturalW: number;
  let naturalD: number;
  let rowInnerX: number;
  let slotLength = 0;
  let cavityLength = 0;
  let slotInnerX = 0;
  let slotInnerY = 0;

  if (m.orientation === 'standing') {
    rowInnerX = face.faceW + m.play + 2 * toothDepth;
    naturalW = rows * rowInnerX + (rows - 1) * div + walls0.left + walls0.right;
    if (variable) {
      const stack = rowCards * face.thickness + rowDividers * (m.dividerPlateThickness + 0.3);
      cavityLength = (stack + m.play) / cos;
    } else {
      slotLength = (m.cardsPerSlot * face.thickness + m.play) / cos;
      cavityLength = slots * slotLength + ((slots - 1) * div) / cos;
    }
    naturalD = walls0.front + walls0.back + cavityLength + cavityHeight * tan;
  } else {
    slotInnerX = face.faceW + m.play;
    slotInnerY = face.faceH + m.play;
    rowInnerX = slots * slotInnerX + (slots - 1) * div;
    naturalW = rowInnerX + walls0.left + walls0.right;
    naturalD = rows * slotInnerY + (rows - 1) * div + walls0.front + walls0.back;
  }

  const { width, depth } = snapSize(m, p, naturalW, naturalD);
  const extraX = width - naturalW;
  const extraY = depth - naturalD;
  const walls = { ...walls0 };
  // Zusätzlicher Platz: in X immer in die Seitenwände (Karten brauchen nicht mehr
  // Breite), in Y je nach Einstellung in die Kavität oder in Vorder-/Rückwand.
  walls.left += extraX / 2;
  walls.right += extraX / 2;
  if (p.grid.grow === 'wall') {
    walls.front += extraY / 2;
    walls.back += extraY / 2;
  } else if (m.orientation === 'standing') {
    if (variable) cavityLength += extraY;
    else {
      slotLength += extraY / slots;
      cavityLength += extraY;
    }
  } else {
    slotInnerY += extraY / rows;
  }
  const rowX = Array.from({ length: m.orientation === 'standing' ? rows : 1 }, (_, i) => walls.left + i * (rowInnerX + div));

  return {
    width,
    depth,
    height,
    total: height + lid.plate,
    floor,
    walls,
    lid,
    orientation: m.orientation,
    rows,
    rowX,
    cavityY: walls.front,
    rowInnerX,
    cardFaceW: face.faceW,
    cardFaceH: face.faceH,
    tilt,
    cavityLength,
    slots,
    slotLength,
    rowCards,
    rowDividers,
    dividerWidth: rowInnerX - 2 * c,
    dividerBodyHeight: face.faceH,
    toothDepth,
    toothPitch,
    slotInnerX,
    slotInnerY,
    requiredInnerHeight,
    cavityHeight,
  };
}

// ---------------------------------------------------------------------------
// Fächerbox (Aufteilungsbaum)

export interface CellRect {
  id: string;
  leaf: CellLeaf;
  x: number;
  y: number;
  w: number;
  d: number;
  /** Bodenhöhe des Fachs (bei liegenden Karten angehoben). */
  floor: number;
  /** Fach grenzt an die Außenwand. */
  front: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
}

export interface GridBoxLayout {
  width: number;
  depth: number;
  /** Höhe des Unterteils (ohne Deckel). */
  height: number;
  total: number;
  floor: number;
  walls: Walls;
  lid: LidInfo;
  cells: CellRect[];
  /** Absenkung der Trennwände. */
  dividerLowering: number;
  /** Innenmaß, das der Inhalt mindestens braucht. */
  requiredInner: { w: number; d: number };
}

/** Platzbedarf eines Fachs (Innenmaße und Höhe über dem Fachboden). */
export function leafRequirement(leaf: CellLeaf): { w: number; d: number; h: number } {
  const ct = leaf.content;
  if (ct.type === 'cards') {
    const f = cardFace(ct, ct.format);
    if (ct.orientation === 'flat') return { w: f.faceW + 1, d: f.faceH + 1, h: ct.count * f.thickness };
    return { w: f.faceW + 1, d: ct.count * f.thickness + 1, h: f.faceH };
  }
  if (ct.type === 'scoop') return { w: 15, d: 15, h: 0 };
  return { w: 8, d: 8, h: 0 };
}

function nodeRequirement(n: CellNode, div: number): { w: number; d: number } {
  if (n.kind === 'leaf') {
    const r = leafRequirement(n);
    return { w: r.w, d: r.d };
  }
  const kids = n.children.map((ch) => {
    const r = nodeRequirement(ch, div);
    if (ch.unit === 'mm') return n.dir === 'x' ? { ...r, w: ch.size } : { ...r, d: ch.size };
    return r;
  });
  const gaps = Math.max(0, kids.length - 1) * div;
  return n.dir === 'x'
    ? { w: kids.reduce((s, k) => s + k.w, 0) + gaps, d: Math.max(0, ...kids.map((k) => k.d)) }
    : { w: Math.max(0, ...kids.map((k) => k.w)), d: kids.reduce((s, k) => s + k.d, 0) + gaps };
}

/** Teilt eine Länge auf die Kinder einer Teilung auf. */
export function distribute(n: Extract<CellNode, { kind: 'split' }>, length: number, div: number): number[] {
  const kids = n.children;
  const req = kids.map((k) => {
    const r = nodeRequirement(k, div);
    return n.dir === 'x' ? r.w : r.d;
  });
  const space = length - Math.max(0, kids.length - 1) * div;
  const fixed = kids.map((k, i) => (k.unit === 'mm' ? k.size : k.unit === 'auto' ? req[i] : 0));
  const frSum = kids.reduce((s, k) => s + (k.unit === 'fr' ? Math.max(0.01, k.size) : 0), 0);
  const rest = space - fixed.reduce((s, v) => s + v, 0);
  if (rest < 0) {
    // Passt nicht: proportional stauchen (Validierung meldet zu kleine Fächer).
    const total = fixed.reduce((s, v) => s + v, 0) || 1;
    return fixed.map((v) => (v / total) * Math.max(0, space));
  }
  if (frSum > 0) return kids.map((k, i) => (k.unit === 'fr' ? (rest * Math.max(0.01, k.size)) / frSum : fixed[i]));
  // Keine Anteils-Fächer: Rest gleichmäßig auf die automatischen verteilen
  const autos = kids.filter((k) => k.unit === 'auto').length;
  return kids.map((k, i) => fixed[i] + (autos > 0 ? (k.unit === 'auto' ? rest / autos : 0) : rest / kids.length));
}

function layoutTree(n: CellNode, x: number, y: number, w: number, d: number, div: number, out: Omit<CellRect, 'floor' | 'front' | 'back' | 'left' | 'right'>[]) {
  if (n.kind === 'leaf') {
    out.push({ id: n.id, leaf: n, x, y, w, d });
    return;
  }
  const sizes = distribute(n, n.dir === 'x' ? w : d, div);
  let pos = n.dir === 'x' ? x : y;
  n.children.forEach((ch, i) => {
    if (n.dir === 'x') layoutTree(ch, pos, y, sizes[i], d, div, out);
    else layoutTree(ch, x, pos, w, sizes[i], div, out);
    pos += sizes[i] + div;
  });
}

/** Alle Blätter des Baums in Reihenfolge. */
export function treeLeaves(n: CellNode): CellLeaf[] {
  return n.kind === 'leaf' ? [n] : n.children.flatMap(treeLeaves);
}

export function gridBoxDims(m: GridBoxModule, p: Project, avail: number): GridBoxLayout {
  const div = p.print.dividerThickness;
  const floor = p.print.floorThickness;
  const lid = lidInfo(m, p);
  const walls = baseWalls(m, p);
  const req = nodeRequirement(m.root, div);
  const naturalW = m.sizeMode === 'auto' ? req.w + walls.left + walls.right : m.width;
  const naturalD = m.sizeMode === 'auto' ? req.d + walls.front + walls.back : m.depth;
  const { width, depth } = snapSize(m, p, naturalW, naturalD);
  const extraX = width - naturalW;
  const extraY = depth - naturalD;
  if (p.grid.grow === 'wall') {
    walls.left += extraX / 2;
    walls.right += extraX / 2;
    walls.front += extraY / 2;
    walls.back += extraY / 2;
  }

  // Höhe aus dem Inhalt: höchster Platzbedarf eines Fachs
  const leaves = treeLeaves(m.root);
  const contentH = Math.max(0, ...leaves.map((l) => leafRequirement(l).h + (l.content.type === 'cards' ? 1 : 0)));
  const naturalTotal = floor + Math.max(contentH, 20) + lid.innerReserve + lid.plate;
  const total = totalHeight(m, naturalTotal, avail);
  const height = Math.max(floor + 1, total - lid.plate);

  const innerW = width - walls.left - walls.right;
  const innerD = depth - walls.front - walls.back;
  const raw: Omit<CellRect, 'floor' | 'front' | 'back' | 'left' | 'right'>[] = [];
  layoutTree(m.root, walls.left, walls.front, innerW, innerD, div, raw);
  const e = 0.01;
  const top = height - lid.innerReserve;
  const cells: CellRect[] = raw.map((r) => {
    let f = floor;
    const ct = r.leaf.content;
    if (ct.type === 'cards' && ct.orientation === 'flat' && ct.raise) {
      const stack = leafRequirement(r.leaf).h;
      f = Math.max(floor, top - stack - 1);
    }
    return {
      ...r,
      floor: f,
      front: r.y <= walls.front + e,
      back: r.y + r.d >= depth - walls.back - e,
      left: r.x <= walls.left + e,
      right: r.x + r.w >= width - walls.right - e,
    };
  });

  return {
    width,
    depth,
    height,
    total: height + lid.plate,
    floor,
    walls,
    lid,
    cells,
    dividerLowering: Math.max(0, m.dividerLowering),
    requiredInner: { w: req.w, d: req.d },
  };
}

// ---------------------------------------------------------------------------
// Aufleger-Box

export interface PocketLayout {
  pocket: Pocket;
  /** Umriss in Box-Koordinaten (ohne Spiel). */
  outline: Pt[];
  /** Taschentiefe ab Oberkante. */
  depth: number;
  /** Boden der Tasche. */
  floorZ: number;
  grips: Pt[];
  gripR: number;
}

export interface ShapeBoxLayout {
  width: number;
  depth: number;
  height: number;
  total: number;
  floor: number;
  lid: LidInfo;
  /** Verschiebung der Taschenkoordinaten (bei automatischer Größe). */
  dx: number;
  dy: number;
  play: number;
  pockets: PocketLayout[];
}

/** Rand um die Taschen bei automatischer Boxgröße. */
export function shapeMargin(p: Project): number {
  return Math.max(2, p.print.wallThickness + 0.4);
}

export function pocketDepth(pk: Pocket): number {
  return Math.max(0.6, pk.count * pk.thickness + 0.4);
}

/** Begrenzungsrechteck aller Taschen inkl. Spiel und Griffmulden (Taschenkoordinaten). */
export function pocketsBounds(pockets: Pocket[], play: number) {
  let b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const pk of pockets) {
    const o = pocketOutline(pk);
    const ob = bounds(o);
    b = { x0: Math.min(b.x0, ob.x0 - play), y0: Math.min(b.y0, ob.y0 - play), x1: Math.max(b.x1, ob.x1 + play), y1: Math.max(b.y1, ob.y1 + play) };
    const r = gripRadius(pk);
    for (const [gx, gy] of gripCenters(pk, o, play))
      b = { x0: Math.min(b.x0, gx - r), y0: Math.min(b.y0, gy - r), x1: Math.max(b.x1, gx + r), y1: Math.max(b.y1, gy + r) };
  }
  return b;
}

export function shapeBoxDims(m: ShapeBoxModule, p: Project, avail: number): ShapeBoxLayout {
  const floor = p.print.floorThickness;
  const lid = lidInfo(m, p);
  const play = p.print.clearance + Math.max(0, m.pocketPlay);
  const margin = shapeMargin(p);
  const b = m.pockets.length ? pocketsBounds(m.pockets, play) : { x0: 0, y0: 0, x1: 40, y1: 40 };
  const sideText = labelSides(m);
  const textPad = p.labels.depth + LABEL_BACKING;
  const mx0 = Math.max(margin, sideText.left ? textPad + 0.8 : 0);
  const mx1 = Math.max(margin, sideText.right ? textPad + 0.8 : 0);
  const my0 = Math.max(margin, sideText.front ? textPad + 0.8 : 0);
  const my1 = Math.max(margin, sideText.back ? textPad + 0.8 : 0);
  const lipPad =
    lid.type === 'lift' || lid.type === 'snap'
      ? LID_LIP_WALL + 2 * p.print.clearance + 0.6
      : lid.type === 'slide'
        ? Math.max(0, lid.plate + SLIDE_BACKING + 0.8 - margin)
        : lid.type === 'magnet'
          ? magnetPostSize(m) + 0.6 - margin
          : lid.type === 'hinge'
            ? Math.max(0, 2 * HINGE_RADIUS + 0.8 - margin)
            : 0;
  const naturalW = m.sizeMode === 'auto' ? b.x1 - b.x0 + mx0 + mx1 + 2 * lipPad : m.width;
  const naturalD = m.sizeMode === 'auto' ? b.y1 - b.y0 + my0 + my1 + 2 * lipPad : m.depth;
  const { width, depth } = snapSize(m, p, naturalW, naturalD);
  let dx = 0;
  let dy = 0;
  if (m.sizeMode === 'auto') {
    dx = mx0 + lipPad - b.x0 + (width - naturalW) / 2;
    dy = my0 + lipPad - b.y0 + (depth - naturalD) / 2;
  } else {
    dx = (width - naturalW) / 2;
    dy = (depth - naturalD) / 2;
  }
  const maxDepth = Math.max(1, ...m.pockets.map(pocketDepth));
  const natural = floor + maxDepth + lid.plate;
  const total = totalHeight(m, natural, avail);
  const height = Math.max(floor + 0.6, total - lid.plate);
  const pockets: PocketLayout[] = m.pockets.map((pk) => {
    const outline = pocketOutline(pk, dx, dy);
    const shifted = { ...pk, x: pk.x + dx, y: pk.y + dy };
    const depthP = Math.min(pocketDepth(pk), height - 0.6);
    return { pocket: pk, outline, depth: depthP, floorZ: height - depthP, grips: gripCenters(shifted, outline, play), gripR: gripRadius(pk) };
  });
  return { width, depth, height, total: height + lid.plate, floor, lid, dx, dy, play, pockets };
}

// ---------------------------------------------------------------------------

/** Außenmaße eines Moduls (unrotiert, inkl. Deckel) bei gegebener verfügbarer Höhe. */
export function moduleSizeWith(m: InsertModule, p: Project, avail: number): ModuleSize {
  if (m.type === 'cardTray') {
    const l = cardTrayDims(m, p, avail);
    return { width: l.width, depth: l.depth, height: l.total };
  }
  if (m.type === 'gridBox') {
    const l = gridBoxDims(m, p, avail);
    return { width: l.width, depth: l.depth, height: l.total };
  }
  const l = shapeBoxDims(m, p, avail);
  return { width: l.width, depth: l.depth, height: l.total };
}
