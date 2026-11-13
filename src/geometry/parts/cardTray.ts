/**
 * Kartenfach mit festen Fächern.
 *
 * Aufbau: massiver Quader, aus dem die Fächer ausgeschnitten werden. Zwischen
 * den Fächern bleiben Trennwände stehen. Optional wird eine U-förmige
 * Griffmulde eingeschnitten.
 */
import { cardTrayLayout } from '../dimensions';
import type { ManifoldToplevel, Manifold, Scope } from '../kernel';
import { box, uNotch } from '../primitives';
import type { BoxSettings, CardTrayModule, PrintSettings } from '../types';

export function buildCardTray(
  k: ManifoldToplevel,
  s: Scope,
  m: CardTrayModule,
  print: PrintSettings,
  boxSettings: BoxSettings,
): Manifold {
  const l = cardTrayLayout(m, print, boxSettings);
  const wall = print.wallThickness;
  const div = print.dividerThickness;
  const floor = print.floorThickness;
  const slots = Math.max(1, Math.round(m.slots));
  const H = l.height;
  const cutH = H - floor + 1; // Schneidkörper ragen über die Oberkante.

  const outer = box(k, s, 0, 0, 0, l.width, l.depth, H);
  const cutters: Manifold[] = [];

  for (let i = 0; i < slots; i++) {
    if (m.orientation === 'standing') {
      const y = wall + i * (l.slotInnerY + div);
      cutters.push(box(k, s, wall, y, floor, l.slotInnerX, l.slotInnerY, cutH));
    } else {
      const x = wall + i * (l.slotInnerX + div);
      cutters.push(box(k, s, x, wall, floor, l.slotInnerX, l.slotInnerY, cutH));
    }
  }

  if (m.fingerCutout) {
    if (m.orientation === 'standing') {
      // Mulde quer durch alle Trennwände (entlang Y), mittig in X:
      // Kartenstapel lässt sich vorne und hinten greifen.
      const width = Math.min(30, l.slotInnerX * 0.45);
      const depth = Math.min(H * 0.6, H - floor - 2);
      if (width > 4 && depth > width / 2) {
        cutters.push(uNotch(k, s, 'y', l.width / 2, -1, l.depth + 2, width, H - depth, H));
      }
    } else {
      // Daumenmulde in der Vorderwand jedes Fachs.
      const width = Math.min(25, l.slotInnerX * 0.4);
      const bottom = floor + 1;
      if (width > 4 && H - bottom > width / 2) {
        for (let i = 0; i < slots; i++) {
          const cx = wall + i * (l.slotInnerX + div) + l.slotInnerX / 2;
          cutters.push(uNotch(k, s, 'y', cx, -1, wall + 2, width, bottom, H));
        }
      }
    }
  }

  const cut = s.track(k.Manifold.union(cutters));
  return s.track(outer.subtract(cut));
}
