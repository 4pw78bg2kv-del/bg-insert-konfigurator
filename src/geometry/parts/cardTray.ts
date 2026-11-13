/**
 * Kartenfach.
 *
 * Stehend: Die Fächer werden zunächst senkrecht modelliert und danach (bei
 * Neigung) per Scherung schräg gestellt – Trennwände, Zackenmuster und Karten
 * neigen sich dadurch gemeinsam. Varianten:
 *  - `fixed`: mitgedruckte Trennwände,
 *  - `loose`: glatte Wände, separate Trenner,
 *  - `toothed`: Zackenmuster an den Seitenwänden, in dem separate Trenner einrasten.
 * Liegend: Fächer nebeneinander, Daumenmulde in der Vorder-/Rückwand.
 */
import { cardTrayLayout } from '../dimensions';
import type { ManifoldToplevel, Manifold, Scope } from '../kernel';
import { box, cylinderZ, prismX, prismZ, stadiumZ, uNotch } from '../primitives';
import type { CardTrayModule, Project } from '../types';
import { TOOTH_BASE } from '../dimensions';

export function buildCardTray(k: ManifoldToplevel, s: Scope, m: CardTrayModule, p: Project): Manifold {
  const l = cardTrayLayout(m, p);
  const wall = p.print.wallThickness;
  const div = p.print.dividerThickness;
  const floor = l.floor;
  const H = l.height;
  const cutH = l.cavityHeight + 2;

  const outer = box(k, s, 0, 0, 0, l.width, l.depth, H);
  const sheared: Manifold[] = [];
  const straight: Manifold[] = [];

  if (l.orientation === 'standing') {
    const cos = Math.cos(l.tilt);
    for (let r = 0; r < l.rows; r++) {
      const x0 = l.rowX[r];
      if (m.dividerMode === 'fixed') {
        for (let i = 0; i < l.slots; i++) {
          const y = wall + i * (l.slotLength + div / cos);
          sheared.push(box(k, s, x0, y, floor, l.rowInnerX, l.slotLength, cutH));
        }
      } else {
        let cavity = box(k, s, x0, wall, floor, l.rowInnerX, l.cavityLength, cutH);
        if (m.dividerMode === 'toothed') {
          // Dreieckige Rippen an beiden Seitenwänden; dazwischen die Nuten für die Trenner.
          const ridges: Manifold[] = [];
          const td = l.toothDepth;
          const x1 = x0 + l.rowInnerX;
          const groove = l.toothPitch - TOOTH_BASE;
          for (let y = wall + groove; y + TOOTH_BASE <= wall + l.cavityLength - groove / 2 + 1e-6; y += l.toothPitch) {
            const ym = y + TOOTH_BASE / 2;
            ridges.push(prismZ(k, s, [[x0 - 0.01, y], [x0 + td, ym], [x0 - 0.01, y + TOOTH_BASE]], floor - 1, cutH + 2));
            ridges.push(prismZ(k, s, [[x1 + 0.01, y], [x1 + 0.01, y + TOOTH_BASE], [x1 - td, ym]], floor - 1, cutH + 2));
          }
          if (ridges.length) cavity = s.track(cavity.subtract(s.track(k.Manifold.union(ridges))));
        }
        sheared.push(cavity);
      }

      // Griffmulde quer durch alle Wände, mittig in der Reihe
      if (m.fingerCutout !== 'none') {
        const width = Math.min(30, l.cardFaceW * 0.45);
        const bottom = m.fingerCutout === 'toFloor' ? floor : H - Math.min(l.cavityHeight * 0.6, l.cavityHeight - 2);
        if (width > 4 && H - bottom > width / 2) {
          straight.push(uNotch(k, s, 'y', x0 + l.rowInnerX / 2, -1, l.depth + 2, width, bottom, H));
        }
      }

      // Griffloch im Boden
      if (m.floorHole) {
        if (m.dividerMode === 'fixed') {
          const d = Math.min(20, l.slotLength * cos - 3, l.rowInnerX - 6);
          if (d >= 6) {
            for (let i = 0; i < l.slots; i++) {
              const yc = wall + i * (l.slotLength + div / cos) + l.slotLength / 2;
              straight.push(cylinderZ(k, s, x0 + l.rowInnerX / 2, yc, -1, floor + 2, d / 2));
            }
          }
        } else {
          const r = Math.min(10, l.rowInnerX * 0.2, l.cavityLength / 2 - 2);
          if (r >= 3) {
            straight.push(stadiumZ(k, s, x0 + l.rowInnerX / 2, wall + r + 2, wall + l.cavityLength - r - 2, -1, floor + 2, r));
          }
        }
      }
    }
  } else {
    // Liegend: Fächer in X nebeneinander, Reihen in Y
    for (let r = 0; r < l.rows; r++) {
      const y0 = wall + r * (l.slotInnerY + div);
      for (let i = 0; i < l.slots; i++) {
        const x = l.rowX[0] + i * (l.slotInnerX + div);
        sheared.push(box(k, s, x, y0, floor, l.slotInnerX, l.slotInnerY, cutH));
        const cx = x + l.slotInnerX / 2;
        if (m.fingerCutout !== 'none') {
          const width = Math.min(25, l.slotInnerX * 0.4);
          const bottom = m.fingerCutout === 'toFloor' ? floor : floor + l.cavityHeight * 0.4;
          if (width > 4 && H - bottom > width / 2) {
            const front = r === 0;
            straight.push(uNotch(k, s, 'y', cx, front ? -1 : l.depth - wall - 1, wall + 2, width, bottom, H));
          }
        }
        if (m.floorHole) {
          const d = Math.min(25, l.slotInnerX * 0.5, l.slotInnerY * 0.5);
          if (d >= 6) straight.push(cylinderZ(k, s, cx, y0 + l.slotInnerY / 2, -1, floor + 2, d / 2));
        }
      }
    }
  }

  let cut = s.track(k.Manifold.union(sheared));
  if (l.tilt > 0) {
    const tan = Math.tan(l.tilt);
    cut = s.track(cut.warp((v) => {
      v[1] += (v[2] - floor) * tan;
    }));
  }
  if (l.tilt > 0 && l.orientation === 'standing') {
    // Außenflächen vorne und hinten parallel zur Neigung abschrägen: spart die
    // massiven Keile; die hintere Wand neigt sich mit (< 45°, stützfrei).
    const tan = Math.tan(l.tilt);
    const top = H + 1;
    const run = (top - floor) * tan;
    // Leicht nach innen versetzt, damit die Schräge die Oberkante nicht exakt in
    // der Hinterkante trifft (sonst entstehen Splitterkanten).
    const backY = 2 * wall + l.cavityLength - 0.05;
    straight.push(prismX(k, s, [[-1, floor], [0, floor], [run, top], [-1, top]], -1, l.width + 2));
    straight.push(prismX(k, s, [[backY, -1], [l.depth + 1, -1], [l.depth + 1, top], [backY + run, top], [backY, floor]], -1, l.width + 2));
  }
  const all = straight.length ? s.track(k.Manifold.union([cut, ...straight])) : cut;
  return s.track(outer.subtract(all));
}
