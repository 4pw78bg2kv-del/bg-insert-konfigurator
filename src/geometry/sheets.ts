/**
 * Druckbare A4-Bögen im Maßstab 1:1: Rasterbogen mit Lineal zum Auslegen
 * der Spielteile und Kartenformate zum Vergleichen.
 */
import { CARD_PRESETS, SLEEVES } from './cards';

const A4W = 210;
const A4H = 297;
const MARGIN = 10;
const fmt = (v: number) => (Math.round(v * 10) / 10).toString().replace('.', ',');

function page(content: string): string {
  return `<section class="page"><svg xmlns="http://www.w3.org/2000/svg" width="${A4W}mm" height="${A4H}mm" viewBox="0 0 ${A4W} ${A4H}" font-family="Helvetica, Arial, sans-serif">${content}</svg></section>`;
}

function ruler(x0: number, y0: number, length: number, horizontal: boolean): string {
  const out: string[] = [];
  out.push(horizontal ? `<line x1="${x0}" y1="${y0}" x2="${x0 + length}" y2="${y0}" stroke="#000" stroke-width="0.25"/>` : `<line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 + length}" stroke="#000" stroke-width="0.25"/>`);
  for (let i = 0; i <= length; i++) {
    const t = i % 10 === 0 ? 4 : i % 5 === 0 ? 2.6 : 1.5;
    if (horizontal) out.push(`<line x1="${x0 + i}" y1="${y0}" x2="${x0 + i}" y2="${y0 + t}" stroke="#000" stroke-width="0.15"/>`);
    else out.push(`<line x1="${x0}" y1="${y0 + i}" x2="${x0 + t}" y2="${y0 + i}" stroke="#000" stroke-width="0.15"/>`);
    if (i % 10 === 0 && i > 0) {
      out.push(horizontal ? `<text x="${x0 + i}" y="${y0 + 7}" font-size="2.6" text-anchor="middle">${i / 10}</text>` : `<text x="${x0 + 5}" y="${y0 + i + 0.9}" font-size="2.6">${i / 10}</text>`);
    }
  }
  return out.join('');
}

/** Rasterbogen: Raster im gewählten Rastermaß, Lineale und Prüfstrecke. */
function gridPage(pitch: number): string {
  const x0 = MARGIN + 8;
  const y0 = MARGIN + 24;
  const w = A4W - x0 - MARGIN;
  const h = A4H - y0 - MARGIN - 14;
  const nx = Math.floor(w / pitch);
  const ny = Math.floor(h / pitch);
  const gw = nx * pitch;
  const gh = ny * pitch;
  const out: string[] = [];
  out.push(`<text x="${MARGIN}" y="${MARGIN + 4}" font-size="5" font-weight="700">Rasterbogen ${fmt(pitch)} mm</text>`);
  out.push(`<text x="${MARGIN}" y="${MARGIN + 9}" font-size="3">Spielteile auflegen und Anordnungen ausprobieren. Ohne Skalierung drucken („Tatsächliche Größe“ / 100 %).</text>`);
  out.push(ruler(x0, y0 - 9, gw, true));
  out.push(ruler(x0 - 8, y0, gh, false));
  for (let i = 0; i <= nx; i++) {
    const major = i % 5 === 0;
    out.push(`<line x1="${x0 + i * pitch}" y1="${y0}" x2="${x0 + i * pitch}" y2="${y0 + gh}" stroke="${major ? '#555' : '#aaa'}" stroke-width="${major ? 0.3 : 0.15}"/>`);
  }
  for (let j = 0; j <= ny; j++) {
    const major = j % 5 === 0;
    out.push(`<line x1="${x0}" y1="${y0 + j * pitch}" x2="${x0 + gw}" y2="${y0 + j * pitch}" stroke="${major ? '#555' : '#aaa'}" stroke-width="${major ? 0.3 : 0.15}"/>`);
  }
  // Prüfstrecke
  const py = A4H - MARGIN - 5;
  out.push(`<line x1="${MARGIN}" y1="${py}" x2="${MARGIN + 100}" y2="${py}" stroke="#000" stroke-width="0.5"/>`);
  out.push(`<line x1="${MARGIN}" y1="${py - 2}" x2="${MARGIN}" y2="${py + 2}" stroke="#000" stroke-width="0.5"/><line x1="${MARGIN + 100}" y1="${py - 2}" x2="${MARGIN + 100}" y2="${py + 2}" stroke="#000" stroke-width="0.5"/>`);
  out.push(`<text x="${MARGIN + 104}" y="${py + 1}" font-size="3">Prüfstrecke: muss genau 100 mm messen</text>`);
  out.push(`<text x="${MARGIN}" y="${A4H - MARGIN + 2}" font-size="2.6" fill="#555">${nx} × ${ny} Rasterfelder · dicke Linien alle 5 Felder (${fmt(5 * pitch)} mm)</text>`);
  return page(out.join(''));
}

/** Kartenformate 1:1 (ohne und mit Standard-Hülle). */
function cardPages(): string[] {
  const items = CARD_PRESETS.map((c) => ({ label: c.label, w: c.width, h: c.height }));
  const pages: string[] = [];
  const x0 = MARGIN;
  const top = MARGIN + 14;
  const maxW = A4W - 2 * MARGIN;
  const maxY = A4H - MARGIN - 6;
  const gap = 6;
  const sl = SLEEVES.standard;
  let out: string[] = [];
  let x = x0;
  let y = top;
  let rowH = 0;
  const header = (n: number) =>
    `<text x="${MARGIN}" y="${MARGIN + 4}" font-size="5" font-weight="700">Kartenformate 1:1${n > 1 ? ` (Seite ${n})` : ''}</text><text x="${MARGIN}" y="${MARGIN + 9}" font-size="3">Karte auflegen: durchgezogen = Karte ohne Hülle, gestrichelt = mit Standard-Hülle (+${fmt(sl.addWidth)} × ${fmt(sl.addHeight)} mm).</text>`;
  out.push(header(1));
  for (const it of items) {
    const w = it.w + sl.addWidth;
    const h = it.h + sl.addHeight;
    if (x + w > x0 + maxW + 1e-6) {
      x = x0;
      y += rowH + gap + 4;
      rowH = 0;
    }
    if (y + h + 4 > maxY) {
      pages.push(page(out.join('')));
      out = [header(pages.length + 1)];
      x = x0;
      y = top;
      rowH = 0;
    }
    const dx = sl.addWidth / 2;
    const dy = sl.addHeight / 2;
    out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#777" stroke-width="0.25" stroke-dasharray="1.5 1" rx="3"/>`);
    out.push(`<rect x="${x + dx}" y="${y + dy}" width="${it.w}" height="${it.h}" fill="none" stroke="#000" stroke-width="0.35" rx="3"/>`);
    out.push(`<text x="${x + w / 2}" y="${y + h / 2 - 1}" font-size="3.2" text-anchor="middle" font-weight="700">${it.label.split(' (')[0]}</text>`);
    out.push(`<text x="${x + w / 2}" y="${y + h / 2 + 3.5}" font-size="2.8" text-anchor="middle">${fmt(it.w)} × ${fmt(it.h)} mm</text>`);
    x += w + gap;
    rowH = Math.max(rowH, h);
  }
  pages.push(page(out.join('')));
  return pages;
}

/** Druckbare HTML-Datei mit Rasterbogen und Kartenformaten. */
export function printSheetsHtml(pitch: number, title = 'Rasterbogen'): string {
  const pages = [gridPage(Math.max(3, pitch)), ...cardPages()];
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; background: #888; }
  .page { width: 210mm; height: 297mm; background: #fff; margin: 10mm auto; overflow: hidden; }
  .page svg { display: block; }
  @media print { html, body { background: #fff; } .page { margin: 0; page-break-after: always; } }
</style></head><body>${pages.join('')}</body></html>`;
}
