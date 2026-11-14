/**
 * Stückliste der druckbaren Teile, Zukaufteile und Platzierung in der Vorschau.
 *
 * Ein Modul kann mehrere STL-Dateien erzeugen: das Modul selbst, einen Deckel,
 * Schrift-Einleger (für Mehrfarbdruck), separate Trenner – dazu kommen die
 * Kacheln der Grundplatte.
 */
import { dividerTotal, floorZ, lidAllowed, lidInfo, labelSides } from './dimensions';
import { BED_MARGIN } from './printers';
import { cardTrayLayout, computeLayout, gridBoxLayout, moduleSize } from './layout';
import type { BaseplateTile, CardTrayModule, HardwareItem, InsertModule, PartSpec, PlacedInstance, Project } from './types';

export const TAB_VARIANT_NAMES = ['links', 'Mitte', 'rechts'] as const;

export function hasSeparateDividers(m: InsertModule): m is CardTrayModule {
  return m.type === 'cardTray' && m.orientation === 'standing' && m.dividerMode !== 'fixed' && dividerTotal(m) > 0;
}

/** Beschriftete Trenner (nicht leere Einträge). */
export function dividerLabelList(m: CardTrayModule): string[] {
  return m.dividerLabels.map((s) => s.trim()).filter((s) => s !== '');
}

/** Anzahl der Trenner pro Laschen-Variante (Index 0..2) für ein Modul ohne Einzelbeschriftung. */
export function dividerVariantCounts(m: CardTrayModule): number[] {
  const n = dividerTotal(m);
  if (!m.tab || !m.tabStaggered) return [n];
  const counts = [0, 0, 0];
  for (let i = 0; i < n; i++) counts[i % 3]++;
  return counts;
}

/** Laschenposition einer Variante (0 = links, 1 = Mitte, 2 = rechts) bzw. Mitte ohne Versatz. */
export function tabPosition(m: CardTrayModule, variant: number): number {
  return m.tabStaggered ? variant : 1;
}

/** Beschriftungstext eines Moduls. */
export function labelText(m: InsertModule): string {
  return (m.label.text.trim() || m.name).trim();
}

export function hasLid(m: InsertModule): boolean {
  return lidAllowed(m) && m.lid !== 'none';
}

export function hasBodyLabel(m: InsertModule): boolean {
  const s = labelSides(m);
  return labelText(m) !== '' && (s.front || s.back || s.left || s.right);
}

export function hasLidLabel(m: InsertModule): boolean {
  return hasLid(m) && m.label.onLid && labelText(m) !== '';
}

// ---------------------------------------------------------------------------
// Grundplatte

/** Zerlegt die Grundplatte in Kacheln, die aufs Druckbett passen. */
export function baseplateTiles(p: Project): BaseplateTile[] {
  const c = p.print.clearance;
  const X0 = c / 2;
  const X1 = p.box.innerWidth - c / 2;
  const Y0 = c / 2;
  const Y1 = p.box.innerDepth - c / 2;
  const maxX = Math.max(20, p.print.bedX - BED_MARGIN);
  const maxY = Math.max(20, p.print.bedY - BED_MARGIN);
  const nx = Math.max(1, Math.ceil((X1 - X0 - 1e-6) / maxX));
  const ny = Math.max(1, Math.ceil((Y1 - Y0 - 1e-6) / maxY));
  const tiles: BaseplateTile[] = [];
  const sx = (X1 - X0) / nx;
  const sy = (Y1 - Y0) / ny;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      tiles.push({
        index: tiles.length,
        x0: X0 + i * sx + (i > 0 ? c / 4 : 0),
        x1: X0 + (i + 1) * sx - (i < nx - 1 ? c / 4 : 0),
        y0: Y0 + j * sy + (j > 0 ? c / 4 : 0),
        y1: Y0 + (j + 1) * sy - (j < ny - 1 ? c / 4 : 0),
      });
    }
  return tiles;
}

/** Module, die direkt auf der Grundplatte stehen (für die Rippen). */
export function groundInstances(p: Project, layout: PlacedInstance[] = computeLayout(p)): PlacedInstance[] {
  const z = floorZ(p);
  return layout.filter((i) => Math.abs(i.z - z) < 0.01 && i.x < p.box.innerWidth && i.y < p.box.innerDepth);
}

// ---------------------------------------------------------------------------

export function listParts(p: Project): PartSpec[] {
  const parts: PartSpec[] = [];
  for (const m of p.modules) {
    parts.push({ id: m.id, kind: 'module', moduleId: m.id, name: m.name, quantity: m.quantity });
    if (hasBodyLabel(m)) {
      parts.push({
        id: `${m.id}:inlay`,
        kind: 'inlay',
        moduleId: m.id,
        name: `${m.name} Schrift`,
        quantity: m.quantity,
        note: 'Schrift-Einleger: im Slicer zusammen mit dem Modul als ein Objekt laden und andere Farbe zuweisen',
      });
    }
    if (hasLid(m)) {
      parts.push({ id: `${m.id}:lid`, kind: 'lid', moduleId: m.id, name: `${m.name} Deckel`, quantity: m.quantity });
      if (hasLidLabel(m)) {
        parts.push({
          id: `${m.id}:lidInlay`,
          kind: 'lidInlay',
          moduleId: m.id,
          name: `${m.name} Deckel Schrift`,
          quantity: m.quantity,
          note: 'Schrift-Einleger für den Deckel (andere Farbe)',
        });
      }
    }
    if (hasSeparateDividers(m)) {
      const labels = dividerLabelList(m);
      const raised = `Farbwechsel bei ${m.dividerPlateThickness.toFixed(1).replace('.', ',')} mm`;
      if (labels.length > 0) {
        labels.forEach((text, i) => {
          const nr = String(i + 1).padStart(2, '0');
          parts.push({
            id: `${m.id}:div:L${i}`,
            kind: 'divider',
            moduleId: m.id,
            variant: m.tabStaggered ? i % 3 : 1,
            text,
            name: `${m.name} Trenner ${nr} ${text}`,
            quantity: m.quantity,
            note: raised,
          });
        });
      } else {
        const counts = dividerVariantCounts(m);
        counts.forEach((count, v) => {
          if (count === 0) return;
          const suffix = counts.length > 1 ? ` ${TAB_VARIANT_NAMES[v]}` : '';
          parts.push({
            id: `${m.id}:div:${v}`,
            kind: 'divider',
            moduleId: m.id,
            variant: counts.length > 1 ? v : 1,
            name: `${m.name} Trenner${suffix}`,
            quantity: count * m.quantity,
          });
        });
      }
    }
  }
  if (p.baseplate.enabled && p.modules.length > 0) {
    const tiles = baseplateTiles(p);
    for (const tile of tiles) {
      const suffix = tiles.length > 1 ? ` ${String.fromCharCode(65 + tile.index)}` : '';
      parts.push({ id: `baseplate:${tile.index}`, kind: 'baseplate', tile, name: `Grundplatte${suffix}`, quantity: 1 });
    }
  }
  return parts;
}

/** Zukaufteile (Magnete, Scharnierstifte). */
export function listHardware(p: Project): HardwareItem[] {
  const map = new Map<string, number>();
  const add = (name: string, n: number) => map.set(name, (map.get(name) ?? 0) + n);
  for (const m of p.modules) {
    if (!hasLid(m)) continue;
    if (m.lid === 'magnet') {
      const d = String(m.magnetDiameter).replace('.', ',');
      const h = String(m.magnetHeight).replace('.', ',');
      add(`Scheibenmagnet ${d} × ${h} mm (Neodym)`, 8 * m.quantity);
    }
    if (m.lid === 'hinge') {
      const s = moduleSize(m, p);
      add(`Filamentstück 1,75 mm als Scharnierstift (je ca. ${Math.round(s.width)} mm)`, m.quantity);
    }
  }
  return [...map].map(([name, quantity]) => ({ name, quantity }));
}

// ---------------------------------------------------------------------------
// Platzierung in der 3D-Vorschau

/** Lokale Transformation innerhalb eines Moduls (Druckkoordinaten → Einbaulage). */
export interface LocalTransform {
  x: number;
  y: number;
  z: number;
  /** Drehung um X in Grad. */
  rx: number;
}

export interface ScenePlacement {
  key: string;
  partId: string;
  moduleId?: string;
  level: number;
  /** Position der Modulkopie (linke vordere untere Ecke des Footprints). */
  x: number;
  y: number;
  z: number;
  rotated: boolean;
  /** Footprint-Breite (für die Drehung). */
  width: number;
  local?: LocalTransform;
}

/** Wie der gedruckte Deckel auf dem Modul sitzt. */
export function lidTransform(m: InsertModule, p: Project): LocalTransform {
  const s = moduleSize(m, p);
  const lid = lidInfo(m, p);
  if (m.lid === 'slide') return { x: 0, y: 0, z: s.height - lid.plate, rx: 0 };
  // Alle anderen Deckel werden umgedreht gedruckt (Oberseite auf dem Druckbett).
  return { x: 0, y: s.depth, z: s.height, rx: 180 };
}

export function scenePlacements(p: Project, layout: PlacedInstance[]): ScenePlacement[] {
  const out: ScenePlacement[] = [];
  const byId = new Map(p.modules.map((m) => [m.id, m]));
  for (const inst of layout) {
    const m = byId.get(inst.moduleId);
    if (!m) continue;
    const base = { moduleId: m.id, level: inst.level, x: inst.x, y: inst.y, z: inst.z, rotated: inst.rotated, width: inst.width };
    const k = `${m.id}#${inst.copyIndex}`;
    out.push({ key: k, partId: m.id, ...base });
    if (hasBodyLabel(m)) out.push({ key: `${k}:inlay`, partId: `${m.id}:inlay`, ...base });
    if (hasLid(m)) {
      const t = lidTransform(m, p);
      out.push({ key: `${k}:lid`, partId: `${m.id}:lid`, ...base, local: t });
      if (hasLidLabel(m)) out.push({ key: `${k}:lidInlay`, partId: `${m.id}:lidInlay`, ...base, local: t });
    }
    if (hasSeparateDividers(m)) {
      const l = cardTrayLayout(m, p);
      const labels = dividerLabelList(m);
      const counts = dividerVariantCounts(m);
      const total = dividerTotal(m);
      const tiltDeg = (l.tilt * 180) / Math.PI;
      let idx = 0;
      for (let r = 0; r < l.rows; r++) {
        for (let j = 0; j < l.rowDividers && idx < total; j++, idx++) {
          const partId = labels.length > 0 ? `${m.id}:div:L${idx}` : `${m.id}:div:${counts.length > 1 ? idx % 3 : 0}`;
          const ys = l.cavityY + ((j + 1) * l.cavityLength) / (l.rowDividers + 1);
          out.push({
            key: `${k}:div:${idx}`,
            partId,
            ...base,
            // Platte liegt in XY (Dicke in Z) und wird um (90° − Neigung) aufgestellt.
            local: { x: l.rowX[r] + p.print.clearance, y: ys, z: l.floor, rx: 90 - tiltDeg },
          });
        }
      }
    }
  }
  if (p.baseplate.enabled && p.modules.length > 0) {
    for (const t of baseplateTiles(p)) {
      out.push({ key: `baseplate#${t.index}`, partId: `baseplate:${t.index}`, level: 0, x: t.x0, y: t.y0, z: 0, rotated: false, width: t.x1 - t.x0 });
    }
  }
  return out;
}

/** Für Tests und Prüfungen: Fächer einer Box (Kurzform). */
export function boxCells(m: InsertModule, p: Project) {
  return m.type === 'gridBox' ? gridBoxLayout(m, p).cells : [];
}
