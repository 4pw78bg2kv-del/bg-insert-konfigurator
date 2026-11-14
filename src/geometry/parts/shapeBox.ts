/**
 * Aufleger-Box: massiver Block mit Taschen in Sonderformen (Kreis, Pfeil,
 * Stern …). Jede Tasche ist so tief wie ihr Stapel und hat auf Wunsch
 * Griffmulden. Spiel um die Aufleger per Offset des Umrisses.
 */
import type { ManifoldToplevel, Manifold, Scope } from '../kernel';
import { shapeBoxLayout } from '../layout';
import { labelText } from '../parts';
import { box, cylinderZ } from '../primitives';
import type { Project, ShapeBoxModule } from '../types';
import { chamferBottom, lidPrep, sideTexts } from './common';
import { textBandTop, type BodyResult } from './gridBox';

export function buildShapeBoxParts(k: ManifoldToplevel, s: Scope, m: ShapeBoxModule, p: Project): BodyResult {
  const l = shapeBoxLayout(m, p);
  const { width: W, depth: D, height: H } = l;
  const cutters: Manifold[] = [];
  for (const pl of l.pockets) {
    const cs0 = new k.CrossSection([pl.outline], 'NonZero');
    const cs = cs0.offset(l.play, 'Round', 2, 32);
    cs0.delete();
    const pocket = s.track(s.track(cs.extrude(pl.depth + 1)).translate([0, 0, pl.floorZ]));
    cs.delete();
    cutters.push(pocket);
    for (const [gx, gy] of pl.grips) cutters.push(cylinderZ(k, s, gx, gy, pl.floorZ, pl.depth + 1, pl.gripR));
    if (m.floorHole) {
      const r = Math.min(pl.pocket.w, pl.pocket.h) * 0.2;
      if (r >= 4) cutters.push(cylinderZ(k, s, pl.pocket.x + l.dx, pl.pocket.y + l.dy, -1, pl.floorZ + 2, r));
    }
  }
  let body = box(k, s, 0, 0, 0, W, D, H);
  if (cutters.length) body = s.track(body.subtract(s.track(k.Manifold.union(cutters))));
  const m2 = Math.max(2, p.print.wallThickness);
  const prep = lidPrep(k, s, m, p, W, D, H, { left: m2, right: m2, front: m2, back: m2 }, l.floor, false);
  if (prep.add.length) body = s.track(k.Manifold.union([body, ...prep.add]));
  if (prep.cut.length) body = s.track(body.subtract(s.track(k.Manifold.union(prep.cut))));
  const text = labelText(m);
  let textSolid: Manifold | null = null;
  if (text) {
    const t = sideTexts(k, s, m, p, text, { W, D, z0: Math.min(l.floor + 1, H / 3), z1: textBandTop(m, H, l.lid.plate, p.print.clearance) });
    if (t.length) {
      textSolid = t.length > 1 ? s.track(k.Manifold.union(t)) : t[0];
      body = s.track(body.subtract(textSolid));
      textSolid = s.track(textSolid.intersect(box(k, s, 0, 0, 0, W, D, H)));
    }
  }
  body = chamferBottom(k, s, body, W, D, p);
  return { body, text: textSolid };
}
