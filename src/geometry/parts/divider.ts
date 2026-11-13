/**
 * Separater Kartentrenner mit optionaler Beschriftungslasche.
 * Wird flach liegend gedruckt (Platte in XY, Stärke in Z).
 */
import { cardTrayLayout } from '../dimensions';
import type { ManifoldToplevel, Manifold, Scope } from '../kernel';
import { dedupe, prismZ } from '../primitives';
import { tabPosition } from '../parts';
import type { CardTrayModule, Project } from '../types';

export function dividerOutline(m: CardTrayModule, p: Project, variant: number): [number, number][] {
  const l = cardTrayLayout(m, p);
  const w = l.dividerWidth;
  const hb = l.dividerBodyHeight;
  const ch = 1; // Fase an den unteren Ecken
  const pts: [number, number][] = [[ch, 0], [w - ch, 0], [w, ch], [w, hb]];
  if (m.tab && m.tabHeight > 0) {
    const tw = Math.min(w, Math.max(5, (w * m.tabWidthPercent) / 100));
    const pos = tabPosition(m, variant);
    const tx0 = pos === 0 ? 0 : pos === 2 ? w - tw : (w - tw) / 2;
    const tx1 = tx0 + tw;
    const tc = Math.min(2, m.tabHeight / 2, tw / 4);
    pts.push([tx1, hb], [tx1, hb + m.tabHeight - tc], [tx1 - tc, hb + m.tabHeight], [tx0 + tc, hb + m.tabHeight], [tx0, hb + m.tabHeight - tc], [tx0, hb]);
  }
  pts.push([0, hb], [0, ch]);
  return dedupe(pts);
}

export function buildDivider(k: ManifoldToplevel, s: Scope, m: CardTrayModule, p: Project, variant: number): Manifold {
  return prismZ(k, s, dividerOutline(m, p, variant), 0, m.dividerPlateThickness);
}
