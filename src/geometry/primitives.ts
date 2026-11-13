/**
 * Kleine Bausteine für die Modul-Geometrie.
 */
import type { ManifoldToplevel, Manifold, Scope } from './kernel';

type Pt = [number, number];

/** Quader mit linker vorderer unterer Ecke bei (x, y, z). */
export function box(k: ManifoldToplevel, s: Scope, x: number, y: number, z: number, w: number, d: number, h: number): Manifold {
  return s.track(s.track(k.Manifold.cube([w, d, h], false)).translate([x, y, z]));
}

function extrudePolygon(k: ManifoldToplevel, s: Scope, pts: Pt[], length: number): Manifold {
  const cs = new k.CrossSection([pts], 'NonZero');
  const m = s.track(cs.extrude(length));
  cs.delete();
  return m;
}

/** Prisma mit Profil in der XY-Ebene, extrudiert in Z ab z0. */
export function prismZ(k: ManifoldToplevel, s: Scope, pts: Pt[], z0: number, height: number): Manifold {
  return s.track(extrudePolygon(k, s, pts, height).translate([0, 0, z0]));
}

/** Prisma mit Profil in der XZ-Ebene (Punkte als [x, z]), extrudiert in Y ab y0. */
export function prismY(k: ManifoldToplevel, s: Scope, pts: Pt[], y0: number, length: number): Manifold {
  // Rotation −90° um X bildet (u, v, w) auf (u, w, −v) ab.
  const m = extrudePolygon(k, s, pts.map(([x, z]) => [x, -z] as Pt), length);
  return s.track(s.track(m.rotate([-90, 0, 0])).translate([0, y0, 0]));
}

/** Prisma mit Profil in der YZ-Ebene (Punkte als [y, z]), extrudiert in X ab x0. */
export function prismX(k: ManifoldToplevel, s: Scope, pts: Pt[], x0: number, length: number): Manifold {
  // Rotation 90° um Y bildet (u, v, w) auf (w, v, −u) ab.
  const m = extrudePolygon(k, s, pts.map(([y, z]) => [-z, y] as Pt), length);
  return s.track(s.track(m.rotate([0, 90, 0])).translate([x0, 0, 0]));
}

/** Senkrechter Zylinder (Loch) mit Mittelpunkt (cx, cy). */
export function cylinderZ(k: ManifoldToplevel, s: Scope, cx: number, cy: number, z0: number, h: number, r: number): Manifold {
  return s.track(s.track(k.Manifold.cylinder(h, r, r, 48, false)).translate([cx, cy, z0]));
}

/** Langloch (Stadion) entlang Y von y0 bis y1 mit Radius r. */
export function stadiumZ(
  k: ManifoldToplevel,
  s: Scope,
  cx: number,
  y0: number,
  y1: number,
  z0: number,
  h: number,
  r: number,
): Manifold {
  if (y1 - y0 < 1e-3) return cylinderZ(k, s, cx, y0, z0, h, r);
  return s.track(k.Manifold.hull([cylinderZ(k, s, cx, y0, z0, h, r), cylinderZ(k, s, cx, y1, z0, h, r)]));
}

/**
 * U-förmige Griffmulde, die entlang einer Achse durch das Teil geschnitten wird.
 * Unten halbrund, oben offen bis über die Oberkante.
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
  const cylZ = bottomZ + r;
  const parts: Manifold[] = [];
  const cyl = s.track(k.Manifold.cylinder(length, r, r, 48, false));
  if (axis === 'y') {
    parts.push(s.track(s.track(cyl.rotate([-90, 0, 0])).translate([center, from, cylZ])));
    if (topZ + 1 > cylZ) parts.push(box(k, s, center - r, from, cylZ, width, length, topZ + 1 - cylZ));
  } else {
    parts.push(s.track(s.track(cyl.rotate([0, 90, 0])).translate([from, center, cylZ])));
    if (topZ + 1 > cylZ) parts.push(box(k, s, from, center - r, cylZ, length, width, topZ + 1 - cylZ));
  }
  return s.track(k.Manifold.union(parts));
}

/** Entfernt aufeinanderfolgende doppelte Punkte eines Polygons. */
export function dedupe(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last[0] - p[0]) > 1e-6 || Math.abs(last[1] - p[1]) > 1e-6) out.push(p);
  }
  if (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) out.pop();
  }
  return out;
}
