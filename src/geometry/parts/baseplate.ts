/**
 * Grundplatte mit Verriegelungsrippen auf den Rasterlinien sowie die
 * passenden Nuten im Boden der Module.
 *
 * Rippenprofil: Trapez mit 45°-Flanken (stützfrei druckbar). Module stehen auf
 * der Platte, die Rippen greifen in die Nuten – dadurch verrutscht nichts.
 */
import { BASEPLATE_THICKNESS, gridInfo, gridLineX, gridLineY, RIB_BASE, RIB_HEIGHT, RIB_TOP, type GridInfo } from '../dimensions';
import type { ManifoldToplevel, Manifold, Scope } from '../kernel';
import { tileBounds } from '../parts';
import { box, prismX, prismY } from '../primitives';
import type { BaseplateTile, Project } from '../types';

export function buildBaseplate(k: ManifoldToplevel, s: Scope, tile: BaseplateTile, p: Project): Manifold {
  const g = gridInfo(p);
  const b = tileBounds(tile, g);
  const w = b.x1 - b.x0;
  const d = b.y1 - b.y0;
  const T = BASEPLATE_THICKNESS;
  const parts: Manifold[] = [box(k, s, 0, 0, 0, w, d, T + 0.01)];
  const profile = (c: number): [number, number][] => [
    [c - RIB_BASE / 2, T - 0.01],
    [c + RIB_BASE / 2, T - 0.01],
    [c + RIB_TOP / 2, T + RIB_HEIGHT],
    [c - RIB_TOP / 2, T + RIB_HEIGHT],
  ];
  for (let i = tile.cx; i <= tile.cx + tile.nx; i++) parts.push(prismY(k, s, profile(gridLineX(g, i) - b.x0), -1, d + 2));
  for (let j = tile.cy; j <= tile.cy + tile.ny; j++) parts.push(prismX(k, s, profile(gridLineY(g, j) - b.y0), -1, w + 2));
  const all = s.track(k.Manifold.union(parts));
  return s.track(all.intersect(box(k, s, 0, 0, 0, w, d, T + RIB_HEIGHT + 1)));
}

/**
 * Nuten im Modulboden. Das Modul liegt mit seiner linken vorderen Ecke im
 * Ursprung, um c/2 von der ersten Rasterlinie versetzt.
 */
export function buildGrooves(
  k: ManifoldToplevel,
  s: Scope,
  width: number,
  depth: number,
  cellX: number,
  cellY: number,
  g: GridInfo,
): Manifold {
  const c = g.clearance;
  const B = RIB_BASE + 2 * c + 0.2;
  const Tp = RIB_TOP + 2 * c + 0.2;
  const Hg = RIB_HEIGHT + c;
  const profile = (x: number): [number, number][] => [
    [x - B / 2, -1],
    [x + B / 2, -1],
    [x + B / 2, 0],
    [x + Tp / 2, Hg],
    [x - Tp / 2, Hg],
    [x - B / 2, 0],
  ];
  const parts: Manifold[] = [];
  const nx = Math.round((width + c) / cellX);
  const ny = Math.round((depth + c) / cellY);
  for (let i = 0; i <= nx; i++) parts.push(prismY(k, s, profile(-c / 2 + i * cellX), -1, depth + 2));
  for (let j = 0; j <= ny; j++) parts.push(prismX(k, s, profile(-c / 2 + j * cellY), -1, width + 2));
  return s.track(k.Manifold.union(parts));
}
