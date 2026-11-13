/**
 * Kleine Bausteine für die Modul-Geometrie.
 */
import type { ManifoldToplevel, Manifold, Scope } from './kernel';

/** Quader mit linker vorderer unterer Ecke bei (x, y, z). */
export function box(
  k: ManifoldToplevel,
  s: Scope,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
): Manifold {
  return s.track(s.track(k.Manifold.cube([w, d, h], false)).translate([x, y, z]));
}

/**
 * U-förmige Griffmulde, die entlang einer Achse durch das Teil geschnitten wird.
 * Unten halbrund, oben offen bis über die Oberkante.
 *
 * @param axis Achse, entlang der geschnitten wird ('x' oder 'y').
 * @param center Mittelpunkt der Mulde quer zur Schnittachse.
 * @param from Startkoordinate entlang der Schnittachse.
 * @param length Länge entlang der Schnittachse.
 * @param width Breite der Mulde.
 * @param bottomZ Tiefster Punkt der Mulde.
 * @param topZ Oberkante (Schneidkörper ragt 1 mm darüber hinaus).
 */
export function uNotch(
  k: ManifoldToplevel,
  s: Scope,
  axis: 'x' | 'y',
  center: number,
  from: number,
  length: number,
  width: number,
  bottomZ: number,
  topZ: number,
): Manifold {
  const r = width / 2;
  const segments = 48;
  const cylZ = bottomZ + r;
  const parts: Manifold[] = [];
  // Zylinder entlang Z erzeugen und in die Schnittachse drehen.
  const cyl = s.track(k.Manifold.cylinder(length, r, r, segments, false));
  if (axis === 'y') {
    parts.push(s.track(s.track(cyl.rotate([-90, 0, 0])).translate([center, from, cylZ])));
    if (topZ + 1 > cylZ) parts.push(box(k, s, center - r, from, cylZ, width, length, topZ + 1 - cylZ));
  } else {
    parts.push(s.track(s.track(cyl.rotate([0, 90, 0])).translate([from, center, cylZ])));
    if (topZ + 1 > cylZ) parts.push(box(k, s, from, center - r, cylZ, length, width, topZ + 1 - cylZ));
  }
  return s.track(k.Manifold.union(parts));
}
