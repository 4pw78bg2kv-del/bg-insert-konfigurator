/**
 * Fächerbox mit freier Aufteilung (Baum aus Teilungen). Fächer können leer
 * sein, eine Token-Mulde haben oder Karten aufnehmen (liegend mit
 * angehobenem Boden oder stehend). Dazu Griffmulden, Grifflöcher, Deckel und
 * vertiefte Beschriftung.
 */
import { HINGE_RADIUS, LID_LIP_DEPTH, SLIDE_BACKING, leafRequirement, type GridBoxLayout } from '../dimensions';
import type { ManifoldToplevel, Manifold, Scope } from '../kernel';
import { gridBoxLayout } from '../layout';
import { labelText } from '../parts';
import { box, cylinderZ, prismX, uNotch } from '../primitives';
import type { GridBoxModule, InsertModule, Project } from '../types';
import { chamferBottom, lidPrep, sideTexts } from './common';

/** Oberkante des Schriftbands an den Seitenwänden (unterhalb von Deckel-Details). */
export function textBandTop(m: InsertModule, H: number, plate: number, clearance: number): number {
  switch (m.lid) {
    case 'lift':
    case 'snap':
      return H - LID_LIP_DEPTH - clearance - 1.2;
    case 'slide':
      return H - 2 * plate - SLIDE_BACKING - 1.6;
    case 'hinge':
      return H - 2 * HINGE_RADIUS - 1.5;
    default:
      return H - 1.5;
  }
}

/**
 * Viertelkreis-Rundung am Fachboden (Token-Mulde) entlang X. Ragt 0,5 mm in
 * Wand, Boden und seitliche Trennwände hinein, damit die Vereinigung sauber ist.
 */
function scoopFillet(k: ManifoldToplevel, s: Scope, x: number, w: number, yWall: number, dir: 1 | -1, z: number, r: number): Manifold {
  const o = 0.5;
  const pts: [number, number][] = [[yWall - dir * o, z - o], [yWall + dir * r, z - o], [yWall + dir * r, z]];
  const n = 16;
  for (let i = 1; i < n; i++) {
    const a = (Math.PI / 2) * (i / n);
    pts.push([yWall + dir * (r - r * Math.sin(a)), z + r - r * Math.cos(a)]);
  }
  pts.push([yWall, z + r], [yWall - dir * o, z + r]);
  return prismX(k, s, pts, x - o, w + 2 * o);
}

export interface BodyResult {
  body: Manifold;
  text: Manifold | null;
}

export function buildGridBoxParts(k: ManifoldToplevel, s: Scope, m: GridBoxModule, p: Project): BodyResult {
  const l: GridBoxLayout = gridBoxLayout(m, p);
  const { width: W, depth: D, height: H, floor, walls } = l;
  const div = p.print.dividerThickness;
  const cutters: Manifold[] = [];
  const adds: Manifold[] = [];

  for (const c of l.cells) cutters.push(box(k, s, c.x, c.y, c.floor, c.w, c.d, H - c.floor + 1));

  // Abgesenkte Trennwände
  const lower = Math.min(Math.max(0, l.dividerLowering), H - floor);
  if (lower > 0 && l.cells.length > 1) cutters.push(box(k, s, walls.left, walls.front, H - lower, W - walls.left - walls.right, D - walls.front - walls.back, lower + 1));

  // Griffmulden in den Außenwänden
  if (m.fingerCutout !== 'none') {
    for (const c of l.cells) {
      if (c.leaf.content.type === 'cards') continue; // Karten-Fächer haben eigene Mulden
      const bottom = m.fingerCutout === 'toFloor' ? c.floor : c.floor + (H - c.floor) * 0.45;
      const front = c.front && m.fingerSides !== 'leftRight';
      const back = c.back && m.fingerSides === 'frontBack';
      const left = c.left && m.fingerSides === 'leftRight';
      const right = c.right && m.fingerSides === 'leftRight';
      const wY = Math.min(25, c.w * 0.5);
      const wX = Math.min(25, c.d * 0.5);
      if (front && wY > 4 && H - bottom > wY / 2) cutters.push(uNotch(k, s, 'y', c.x + c.w / 2, -1, walls.front + 2, wY, bottom, H));
      if (back && wY > 4 && H - bottom > wY / 2) cutters.push(uNotch(k, s, 'y', c.x + c.w / 2, D - walls.back - 1, walls.back + 2, wY, bottom, H));
      if (left && wX > 4 && H - bottom > wX / 2) cutters.push(uNotch(k, s, 'x', c.y + c.d / 2, -1, walls.left + 2, wX, bottom, H));
      if (right && wX > 4 && H - bottom > wX / 2) cutters.push(uNotch(k, s, 'x', c.y + c.d / 2, W - walls.right - 1, walls.right + 2, wX, bottom, H));
    }
  }

  for (const c of l.cells) {
    const ct = c.leaf.content;
    // Karten: Daumenmulde in der vorderen Begrenzung (Außenwand oder Trennwand)
    if (ct.type === 'cards') {
      const wN = Math.min(26, c.w * 0.42);
      const t = c.front ? walls.front : div;
      const bottom = ct.orientation === 'flat' ? c.floor : c.floor + (H - c.floor) * 0.4;
      if (wN > 5 && H - bottom > wN / 2) cutters.push(uNotch(k, s, 'y', c.x + c.w / 2, c.y - t - 0.5, t + 1, wN, bottom, H));
    }
    // Grifflöcher im Boden (bei angehobenem Boden nur bis zur Unterseite des Sockels sinnvoll)
    if (m.floorHole && Math.abs(c.floor - floor) < 0.01) {
      const d = Math.min(22, c.w - 6, c.d - 6);
      if (d >= 8) cutters.push(cylinderZ(k, s, c.x + c.w / 2, c.y + c.d / 2, -1, floor + 2, d / 2));
    }
    // Token-Mulde
    if (ct.type === 'scoop') {
      const r = Math.min(c.d / 2.4, (H - c.floor) * 0.8, H - lower - c.floor - 0.5, 22);
      if (r > 2) {
        adds.push(scoopFillet(k, s, c.x, c.w, c.y, 1, c.floor, r));
        if (ct.sides === 'both') adds.push(scoopFillet(k, s, c.x, c.w, c.y + c.d, -1, c.floor, r));
      }
    }
  }

  const outer = box(k, s, 0, 0, 0, W, D, H);
  let body = s.track(outer.subtract(s.track(k.Manifold.union(cutters))));
  const prep = lidPrep(k, s, m, p, W, D, H, walls, floor, true);
  if (adds.length || prep.add.length) {
    body = s.track(k.Manifold.union([body, ...adds, ...prep.add]));
  }
  if (prep.cut.length) body = s.track(body.subtract(s.track(k.Manifold.union(prep.cut))));

  // Beschriftung (vertieft) und Einleger
  const text = labelText(m);
  let textSolid: Manifold | null = null;
  if (text) {
    const z1 = textBandTop(m, H, l.lid.plate, p.print.clearance);
    const t = sideTexts(k, s, m, p, text, { W, D, z0: floor + 1, z1 });
    if (t.length) {
      textSolid = t.length > 1 ? s.track(k.Manifold.union(t)) : t[0];
      body = s.track(body.subtract(textSolid));
      textSolid = s.track(textSolid.intersect(box(k, s, 0, 0, 0, W, D, H)));
    }
  }
  body = chamferBottom(k, s, body, W, D, p);
  return { body, text: textSolid };
}

export function buildGridBox(k: ManifoldToplevel, s: Scope, m: GridBoxModule, p: Project): Manifold {
  return buildGridBoxParts(k, s, m, p).body;
}

/** Für Tests: Platzbedarf je Fach. */
export { leafRequirement };
