/**
 * Reine Maß-Berechnungen (ohne Geometrie-Kernel).
 *
 * Werden sowohl vom Geometrie-Aufbau als auch von Layout und Validierung
 * genutzt, damit alle Stellen garantiert mit denselben Zahlen rechnen.
 */
import { effectiveCard } from './cards';
import type { BoxSettings, CardTrayModule, GridBoxModule, InsertModule, ModuleSize, PrintSettings, Project } from './types';

/** Nutzbare Höhe einer Ebene: Innenhöhe minus Kopfraum. */
export function usableHeight(box: BoxSettings): number {
  return Math.max(0, box.innerHeight - box.headroom);
}

/** Außenmaße der Spielschachtel. */
export function outerBoxSize(box: BoxSettings): ModuleSize {
  return {
    width: box.innerWidth + 2 * box.wallThickness,
    depth: box.innerDepth + 2 * box.wallThickness,
    height: box.innerHeight + box.floorThickness,
  };
}

export function moduleHeight(m: InsertModule, box: BoxSettings): number {
  return m.heightMode === 'custom' ? m.customHeight : usableHeight(box);
}

/** Innenaufteilung eines Kartenfachs. */
export interface CardTrayLayout {
  width: number;
  depth: number;
  height: number;
  /** Innenmaß eines Fachs in X. */
  slotInnerX: number;
  /** Innenmaß eines Fachs in Y. */
  slotInnerY: number;
  /** Höhe, die der Kartenstapel im Fach benötigt (ab Fachboden). */
  requiredInnerHeight: number;
}

export function cardTrayLayout(m: CardTrayModule, print: PrintSettings, box: BoxSettings): CardTrayLayout {
  const card = effectiveCard(m);
  const wall = print.wallThickness;
  const div = print.dividerThickness;
  const slots = Math.max(1, Math.round(m.slots));
  const height = moduleHeight(m, box);

  if (m.orientation === 'standing') {
    // Karten stehen hochkant (Kartenfläche in XZ), Stapel wächst in Y.
    const slotInnerX = card.width + m.play;
    const slotInnerY = card.stack + m.play;
    return {
      width: slotInnerX + 2 * wall,
      depth: slots * slotInnerY + (slots - 1) * div + 2 * wall,
      height,
      slotInnerX,
      slotInnerY,
      requiredInnerHeight: card.height,
    };
  }
  // Karten liegen flach, Fächer nebeneinander in X.
  const slotInnerX = card.width + m.play;
  const slotInnerY = card.height + m.play;
  return {
    width: slots * slotInnerX + (slots - 1) * div + 2 * wall,
    depth: slotInnerY + 2 * wall,
    height,
    slotInnerX,
    slotInnerY,
    requiredInnerHeight: card.stack,
  };
}

/** Innenaufteilung einer Rasterbox. */
export interface GridBoxLayout {
  width: number;
  depth: number;
  height: number;
  cellX: number;
  cellY: number;
}

export function gridBoxLayout(m: GridBoxModule, print: PrintSettings, box: BoxSettings): GridBoxLayout {
  const cols = Math.max(1, Math.round(m.columns));
  const rows = Math.max(1, Math.round(m.rows));
  const innerX = m.width - 2 * print.wallThickness;
  const innerY = m.depth - 2 * print.wallThickness;
  return {
    width: m.width,
    depth: m.depth,
    height: moduleHeight(m, box),
    cellX: (innerX - (cols - 1) * print.dividerThickness) / cols,
    cellY: (innerY - (rows - 1) * print.dividerThickness) / rows,
  };
}

/** Außenmaße eines Moduls (unrotiert). */
export function moduleSize(m: InsertModule, project: Pick<Project, 'print' | 'box'>): ModuleSize {
  const l = m.type === 'cardTray' ? cardTrayLayout(m, project.print, project.box) : gridBoxLayout(m, project.print, project.box);
  return { width: l.width, depth: l.depth, height: l.height };
}
