/**
 * Automatische Anordnung der Module, getrennt für jede Ebene.
 *
 * - Mit Innenraster: First-Fit auf dem Zellraster (Zeile für Zeile von vorne
 *   links). Manuell platzierte Module belegen ihre Zellen zuerst.
 * - Ohne Raster: Regal-Packung in Listenreihenfolge mit Spaltmaß zwischen
 *   allen Teilen; manuell platzierte Module werden umflossen.
 */
import { gridInfo, gridLineX, gridLineY, layerInfoFor, moduleCells, moduleSize, type GridInfo } from './dimensions';
import type { InsertModule, PlacedInstance, Project } from './types';

interface Rect {
  x: number;
  y: number;
  width: number;
  depth: number;
}

const EPS = 1e-6;

function overlaps(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x < b.x + b.width + gap - EPS &&
    b.x < a.x + a.width + gap - EPS &&
    a.y < b.y + b.depth + gap - EPS &&
    b.y < a.y + a.depth + gap - EPS
  );
}

function footprint(m: InsertModule, p: Project) {
  const s = moduleSize(m, p);
  return {
    w: m.placement.rotated ? s.depth : s.width,
    d: m.placement.rotated ? s.width : s.depth,
    h: s.height,
  };
}

export function computeLayout(project: Project): PlacedInstance[] {
  const g = gridInfo(project);
  const result: PlacedInstance[] = [];
  for (const layer of project.layers) {
    const mods = project.modules.filter((m) => (project.layers.some((l) => l.id === m.layerId) ? m.layerId : project.layers[0]?.id) === layer.id);
    const z = layerInfoFor(project, layer.id).moduleZ;
    const placed = g.enabled ? layoutGrid(mods, project, g) : layoutFree(mods, project);
    for (const r of placed) result.push({ ...r, layerId: layer.id, z });
  }
  return result;
}

type Placed = Omit<PlacedInstance, 'layerId' | 'z'>;

// ---------------------------------------------------------------------------

function layoutGrid(mods: InsertModule[], project: Project, g: GridInfo): Placed[] {
  const occupied: boolean[][] = Array.from({ length: g.ny }, () => Array<boolean>(g.nx).fill(false));
  const out: Placed[] = [];

  const mark = (gx: number, gy: number, nx: number, ny: number) => {
    for (let y = gy; y < gy + ny; y++)
      for (let x = gx; x < gx + nx; x++) if (y >= 0 && y < g.ny && x >= 0 && x < g.nx) occupied[y][x] = true;
  };
  const free = (gx: number, gy: number, nx: number, ny: number) => {
    if (gx < 0 || gy < 0 || gx + nx > g.nx || gy + ny > g.ny) return false;
    for (let y = gy; y < gy + ny; y++) for (let x = gx; x < gx + nx; x++) if (occupied[y][x]) return false;
    return true;
  };
  const push = (m: InsertModule, i: number, gx: number, gy: number) => {
    const f = footprint(m, project);
    out.push({
      moduleId: m.id,
      copyIndex: i,
      x: gridLineX(g, gx) + g.clearance / 2,
      y: gridLineY(g, gy) + g.clearance / 2,
      width: f.w,
      depth: f.d,
      height: f.h,
      rotated: m.placement.rotated,
    });
  };
  const cellsOf = (m: InsertModule) => {
    const c = moduleCells(m, project);
    return m.placement.rotated ? { nx: c.ny, ny: c.nx } : c;
  };

  // Manuelle zuerst
  for (const m of mods) {
    if (m.placement.mode !== 'manual') continue;
    const c = cellsOf(m);
    for (let i = 0; i < Math.max(1, m.quantity); i++) {
      const gx = Math.round(m.placement.gx) + i * c.nx;
      const gy = Math.round(m.placement.gy);
      mark(gx, gy, c.nx, c.ny);
      push(m, i, gx, gy);
    }
  }
  // Dann automatisch: erste freie Position (vorne links zuerst)
  for (const m of mods) {
    if (m.placement.mode !== 'auto') continue;
    const c = cellsOf(m);
    for (let i = 0; i < Math.max(1, m.quantity); i++) {
      let spot: [number, number] | null = null;
      for (let gy = 0; gy < g.ny && !spot; gy++)
        for (let gx = 0; gx < g.nx && !spot; gx++) if (free(gx, gy, c.nx, c.ny)) spot = [gx, gy];
      // Passt nirgends: hinter die Schachtel setzen, Validierung meldet es.
      if (!spot) spot = [0, g.ny];
      mark(spot[0], spot[1], c.nx, c.ny);
      push(m, i, spot[0], spot[1]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------

function layoutFree(mods: InsertModule[], project: Project): Placed[] {
  const { box, print } = project;
  const gap = print.clearance;
  const out: Placed[] = [];

  for (const m of mods) {
    if (m.placement.mode !== 'manual') continue;
    const f = footprint(m, project);
    for (let i = 0; i < Math.max(1, m.quantity); i++) {
      out.push({
        moduleId: m.id,
        copyIndex: i,
        x: m.placement.x + i * (f.w + gap),
        y: m.placement.y,
        width: f.w,
        depth: f.d,
        height: f.h,
        rotated: m.placement.rotated,
      });
    }
  }
  const obstacles: Rect[] = out.map((r) => ({ ...r }));

  let cursorX = gap;
  let rowY = gap;
  let rowDepth = 0;
  for (const m of mods) {
    if (m.placement.mode !== 'auto') continue;
    const { w, d, h } = footprint(m, project);
    for (let i = 0; i < Math.max(1, m.quantity); i++) {
      let placed: Rect | null = null;
      for (let guard = 0; guard < 500 && !placed; guard++) {
        const candidate: Rect = { x: cursorX, y: rowY, width: w, depth: d };
        if (candidate.x + w > box.innerWidth - gap + EPS && cursorX > gap + EPS) {
          rowY += rowDepth + gap;
          cursorX = gap;
          rowDepth = 0;
          continue;
        }
        const blocker = obstacles.find((o) => overlaps(candidate, o, gap));
        if (blocker) {
          cursorX = blocker.x + blocker.width + gap;
          if (cursorX + w > box.innerWidth - gap + EPS) {
            rowY = rowY + Math.max(rowDepth, 1) + gap;
            cursorX = gap;
            rowDepth = 0;
          }
          continue;
        }
        placed = candidate;
      }
      if (!placed) placed = { x: cursorX, y: rowY, width: w, depth: d };
      obstacles.push(placed);
      out.push({ moduleId: m.id, copyIndex: i, x: placed.x, y: placed.y, width: w, depth: d, height: h, rotated: m.placement.rotated });
      cursorX = placed.x + w + gap;
      rowDepth = Math.max(rowDepth, d);
    }
  }
  return out;
}
