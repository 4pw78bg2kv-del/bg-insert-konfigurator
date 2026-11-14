/**
 * Füllgrad und Spielraum: Wie voll ist die Schachtel, und welche Module können
 * beim Transport rutschen oder springen?
 *
 * Für jede platzierte Kopie wird bestimmt, wie weit sie sich nach links, rechts,
 * vorne, hinten und oben bewegen kann, bevor sie an eine Schachtelwand, an ein
 * anderes Modul oder an den Kopfraum (Bücher, Spielplan) stößt. Module mit mehr
 * Spielraum als `LOOSE_LIMIT` gelten als lose.
 */
import { floorZ, usableHeight } from './dimensions';
import type { PlacedInstance, Project } from './types';

/** Ab diesem Spielraum (mm) gilt ein Modul als lose. */
export const LOOSE_LIMIT = 3;

export type Direction = 'left' | 'right' | 'front' | 'back' | 'up';

export const DIRECTION_LABEL: Record<Direction, string> = {
  left: 'nach links',
  right: 'nach rechts',
  front: 'nach vorne',
  back: 'nach hinten',
  up: 'nach oben',
};

export interface InstanceFreedom {
  instance: PlacedInstance;
  free: Record<Direction, number>;
}

export interface FillReport {
  /** Belegtes Volumen / nutzbares Volumen (0..1). */
  fill: number;
  /** Nutzbares Volumen (Innenraum ohne Kopfraum) in mm³. */
  total: number;
  /** Von Modulen belegtes Volumen in mm³. */
  used: number;
  instances: InstanceFreedom[];
  /** Kopien, die sich in mindestens eine Richtung mehr als `LOOSE_LIMIT` bewegen können. */
  loose: { instance: PlacedInstance; dir: Direction; gap: number }[];
}

const EPS = 1e-6;

const overlap1 = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > 0.01;

export function fillReport(p: Project, layout: PlacedInstance[]): FillReport {
  const W = p.box.innerWidth;
  const D = p.box.innerDepth;
  const top = usableHeight(p.box);
  const z0 = floorZ(p);
  const total = Math.max(EPS, W * D * Math.max(0, top - z0));
  let used = 0;
  const instances: InstanceFreedom[] = [];
  for (const a of layout) {
    const ax1 = a.x + a.width;
    const ay1 = a.y + a.depth;
    const az1 = a.z + a.height;
    // Nur der Teil innerhalb der Schachtel zählt.
    const cw = Math.max(0, Math.min(W, ax1) - Math.max(0, a.x));
    const cd = Math.max(0, Math.min(D, ay1) - Math.max(0, a.y));
    const ch = Math.max(0, Math.min(top, az1) - Math.max(z0, a.z));
    used += cw * cd * ch;
    const free: Record<Direction, number> = { left: a.x, right: W - ax1, front: a.y, back: D - ay1, up: Math.max(0, top - az1) };
    for (const b of layout) {
      if (b === a) continue;
      const bx1 = b.x + b.width;
      const by1 = b.y + b.depth;
      const bz1 = b.z + b.height;
      const zs = overlap1(a.z, az1, b.z, bz1);
      const ys = overlap1(a.y, ay1, b.y, by1);
      const xs = overlap1(a.x, ax1, b.x, bx1);
      if (zs && ys) {
        if (bx1 <= a.x + 0.01) free.left = Math.min(free.left, a.x - bx1);
        if (b.x >= ax1 - 0.01) free.right = Math.min(free.right, b.x - ax1);
      }
      if (zs && xs) {
        if (by1 <= a.y + 0.01) free.front = Math.min(free.front, a.y - by1);
        if (b.y >= ay1 - 0.01) free.back = Math.min(free.back, b.y - ay1);
      }
      if (xs && ys && b.z >= az1 - 0.01) free.up = Math.min(free.up, b.z - az1);
    }
    for (const k of Object.keys(free) as Direction[]) free[k] = Math.max(0, free[k]);
    instances.push({ instance: a, free });
  }
  const loose: FillReport['loose'] = [];
  for (const { instance, free } of instances) {
    const worst = (Object.keys(free) as Direction[]).reduce((best, k) => (free[k] > free[best] ? k : best), 'left' as Direction);
    if (free[worst] > LOOSE_LIMIT) loose.push({ instance, dir: worst, gap: free[worst] });
  }
  return { fill: Math.min(1, used / total), total, used, instances, loose };
}
