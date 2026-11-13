/**
 * Projekt-Standards, Modul-Fabriken, Dateinamen und JSON-(De)Serialisierung.
 */
import { CARD_PRESETS, cardPresetShortName } from './cards';
import {
  PROJECT_FORMAT_VERSION,
  type BoxSettings,
  type CardTrayModule,
  type GridBoxModule,
  type InsertModule,
  type PrintSettings,
  type Project,
} from './types';

export const DEFAULT_BOX: BoxSettings = {
  innerWidth: 290,
  innerDepth: 290,
  innerHeight: 100,
  wallThickness: 2,
  floorThickness: 2,
  headroom: 5,
};

export const DEFAULT_PRINT: PrintSettings = {
  clearance: 0.2,
  wallThickness: 1.6,
  floorThickness: 1.2,
  dividerThickness: 1.2,
};

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const defaultPlacement = () => ({ mode: 'auto' as const, x: 0, y: 0, rotated: false });

export function createCardTray(overrides: Partial<CardTrayModule> = {}): CardTrayModule {
  return {
    id: newId(),
    type: 'cardTray',
    name: 'Kartenfach Poker',
    quantity: 1,
    placement: defaultPlacement(),
    heightMode: 'layer',
    customHeight: 40,
    cardPreset: 'poker',
    customCardWidth: 60,
    customCardHeight: 90,
    sleeve: 'standard',
    cardCount: 60,
    cardThickness: 0.32,
    slots: 2,
    orientation: 'standing',
    play: 1,
    fingerCutout: true,
    ...overrides,
  };
}

export function createGridBox(overrides: Partial<GridBoxModule> = {}): GridBoxModule {
  return {
    id: newId(),
    type: 'gridBox',
    name: 'Box 3x2',
    quantity: 1,
    placement: defaultPlacement(),
    heightMode: 'layer',
    customHeight: 30,
    width: 100,
    depth: 70,
    columns: 3,
    rows: 2,
    dividerLowering: 0,
    ...overrides,
  };
}

export function duplicateModule(m: InsertModule): InsertModule {
  return { ...structuredClone(m), id: newId(), name: `${m.name} Kopie` };
}

export function createDefaultProject(): Project {
  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    name: 'Mein Insert',
    box: { ...DEFAULT_BOX },
    print: { ...DEFAULT_PRINT },
    modules: [
      createCardTray(),
      createGridBox({ name: 'Token-Box', width: 120, depth: 80 }),
      createGridBox({ name: 'Ressourcen', width: 120, depth: 80, columns: 2, rows: 1 }),
    ],
  };
}

/** Vorschlag für einen Modulnamen anhand der Parameter. */
export function suggestName(m: InsertModule): string {
  if (m.type === 'cardTray') return `Kartenfach ${cardPresetShortName(m)}`;
  return `Box ${m.columns}x${m.rows}`;
}

/**
 * STL-Dateiname mit Stückzahl, z. B. `2x_Kartenfach_Poker.stl`.
 * Umlaute werden umschrieben, Sonderzeichen entfernt.
 */
export function partFileName(m: InsertModule): string {
  const base = (m.name || suggestName(m))
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'Teil';
  return `${Math.max(1, Math.round(m.quantity))}x_${base}.stl`;
}

/** Macht Dateinamen innerhalb eines Exports eindeutig. */
export function uniqueFileNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const count = seen.get(n) ?? 0;
    seen.set(n, count + 1);
    return count === 0 ? n : n.replace(/\.stl$/, `_${count + 1}.stl`);
  });
}

export function serializeProject(p: Project): string {
  return JSON.stringify({ ...p, formatVersion: PROJECT_FORMAT_VERSION }, null, 2);
}

// ---------------------------------------------------------------------------
// Einlesen mit Validierung: fehlende Felder werden mit Standardwerten ergänzt,
// damit auch ältere oder handbearbeitete Dateien geladen werden können.

function num(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function parseModule(raw: unknown): InsertModule | null {
  const r = obj(raw);
  const pl = obj(r.placement);
  const base = {
    id: typeof r.id === 'string' && r.id ? r.id : newId(),
    name: typeof r.name === 'string' ? r.name : '',
    quantity: Math.round(num(r.quantity, 1, 1, 99)),
    placement: {
      mode: pick(pl.mode, ['auto', 'manual'] as const, 'auto'),
      x: num(pl.x, 0),
      y: num(pl.y, 0),
      rotated: pl.rotated === true,
    },
    heightMode: pick(r.heightMode, ['layer', 'custom'] as const, 'layer'),
    customHeight: num(r.customHeight, 30, 1, 1000),
  };
  if (r.type === 'cardTray') {
    const d = createCardTray();
    return {
      ...d,
      ...base,
      name: base.name || d.name,
      cardPreset: pick(r.cardPreset, [...CARD_PRESETS.map((c) => c.id), 'custom'] as const, d.cardPreset),
      customCardWidth: num(r.customCardWidth, d.customCardWidth, 10, 400),
      customCardHeight: num(r.customCardHeight, d.customCardHeight, 10, 400),
      sleeve: pick(r.sleeve, ['none', 'standard', 'premium'] as const, d.sleeve),
      cardCount: Math.round(num(r.cardCount, d.cardCount, 1, 1000)),
      cardThickness: num(r.cardThickness, d.cardThickness, 0.1, 3),
      slots: Math.round(num(r.slots, d.slots, 1, 50)),
      orientation: pick(r.orientation, ['standing', 'flat'] as const, d.orientation),
      play: num(r.play, d.play, 0, 20),
      fingerCutout: r.fingerCutout !== false,
    };
  }
  if (r.type === 'gridBox') {
    const d = createGridBox();
    return {
      ...d,
      ...base,
      name: base.name || d.name,
      width: num(r.width, d.width, 5, 2000),
      depth: num(r.depth, d.depth, 5, 2000),
      columns: Math.round(num(r.columns, d.columns, 1, 50)),
      rows: Math.round(num(r.rows, d.rows, 1, 50)),
      dividerLowering: num(r.dividerLowering, d.dividerLowering, 0, 1000),
    };
  }
  return null;
}

export function parseProject(json: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.');
  }
  const r = obj(raw);
  if (!Array.isArray(r.modules) || !r.box) throw new Error('Die Datei ist keine Konfigurator-Projektdatei.');
  const b = obj(r.box);
  const p = obj(r.print);
  const seenIds = new Set<string>();
  const modules = (r.modules as unknown[])
    .map(parseModule)
    .filter((m): m is InsertModule => m !== null)
    .map((m) => {
      if (seenIds.has(m.id)) m = { ...m, id: newId() };
      seenIds.add(m.id);
      return m;
    });
  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    name: typeof r.name === 'string' ? r.name : 'Mein Insert',
    box: {
      innerWidth: num(b.innerWidth, DEFAULT_BOX.innerWidth, 10, 2000),
      innerDepth: num(b.innerDepth, DEFAULT_BOX.innerDepth, 10, 2000),
      innerHeight: num(b.innerHeight, DEFAULT_BOX.innerHeight, 5, 1000),
      wallThickness: num(b.wallThickness, DEFAULT_BOX.wallThickness, 0, 50),
      floorThickness: num(b.floorThickness, DEFAULT_BOX.floorThickness, 0, 50),
      headroom: num(b.headroom, DEFAULT_BOX.headroom, 0, 1000),
    },
    print: {
      clearance: num(p.clearance, DEFAULT_PRINT.clearance, 0, 5),
      wallThickness: num(p.wallThickness, DEFAULT_PRINT.wallThickness, 0.4, 20),
      floorThickness: num(p.floorThickness, DEFAULT_PRINT.floorThickness, 0.2, 20),
      dividerThickness: num(p.dividerThickness, DEFAULT_PRINT.dividerThickness, 0.4, 20),
    },
    modules,
  };
}
