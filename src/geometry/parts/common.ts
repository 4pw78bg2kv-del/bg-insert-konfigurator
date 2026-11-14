/**
 * Gemeinsame Bausteine: Bodenfase, Schrift auf Flächen, Deckel-Vorbereitung
 * am Unterteil (Lippennut, Rastnuten, Schiebenuten, Magnetpfeiler, Scharnier).
 */
import {
  HINGE_PIN_HOLE,
  HINGE_RADIUS,
  LID_LIP_DEPTH,
  LID_LIP_WALL,
  MAGNET_PLAY,
  SLIDE_BACKING,
  SNAP_DEPTH,
  SNAP_HEIGHT,
  bottomChamfer,
  labelSides,
  lidInfo,
  magnetPostSize,
  type LidInfo,
  type Walls,
} from '../dimensions';
import { fitTextHeight } from '../text';
import type { ManifoldToplevel, Manifold, Scope } from '../kernel';
import { box, cylinderZ, prismX, prismY, uNotch } from '../primitives';
import { textShape } from '../text';
import type { FontId, InsertModule, Project } from '../types';

type V3 = [number, number, number];

/** Fase an allen vier unteren Außenkanten (Verriegelung bzw. Elefantenfuß). */
export function chamferBottom(k: ManifoldToplevel, s: Scope, solid: Manifold, W: number, D: number, p: Project): Manifold {
  const ch = bottomChamfer(p);
  if (ch <= 0.01 || W <= 2 * ch + 0.5 || D <= 2 * ch + 0.5) return solid;
  // Konvexer Körper: unten um die Fase eingerückt, ab Fasenhöhe volle Größe (45°, saubere Gehrung).
  const e = 1;
  const bottom = box(k, s, ch - e, ch - e, -e, W - 2 * ch + 2 * e, D - 2 * ch + 2 * e, 0.001);
  const mid = box(k, s, -e, -e, ch + e - 0.001, W + 2 * e, D + 2 * e, 0.001);
  const top = box(k, s, -e, -e, 10000, W + 2 * e, D + 2 * e, 1);
  const keep = s.track(k.Manifold.hull([bottom, mid, top]));
  return s.track(solid.intersect(keep));
}

/** Schrift als Volumen auf einer Fläche. Gibt `null` zurück, wenn nichts zu schreiben ist. */
export function textOnFace(
  k: ManifoldToplevel,
  s: Scope,
  text: string,
  font: FontId,
  height: number,
  origin: V3,
  U: V3,
  V: V3,
  /** Außennormale der Fläche (U × V). */
  N: V3,
  /** Von der Fläche nach innen (negativ = erhaben nach außen). */
  depth: number,
): Manifold | null {
  if (!text || height < 1) return null;
  const shape = textShape(text, font, height);
  if (shape.glyphs.length === 0) return null;
  const sections = shape.glyphs.map((g) => new k.CrossSection(g, 'EvenOdd'));
  const all = k.CrossSection.union(sections);
  sections.forEach((c) => c.delete());
  const centered = all.translate([-shape.width / 2, -height / 2]);
  all.delete();
  const d = Math.abs(depth);
  const solid = s.track(centered.extrude(d + 0.02));
  centered.delete();
  // Engraviert: w ∈ [−d, +0.02]; erhaben: w ∈ [−0.02, d]
  const shifted = s.track(solid.translate([0, 0, depth > 0 ? -d : -0.02]));
  const m = [U[0], U[1], U[2], 0, V[0], V[1], V[2], 0, N[0], N[1], N[2], 0, origin[0], origin[1], origin[2], 1] as Parameters<Manifold['transform']>[0];
  return s.track(shifted.transform(m));
}

export interface SideTextOptions {
  W: number;
  D: number;
  /** Unterkante und Oberkante des Schriftbands an den Seitenwänden. */
  z0: number;
  z1: number;
}

/** Vertiefte Schrift an den gewählten Außenwänden (für Abzug und Einleger). */
export function sideTexts(k: ManifoldToplevel, s: Scope, m: InsertModule, p: Project, text: string, o: SideTextOptions): Manifold[] {
  const sides = labelSides(m);
  const depth = p.labels.depth;
  const band = Math.max(0, o.z1 - o.z0);
  const cz = (o.z0 + o.z1) / 2;
  const out: (Manifold | null)[] = [];
  // Mindestens 1,2 mm, damit Schrift-Teil und Teileliste immer zusammenpassen (die Prüfung warnt bei < 4 mm).
  const hFor = (len: number) => Math.max(1.2, fitTextHeight(text, p.labels.font, len * 0.86, band, m.label.size));
  if (sides.front) out.push(textOnFace(k, s, text, p.labels.font, hFor(o.W), [o.W / 2, 0, cz], [1, 0, 0], [0, 0, 1], [0, -1, 0], depth));
  if (sides.back) out.push(textOnFace(k, s, text, p.labels.font, hFor(o.W), [o.W / 2, o.D, cz], [-1, 0, 0], [0, 0, 1], [0, 1, 0], depth));
  if (sides.left) out.push(textOnFace(k, s, text, p.labels.font, hFor(o.D), [0, o.D / 2, cz], [0, -1, 0], [0, 0, 1], [-1, 0, 0], depth));
  if (sides.right) out.push(textOnFace(k, s, text, p.labels.font, hFor(o.D), [o.W, o.D / 2, cz], [0, 1, 0], [0, 0, 1], [1, 0, 0], depth));
  return out.filter((x): x is Manifold => x !== null);
}

/** Schrift auf der Deckeloberseite (Deckel in Einbaulage, Oberseite bei z = plate). */
export function lidText(k: ManifoldToplevel, s: Scope, m: InsertModule, p: Project, text: string, W: number, y0: number, y1: number, plate: number): Manifold | null {
  const h = fitTextHeight(text, p.labels.font, W * 0.8, Math.min((y1 - y0) * 0.5, 22), m.label.size);
  return textOnFace(k, s, text, p.labels.font, h, [W / 2, (y0 + y1) / 2, plate], [1, 0, 0], [0, 1, 0], [0, 0, 1], p.labels.depth);
}

// ---------------------------------------------------------------------------
// Deckel-Vorbereitung am Unterteil

export interface LidPrep {
  add: Manifold[];
  cut: Manifold[];
}

/** Länge der Rastrippe an einer Seite. */
export function snapLength(side: number): number {
  return Math.max(4, side * 0.4);
}

/**
 * Geometrie, die das Unterteil für den gewählten Deckel braucht.
 * `hollow` = Box mit Innenraum (sonst massiver Block mit Taschen).
 */
export function lidPrep(k: ManifoldToplevel, s: Scope, m: InsertModule, p: Project, W: number, D: number, H: number, walls: Walls, floor: number, hollow: boolean): LidPrep {
  const wall = Math.min(walls.left, walls.right, walls.front, walls.back);
  const lid: LidInfo = lidInfo(m, p);
  const c = p.print.clearance;
  const add: Manifold[] = [];
  const cut: Manifold[] = [];
  switch (lid.type) {
    case 'none':
      break;
    case 'lift':
    case 'snap': {
      // Nut für die Lippe entlang der Innenwand (Trennwände bekommen nur dort eine Kerbe)
      const ring = LID_LIP_WALL + 2 * c + 0.2;
      const zr = H - LID_LIP_DEPTH - c;
      const outer = box(k, s, wall, wall, zr, W - 2 * wall, D - 2 * wall, H - zr + 1);
      if (W - 2 * wall - 2 * ring > 1 && D - 2 * wall - 2 * ring > 1) {
        cut.push(s.track(outer.subtract(box(k, s, wall + ring, wall + ring, zr - 1, W - 2 * wall - 2 * ring, D - 2 * wall - 2 * ring, H - zr + 3))));
      } else cut.push(outer);
      if (lid.type === 'snap') {
        const zc = H - LID_LIP_DEPTH / 2;
        const gd = SNAP_DEPTH + 0.1;
        const gh = SNAP_HEIGHT + 0.2;
        const len = snapLength(D - 2 * wall);
        const y0 = D / 2 - len / 2;
        cut.push(prismY(k, s, [[wall + 0.5, zc - gh / 2 - 0.5], [wall - gd, zc], [wall + 0.5, zc + gh / 2 + 0.5]], y0, len));
        cut.push(prismY(k, s, [[W - wall - 0.5, zc - gh / 2 - 0.5], [W - wall - 0.5, zc + gh / 2 + 0.5], [W - wall + gd, zc]], y0, len));
      }
      // Öffnungsmulde vorne zum Anheben des Deckels
      const pw = Math.min(14, W * 0.3);
      cut.push(uNotch(k, s, 'y', W / 2, -1, wall + 2, pw, H - 2.5, H));
      break;
    }
    case 'slide': {
      // Nut links, rechts und hinten mit 45°-Oberkante (stützfrei); Vorderwand bis zur Nut abgesenkt.
      const g = lid.plate; // Nuttiefe = Plattenstärke
      const z0 = H - g;
      const ins = slideInsets(lid, walls, hollow);
      if (hollow) {
        // Innen verstärkter Rand mit 45°-Unterseite, wo die Wand für die Nut zu dünn ist
        const rimL = ins.left - walls.left;
        const rimR = ins.right - walls.right;
        const rimB = ins.back - walls.back;
        const prof = (x0: number, t: number, dir: 1 | -1): [number, number][] => {
          const zb = z0 - 0.6 - t;
          return dir === 1 ? [[x0 - 0.01, zb], [x0 + t, zb + t], [x0 + t, H], [x0 - 0.01, H]] : [[x0 + 0.01, zb], [x0 + 0.01, H], [x0 - t, H], [x0 - t, zb + t]];
        };
        // Je 0,01 mm in die angrenzenden Wände verlängert (keine deckungsgleichen Flächen)
        if (rimL > 0.01) add.push(prismY(k, s, prof(walls.left, rimL, 1), walls.front - 0.01, D - walls.front - walls.back + 0.02));
        if (rimR > 0.01) add.push(prismY(k, s, prof(W - walls.right, rimR, -1), walls.front - 0.01, D - walls.front - walls.back + 0.02));
        if (rimB > 0.01) add.push(prismX(k, s, prof(D - walls.back, rimB, -1), walls.left - 0.01, W - walls.left - walls.right + 0.02));
      }
      cut.push(prismY(k, s, slideGrooveProfile(ins.left, g, z0, 1), -1, D - ins.back + g + 1));
      cut.push(prismY(k, s, slideGrooveProfile(W - ins.right, g, z0, -1), -1, D - ins.back + g + 1));
      cut.push(prismX(k, s, slideGrooveProfile(D - ins.back, g, z0, -1), ins.left - g, W - ins.left - ins.right + 2 * g));
      // Raum oberhalb der Nutunterkante freiräumen (Deckelplatte liegt bündig)
      cut.push(box(k, s, ins.left - 0.01, -1, z0, W - ins.left - ins.right + 0.02, D - ins.back + 1.01, g + 1));
      // Vorderwand bis zur Nutunterkante absenken
      cut.push(box(k, s, -1, -1, z0, W + 2, ins.front + 1, g + 1));
      // Rastnoppe auf der Vorderwand (passende Rille in der Deckelunterseite)
      const bw = Math.min(10, W * 0.25);
      const yb = slideBumpY(ins);
      add.push(prismX(k, s, [[yb - 0.7, z0 - 0.01], [yb + 0.7, z0 - 0.01], [yb, z0 + 0.45]], W / 2 - bw / 2, bw));
      break;
    }
    case 'magnet': {
      const ps = magnetPostSize(m);
      const r = (m.magnetDiameter + MAGNET_PLAY) / 2;
      const depthM = m.magnetHeight + MAGNET_PLAY;
      const corners = magnetCorners(W, D, walls, ps);
      for (const [x, y] of corners) {
        if (hollow) add.push(box(k, s, x - 0.01, y - 0.01, floor - 0.01, ps + 0.02, ps + 0.02, H - floor + 0.01));
        cut.push(cylinderZ(k, s, x + ps / 2, y + ps / 2, H - depthM, depthM + 1, r));
      }
      break;
    }
    case 'hinge': {
      const R = HINGE_RADIUS;
      const plate = lid.plate;
      const za = H + plate - R + 0.5; // Achse (Knöchel oben bündig abgeflacht)
      const ya = D - R;
      const L = hingeKnuckleLength(W);
      // Freischnitt für den Deckelknöchel in der Mitte
      cut.push(cylX(k, s, ya, za, R + c + 0.2, L - c, W - 2 * L + 2 * c));
      cut.push(box(k, s, L - c, ya - R - c - 0.2, za, W - 2 * L + 2 * c, R * 2 + 2, R + 2));
      // Knöchel am Unterteil (links und rechts) mit 45°-Stütze zur Rückwand
      for (const x0 of [0, W - L]) {
        const knuckle = s.track(cylX(k, s, ya, za, R, x0, L).intersect(box(k, s, x0 - 1, ya - R - 1, za - R - 1, L + 2, 2 * R + 2, H + plate - (za - R - 1))));
        add.push(knuckle);
        const wb = Math.min(walls.back, 2 * R);
        const zl = za - R - (2 * R - wb);
        // Obere Ecke 0,4 mm in den Knöchel gerückt: keine tangentiale Berührung mit dem Zylinder
        if (hollow) add.push(prismX(k, s, [[D - 2 * R + 0.4, za], [D - 2 * R, za - R], [D - wb, zl], [D + 0.01, zl], [D + 0.01, za]], x0, L));
        else add.push(box(k, s, x0, D - 2 * R + 0.4, za - R - 0.5, L, 2 * R - 0.4, R + 0.5));
      }
      // Bohrung für den Stift (1,75-mm-Filament)
      cut.push(cylX(k, s, ya, za, HINGE_PIN_HOLE / 2, -1, W + 2));
      break;
    }
  }
  return { add, cut };
}

/** Nutprofil des Schiebedeckels (in der Ebene senkrecht zur Nut). */
function slideGrooveProfile(xin: number, g: number, z0: number, dir: 1 | -1): [number, number][] {
  // dir = 1: Nut nach −x (linke Wand); dir = −1: nach +x
  const o = xin - dir * g;
  const a: [number, number] = [xin + dir * 0.02, z0];
  const b: [number, number] = [o, z0];
  const c: [number, number] = [xin + dir * 0.02, z0 + g + 0.02];
  return dir === 1 ? [b, a, c] : [a, b, c];
}

/** Innenflächen der Schiebenut (Abstand von der Außenkante). */
export function slideInsets(lid: LidInfo, walls: Walls, hollow: boolean) {
  const rim = lid.plate + SLIDE_BACKING;
  const f = (w: number) => (hollow ? Math.max(w, rim) : Math.max(w, rim));
  return { left: f(walls.left), right: f(walls.right), back: f(walls.back), front: f(walls.left) };
}

export function slideBumpY(ins: { front: number }): number {
  return ins.front * 0.5;
}

/** Ecken (linke vordere Ecke) der Magnetpfeiler. */
export function magnetCorners(W: number, D: number, walls: Walls, ps: number): [number, number][] {
  return [
    [walls.left, walls.front],
    [W - walls.right - ps, walls.front],
    [walls.left, D - walls.back - ps],
    [W - walls.right - ps, D - walls.back - ps],
  ];
}

/** Zylinder entlang X durch (y, z). */
export function cylX(k: ManifoldToplevel, s: Scope, y: number, z: number, r: number, x0: number, len: number): Manifold {
  const c = s.track(k.Manifold.cylinder(len, r, r, 40, false));
  return s.track(s.track(c.rotate([0, 90, 0])).translate([x0, y, z]));
}

/** Länge der äußeren Scharnierknöchel. */
export function hingeKnuckleLength(W: number): number {
  return Math.max(6, Math.min(W * 0.28, 40));
}

