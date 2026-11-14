/**
 * Grundplatte: dünne Platte mit Rippen entlang der Kanten aller Module, die
 * direkt auf ihr stehen. Die Rippen greifen in die Bodenfase der Module –
 * dadurch verrutscht die unterste Lage nicht, unabhängig vom Rastermaß.
 *
 * Rippenprofil: Trapez mit 45°-Flanken (stützfrei), passend zur Fase.
 */
import { BASEPLATE_THICKNESS, LOCK_CHAMFER } from '../dimensions';
import type { ManifoldToplevel, Manifold, Scope } from '../kernel';
import { computeLayout } from '../layout';
import { groundInstances } from '../parts';
import { box, prismX, prismY } from '../primitives';
import type { BaseplateTile, Project } from '../types';

export function ribProfile(c: number): { base: number; top: number; height: number } {
  const half = LOCK_CHAMFER - c;
  return { base: 2 * half, top: 0.4, height: half - 0.2 };
}

export function buildBaseplate(k: ManifoldToplevel, s: Scope, tile: BaseplateTile, p: Project): Manifold {
  const c = p.print.clearance;
  const w = tile.x1 - tile.x0;
  const d = tile.y1 - tile.y0;
  const T = BASEPLATE_THICKNESS;
  const rib = ribProfile(c);
  const parts: Manifold[] = [box(k, s, 0, 0, 0, w, d, T + 0.01)];
  const prof = (cx: number): [number, number][] => [
    [cx - rib.base / 2, T - 0.01],
    [cx + rib.base / 2, T - 0.01],
    [cx + rib.top / 2, T + rib.height],
    [cx - rib.top / 2, T + rib.height],
  ];
  // Kantenstücke je Linie sammeln und zusammenfassen (keine überlappenden Rippen)
  const lines = new Map<string, { axis: 'x' | 'y'; at: number; segs: [number, number][] }>();
  const addSeg = (axis: 'x' | 'y', at: number, from: number, to: number) => {
    const key = `${axis}:${at.toFixed(2)}`;
    const e = lines.get(key) ?? { axis, at, segs: [] };
    e.segs.push([from + 0.5, to - 0.5]);
    lines.set(key, e);
  };
  for (const i of groundInstances(p, computeLayout(p))) {
    addSeg('x', i.x - c / 2, i.y, i.y + i.depth);
    addSeg('x', i.x + i.width + c / 2, i.y, i.y + i.depth);
    addSeg('y', i.y - c / 2, i.x, i.x + i.width);
    addSeg('y', i.y + i.depth + c / 2, i.x, i.x + i.width);
  }
  for (const { axis, at, segs } of lines.values()) {
    segs.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const sg of segs) {
      const last = merged[merged.length - 1];
      if (last && sg[0] <= last[1] + 1.5) last[1] = Math.max(last[1], sg[1]);
      else merged.push([...sg]);
    }
    for (const [from, to] of merged) {
      if (axis === 'x') {
        const lo = Math.max(from, tile.y0) - tile.y0;
        const hi = Math.min(to, tile.y1) - tile.y0;
        if (hi - lo > 2 && at > tile.x0 - rib.base && at < tile.x1 + rib.base) parts.push(prismY(k, s, prof(at - tile.x0), lo, hi - lo));
      } else {
        const lo = Math.max(from, tile.x0) - tile.x0;
        const hi = Math.min(to, tile.x1) - tile.x0;
        if (hi - lo > 2 && at > tile.y0 - rib.base && at < tile.y1 + rib.base) parts.push(prismX(k, s, prof(at - tile.y0), lo, hi - lo));
      }
    }
  }
  const all = parts.length > 1 ? s.track(k.Manifold.union(parts)) : parts[0];
  return s.track(all.intersect(box(k, s, 0, 0, 0, w, d, T + rib.height + 1)));
}
