/**
 * Anwendungszustand (Zustand). Enthält nur Daten und Aktionen – keine
 * Geometrie-Berechnung. Das Projekt wird automatisch im Browser
 * zwischengespeichert, damit beim Neuladen nichts verloren geht.
 */
import { create } from 'zustand';
import {
  computeLayout,
  gridInfo,
  createCardTray,
  createDefaultProject,
  createGridBox,
  createLayer,
  duplicateModule,
  parseProject,
  serializeProject,
  suggestName,
  type BoxSettings,
  type GridSettings,
  type InsertModule,
  type Layer,
  type ModuleType,
  type PrintSettings,
  type Project,
} from '../geometry';
import type { PartPreview } from '../worker/protocol';

const STORAGE_KEY = 'bg-insert-konfigurator:project';

function loadInitial(): Project {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return parseProject(raw);
  } catch {
    /* Speicher nicht verfügbar oder Daten defekt – Standardprojekt nehmen */
  }
  return createDefaultProject();
}

export type ViewMode = 'all' | 'single';

interface State {
  project: Project;
  selectedId: string | null;
  activeLayerId: string;
  parts: Record<string, PartPreview>;
  building: boolean;
  buildError: string | null;
  viewMode: ViewMode;
  showBox: boolean;
  /** Abstand zwischen den Ebenen in der Explosionsansicht (mm). */
  explode: number;

  setName(name: string): void;
  setBox(patch: Partial<BoxSettings>): void;
  setPrint(patch: Partial<PrintSettings>): void;
  setGrid(patch: Partial<GridSettings>): void;
  addLayer(): void;
  updateLayer(id: string, patch: Partial<Layer>): void;
  removeLayer(id: string): void;
  setActiveLayer(id: string): void;
  addModule(type: ModuleType): void;
  updateModule(id: string, patch: Partial<InsertModule>): void;
  removeModule(id: string): void;
  duplicate(id: string): void;
  move(id: string, dir: -1 | 1): void;
  select(id: string | null): void;
  loadProject(p: Project): void;
  newProject(): void;
  setParts(parts: PartPreview[]): void;
  setBuilding(b: boolean, error?: string | null): void;
  setViewMode(v: ViewMode): void;
  setShowBox(v: boolean): void;
  setExplode(v: number): void;
  /** Verschiebt ein Modul (fixiert es dabei). Mit Raster in Zellen, sonst in mm. */
  nudge(id: string, dx: number, dy: number, stepMm?: number): void;
  rotate(id: string): void;
  /** Modul in die Ebene darüber (+1) oder darunter (−1) verschieben. */
  shiftLayer(id: string, dir: -1 | 1): void;
  selectNext(dir: -1 | 1): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  helpOpen: boolean;
  setHelpOpen(v: boolean): void;
}

// ---------------------------------------------------------------------------
// Verlauf für Rückgängig/Wiederholen. Schnelle Folgeänderungen (z. B. Tippen)
// werden zu einem Schritt zusammengefasst.
const past: Project[] = [];
const future: Project[] = [];
const HISTORY_LIMIT = 100;
const MERGE_MS = 600;
let lastRecord = 0;
let restoring = false;

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

const initial = loadInitial();

export const useStore = create<State>((set) => ({
  project: initial,
  selectedId: null,
  activeLayerId: initial.layers[0].id,
  parts: {},
  building: false,
  buildError: null,
  viewMode: 'all',
  showBox: true,
  explode: 0,

  setName: (name) => set((s) => ({ project: { ...s.project, name } })),
  setBox: (patch) => set((s) => ({ project: { ...s.project, box: { ...s.project.box, ...patch } } })),
  setPrint: (patch) => set((s) => ({ project: { ...s.project, print: { ...s.project.print, ...patch } } })),
  setGrid: (patch) => set((s) => ({ project: { ...s.project, grid: { ...s.project.grid, ...patch } } })),

  addLayer: () =>
    set((s) => {
      const layer = createLayer(s.project.layers.length);
      return { project: { ...s.project, layers: [...s.project.layers, layer] }, activeLayerId: layer.id };
    }),
  updateLayer: (id, patch) =>
    set((s) => ({ project: { ...s.project, layers: s.project.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) } })),
  removeLayer: (id) =>
    set((s) => {
      if (s.project.layers.length <= 1) return {};
      const layers = s.project.layers.filter((l) => l.id !== id);
      const fallback = layers[0].id;
      // Module der gelöschten Ebene wandern in die unterste Ebene.
      const modules = s.project.modules.map((m) => (m.layerId === id ? { ...m, layerId: fallback } : m));
      return { project: { ...s.project, layers, modules }, activeLayerId: s.activeLayerId === id ? fallback : s.activeLayerId };
    }),
  setActiveLayer: (activeLayerId) => set({ activeLayerId }),

  addModule: (type) =>
    set((s) => {
      const m = type === 'cardTray' ? createCardTray() : createGridBox();
      m.layerId = s.project.layers.some((l) => l.id === s.activeLayerId) ? s.activeLayerId : s.project.layers[0].id;
      const taken = new Set(s.project.modules.map((x) => x.name));
      for (let n = 2; taken.has(m.name); n++) m.name = `${suggestName(m)} ${n}`;
      return { project: { ...s.project, modules: [...s.project.modules, m] }, selectedId: m.id };
    }),
  updateModule: (id, patch) =>
    set((s) => ({
      project: {
        ...s.project,
        modules: s.project.modules.map((m) => {
          if (m.id !== id) return m;
          const next = { ...m, ...patch } as InsertModule;
          // Automatisch vergebene Namen folgen den Parametern (z. B. Kartengröße).
          if (patch.name === undefined) {
            const auto = suggestName(m);
            if (m.name === auto) next.name = suggestName(next);
            else if (m.name.startsWith(`${auto} `) && /^\d+$/.test(m.name.slice(auto.length + 1)))
              next.name = `${suggestName(next)}${m.name.slice(auto.length)}`;
          }
          return next;
        }),
      },
    })),
  removeModule: (id) =>
    set((s) => ({
      project: { ...s.project, modules: s.project.modules.filter((m) => m.id !== id) },
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),
  duplicate: (id) =>
    set((s) => {
      const idx = s.project.modules.findIndex((m) => m.id === id);
      if (idx < 0) return {};
      const copy = duplicateModule(s.project.modules[idx]);
      const modules = [...s.project.modules];
      modules.splice(idx + 1, 0, copy);
      return { project: { ...s.project, modules }, selectedId: copy.id };
    }),
  move: (id, dir) =>
    set((s) => {
      const modules = [...s.project.modules];
      const i = modules.findIndex((m) => m.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= modules.length) return {};
      [modules[i], modules[j]] = [modules[j], modules[i]];
      return { project: { ...s.project, modules } };
    }),
  select: (id) =>
    set((s) => {
      const m = s.project.modules.find((x) => x.id === id);
      return { selectedId: id, activeLayerId: m ? m.layerId : s.activeLayerId };
    }),
  loadProject: (p) => set({ project: p, selectedId: null, parts: {}, activeLayerId: p.layers[0].id }),
  newProject: () =>
    set(() => {
      const p = createDefaultProject();
      return { project: p, selectedId: null, parts: {}, activeLayerId: p.layers[0].id };
    }),
  setParts: (parts) => set({ parts: Object.fromEntries(parts.map((p) => [p.partId, p])) }),
  setBuilding: (building, error = null) => set({ building, buildError: error }),
  setViewMode: (viewMode) => set({ viewMode }),
  setShowBox: (showBox) => set({ showBox }),
  setExplode: (explode) => set({ explode }),

  nudge: (id, dx, dy, stepMm = 1) =>
    set((s) => {
      const m = s.project.modules.find((x) => x.id === id);
      if (!m) return {};
      const g = gridInfo(s.project);
      let pl = m.placement;
      if (pl.mode !== 'manual') {
        const inst = computeLayout(s.project).find((i) => i.moduleId === id && i.copyIndex === 0);
        const x = inst?.x ?? 0;
        const y = inst?.y ?? 0;
        pl = {
          ...pl,
          x: round2(x),
          y: round2(y),
          gx: Math.max(0, Math.round((x - g.clearance) / g.cellX)),
          gy: Math.max(0, Math.round((y - g.clearance) / g.cellY)),
        };
      }
      const placement = g.enabled
        ? { ...pl, mode: 'manual' as const, gx: Math.max(0, pl.gx + dx), gy: Math.max(0, pl.gy + dy) }
        : { ...pl, mode: 'manual' as const, x: round2(pl.x + dx * stepMm), y: round2(pl.y + dy * stepMm) };
      return { project: { ...s.project, modules: s.project.modules.map((x) => (x.id === id ? { ...x, placement } : x)) } };
    }),
  rotate: (id) =>
    set((s) => ({
      project: {
        ...s.project,
        modules: s.project.modules.map((x) => (x.id === id ? { ...x, placement: { ...x.placement, rotated: !x.placement.rotated } } : x)),
      },
    })),
  shiftLayer: (id, dir) =>
    set((s) => {
      const m = s.project.modules.find((x) => x.id === id);
      if (!m) return {};
      const idx = s.project.layers.findIndex((l) => l.id === m.layerId);
      const target = s.project.layers[idx + dir];
      if (!target) return {};
      return {
        project: { ...s.project, modules: s.project.modules.map((x) => (x.id === id ? { ...x, layerId: target.id } : x)) },
        activeLayerId: target.id,
      };
    }),
  selectNext: (dir) =>
    set((s) => {
      const mods = s.project.modules;
      if (mods.length === 0) return {};
      const i = mods.findIndex((m) => m.id === s.selectedId);
      const next = mods[(i < 0 ? (dir > 0 ? 0 : mods.length - 1) : (i + dir + mods.length) % mods.length)];
      return { selectedId: next.id, activeLayerId: next.layerId };
    }),
  undo: () =>
    set((s) => {
      const prev = past.pop();
      if (!prev) return {};
      future.push(s.project);
      restoring = true;
      return { project: prev, canUndo: past.length > 0, canRedo: true, ...keepSelection(prev, s.selectedId) };
    }),
  redo: () =>
    set((s) => {
      const next = future.pop();
      if (!next) return {};
      past.push(s.project);
      restoring = true;
      return { project: next, canUndo: true, canRedo: future.length > 0, ...keepSelection(next, s.selectedId) };
    }),
  canUndo: false,
  canRedo: false,
  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),
}));

function keepSelection(p: Project, selectedId: string | null) {
  const layerOk = (id: string) => p.layers.some((l) => l.id === id);
  return {
    selectedId: p.modules.some((m) => m.id === selectedId) ? selectedId : null,
    activeLayerId: layerOk(useStore.getState().activeLayerId) ? useStore.getState().activeLayerId : p.layers[0].id,
  };
}

// Verlauf aufzeichnen
useStore.subscribe((s, prev) => {
  if (s.project === prev.project) return;
  if (restoring) {
    restoring = false;
    return;
  }
  const now = Date.now();
  if (now - lastRecord > MERGE_MS || past.length === 0) {
    past.push(prev.project);
    if (past.length > HISTORY_LIMIT) past.shift();
  }
  lastRecord = now;
  future.length = 0;
  if (!s.canUndo || s.canRedo) useStore.setState({ canUndo: true, canRedo: false });
});

// Autosave im Browser (best effort).
useStore.subscribe((s, prev) => {
  if (s.project === prev.project) return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeProject(s.project));
  } catch {
    /* ignorieren */
  }
});
