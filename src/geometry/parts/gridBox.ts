/**
 * Rasterbox mit freier Aufteilung (Reihen mit eigenen Spalten), Griffmulden,
 * Grifflöchern und optionalem Steckdeckel mit Rastnasen.
 */
import {
  gridBoxLayout,
  LID_LIP_DEPTH,
  LID_LIP_WALL,
  LID_PLATE,
  SNAP_DEPTH,
  SNAP_HEIGHT,
} from '../dimensions';
import type { ManifoldToplevel, Manifold, Scope } from '../kernel';
import { box, cylinderZ, prismY, uNotch } from '../primitives';
import type { GridBoxModule, Project } from '../types';

/** Länge der Rastrippe an einer Seite. */
function snapLength(side: number): number {
  return Math.max(4, side * 0.4);
}

export function buildGridBox(k: ManifoldToplevel, s: Scope, m: GridBoxModule, p: Project): Manifold {
  const l = gridBoxLayout(m, p);
  const wall = p.print.wallThickness;
  const floor = l.floor;
  const H = l.height;
  const W = l.width;
  const D = l.depth;

  const outer = box(k, s, 0, 0, 0, W, D, H);
  const cutters: Manifold[] = [];
  for (const c of l.cells) cutters.push(box(k, s, c.x, c.y, floor, c.w, c.d, H - floor + 1));

  // Abgesenkte Trennwände (bei Deckel mindestens um die Lippentiefe)
  const lower = Math.min(Math.max(0, l.dividerLowering), H - floor);
  if (lower > 0 && l.cells.length > 1) cutters.push(box(k, s, wall, wall, H - lower, W - 2 * wall, D - 2 * wall, lower + 1));

  // Griffmulden in den Außenwänden
  if (m.fingerCutout !== 'none') {
    const lastRow = Math.max(...l.cells.map((c) => c.row));
    const bottom = m.fingerCutout === 'toFloor' ? floor : floor + (H - floor) * 0.45;
    for (const c of l.cells) {
      const lastCol = Math.max(...l.cells.filter((x) => x.row === c.row).map((x) => x.col));
      const front = c.row === 0 && m.fingerSides !== 'leftRight';
      const back = c.row === lastRow && m.fingerSides === 'frontBack';
      const left = c.col === 0 && m.fingerSides === 'leftRight';
      const right = c.col === lastCol && m.fingerSides === 'leftRight';
      const wY = Math.min(25, c.w * 0.5);
      const wX = Math.min(25, c.d * 0.5);
      if (front && wY > 4 && H - bottom > wY / 2) cutters.push(uNotch(k, s, 'y', c.x + c.w / 2, -1, wall + 2, wY, bottom, H));
      if (back && wY > 4 && H - bottom > wY / 2) cutters.push(uNotch(k, s, 'y', c.x + c.w / 2, D - wall - 1, wall + 2, wY, bottom, H));
      if (left && wX > 4 && H - bottom > wX / 2) cutters.push(uNotch(k, s, 'x', c.y + c.d / 2, -1, wall + 2, wX, bottom, H));
      if (right && wX > 4 && H - bottom > wX / 2) cutters.push(uNotch(k, s, 'x', c.y + c.d / 2, W - wall - 1, wall + 2, wX, bottom, H));
    }
  }

  // Grifflöcher im Boden
  if (m.floorHole) {
    for (const c of l.cells) {
      const d = Math.min(22, c.w - 6, c.d - 6);
      if (d >= 8) cutters.push(cylinderZ(k, s, c.x + c.w / 2, c.y + c.d / 2, -1, floor + 2, d / 2));
    }
  }

  if (l.lid) {
    // Rastnuten in der linken und rechten Innenwand
    const zc = H - LID_LIP_DEPTH / 2;
    const gd = SNAP_DEPTH + 0.1;
    const gh = SNAP_HEIGHT + 0.2;
    const len = snapLength(D - 2 * wall);
    const y0 = D / 2 - len / 2;
    cutters.push(prismY(k, s, [[wall + 0.5, zc - gh / 2 - 0.5], [wall - gd, zc], [wall + 0.5, zc + gh / 2 + 0.5]], y0, len));
    cutters.push(prismY(k, s, [[W - wall - 0.5, zc - gh / 2 - 0.5], [W - wall - 0.5, zc + gh / 2 + 0.5], [W - wall + gd, zc]], y0, len));
    // Öffnungsmulde vorne zum Anheben des Deckels
    const pw = Math.min(14, W * 0.3);
    cutters.push(uNotch(k, s, 'y', W / 2, -1, wall + 2, pw, H - 2.5, H));
  }

  return s.track(outer.subtract(s.track(k.Manifold.union(cutters))));
}

/**
 * Steckdeckel, in Druckorientierung: Platte unten, Steck-Lippe nach oben.
 * Rastrippen an der linken und rechten Lippe greifen in die Nuten der Box.
 */
export function buildLid(k: ManifoldToplevel, s: Scope, m: GridBoxModule, p: Project): Manifold {
  const l = gridBoxLayout(m, p);
  const c = p.print.clearance;
  const wall = p.print.wallThickness;
  const W = l.width;
  const D = l.depth;
  const plate = box(k, s, 0, 0, 0, W, D, LID_PLATE);
  const ox = wall + c;
  const ow = W - 2 * ox;
  const od = D - 2 * ox;
  const lipOuter = box(k, s, ox, ox, LID_PLATE - 0.5, ow, od, LID_LIP_DEPTH + 0.5);
  const parts: Manifold[] = [plate];
  if (ow > 2 * LID_LIP_WALL + 1 && od > 2 * LID_LIP_WALL + 1) {
    const lipInner = box(k, s, ox + LID_LIP_WALL, ox + LID_LIP_WALL, LID_PLATE - 1, ow - 2 * LID_LIP_WALL, od - 2 * LID_LIP_WALL, LID_LIP_DEPTH + 2);
    parts.push(s.track(lipOuter.subtract(lipInner)));
  } else {
    parts.push(lipOuter);
  }
  // Rastrippen (gleiche Höhe wie die Nuten nach dem Umdrehen)
  const zc = LID_PLATE + LID_LIP_DEPTH / 2;
  const len = snapLength(D - 2 * wall) - 2;
  const y0 = D / 2 - len / 2;
  const h = SNAP_HEIGHT;
  parts.push(prismY(k, s, [[ox + 0.6, zc - h / 2], [ox + 0.6, zc + h / 2], [ox - SNAP_DEPTH, zc]], y0, len));
  parts.push(prismY(k, s, [[W - ox - 0.6, zc - h / 2], [W - ox + SNAP_DEPTH, zc], [W - ox - 0.6, zc + h / 2]], y0, len));
  return s.track(k.Manifold.union(parts));
}
