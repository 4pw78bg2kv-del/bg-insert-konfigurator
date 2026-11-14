/**
 * Separater Kartentrenner mit optionaler Beschriftungslasche und erhabener
 * Schrift (Farbwechsel ab Plattenstärke). Wird flach liegend gedruckt.
 *
 * Varianten:
 *  - Lasche: schmale Lasche über den Karten (links/Mitte/rechts),
 *  - Hängetrenner: durchgehende Kopfleiste, die links und rechts auf den
 *    Fachwänden aufliegt, mit Griffschlitz in der Mitte. Die Schrift steht
 *    rechts vom Schlitz, bei Platzmangel zweizeilig.
 */
import type { ManifoldToplevel, Manifold, Scope } from '../kernel';
import { cardTrayLayout } from '../layout';
import { tabPosition } from '../parts';
import { dedupe, prismZ } from '../primitives';
import { fitTextHeight } from '../text';
import type { CardTrayModule, FontId, Project } from '../types';
import { textOnFace } from './common';

interface TabBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Griffschlitz eines Hängetrenners: Breite und Unterkante (Mitte des Rundbogens). */
export function headerSlot(w: number, bodyHeight: number): { width: number; bottom: number } {
  const width = Math.min(25, Math.max(10, w * 0.27));
  return { width, bottom: Math.max(width / 2 + 2, bodyHeight * 0.25) };
}

function hangingOutline(w: number, hb: number, ov: number, hh: number): { pts: [number, number][]; tab: TabBox } {
  const ch = 1;
  const tc = Math.min(1.5, hh / 3);
  const slot = headerSlot(w, hb);
  const cx = w / 2;
  const r = slot.width / 2;
  const top = hb + hh;
  const pts: [number, number][] = [[ch, 0], [w - ch, 0], [w, ch], [w, hb], [w + ov, hb], [w + ov, top - tc], [w + ov - tc, top], [cx + r, top]];
  // Rundbogen unten im Schlitz (von rechts über unten nach links)
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const a = -(Math.PI * i) / n;
    pts.push([cx + r * Math.cos(a), slot.bottom + r * Math.sin(a)]);
  }
  pts.push([cx - r, top], [-ov + tc, top], [-ov, top - tc], [-ov, hb], [0, hb], [0, ch]);
  // Schriftfeld rechts vom Schlitz
  return { pts: dedupe(pts), tab: { x0: cx + r, x1: w + ov, y0: hb, y1: top } };
}

export function dividerOutline(m: CardTrayModule, p: Project, variant: number): { pts: [number, number][]; tab: TabBox | null } {
  const l = cardTrayLayout(m, p);
  const w = l.dividerWidth;
  const hb = l.dividerBodyHeight;
  if (l.headerHeight > 0) return hangingOutline(w, hb, l.headerOverhang, l.headerHeight);
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
  // Erhabene Schrift auf der Lasche (bei Platzmangel zweizeilig).
  const lines = labelLines(text, p.labels.font, tab.x1 - tab.x0 - 2.5, tab.y1 - tab.y0 - 1.6);
  const cx = (tab.x0 + tab.x1) / 2;
  const cy = (tab.y0 + tab.y1) / 2 - 0.2;
  const solids: Manifold[] = [];
  lines.lines.forEach((line, i) => {
    const off = ((lines.lines.length - 1) / 2 - i) * lines.height * LINE_PITCH;
    const t = textOnFace(k, s, line, p.labels.font, lines.height, [cx, cy + off, T], [1, 0, 0], [0, 1, 0], [0, 0, 1], -p.labels.raised);
    if (t) solids.push(t);
  });
  return solids.length ? s.track(k.Manifold.union([plate, ...solids])) : plate;
}

/** Zeilenabstand als Vielfaches der Schrifthöhe. */
const LINE_PITCH = 1.4;

/**
 * Teilt eine Beschriftung auf ein oder zwei Zeilen auf – je nachdem, was die
 * größere Schrift ergibt. Getrennt wird am Leerzeichen bzw. Bindestrich nahe der Mitte.
 */
export function labelLines(text: string, font: FontId, maxW: number, maxH: number): { lines: string[]; height: number } {
  const one = fitTextHeight(text, font, maxW, maxH);
  const breaks: number[] = [];
  for (let i = 1; i < text.length - 1; i++) if (text[i] === ' ' || text[i - 1] === '-') breaks.push(i);
  if (breaks.length === 0) return { lines: [text], height: one };
  const mid = text.length / 2;
  const at = breaks.reduce((b, i) => (Math.abs(i - mid) < Math.abs(b - mid) ? i : b), breaks[0]);
  const a = text.slice(0, at).trim();
  const b = text.slice(at).trim();
  const lineH = maxH / (1 + LINE_PITCH);
  const two = Math.min(fitTextHeight(a, font, maxW, lineH), fitTextHeight(b, font, maxW, lineH));
  return two > one * 1.15 ? { lines: [a, b], height: two } : { lines: [text], height: one };
}
