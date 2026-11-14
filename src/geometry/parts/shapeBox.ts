/**
 * Aufleger-Box: massiver Block mit Taschen in Sonderformen (Kreis, Pfeil,
 * Stern …). Jede Tasche ist so tief wie ihr Stapel und hat auf Wunsch
 * Griffmulden. Spiel um die Aufleger per Offset des Umrisses.
 */
import type { ManifoldToplevel, Manifold, Scope } from '../kernel';
import { shapeBoxLayout } from '../layout';
import { labelText } from '../parts';
import { labelAnchor } from '../shapes';
import { fontLoaded } from '../text';
import { box, cylinderZ } from '../primitives';
import type { Project, ShapeBoxModule } from '../types';
import { chamferBottom, lidPrep, sideTexts, textOnFace } from './common';
import { LINE_PITCH, labelLines } from './divider';
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
    const label = pl.pocket.label?.trim();
    if (label && fontLoaded(p.labels.font)) {
      const t = pocketLabel(k, s, label, pl.outline, l.play, pl.floorZ, p);
      if (t) cutters.push(t);
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

/**
 * Beschriftung im Taschenboden: an der breitesten Stelle der Tasche, bei hohen
 * Taschen quer gedreht, auf die Tasche zugeschnitten.
 */
function pocketLabel(k: ManifoldToplevel, s: Scope, text: string, outline: [number, number][], play: number, floorZ: number, p: Project): Manifold | null {
  const depth = Math.min(p.labels.depth, floorZ - 0.6);
  if (depth < 0.3) return null;
  const a = labelAnchor(outline);
  const vertical = a.spanY > a.spanX * 1.25;
  const along = vertical ? a.spanY : a.spanX;
  const across = Math.min(vertical ? a.spanX : a.spanY, 2.4 * a.r);
  const { lines, height } = labelLines(text, p.labels.font, along * 0.8, across * 0.7);
  if (height < 2.5) return null;
  const U: [number, number, number] = vertical ? [0, 1, 0] : [1, 0, 0];
  const V: [number, number, number] = vertical ? [-1, 0, 0] : [0, 1, 0];
  const parts: Manifold[] = [];
  lines.forEach((line, i) => {
    const off = ((lines.length - 1) / 2 - i) * height * LINE_PITCH;
    const t = textOnFace(k, s, line, p.labels.font, height, [a.x + V[0] * off, a.y + V[1] * off, floorZ], U, V, [0, 0, 1], depth);
    if (t) parts.push(t);
  });
  if (!parts.length) return null;
  const solid = parts.length > 1 ? s.track(k.Manifold.union(parts)) : parts[0];
  // Nur innerhalb der Tasche (bei verwinkelten Formen nicht unter den Rand)
  const cs0 = new k.CrossSection([outline], 'NonZero');
  const cs = cs0.offset(play - 0.4, 'Round', 2, 32);
  cs0.delete();
  const clip = s.track(s.track(cs.extrude(depth + 2)).translate([0, 0, floorZ - depth - 1]));
  cs.delete();
  return s.track(solid.intersect(clip));
}
