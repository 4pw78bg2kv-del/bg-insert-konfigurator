/**
 * Explosionszeichnung und Einräum-Anleitung (SVG/HTML) für den Export.
 *
 * Die Module werden als isometrische Quader gezeichnet (von vorne links oben),
 * mit Fächern bzw. Taschen auf der Oberseite, nach Stapelstufen auseinander-
 * gezogen und in Einräum-Reihenfolge nummeriert.
 */
import { floorZ, usableHeight } from './dimensions';
import { gridBoxLayout, cardTrayLayout, shapeBoxLayout } from './layout';
import { listHardware, listParts } from './parts';
import { fileNameFor, uniqueFileNames } from './project';
import type { Pt } from './shapes';
import type { InsertModule, PlacedInstance, Project } from './types';

export const ASSEMBLY_PALETTE = ['#e08a3c', '#4f9dde', '#6cbf6a', '#c770c9', '#e0c23c', '#5ac7c0', '#e0605c', '#9a8cf0'];

const R = [1 / Math.SQRT2, -1 / Math.SQRT2, 0];
const U = [1 / Math.sqrt(6), 1 / Math.sqrt(6), 2 / Math.sqrt(6)];
const F = [1 / Math.sqrt(3), 1 / Math.sqrt(3), -1 / Math.sqrt(3)];
type V3 = [number, number, number];
const proj = (p: V3): Pt => [p[0] * R[0] + p[1] * R[1] + p[2] * R[2], -(p[0] * U[0] + p[1] * U[1] + p[2] * U[2])];
const depthOf = (p: V3) => p[0] * F[0] + p[1] * F[1] + p[2] * F[2];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');

export interface NumberedInstance extends PlacedInstance {
  nr: number;
  name: string;
  color: string;
}

/** Einräum-Reihenfolge: von unten nach oben, hinten vor vorne, links vor rechts. */
export function packingOrder(p: Project, layout: PlacedInstance[]): NumberedInstance[] {
  const idx = new Map(p.modules.map((m, i) => [m.id, i]));
  const byId = new Map(p.modules.map((m) => [m.id, m]));
  return [...layout]
    .sort((a, b) => a.z - b.z || a.level - b.level || b.y - a.y || a.x - b.x)
    .map((inst, i) => ({
      ...inst,
      nr: i + 1,
      name: byId.get(inst.moduleId)?.name ?? 'Modul',
      color: ASSEMBLY_PALETTE[(idx.get(inst.moduleId) ?? 0) % ASSEMBLY_PALETTE.length],
    }));
}

/** Lage in Worten, z. B. „hinten links“. */
export function positionText(p: Project, i: PlacedInstance): string {
  const cx = (i.x + i.width / 2) / p.box.innerWidth;
  const cy = (i.y + i.depth / 2) / p.box.innerDepth;
  const h = cx < 0.34 ? 'links' : cx > 0.66 ? 'rechts' : 'Mitte';
  const v = cy < 0.34 ? 'vorne' : cy > 0.66 ? 'hinten' : '';
  if (!v) return h === 'Mitte' ? 'Mitte' : `Mitte ${h}`;
  return h === 'Mitte' ? `${v} Mitte` : `${v} ${h}`;
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/** Umrisse auf der Oberseite (Fächer, Kavitäten, Taschen) in Modulkoordinaten. */
function topOutlines(m: InsertModule, p: Project): Pt[][] {
  if (m.type === 'gridBox') {
    return gridBoxLayout(m, p).cells.map((c) => [[c.x, c.y], [c.x + c.w, c.y], [c.x + c.w, c.y + c.d], [c.x, c.y + c.d]] as Pt[]);
  }
  if (m.type === 'cardTray') {
    const l = cardTrayLayout(m, p);
    if (l.orientation === 'standing') return l.rowX.map((x) => [[x, l.cavityY], [x + l.rowInnerX, l.cavityY], [x + l.rowInnerX, l.depth - l.walls.back], [x, l.depth - l.walls.back]] as Pt[]);
    const out: Pt[][] = [];
    for (let r = 0; r < l.rows; r++)
      for (let i = 0; i < l.slots; i++) {
        const x = l.rowX[0] + i * (l.slotInnerX + p.print.dividerThickness);
        const y = l.cavityY + r * (l.slotInnerY + p.print.dividerThickness);
        out.push([[x, y], [x + l.slotInnerX, y], [x + l.slotInnerX, y + l.slotInnerY], [x, y + l.slotInnerY]]);
      }
    return out;
  }
  return shapeBoxLayout(m, p).pockets.map((pk) => pk.outline);
}

interface Drawn {
  inst: NumberedInstance;
  box: { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number };
  style: 'active' | 'ghost';
}

function behind(a: Drawn['box'], b: Drawn['box']): boolean {
  return a.x0 >= b.x1 - 1e-6 || a.y0 >= b.y1 - 1e-6 || a.z1 <= b.z0 + 1e-6;
}

/** Zeichenreihenfolge (Maler-Algorithmus für achsparallele Quader). */
function paintOrder(items: Drawn[]): Drawn[] {
  const n = items.length;
  const done = new Array<boolean>(n).fill(false);
  const out: Drawn[] = [];
  const center = (d: Drawn): V3 => [(d.box.x0 + d.box.x1) / 2, (d.box.y0 + d.box.y1) / 2, (d.box.z0 + d.box.z1) / 2];
  for (let step = 0; step < n; step++) {
    // Kandidat: liegt vor keinem anderen offenen Quader, dafür hinter ihnen
    let pick = -1;
    for (let i = 0; i < n && pick < 0; i++) {
      if (done[i]) continue;
      const blocked = items.some((o, j) => j !== i && !done[j] && behind(o.box, items[i].box) && !behind(items[i].box, o.box));
      if (!blocked) pick = i;
    }
    if (pick < 0) {
      // Zyklus (sollte nicht vorkommen): nach Tiefe
      let best = -Infinity;
      items.forEach((d, i) => {
        if (!done[i] && depthOf(center(d)) > best) {
          best = depthOf(center(d));
          pick = i;
        }
      });
    }
    done[pick] = true;
    out.push(items[pick]);
  }
  return out;
}

export interface AssemblyView {
  /** Zusätzlicher Abstand je Stapelstufe (Explosion). */
  explode: number;
  /** Nur diese Stufen farbig (andere grau), leer = alle. */
  activeLevels?: number[];
  /** Stufen oberhalb weglassen. */
  maxLevel?: number;
  width?: number;
  showBox?: boolean;
}

export function assemblySvg(p: Project, layout: PlacedInstance[], view: AssemblyView): string {
  const order = packingOrder(p, layout);
  const byId = new Map(p.modules.map((m) => [m.id, m]));
  const levels = [...new Set(order.map((o) => o.level))].sort((a, b) => a - b);
  const levelIdx = new Map(levels.map((l, i) => [l, i]));
  const items: Drawn[] = order
    .filter((o) => view.maxLevel === undefined || o.level <= view.maxLevel)
    .map((inst) => {
      const dz = (levelIdx.get(inst.level) ?? 0) * view.explode;
      return {
        inst,
        box: { x0: inst.x, y0: inst.y, z0: inst.z + dz, x1: inst.x + inst.width, y1: inst.y + inst.depth, z1: inst.z + inst.height + dz },
        style: !view.activeLevels || view.activeLevels.length === 0 || view.activeLevels.includes(inst.level) ? 'active' : 'ghost',
      };
    });

  const W = p.box.innerWidth;
  const D = p.box.innerDepth;
  const H = usableHeight(p.box);
  const pts: Pt[] = [];
  const corners = (b: Drawn['box']): V3[] => [
    [b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x1, b.y1, b.z0], [b.x0, b.y1, b.z0],
    [b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1],
  ];
  for (const it of items) for (const c of corners(it.box)) pts.push(proj(c));
  const boxCorners = corners({ x0: 0, y0: 0, z0: 0, x1: W, y1: D, z1: H });
  for (const c of boxCorners) pts.push(proj(c));
  const minX = Math.min(...pts.map((q) => q[0])) - 20;
  const maxX = Math.max(...pts.map((q) => q[0])) + 20;
  const minY = Math.min(...pts.map((q) => q[1])) - 20;
  const maxY = Math.max(...pts.map((q) => q[1])) + 20;
  const vw = maxX - minX;
  const vh = maxY - minY;
  const outW = view.width ?? 760;
  const scale = outW / vw;
  const P = (p3: V3) => {
    const [x, y] = proj(p3);
    return `${((x - minX) * scale).toFixed(1)},${((y - minY) * scale).toFixed(1)}`;
  };
  const poly = (ps: V3[], fill: string, stroke: string, extra = '') => `<polygon points="${ps.map(P).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round" ${extra}/>`;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${outW.toFixed(0)} ${(vh * scale).toFixed(0)}" width="${outW.toFixed(0)}" height="${(vh * scale).toFixed(0)}" font-family="Helvetica, Arial, sans-serif">`);
  // Schachtelboden und hintere Wände (dünn)
  if (view.showBox !== false) {
    const z0 = 0;
    parts.push(poly([[0, 0, z0], [W, 0, z0], [W, D, z0], [0, D, z0]], '#f2ece1', '#b9a27c'));
    parts.push(`<polyline points="${[[0, D, H], [0, D, 0], [W, D, 0], [W, D, H]].map((q) => P(q as V3)).join(' ')}" fill="none" stroke="#b9a27c" stroke-dasharray="4 3"/>`);
    parts.push(`<polyline points="${[[0, 0, H], [0, 0, 0], [0, D, 0], [0, D, H]].map((q) => P(q as V3)).join(' ')}" fill="none" stroke="#b9a27c" stroke-dasharray="4 3"/>`);
    if (floorZ(p) > 0) parts.push(poly([[0, 0, floorZ(p)], [W, 0, floorZ(p)], [W, D, floorZ(p)], [0, D, floorZ(p)]], '#d5d8dc', '#9aa3ad', 'fill-opacity="0.6"'));
  }
  const labels: string[] = [];
  for (const it of paintOrder(items)) {
    const b = it.box;
    const ghost = it.style === 'ghost';
    const base = ghost ? '#d9dce0' : it.inst.color;
    const stroke = ghost ? '#a8adb3' : '#333';
    parts.push(poly([[b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x1, b.y0, b.z1], [b.x0, b.y0, b.z1]], shade(base, 0.85), stroke)); // vorne
    parts.push(poly([[b.x0, b.y0, b.z0], [b.x0, b.y1, b.z0], [b.x0, b.y1, b.z1], [b.x0, b.y0, b.z1]], shade(base, 0.7), stroke)); // links
    parts.push(poly([[b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1]], shade(base, 1.08), stroke)); // oben
    const m = byId.get(it.inst.moduleId);
    if (m) {
      const fp = it.inst;
      const toWorld = ([u, v]: Pt): V3 => (fp.rotated ? [fp.x + fp.width - v, fp.y + u, b.z1] : [fp.x + u, fp.y + v, b.z1]);
      for (const o of topOutlines(m, p)) parts.push(`<polygon points="${o.map((q) => P(toWorld(q))).join(' ')}" fill="${ghost ? '#c9cdd2' : shade(base, 0.78)}" stroke="${stroke}" stroke-width="0.6"/>`);
    }
    if (!ghost) {
      const [cx, cy] = P([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, b.z1]).split(',').map(Number);
      labels.push(`<g><circle cx="${cx}" cy="${cy}" r="11" fill="#fff" stroke="#222" stroke-width="1.5"/><text x="${cx}" y="${cy + 4.5}" text-anchor="middle" font-size="13" font-weight="700" fill="#222">${it.inst.nr}</text></g>`);
    }
  }
  parts.push(...labels);
  parts.push('</svg>');
  return parts.join('');
}

/** Einräum-Anleitung als eigenständige HTML-Seite (druckbar). */
export function assemblyHtml(p: Project, layout: PlacedInstance[]): string {
  const order = packingOrder(p, layout);
  const byId = new Map(p.modules.map((m) => [m.id, m]));
  const levels = [...new Set(order.map((o) => o.level))].sort((a, b) => a - b);
  const specs = listParts(p);
  const names = uniqueFileNames(specs.map((s) => fileNameFor(s.name, s.quantity)));
  const hardware = listHardware(p);
  const explode = Math.max(20, usableHeight(p.box) * 0.35);
  const rows = (lv: number) =>
    order
      .filter((o) => o.level === lv)
      .map((o) => {
        const on = o.supports.map((id) => byId.get(id)?.name).filter(Boolean);
        return `<tr><td class="nr"><span style="background:${o.color}">${o.nr}</span></td><td>${esc(o.name)}</td><td>${esc(positionText(p, o))}${o.rotated ? ', gedreht' : ''}</td><td>${on.length ? `liegt auf ${esc(on.join(', '))}` : 'auf dem Boden'}</td><td>${fmt(o.width)} × ${fmt(o.depth)} × ${fmt(o.height)} mm</td></tr>`;
      })
      .join('');

  const steps = levels
    .map(
      (lv, i) => `
    <section class="step">
      <h2>Schritt ${i + 1}: Stapelstufe ${lv}</h2>
      ${assemblySvg(p, layout, { explode: 0, activeLevels: [lv], maxLevel: lv, width: 620 })}
      <table><thead><tr><th>Nr.</th><th>Modul</th><th>Lage</th><th>Auflage</th><th>Maße</th></tr></thead><tbody>${rows(lv)}</tbody></table>
    </section>`,
    )
    .join('');

  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>${esc(p.name)} – Einräum-Anleitung</title>
<style>
  body { font-family: Helvetica, Arial, sans-serif; color: #222; margin: 24px; max-width: 900px; }
  h1 { margin: 0 0 4px; } h2 { font-size: 17px; margin: 18px 0 8px; }
  .muted { color: #666; font-size: 13px; }
  svg { max-width: 100%; height: auto; display: block; margin: 8px 0; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { border-bottom: 1px solid #ddd; padding: 4px 6px; text-align: left; vertical-align: top; }
  td.nr span { display: inline-block; min-width: 22px; text-align: center; border-radius: 11px; color: #111; font-weight: 700; padding: 1px 4px; }
  .step { page-break-inside: avoid; }
  code { font-size: 12px; }
  @media print { body { margin: 10mm; } .step { page-break-before: always; } }
</style></head><body>
<h1>${esc(p.name)}</h1>
<p class="muted">Schachtel innen ${fmt(p.box.innerWidth)} × ${fmt(p.box.innerDepth)} × ${fmt(p.box.innerHeight)} mm · ${order.length} Module · erstellt mit dem BG-Insert-Konfigurator</p>
<h2>Explosionszeichnung</h2>
<p class="muted">Die Zahlen geben die Reihenfolge beim Einräumen an: zuerst die unterste Lage, jeweils von hinten nach vorne.</p>
${assemblySvg(p, layout, { explode, width: 820 })}
${steps}
<section class="step">
<h2>Druckteile</h2>
<table><thead><tr><th>Datei</th><th>Stück</th><th>Hinweis</th></tr></thead><tbody>
${specs.map((s, i) => `<tr><td><code>${esc(names[i])}</code></td><td>${s.quantity}</td><td>${esc(s.note ?? '')}</td></tr>`).join('')}
</tbody></table>
${hardware.length ? `<h2>Zukaufteile</h2><ul>${hardware.map((h) => `<li>${h.quantity} × ${esc(h.name)}</li>`).join('')}</ul><p class="muted">Magnete: Polung vor dem Einkleben prüfen – alle Magnete im Deckel gleich herum, in der Box entgegengesetzt.</p>` : ''}
</section>
</body></html>`;
}
