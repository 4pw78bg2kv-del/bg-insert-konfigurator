/**
 * Box mit freier Rastereinteilung (Spalten × Reihen).
 */
import { gridBoxLayout } from '../dimensions';
import type { ManifoldToplevel, Manifold, Scope } from '../kernel';
import { box } from '../primitives';
import type { BoxSettings, GridBoxModule, PrintSettings } from '../types';

export function buildGridBox(
  k: ManifoldToplevel,
  s: Scope,
  m: GridBoxModule,
  print: PrintSettings,
  boxSettings: BoxSettings,
): Manifold {
  const l = gridBoxLayout(m, print, boxSettings);
  const wall = print.wallThickness;
  const div = print.dividerThickness;
  const floor = print.floorThickness;
  const cols = Math.max(1, Math.round(m.columns));
  const rows = Math.max(1, Math.round(m.rows));
  const H = l.height;

  const outer = box(k, s, 0, 0, 0, l.width, l.depth, H);
  const cutters: Manifold[] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x = wall + c * (l.cellX + div);
      const y = wall + r * (l.cellY + div);
      cutters.push(box(k, s, x, y, floor, l.cellX, l.cellY, H - floor + 1));
    }
  }
  // Abgesenkte Trennwände: gesamten Innenraum oberhalb der Absenkhöhe entfernen.
  const lower = Math.min(Math.max(0, m.dividerLowering), H - floor);
  if (lower > 0 && (cols > 1 || rows > 1)) {
    cutters.push(box(k, s, wall, wall, H - lower, l.width - 2 * wall, l.depth - 2 * wall, lower + 1));
  }
  const cut = s.track(k.Manifold.union(cutters));
  return s.track(outer.subtract(cut));
}
