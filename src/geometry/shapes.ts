/**
 * Formen für die Aufleger-Box (angelehnt an die Standardformen aus
 * Zeichenprogrammen). Jede Form liefert einen einfachen Umriss (Polygon,
 * gegen den Uhrzeigersinn, Mittelpunkt im Ursprung) sowie Maßlinien für die
 * Maßzeichnung in der Oberfläche.
 */
import type { Pocket, ShapeKind } from './types';

export type Pt = [number, number];

export interface ShapeParamDef {
  key: string;
  label: string;
  unit: 'mm' | '%' | '';
  min: number;
  max: number;
  /** Standardwert abhängig von Breite/Höhe. */
  initial(w: number, h: number): number;
}

/** Maßlinie in Formkoordinaten (für die Zeichnung). */
export interface DimLine {
  key: string;
  from: Pt;
  to: Pt;
  /** Abstand der Maßlinie vom Bauteil (senkrecht zur Linie, in mm). */
  offset: number;
}

export interface ShapeDef {
  id: ShapeKind;
  label: string;
  params: ShapeParamDef[];
  outline(w: number, h: number, p: Record<string, number>): Pt[];
  /** Zusätzliche Maßlinien (Breite und Höhe werden immer gezeichnet). */
  dims?(w: number, h: number, p: Record<string, number>): DimLine[];
}

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function ellipsePts(w: number, h: number, n = 64): Pt[] {
  return Array.from({ length: n }, (_, i) => [(w / 2) * Math.cos((TAU * i) / n), (h / 2) * Math.sin((TAU * i) / n)] as Pt);
}

/** Abgerundetes Rechteck (Mittelpunkt im Ursprung). */
function roundRectPts(w: number, h: number, r: number, seg = 8): Pt[] {
  r = clamp(r, 0, Math.min(w, h) / 2 - 0.01);
  if (r < 0.05) return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  const out: Pt[] = [];
  const corners: [number, number, number][] = [
    [w / 2 - r, -h / 2 + r, -90],
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, 90],
    [-w / 2 + r, -h / 2 + r, 180],
  ];
  for (const [cx, cy, a0] of corners)
    for (let i = 0; i <= seg; i++) {
      const a = ((a0 + (90 * i) / seg) * Math.PI) / 180;
      out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  return out;
}

/** Normiert ein Polygon auf die Box w × h (Mittelpunkt im Ursprung). */
function fitTo(pts: Pt[], w: number, h: number): Pt[] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return pts.map(([x, y]) => [((x - x0) / (x1 - x0) - 0.5) * w, ((y - y0) / (y1 - y0) - 0.5) * h]);
}

export const SHAPES: readonly ShapeDef[] = [
  { id: 'rect', label: 'Rechteck', params: [], outline: (w, h) => roundRectPts(w, h, 0) },
  {
    id: 'roundRect',
    label: 'Abgerundetes Rechteck',
    params: [{ key: 'r', label: 'Eckenradius', unit: 'mm', min: 0, max: 200, initial: (w, h) => Math.round(Math.min(w, h) * 0.15) }],
    outline: (w, h, p) => roundRectPts(w, h, p.r ?? 3),
    dims: (w, h, p) => [{ key: 'r', from: [w / 2 - (p.r ?? 3), h / 2], to: [w / 2, h / 2], offset: 4 }],
  },
  { id: 'ellipse', label: 'Kreis / Oval', params: [], outline: (w, h) => ellipsePts(w, h) },
  { id: 'triangle', label: 'Dreieck', params: [], outline: (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [0, h / 2]] },
  { id: 'rightTriangle', label: 'Rechtwinkliges Dreieck', params: [], outline: (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [-w / 2, h / 2]] },
  { id: 'diamond', label: 'Raute', params: [], outline: (w, h) => [[0, -h / 2], [w / 2, 0], [0, h / 2], [-w / 2, 0]] },
  {
    id: 'polygon',
    label: 'Vieleck (Fünf-, Sechs-, Achteck)',
    params: [{ key: 'sides', label: 'Ecken', unit: '', min: 3, max: 16, initial: () => 6 }],
    outline: (w, h, p) => {
      const n = Math.round(clamp(p.sides ?? 6, 3, 16));
      // Unten eine flache Kante (bei ungerader Eckenzahl Spitze oben).
      const start = -Math.PI / 2 - Math.PI / n;
      return fitTo(Array.from({ length: n }, (_, i) => [Math.cos(start + (TAU * i) / n), Math.sin(start + (TAU * i) / n)] as Pt), w, h);
    },
  },
  {
    id: 'star',
    label: 'Stern',
    params: [
      { key: 'points', label: 'Zacken', unit: '', min: 3, max: 12, initial: () => 5 },
      { key: 'inner', label: 'Innenradius', unit: '%', min: 15, max: 90, initial: () => 45 },
    ],
    outline: (w, h, p) => {
      const n = Math.round(clamp(p.points ?? 5, 3, 12));
      const ri = clamp(p.inner ?? 45, 15, 90) / 100;
      const pts: Pt[] = [];
      for (let i = 0; i < 2 * n; i++) {
        const a = Math.PI / 2 + (Math.PI * i) / n;
        const r = i % 2 === 0 ? 1 : ri;
        pts.push([r * Math.cos(a), r * Math.sin(a)]);
      }
      return fitTo(pts, w, h);
    },
  },
  {
    id: 'arrow',
    label: 'Pfeil',
    params: [
      { key: 'shaft', label: 'Schaftbreite', unit: 'mm', min: 1, max: 500, initial: (_w, h) => Math.round(h * 0.45) },
      { key: 'head', label: 'Spitzenlänge', unit: 'mm', min: 1, max: 500, initial: (w) => Math.round(w * 0.4) },
    ],
    outline: (w, h, p) => {
      const s = clamp(p.shaft ?? h * 0.45, 0.5, h) / 2;
      const hl = clamp(p.head ?? w * 0.4, 0.5, w - 0.5);
      const xh = w / 2 - hl;
      return [[-w / 2, -s], [xh, -s], [xh, -h / 2], [w / 2, 0], [xh, h / 2], [xh, s], [-w / 2, s]];
    },
    dims: (w, h, p) => {
      const s = clamp(p.shaft ?? h * 0.45, 0.5, h) / 2;
      const hl = clamp(p.head ?? w * 0.4, 0.5, w - 0.5);
      return [
        { key: 'shaft', from: [-w / 2, -s], to: [-w / 2, s], offset: 5 },
        { key: 'head', from: [w / 2 - hl, h / 2], to: [w / 2, h / 2], offset: 5 },
      ];
    },
  },
  {
    id: 'doubleArrow',
    label: 'Doppelpfeil',
    params: [
      { key: 'shaft', label: 'Schaftbreite', unit: 'mm', min: 1, max: 500, initial: (_w, h) => Math.round(h * 0.45) },
      { key: 'head', label: 'Spitzenlänge', unit: 'mm', min: 1, max: 500, initial: (w) => Math.round(w * 0.3) },
    ],
    outline: (w, h, p) => {
      const s = clamp(p.shaft ?? h * 0.45, 0.5, h) / 2;
      const hl = clamp(p.head ?? w * 0.3, 0.5, w / 2 - 0.25);
      const xh = w / 2 - hl;
      return [[-w / 2, 0], [-xh, -h / 2], [-xh, -s], [xh, -s], [xh, -h / 2], [w / 2, 0], [xh, h / 2], [xh, s], [-xh, s], [-xh, h / 2]];
    },
    dims: (w, h, p) => {
      const hl = clamp(p.head ?? w * 0.3, 0.5, w / 2 - 0.25);
      const s = clamp(p.shaft ?? h * 0.45, 0.5, h) / 2;
      return [
        { key: 'shaft', from: [0, -s], to: [0, s], offset: 0 },
        { key: 'head', from: [w / 2 - hl, h / 2], to: [w / 2, h / 2], offset: 5 },
      ];
    },
  },
  {
    id: 'cross',
    label: 'Kreuz',
    params: [{ key: 'arm', label: 'Balkenbreite', unit: 'mm', min: 1, max: 500, initial: (w, h) => Math.round(Math.min(w, h) * 0.35) }],
    outline: (w, h, p) => {
      const a = clamp(p.arm ?? Math.min(w, h) * 0.35, 0.5, Math.min(w, h)) / 2;
      return [[-a, -h / 2], [a, -h / 2], [a, -a], [w / 2, -a], [w / 2, a], [a, a], [a, h / 2], [-a, h / 2], [-a, a], [-w / 2, a], [-w / 2, -a], [-a, -a]];
    },
    dims: (w, _h, p) => {
      const a = (p.arm ?? 10) / 2;
      return [{ key: 'arm', from: [w / 2, -a], to: [w / 2, a], offset: 5 }];
    },
  },
  {
    id: 'heart',
    label: 'Herz',
    params: [],
    outline: (w, h) => {
      const pts: Pt[] = [];
      for (let i = 0; i < 72; i++) {
        const t = (TAU * i) / 72;
        pts.push([16 * Math.sin(t) ** 3, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)]);
      }
      return fitTo(pts, w, h);
    },
  },
  {
    id: 'lightning',
    label: 'Blitz',
    params: [],
    outline: (w, h) =>
      fitTo(
        [
          [0.0, 0.0],
          [0.32, 0.42],
          [0.2, 0.47],
          [0.62, 1.0],
          [0.48, 0.55],
          [0.62, 0.5],
          [0.15, -0.0],
        ].map(([x, y]) => [x, y] as Pt).reverse().map(([x, y]) => [x, -y] as Pt).reverse(),
        w,
        h,
      ),
  },
  {
    id: 'flag',
    label: 'Fahne',
    params: [
      { key: 'pole', label: 'Mastbreite', unit: 'mm', min: 1, max: 100, initial: (w) => Math.max(2, Math.round(w * 0.12)) },
      { key: 'flagH', label: 'Fahnenhöhe', unit: 'mm', min: 1, max: 500, initial: (_w, h) => Math.round(h * 0.55) },
    ],
    outline: (w, h, p) => {
      const pw = clamp(p.pole ?? w * 0.12, 0.5, w - 1);
      const fh = clamp(p.flagH ?? h * 0.55, 0.5, h);
      const x0 = -w / 2;
      const notch = (w - pw) * 0.2;
      return [
        [x0, -h / 2],
        [x0 + pw, -h / 2],
        [x0 + pw, h / 2 - fh],
        [w / 2, h / 2 - fh],
        [w / 2 - notch, h / 2 - fh / 2],
        [w / 2, h / 2],
        [x0, h / 2],
      ];
    },
    dims: (w, h, p) => {
      const pw = clamp(p.pole ?? w * 0.12, 0.5, w - 1);
      const fh = clamp(p.flagH ?? h * 0.55, 0.5, h);
      return [
        { key: 'pole', from: [-w / 2, -h / 2], to: [-w / 2 + pw, -h / 2], offset: -5 },
        { key: 'flagH', from: [w / 2, h / 2 - fh], to: [w / 2, h / 2], offset: 5 },
      ];
    },
  },
  {
    id: 'callout',
    label: 'Sprechblase (eckig)',
    params: [{ key: 'tail', label: 'Zipfellänge', unit: 'mm', min: 1, max: 200, initial: (_w, h) => Math.round(h * 0.3) }],
    outline: (w, h, p) => {
      const t = clamp(p.tail ?? h * 0.3, 0.5, h * 0.8);
      const bh = h - t;
      const body = roundRectPts(w, bh, Math.min(w, bh) * 0.15, 6).map(([x, y]) => [x, y + t / 2] as Pt);
      // Zipfel unten links in die Unterkante einsetzen
      const yb = -h / 2 + t;
      const out: Pt[] = [];
      let inserted = false;
      for (let i = 0; i < body.length; i++) {
        out.push(body[i]);
        if (!inserted && i < body.length - 1 && Math.abs(body[i][1] - yb) < 1e-6 && Math.abs(body[i + 1][1] - yb) < 1e-6 && body[i + 1][0] > body[i][0]) {
          const x1 = -w / 2 + w * 0.2;
          const x2 = -w / 2 + w * 0.38;
          if (x1 > body[i][0] && x2 < body[i + 1][0]) {
            out.push([x1, yb], [-w / 2 + w * 0.12, -h / 2], [x2, yb]);
            inserted = true;
          }
        }
      }
      return out;
    },
    dims: (w, h, p) => {
      const t = clamp(p.tail ?? h * 0.3, 0.5, h * 0.8);
      return [{ key: 'tail', from: [-w / 2, -h / 2], to: [-w / 2, -h / 2 + t], offset: 5 }];
    },
  },
  {
    id: 'ovalCallout',
    label: 'Sprechblase (oval)',
    params: [{ key: 'tail', label: 'Zipfellänge', unit: 'mm', min: 1, max: 200, initial: (_w, h) => Math.round(h * 0.3) }],
    outline: (w, h, p) => {
      const t = clamp(p.tail ?? h * 0.3, 0.5, h * 0.8);
      const bh = h - t;
      const n = 64;
      const cy = t / 2;
      const out: Pt[] = [];
      // Ellipse ab −110° bis 250°, Lücke für den Zipfel unten links
      const a0 = (-125 * Math.PI) / 180;
      const a1 = (-100 * Math.PI) / 180;
      for (let i = 0; i <= n; i++) {
        const a = a1 + ((TAU - (a1 - a0)) * i) / n;
        out.push([(w / 2) * Math.cos(a), cy + (bh / 2) * Math.sin(a)]);
      }
      out.push([-w * 0.32, -h / 2]);
      return out;
    },
    dims: (w, h, p) => {
      const t = clamp(p.tail ?? h * 0.3, 0.5, h * 0.8);
      return [{ key: 'tail', from: [-w / 2, -h / 2], to: [-w / 2, -h / 2 + t], offset: 5 }];
    },
  },
];

export function shapeDef(kind: ShapeKind): ShapeDef {
  return SHAPES.find((s) => s.id === kind) ?? SHAPES[0];
}

/** Schnellauswahl (Namen wie im Zeichenprogramm). */
export const SHAPE_PRESETS: readonly { label: string; shape: ShapeKind; w: number; h: number; params?: Record<string, number> }[] = [
  { label: 'Kreis', shape: 'ellipse', w: 30, h: 30 },
  { label: 'Oval', shape: 'ellipse', w: 40, h: 26 },
  { label: 'Quadrat', shape: 'rect', w: 30, h: 30 },
  { label: 'Rechteck', shape: 'rect', w: 40, h: 25 },
  { label: 'Abgerundet', shape: 'roundRect', w: 40, h: 25, params: { r: 5 } },
  { label: 'Dreieck', shape: 'triangle', w: 34, h: 30 },
  { label: 'Rechtw. Dreieck', shape: 'rightTriangle', w: 30, h: 30 },
  { label: 'Raute', shape: 'diamond', w: 30, h: 40 },
  { label: 'Fünfeck', shape: 'polygon', w: 32, h: 30, params: { sides: 5 } },
  { label: 'Sechseck', shape: 'polygon', w: 34.6, h: 30, params: { sides: 6 } },
  { label: 'Achteck', shape: 'polygon', w: 30, h: 30, params: { sides: 8 } },
  { label: 'Stern 4', shape: 'star', w: 32, h: 32, params: { points: 4, inner: 40 } },
  { label: 'Stern 5', shape: 'star', w: 34, h: 32, params: { points: 5, inner: 45 } },
  { label: 'Stern 6', shape: 'star', w: 34, h: 34, params: { points: 6, inner: 55 } },
  { label: 'Pfeil', shape: 'arrow', w: 50, h: 26, params: { shaft: 12, head: 18 } },
  { label: 'Doppelpfeil', shape: 'doubleArrow', w: 60, h: 24, params: { shaft: 10, head: 16 } },
  { label: 'Kreuz', shape: 'cross', w: 30, h: 30, params: { arm: 10 } },
  { label: 'Herz', shape: 'heart', w: 32, h: 30 },
  { label: 'Blitz', shape: 'lightning', w: 24, h: 40 },
  { label: 'Fahne', shape: 'flag', w: 30, h: 40, params: { pole: 4, flagH: 22 } },
  { label: 'Sprechblase', shape: 'callout', w: 40, h: 32, params: { tail: 9 } },
  { label: 'Sprechblase oval', shape: 'ovalCallout', w: 40, h: 32, params: { tail: 9 } },
];

/** Vollständige Parameter einer Form (fehlende mit Standardwerten). */
export function shapeParams(kind: ShapeKind, w: number, h: number, given: Record<string, number> = {}): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of shapeDef(kind).params) out[d.key] = clamp(given[d.key] ?? d.initial(w, h), d.min, d.max);
  return out;
}

/** Umriss einer Form ohne Drehung, Mittelpunkt im Ursprung. */
export function shapeOutline(kind: ShapeKind, w: number, h: number, params: Record<string, number>): Pt[] {
  return dedupePts(shapeDef(kind).outline(Math.max(1, w), Math.max(1, h), shapeParams(kind, w, h, params)));
}

/** Umriss einer Tasche in Box-Koordinaten (gedreht und verschoben, ohne Spiel). */
export function pocketOutline(pk: Pocket, dx = 0, dy = 0): Pt[] {
  const a = (pk.rotation * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  return shapeOutline(pk.shape, pk.w, pk.h, pk.params).map(([x, y]) => [pk.x + dx + x * c - y * s, pk.y + dy + x * s + y * c]);
}

/** Radius der Griffmulde einer Tasche. */
export function gripRadius(pk: Pocket): number {
  return clamp(Math.min(pk.w, pk.h) * 0.28, 6, 10);
}

/** Mittelpunkte der Griffmulden (auf dem Taschenrand in Griffrichtung). */
export function gripCenters(pk: Pocket, outline: Pt[], play: number): Pt[] {
  if (pk.grip === 'none') return [];
  const angles = pk.grip === 'two' ? [pk.gripAngle, pk.gripAngle + 180] : [pk.gripAngle];
  const cx = outline.reduce((s, p) => s + p[0], 0) / outline.length;
  const cy = outline.reduce((s, p) => s + p[1], 0) / outline.length;
  void cx;
  void cy;
  return angles.map((deg) => {
    const a = ((deg + pk.rotation) * Math.PI) / 180;
    const ux = Math.cos(a), uy = Math.sin(a);
    // Ausdehnung des Umrisses in Griffrichtung, gemessen vom Taschenmittelpunkt
    const ext = Math.max(...outline.map(([x, y]) => (x - pk.x) * ux + (y - pk.y) * uy)) + play;
    const r = gripRadius(pk);
    const along = ext - r * 0.35;
    return [pk.x + ux * along, pk.y + uy * along] as Pt;
  });
}

export function polygonArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export function bounds(pts: Pt[]): { x0: number; y0: number; x1: number; y1: number } {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function dedupePts(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const l = out[out.length - 1];
    if (!l || Math.hypot(l[0] - p[0], l[1] - p[1]) > 1e-4) out.push(p);
  }
  while (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-4) out.pop();
  // Gegen den Uhrzeigersinn ausrichten
  return polygonArea(out) < 0 ? out.reverse() : out;
}

/** Kürzester Abstand zwischen zwei Polygonen (0 bei Überschneidung). */
export function polygonDistance(a: Pt[], b: Pt[]): number {
  if (a.some((p) => pointInPolygon(p, b)) || b.some((p) => pointInPolygon(p, a))) return 0;
  let best = Infinity;
  const segDist = (p: Pt, s0: Pt, s1: Pt) => {
    const dx = s1[0] - s0[0], dy = s1[1] - s0[1];
    const l2 = dx * dx + dy * dy || 1e-12;
    const t = clamp(((p[0] - s0[0]) * dx + (p[1] - s0[1]) * dy) / l2, 0, 1);
    return Math.hypot(p[0] - (s0[0] + t * dx), p[1] - (s0[1] + t * dy));
  };
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) {
      best = Math.min(best, segDist(a[i], b[j], b[(j + 1) % b.length]), segDist(b[j], a[i], a[(i + 1) % a.length]));
    }
  // Kantenschnitt ohne enthaltene Ecken
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) if (segmentsIntersect(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return 0;
  return best;
}

export function pointInPolygon([x, y]: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segmentsIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d = (a: Pt, b: Pt, c: Pt) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
