/**
 * Schrift für die 3D-Beschriftung: wandelt Text mit einer typeface.json-Schrift
 * in Polygone um (Kurven werden fein unterteilt). Reines TypeScript; die
 * Schriftdateien werden bei Bedarf nachgeladen.
 */
import type { FontId } from './types';
import type { Pt } from './shapes';

interface Glyph {
  ha: number;
  o: string;
}

export interface FontData {
  familyName: string;
  resolution: number;
  ascender: number;
  descender: number;
  glyphs: Record<string, Glyph>;
}

export const FONTS: readonly { id: FontId; label: string }[] = [
  { id: 'sans', label: 'Droid Sans Bold (serifenlos, empfohlen)' },
  { id: 'optimer', label: 'Optimer Bold (elegant)' },
  { id: 'serif', label: 'Droid Serif Bold (mit Serifen)' },
];

const loaders: Record<FontId, () => Promise<{ default: unknown }>> = {
  sans: () => import('./fonts/sans.json'),
  serif: () => import('./fonts/serif.json'),
  optimer: () => import('./fonts/optimer.json'),
};

const loaded = new Map<FontId, FontData>();

export async function loadFont(id: FontId): Promise<FontData> {
  const hit = loaded.get(id);
  if (hit) return hit;
  const mod = await loaders[id]();
  const data = mod.default as FontData;
  loaded.set(id, data);
  return data;
}

export async function loadAllFonts(): Promise<void> {
  await Promise.all(FONTS.map((f) => loadFont(f.id)));
}

export function getFont(id: FontId): FontData {
  const f = loaded.get(id) ?? loaded.get('sans');
  if (!f) throw new Error('Schrift noch nicht geladen');
  return f;
}

export function fontLoaded(id: FontId): boolean {
  return loaded.has(id);
}

/** Versalhöhe in Schrifteinheiten (Höhe des „H“). */
function capHeight(font: FontData): number {
  const g = font.glyphs.H;
  if (!g) return font.ascender * 0.7;
  const nums = g.o.split(/\s+/).filter((t) => t && !/[a-z]/.test(t)).map(Number);
  let max = 0;
  for (let i = 1; i < nums.length; i += 2) max = Math.max(max, nums[i]);
  return max || font.ascender * 0.7;
}

function glyphContours(g: Glyph, scale: number, ox: number, oy: number): Pt[][] {
  const t = g.o.split(/\s+/).filter(Boolean);
  const contours: Pt[][] = [];
  let cur: Pt[] = [];
  let x = 0;
  let y = 0;
  const P = (a: number, b: number): Pt => [ox + a * scale, oy + b * scale];
  for (let i = 0; i < t.length; ) {
    const cmd = t[i++];
    if (cmd === 'm') {
      if (cur.length > 2) contours.push(cur);
      x = +t[i++];
      y = +t[i++];
      cur = [P(x, y)];
    } else if (cmd === 'l') {
      x = +t[i++];
      y = +t[i++];
      cur.push(P(x, y));
    } else if (cmd === 'q') {
      const ex = +t[i++], ey = +t[i++], cx = +t[i++], cy = +t[i++];
      for (let s = 1; s <= 6; s++) {
        const u = s / 6;
        const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
        cur.push(P(a * x + b * cx + c * ex, a * y + b * cy + c * ey));
      }
      x = ex;
      y = ey;
    } else if (cmd === 'b') {
      const ex = +t[i++], ey = +t[i++], c1x = +t[i++], c1y = +t[i++], c2x = +t[i++], c2y = +t[i++];
      for (let s = 1; s <= 8; s++) {
        const u = s / 8;
        const a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, c = 3 * (1 - u) * u * u, d = u ** 3;
        cur.push(P(a * x + b * c1x + c * c2x + d * ex, a * y + b * c1y + c * c2y + d * ey));
      }
      x = ex;
      y = ey;
    } else if (cmd === 'z') {
      // Kontur schließen (implizit)
    }
  }
  if (cur.length > 2) contours.push(cur);
  return contours.map(cleanContour).filter((c) => c.length >= 3);
}

function cleanContour(c: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of c) {
    const l = out[out.length - 1];
    if (!l || Math.hypot(l[0] - p[0], l[1] - p[1]) > 1e-3) out.push(p);
  }
  while (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-3) out.pop();
  return out;
}

export interface TextShape {
  /** Konturen je Zeichen (gerade/ungerade Füllregel innerhalb eines Zeichens). */
  glyphs: Pt[][][];
  width: number;
  /** Versalhöhe (Grundlinie bei y = 0). */
  height: number;
  /** Tiefster Punkt (Unterlängen, negativ). */
  descent: number;
}

/** Textumriss mit Versalhöhe `height`, Grundlinie bei y = 0, links bei x = 0. */
export function textShape(text: string, fontId: FontId, height: number): TextShape {
  const font = getFont(fontId);
  const scale = height / capHeight(font);
  const glyphs: Pt[][][] = [];
  let x = 0;
  let minY = 0;
  for (const ch of text) {
    const g = font.glyphs[ch] ?? font.glyphs['?'];
    if (!g) continue;
    if (g.o) {
      const cs = glyphContours(g, scale, x, 0);
      if (cs.length) {
        glyphs.push(cs);
        for (const c of cs) for (const p of c) minY = Math.min(minY, p[1]);
      }
    }
    x += g.ha * scale;
  }
  return { glyphs, width: x, height, descent: minY };
}

/** Breite eines Textes bei Versalhöhe 1 (für die automatische Schriftgröße). */
export function textWidthPerHeight(text: string, fontId: FontId): number {
  const font = getFont(fontId);
  const scale = 1 / capHeight(font);
  let w = 0;
  for (const ch of text) w += (font.glyphs[ch] ?? font.glyphs['?'])?.ha ?? 0;
  return w * scale;
}

/**
 * Schriftgröße, damit der Text in ein Feld passt (Versalhöhe; Unterlängen
 * brauchen zusätzlich etwa 25 %).
 */
export function fitTextHeight(text: string, fontId: FontId, maxW: number, maxH: number, wanted = 0): number {
  const per = textWidthPerHeight(text, fontId) || 1;
  const byWidth = maxW / per;
  const byHeight = maxH / 1.3;
  const auto = Math.min(byWidth, byHeight);
  return wanted > 0 ? Math.min(wanted, byWidth) : auto;
}
