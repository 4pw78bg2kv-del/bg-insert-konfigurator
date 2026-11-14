/**
 * Deckel aller Arten. Aufbau zunächst in Einbaulage (Deckelunterseite bei
 * z = 0, Oberseite bei z = Plattenstärke), danach in Druckorientierung
 * gebracht: Schiebedeckel liegen aufrecht, alle anderen werden umgedreht
 * gedruckt (glatte Oberseite auf dem Druckbett, Lippe/Taschen nach oben).
 */
import {
  HINGE_PIN_HOLE,
  HINGE_RADIUS,
  LID_LIP_DEPTH,
  LID_LIP_WALL,
  MAGNET_PLAY,
  SNAP_DEPTH,
  SNAP_HEIGHT,
  lidInfo,
  magnetPostSize,
  type Walls,
} from '../dimensions';
import type { ManifoldToplevel, Manifold, Scope } from '../kernel';
import { box, cylinderZ, prismX, prismY } from '../primitives';
import type { InsertModule, Project } from '../types';
import { cylX, hingeKnuckleLength, lidText, magnetCorners, slideBumpY, slideInsets, snapLength } from './common';

export interface LidContext {
  W: number;
  D: number;
  walls: Walls;
  hollow: boolean;
}

interface LidParts {
  body: Manifold;
  text: Manifold | null;
}

function buildLidAssembled(k: ManifoldToplevel, s: Scope, m: InsertModule, p: Project, ctx: LidContext, text: string): LidParts {
  const lid = lidInfo(m, p);
  const c = p.print.clearance;
  const { W, D, walls } = ctx;
  const T = lid.plate;
  const parts: Manifold[] = [];
  const cuts: Manifold[] = [];
  let textArea = { y0: 0, y1: D };

  switch (lid.type) {
    case 'lift':
    case 'snap': {
      parts.push(box(k, s, 0, 0, 0, W, D, T));
      const extra = lid.type === 'lift' ? 0.1 : 0;
      const x0 = walls.left + c + extra;
      const x1 = W - walls.right - c - extra;
      const y0 = walls.front + c + extra;
      const y1 = D - walls.back - c - extra;
      const lipOuter = box(k, s, x0, y0, -LID_LIP_DEPTH, x1 - x0, y1 - y0, LID_LIP_DEPTH + 0.5);
      if (x1 - x0 > 2 * LID_LIP_WALL + 1 && y1 - y0 > 2 * LID_LIP_WALL + 1) {
        parts.push(s.track(lipOuter.subtract(box(k, s, x0 + LID_LIP_WALL, y0 + LID_LIP_WALL, -LID_LIP_DEPTH - 1, x1 - x0 - 2 * LID_LIP_WALL, y1 - y0 - 2 * LID_LIP_WALL, LID_LIP_DEPTH + 1))));
      } else parts.push(lipOuter);
      if (lid.type === 'snap') {
        const zc = -LID_LIP_DEPTH / 2;
        const len = snapLength(D - walls.front - walls.back) - 2;
        const ys = D / 2 - len / 2;
        const h = SNAP_HEIGHT;
        parts.push(prismY(k, s, [[x0 + 0.6, zc - h / 2], [x0 + 0.6, zc + h / 2], [x0 - SNAP_DEPTH, zc]], ys, len));
        parts.push(prismY(k, s, [[x1 - 0.6, zc - h / 2], [x1 + SNAP_DEPTH, zc], [x1 - 0.6, zc + h / 2]], ys, len));
      }
      break;
    }
    case 'slide': {
      const g = T;
      const ins = slideInsets(lid, walls, ctx.hollow);
      const xl0 = ins.left - g + c;
      const xr0 = W - ins.right + g - c;
      const yb0 = D - ins.back + g - c;
      const bottom = box(k, s, xl0, 0, 0, xr0 - xl0, yb0, 0.02);
      const top = box(k, s, xl0 + g, 0, g - 0.02, xr0 - xl0 - 2 * g, yb0 - g, 0.02);
      parts.push(s.track(k.Manifold.hull([bottom, top])));
      // Rille für die Rastnoppe
      const yb = slideBumpY(ins);
      const bw = Math.min(10, W * 0.25) + 2;
      cuts.push(prismX(k, s, [[yb - 1, -1], [yb + 1, -1], [yb + 1, 0], [yb, 0.65], [yb - 1, 0]], W / 2 - bw / 2, bw));
      // Griffrillen vorne auf der Oberseite
      for (let i = 0; i < 3; i++) {
        const y = 4 + i * 2.2;
        cuts.push(prismX(k, s, [[y - 0.6, g + 0.1], [y + 0.6, g + 0.1], [y, g - 0.5]], W / 2 - Math.min(18, W * 0.3) / 2, Math.min(18, W * 0.3)));
      }
      textArea = { y0: 12, y1: yb0 - g };
      break;
    }
    case 'magnet': {
      parts.push(box(k, s, 0, 0, 0, W, D, T));
      const ps = magnetPostSize(m);
      const r = (m.magnetDiameter + MAGNET_PLAY) / 2;
      const depthM = m.magnetHeight + MAGNET_PLAY;
      for (const [x, y] of magnetCorners(W, D, walls, ps)) cuts.push(cylinderZ(k, s, x + ps / 2, y + ps / 2, -1, depthM + 1, r));
      break;
    }
    case 'hinge': {
      const R = HINGE_RADIUS;
      const za = T - R + 0.5;
      const ya = D - R;
      const L = hingeKnuckleLength(W);
      parts.push(box(k, s, 0, 0, 0, W, D - 2 * R - c, T));
      const xm0 = L + c;
      const xm1 = W - L - c;
      const knuckle = s.track(cylX(k, s, ya, za, R, xm0, xm1 - xm0).intersect(box(k, s, xm0 - 1, ya - R - 1, za - R - 1, xm1 - xm0 + 2, 2 * R + 2, T - (za - R - 1))));
      parts.push(knuckle);
      parts.push(box(k, s, xm0, D - 2 * R - c - 0.5, Math.max(0, za - 0.2), xm1 - xm0, R + c + 0.5, T - Math.max(0, za - 0.2)));
      cuts.push(cylX(k, s, ya, za, HINGE_PIN_HOLE / 2, -1, W + 2));
      textArea = { y0: 0, y1: D - 2 * R - c };
      break;
    }
    case 'none':
      throw new Error('Modul hat keinen Deckel');
  }
  let body = parts.length > 1 ? s.track(k.Manifold.union(parts)) : parts[0];
  const t = text ? lidText(k, s, m, p, text, W, textArea.y0, textArea.y1, T) : null;
  if (t) cuts.push(t);
  if (cuts.length) body = s.track(body.subtract(s.track(k.Manifold.union(cuts))));
  const textPart = t ? s.track(t.intersect(box(k, s, -1, -1, 0, W + 2, D + 2, T))) : null;
  return { body, text: textPart };
}

/** Bringt einen Deckel aus der Einbaulage in Druckorientierung. */
function toPrint(s: Scope, m: InsertModule, p: Project, solid: Manifold, D: number): Manifold {
  const lid = lidInfo(m, p);
  if (lid.type === 'slide') return solid;
  return s.track(s.track(solid.rotate([180, 0, 0])).translate([0, D, lid.plate]));
}

export function buildLidPart(k: ManifoldToplevel, s: Scope, m: InsertModule, p: Project, ctx: LidContext, text: string): Manifold {
  return toPrint(s, m, p, buildLidAssembled(k, s, m, p, ctx, text).body, ctx.D);
}

export function buildLidInlay(k: ManifoldToplevel, s: Scope, m: InsertModule, p: Project, ctx: LidContext, text: string): Manifold {
  const t = buildLidAssembled(k, s, m, p, ctx, text).text;
  if (!t) throw new Error('Keine Deckelbeschriftung');
  return toPrint(s, m, p, t, ctx.D);
}
