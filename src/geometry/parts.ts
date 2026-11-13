/**
 * Stückliste der druckbaren Teile und deren Platzierung in der Vorschau.
 *
 * Ein Modul kann mehrere STL-Dateien erzeugen: das Modul selbst, einen Deckel,
 * separate Trenner (bis zu drei Laschen-Varianten) – dazu kommen die Kacheln
 * der Grundplatte.
 */
import { cardTrayLayout, gridBoxLayout, gridInfo, gridLineX, gridLineY, layerInfos, LID_PLATE, type GridInfo } from './dimensions';
import type { BaseplateTile, CardTrayModule, InsertModule, PartSpec, PlacedInstance, Project } from './types';

export const TAB_VARIANT_NAMES = ['links', 'Mitte', 'rechts'] as const;

export function hasSeparateDividers(m: InsertModule): m is CardTrayModule {
  return m.type === 'cardTray' && m.orientation === 'standing' && m.dividerMode !== 'fixed' && m.dividerCount > 0;
}

/** Anzahl der Trenner pro Laschen-Variante (Index 0..2) für ein Modul. */
export function dividerVariantCounts(m: CardTrayModule): number[] {
  if (!m.tab || !m.tabStaggered) return [m.dividerCount];
  const counts = [0, 0, 0];
  for (let i = 0; i < m.dividerCount; i++) counts[i % 3]++;
  return counts;
}

/** Laschenposition einer Variante (0 = links, 1 = Mitte, 2 = rechts) bzw. Mitte ohne Versatz. */
export function tabPosition(m: CardTrayModule, variant: number): number {
  return m.tabStaggered ? variant : 1;
}

/** Zerlegt die Grundplatte in druckbare Kacheln. */
export function baseplateTiles(p: Project): BaseplateTile[] {
  const g = gridInfo(p);
  const split = (n: number, cell: number) => {
    const maxCells = Math.max(1, Math.floor((p.grid.maxTileSize + p.print.clearance) / cell));
    const count = Math.ceil(n / maxCells);
    const base = Math.floor(n / count);
    const rest = n % count;
    const out: [number, number][] = [];
    let start = 0;
    for (let i = 0; i < count; i++) {
      const len = base + (i < rest ? 1 : 0);
      out.push([start, len]);
      start += len;
    }
    return out;
  };
  const tiles: BaseplateTile[] = [];
  for (const [cy, ny] of split(g.ny, g.cellY)) for (const [cx, nx] of split(g.nx, g.cellX)) tiles.push({ cx, cy, nx, ny });
  return tiles;
}

/** Kachel-Ausdehnung: Ränder zur Schachtel um c/2 eingerückt, Stoßkanten um c/4. */
export function tileBounds(tile: BaseplateTile, g: GridInfo) {
  const c = g.clearance;
  const x0 = gridLineX(g, tile.cx) + (tile.cx === 0 ? c / 2 : c / 4);
  const x1 = gridLineX(g, tile.cx + tile.nx) - (tile.cx + tile.nx === g.nx ? c / 2 : c / 4);
  const y0 = gridLineY(g, tile.cy) + (tile.cy === 0 ? c / 2 : c / 4);
  const y1 = gridLineY(g, tile.cy + tile.ny) - (tile.cy + tile.ny === g.ny ? c / 2 : c / 4);
  return { x0, x1, y0, y1 };
}

function tileKey(t: BaseplateTile, g: GridInfo): string {
  return [t.nx, t.ny, t.cx === 0, t.cx + t.nx === g.nx, t.cy === 0, t.cy + t.ny === g.ny].join('-');
}

export function listParts(p: Project): PartSpec[] {
  const parts: PartSpec[] = [];
  for (const m of p.modules) {
    parts.push({ id: m.id, kind: 'module', moduleId: m.id, name: m.name, quantity: m.quantity });
    if (m.type === 'gridBox' && m.lid === 'snap') {
      parts.push({ id: `${m.id}:lid`, kind: 'lid', moduleId: m.id, name: `${m.name} Deckel`, quantity: m.quantity });
    }
    if (hasSeparateDividers(m)) {
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
  if (p.grid.enabled && p.grid.baseplate && p.layers.length > 0) {
    const g = gridInfo(p);
    const groups = new Map<string, { tile: BaseplateTile; count: number }>();
    for (const t of baseplateTiles(p)) {
      const k = tileKey(t, g);
      const e = groups.get(k);
      if (e) e.count++;
      else groups.set(k, { tile: t, count: 1 });
    }
    let i = 0;
    for (const [k, { tile, count }] of groups) {
      i++;
      const suffix = groups.size > 1 ? ` ${String.fromCharCode(64 + i)}` : '';
      parts.push({
        id: `baseplate:${k}`,
        kind: 'baseplate',
        tile,
        name: `Grundplatte ${tile.nx}x${tile.ny}${suffix}`,
        quantity: count,
      });
    }
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Platzierung in der 3D-Vorschau

/** Lokale Transformation innerhalb eines Moduls (Trenner stehen aufrecht). */
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
  layerId: string;
  /** Position der Modulkopie (linke vordere untere Ecke des Footprints). */
  x: number;
  y: number;
  z: number;
  rotated: boolean;
  /** Footprint-Breite (für die Drehung). */
  width: number;
  local?: LocalTransform;
}

export function scenePlacements(p: Project, layout: PlacedInstance[]): ScenePlacement[] {
  const out: ScenePlacement[] = [];
  const byId = new Map(p.modules.map((m) => [m.id, m]));
  for (const inst of layout) {
    const m = byId.get(inst.moduleId);
    if (!m) continue;
    const base = { moduleId: m.id, layerId: inst.layerId, x: inst.x, y: inst.y, z: inst.z, rotated: inst.rotated, width: inst.width };
    out.push({ key: `${m.id}#${inst.copyIndex}`, partId: m.id, ...base });
    if (m.type === 'gridBox' && m.lid === 'snap') {
      const l = gridBoxLayout(m, p);
      // Deckel wird umgedreht gedruckt: für die Vorschau um 180° um X zurückdrehen.
      out.push({ key: `${m.id}#${inst.copyIndex}:lid`, partId: `${m.id}:lid`, ...base, local: { x: 0, y: l.depth, z: l.height + LID_PLATE, rx: 180 } });
    }
    if (hasSeparateDividers(m)) {
      const l = cardTrayLayout(m, p);
      const counts = dividerVariantCounts(m);
      const tiltDeg = (l.tilt * 180) / Math.PI;
      let idx = 0;
      for (let r = 0; r < l.rows; r++) {
        for (let j = 0; j < l.rowDividers && idx < m.dividerCount; j++, idx++) {
          const v = counts.length > 1 ? idx % 3 : 0;
          const ys = p.print.wallThickness + ((j + 1) * l.cavityLength) / (l.rowDividers + 1);
          out.push({
            key: `${m.id}#${inst.copyIndex}:div:${idx}`,
            partId: `${m.id}:div:${v}`,
            ...base,
            // Platte liegt in XY (Dicke in Z) und wird um (90° − Neigung) aufgestellt.
            local: { x: l.rowX[r] + p.print.clearance, y: ys, z: l.floor, rx: 90 - tiltDeg },
          });
        }
      }
    }
  }
  if (p.grid.enabled && p.grid.baseplate && p.layers.length > 0) {
    const g = gridInfo(p);
    const layer0 = layerInfos(p)[0];
    baseplateTiles(p).forEach((t) => {
      const k = tileKey(t, g);
      const b = tileBounds(t, g);
      out.push({
        key: `baseplate#${t.cx}-${t.cy}`,
        partId: `baseplate:${k}`,
        layerId: layer0.layer.id,
        x: b.x0,
        y: b.y0,
        z: layer0.z,
        rotated: false,
        width: b.x1 - b.x0,
      });
    });
  }
  return out;
}
