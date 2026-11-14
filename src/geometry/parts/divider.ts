/**
 * Separater Kartentrenner mit optionaler Beschriftungslasche und erhabener
 * Schrift (Farbwechsel ab Plattenstärke). Wird flach liegend gedruckt.
 */
import type { ManifoldToplevel, Manifold, Scope } from '../kernel';
import { cardTrayLayout } from '../layout';
import { tabPosition } from '../parts';
import { dedupe, prismZ } from '../primitives';
import { fitTextHeight } from '../text';
import type { CardTrayModule, Project } from '../types';
import { textOnFace } from './common';

interface TabBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export function dividerOutline(m: CardTrayModule, p: Project, variant: number): { pts: [number, number][]; tab: TabBox | null } {
  const l = cardTrayLayout(m, p);
  const w = l.dividerWidth;
  const hb = l.dividerBodyHeight;
  const ch = 1; // Fase an den unteren Ecken
  const pts: [number, number][] = [[ch, 0], [w - ch, 0], [w, ch], [w, hb]];
  let tab: TabBox | null = null;
  if (m.tab && m.tabHeight > 0) {
    const tw = Math.min(w, Math.max(5, (w * m.tabWidthPercent) / 100));
    const pos = tabPosition(m, variant);
    const tx0 = pos === 0 ? 0 : pos === 2 ? w - tw : (w - tw) / 2;
    const tx1 = tx0 + tw;
    const tc = Math.min(2, m.tabHeight / 2, tw / 4);
    pts.push([tx1, hb], [tx1, hb + m.tabHeight - tc], [tx1 - tc, hb + m.tabHeight], [tx0 + tc, hb + m.tabHeight], [tx0, hb + m.tabHeight - tc], [tx0, hb]);
    tab = { x0: tx0, x1: tx1, y0: hb, y1: hb + m.tabHeight };
  }
  pts.push([0, hb], [0, ch]);
  return { pts: dedupe(pts), tab };
}

export function buildDivider(k: ManifoldToplevel, s: Scope, m: CardTrayModule, p: Project, variant: number, text?: string): Manifold {
  const { pts, tab } = dividerOutline(m, p, variant);
  const T = m.dividerPlateThickness;
  const plate = prismZ(k, s, pts, 0, T);
  if (!text || !tab) return plate;
  // Erhabene Schrift auf der Lasche; reicht der Platz nicht, auch auf den oberen Trennerrand.
  const tw = tab.x1 - tab.x0;
  const h = fitTextHeight(text, p.labels.font, tw - 2.5, tab.y1 - tab.y0 - 1.6);
  const t = textOnFace(k, s, text, p.labels.font, h, [(tab.x0 + tab.x1) / 2, (tab.y0 + tab.y1) / 2 - 0.2, T], [1, 0, 0], [0, 1, 0], [0, 0, 1], -p.labels.raised);
  return t ? s.track(k.Manifold.union([plate, t])) : plate;
}
