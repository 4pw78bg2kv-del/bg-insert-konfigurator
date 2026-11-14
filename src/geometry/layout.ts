/**
 * Anordnung und Stapeln der Module („Schwerkraft-Stapeln“).
 *
 * Jedes Modul hat eine Stapelstufe. Stufe 1 liegt auf dem Boden (bzw. auf der
 * Grundplatte). Ein Modul höherer Stufe fällt auf die höchste Oberkante der
 * Module tieferer Stufen, die unter seiner Grundfläche liegen. Dadurch sind
 * beliebige Zwischenhöhen möglich („Ebene 1,5“): Ein Modul kann auf einem
 * niedrigen Tray liegen, während daneben ein hohes Tray bis zum Deckel reicht.
 *
 * Automatisch platzierte Module suchen die beste freie Position: auf Stufe 1
 * vorne links zuerst, auf höheren Stufen bevorzugt vollständig aufliegend und
 * möglichst tief.
 */
import {
  cardTrayDims,
  floorZ,
  gridBoxDims,
  gridInfo,
  gridLineX,
  gridLineY,
  moduleSizeWith,
  shapeBoxDims,
  usableHeight,
  type CardTrayLayout,
  type GridBoxLayout,
  type GridInfo,
  type ShapeBoxLayout,
} from './dimensions';
import type { CardTrayModule, GridBoxModule, InsertModule, ModuleSize, PlacedInstance, Project, ShapeBoxModule } from './types';

const EPS = 1e-6;

interface Rect {
  x: number;
  y: number;
  width: number;
  depth: number;
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const d = Math.min(a.y + a.depth, b.y + b.depth) - Math.max(a.y, b.y);
  return w > 1e-3 && d > 1e-3 ? w * d : 0;
}

function overlaps(a: Rect, b: Rect, gap = 0): boolean {
  return (
    a.x < b.x + b.width + gap - 1e-3 &&
    b.x < a.x + a.width + gap - 1e-3 &&
    a.y < b.y + b.depth + gap - 1e-3 &&
    b.y < a.y + a.depth + gap - 1e-3
  );
}

export interface Solved {
  layout: PlacedInstance[];
  /** Verfügbare Höhe je Modul (vom Modulboden bis unter den Schachteldeckel). */
  avail: Map<string, number>;
}

const cache = new WeakMap<Project, Solved>();

export function solveProject(p: Project): Solved {
  const hit = cache.get(p);
  if (hit) return hit;
  const usable = usableHeight(p.box);
  const base = Math.max(1, usable - floorZ(p));
  let avail = new Map(p.modules.map((m) => [m.id, base]));
  let layout = place(p, avail);
  // Höhen „bis zum Deckel“ hängen von der Lage ab: zwei Durchläufe genügen.
  for (let iter = 0; iter < 2; iter++) {
    const next = new Map<string, number>();
    for (const m of p.modules) {
      const zs = layout.filter((i) => i.moduleId === m.id).map((i) => i.z);
      next.set(m.id, Math.max(1, usable - Math.max(floorZ(p), ...zs)));
    }
    const same = p.modules.every((m) => Math.abs((next.get(m.id) ?? 0) - (avail.get(m.id) ?? 0)) < 1e-6);
    if (same) break;
    avail = next;
    layout = place(p, avail);
  }
  const solved = { layout, avail };
  cache.set(p, solved);
  return solved;
}

export function computeLayout(p: Project): PlacedInstance[] {
  return solveProject(p).layout;
}

export function moduleAvail(m: InsertModule, p: Project): number {
  return solveProject(p).avail.get(m.id) ?? Math.max(1, usableHeight(p.box) - floorZ(p));
}

export function cardTrayLayout(m: CardTrayModule, p: Project): CardTrayLayout {
  return cardTrayDims(m, p, moduleAvail(m, p));
}
export function gridBoxLayout(m: GridBoxModule, p: Project): GridBoxLayout {
  return gridBoxDims(m, p, moduleAvail(m, p));
}
export function shapeBoxLayout(m: ShapeBoxModule, p: Project): ShapeBoxLayout {
  return shapeBoxDims(m, p, moduleAvail(m, p));
}
/** Außenmaße eines Moduls (unrotiert). `height` enthält einen Deckel. */
export function moduleSize(m: InsertModule, p: Project): ModuleSize {
  return moduleSizeWith(m, p, moduleAvail(m, p));
}

/** Höchste vorkommende Stapelstufe. */
export function maxLevel(p: Project): number {
  return Math.max(1, ...p.modules.map((m) => m.level));
}

// ---------------------------------------------------------------------------

function snapPos(g: GridInfo, x: number, y: number): { x: number; y: number; gx: number; gy: number } {
  const gx = Math.max(0, Math.round((x - g.x0 - g.clearance / 2) / g.cellX));
  const gy = Math.max(0, Math.round((y - g.y0 - g.clearance / 2) / g.cellY));
  return { gx, gy, x: gridLineX(g, gx) + g.clearance / 2, y: gridLineY(g, gy) + g.clearance / 2 };
}

function place(p: Project, avail: Map<string, number>): PlacedInstance[] {
  const g = gridInfo(p);
  const c = p.print.clearance;
  const usable = usableHeight(p.box);
  const plate = floorZ(p);
  const W = p.box.innerWidth;
  const D = p.box.innerDepth;
  const placed: PlacedInstance[] = [];

  const footprint = (m: InsertModule) => {
    const s = moduleSizeWith(m, p, avail.get(m.id) ?? usable - plate);
    return { w: m.placement.rotated ? s.depth : s.width, d: m.placement.rotated ? s.width : s.depth, h: s.height };
  };

  const supportOf = (r: Rect, level: number) => {
    const below = placed.filter((q) => q.level < level && overlapArea(q, r) > 0);
    const top = below.length ? Math.max(...below.map((q) => q.z + q.height)) : plate;
    const sup = below.filter((q) => Math.abs(q.z + q.height - top) < 0.01);
    const area = r.width * r.depth || 1;
    const coverage = below.length ? Math.min(1, sup.reduce((s, q) => s + overlapArea(q, r), 0) / area) : 1;
    return { z: Math.max(plate, top), supports: [...new Set(sup.map((q) => q.moduleId))], coverage };
  };

  const push = (m: InsertModule, i: number, x: number, y: number, f: { w: number; d: number; h: number }) => {
    const r = { x, y, width: f.w, depth: f.d };
    const s = supportOf(r, m.level);
    placed.push({ moduleId: m.id, copyIndex: i, level: m.level, x, y, z: s.z, width: f.w, depth: f.d, height: f.h, rotated: m.placement.rotated, supports: s.supports });
  };

  const levels = [...new Set(p.modules.map((m) => m.level))].sort((a, b) => a - b);
  for (const level of levels) {
    const mods = p.modules.filter((m) => m.level === level);

    // Manuell platzierte zuerst (Kopien nebeneinander)
    for (const m of mods) {
      if (m.placement.mode !== 'manual') continue;
      const f = footprint(m);
      for (let i = 0; i < Math.max(1, m.quantity); i++) {
        let x = m.placement.x + i * (f.w + c);
        let y = m.placement.y;
        if (g.enabled) {
          const s = snapPos(g, m.placement.x, m.placement.y);
          const cells = Math.max(1, Math.ceil((f.w + c) / g.cellX - EPS));
          x = gridLineX(g, s.gx + i * cells) + c / 2;
          y = s.y;
        }
        push(m, i, x, y, f);
      }
    }

    // Dann automatisch
    for (const m of mods) {
      if (m.placement.mode !== 'auto') continue;
      const f = footprint(m);
      for (let i = 0; i < Math.max(1, m.quantity); i++) {
        const cands: { x: number; y: number }[] = [];
        if (g.enabled) {
          for (let gy = 0; gy < g.ny; gy++)
            for (let gx = 0; gx < g.nx; gx++) {
              const x = gridLineX(g, gx) + c / 2;
              const y = gridLineY(g, gy) + c / 2;
              if (x + f.w <= W - c / 2 + 1e-3 && y + f.d <= D - c / 2 + 1e-3) cands.push({ x, y });
            }
        } else {
          const xs = new Set([c / 2, ...placed.flatMap((q) => [q.x + q.width + c, q.x])]);
          const ys = new Set([c / 2, ...placed.flatMap((q) => [q.y + q.depth + c, q.y])]);
          for (const y of ys) for (const x of xs) if (x >= c / 2 - 1e-3 && y >= c / 2 - 1e-3 && x + f.w <= W - c / 2 + 1e-3 && y + f.d <= D - c / 2 + 1e-3) cands.push({ x, y });
        }
        let best: { x: number; y: number; score: number[] } | null = null;
        for (const cand of cands) {
          const r = { x: cand.x, y: cand.y, width: f.w, depth: f.d };
          const gap = g.enabled ? 0 : c;
          if (placed.some((q) => q.level === level && overlaps(q, r, gap))) continue;
          // Auch nicht in höher gestapelte Module hineinragen
          const s = supportOf(r, level);
          const h = m.heightMode === 'fill' ? usable - s.z : f.h;
          if (placed.some((q) => q.level > level && overlaps(q, r) && q.z < s.z + h - 1e-3)) continue;
          const fits = s.z + h <= usable + 0.01 ? 0 : 1;
          const score =
            level <= 1
              ? [fits, Math.round(cand.y * 100), Math.round(cand.x * 100)]
              : [fits, s.coverage >= 0.999 ? 0 : s.coverage >= 0.5 ? 1 : 2, Math.round(s.z * 100), Math.round(cand.y * 100), Math.round(cand.x * 100)];
          if (!best || lexLess(score, best.score)) best = { ...cand, score };
        }
        // Passt nirgends: hinter die Schachtel setzen, die Prüfung meldet es.
        const spot = best ?? { x: c / 2, y: D + 10 + placed.filter((q) => q.y > D).length * 5 };
        push(m, i, spot.x, spot.y, f);
      }
    }
  }
  return placed;
}

function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}
