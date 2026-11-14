/**
 * Anwendungszustand (Zustand). Enthält nur Daten und Aktionen – keine
 * Geometrie-Berechnung. Das Projekt wird automatisch im Browser
 * zwischengespeichert, damit beim Neuladen nichts verloren geht.
 */
import { create } from 'zustand';
import {
  TEMPLATES,
  computeLayout,
  gridInfo,
  createCardTray,
  createDefaultProject,
  createGridBox,
  createShapeBox,
  duplicateModule,
  maxLevel,
  parseProject,
  serializeProject,
  suggestName,
  type BaseplateSettings,
  type BoxSettings,
  type GridSettings,
  type InsertModule,
  type LabelStyle,
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
  /** Gewähltes Fach im Fächer-Editor bzw. gewählte Tasche der Aufleger-Box. */
  selectedCellId: string | null;
  parts: Record<string, PartPreview>;
  building: boolean;
  buildError: string | null;
  viewMode: ViewMode;
  showBox: boolean;
  /** Abstand zwischen den Stapelstufen in der Explosionsansicht (mm). */
  explode: number;
  /** Nur Stapelstufen bis hierhin anzeigen (0 = alle). */
  levelView: number;
  galleryOpen: boolean;
  inventoryOpen: boolean;
  /** Wird erhöht, sobald die Schriften geladen sind (für die Prüfung). */
  fontsVersion: number;

  setName(name: string): void;
  setBox(patch: Partial<BoxSettings>): void;
  setPrint(patch: Partial<PrintSettings>): void;
  setGrid(patch: Partial<GridSettings>): void;
  setBaseplate(patch: Partial<BaseplateSettings>): void;
  setLabels(patch: Partial<LabelStyle>): void;
  addModule(type: ModuleType): void;
  addTemplate(id: string): void;
  /** Ersetzt (replace) oder ergänzt Module, z. B. aus dem Inventar-Import. */
  insertModules(mods: InsertModule[], replace: boolean): void;
  updateModule(id: string, patch: Partial<InsertModule>): void;
  removeModule(id: string): void;
  duplicate(id: string): void;
  move(id: string, dir: -1 | 1): void;
  select(id: string | null): void;
  selectCell(id: string | null): void;
  loadProject(p: Project): void;
  newProject(): void;
  setParts(parts: PartPreview[]): void;
  setBuilding(b: boolean, error?: string | null): void;
  setViewMode(v: ViewMode): void;
  setShowBox(v: boolean): void;
  setExplode(v: number): void;
  setLevelView(v: number): void;
  setGalleryOpen(v: boolean): void;
  setInventoryOpen(v: boolean): void;
  bumpFonts(): void;
  /** Verschiebt ein Modul (fixiert es dabei). Mit Raster um eine Zelle, sonst in mm. */
  nudge(id: string, dx: number, dy: number, stepMm?: number): void;
  rotate(id: string): void;
  /** Alle Module um 90° drehen und neu anordnen. */
  rotateAll(): void;
  /** Modul eine Stapelstufe höher (+1) oder tiefer (−1) legen. */
  shiftLevel(id: string, dir: -1 | 1): void;
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

function uniqueName(m: InsertModule, modules: InsertModule[]) {
  const taken = new Set(modules.map((x) => x.name));
  const baseName = m.name;
  for (let n = 2; taken.has(m.name); n++) m.name = `${baseName} ${n}`;
}

const mapModule = (s: State, id: string, fn: (m: InsertModule) => InsertModule) => ({
  project: { ...s.project, modules: s.project.modules.map((m) => (m.id === id ? fn(m) : m)) },
});

export const useStore = create<State>((set) => ({
  project: initial,
  selectedId: null,
  selectedCellId: null,
  parts: {},
  building: false,
  buildError: null,
  viewMode: 'all',
  showBox: true,
  explode: 0,
  levelView: 0,
  galleryOpen: false,
  inventoryOpen: false,
  fontsVersion: 0,

  setName: (name) => set((s) => ({ project: { ...s.project, name } })),
  setBox: (patch) => set((s) => ({ project: { ...s.project, box: { ...s.project.box, ...patch } } })),
  setPrint: (patch) => set((s) => ({ project: { ...s.project, print: { ...s.project.print, ...patch } } })),
  setGrid: (patch) => set((s) => ({ project: { ...s.project, grid: { ...s.project.grid, ...patch } } })),
  setBaseplate: (patch) => set((s) => ({ project: { ...s.project, baseplate: { ...s.project.baseplate, ...patch } } })),
  setLabels: (patch) => set((s) => ({ project: { ...s.project, labels: { ...s.project.labels, ...patch } } })),

  addModule: (type) =>
    set((s) => {
      const m = type === 'cardTray' ? createCardTray() : type === 'gridBox' ? createGridBox() : createShapeBox();
      uniqueName(m, s.project.modules);
      return { project: { ...s.project, modules: [...s.project.modules, m] }, selectedId: m.id, selectedCellId: null };
    }),
  addTemplate: (id) =>
    set((s) => {
      const t = TEMPLATES.find((x) => x.id === id);
      if (!t) return {};
      const m = t.create();
      uniqueName(m, s.project.modules);
      return { project: { ...s.project, modules: [...s.project.modules, m] }, selectedId: m.id, selectedCellId: null, galleryOpen: false };
    }),
  insertModules: (mods, replace) =>
    set((s) => {
      const base = replace ? [] : s.project.modules;
      const list = [...base];
      for (const m of mods) {
        uniqueName(m, list);
        list.push(m);
      }
      return { project: { ...s.project, modules: list }, selectedId: mods[0]?.id ?? null, selectedCellId: null };
    }),
  updateModule: (id, patch) =>
    set((s) =>
      mapModule(s, id, (m) => {
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
    ),
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
  select: (id) => set((s) => ({ selectedId: id, selectedCellId: id === s.selectedId ? s.selectedCellId : null })),
  selectCell: (selectedCellId) => set({ selectedCellId }),
  loadProject: (p) => set({ project: p, selectedId: null, selectedCellId: null, parts: {} }),
  newProject: () => set({ project: createDefaultProject(), selectedId: null, selectedCellId: null, parts: {} }),
  setParts: (parts) => set({ parts: Object.fromEntries(parts.map((p) => [p.partId, p])) }),
  setBuilding: (building, error = null) => set({ building, buildError: error }),
  setViewMode: (viewMode) => set({ viewMode }),
  setShowBox: (showBox) => set({ showBox }),
  setExplode: (explode) => set({ explode }),
  setLevelView: (levelView) => set({ levelView }),
  setGalleryOpen: (galleryOpen) => set({ galleryOpen }),
  setInventoryOpen: (inventoryOpen) => set({ inventoryOpen }),
  bumpFonts: () => set((s) => ({ fontsVersion: s.fontsVersion + 1 })),

  nudge: (id, dx, dy, stepMm = 1) =>
    set((s) => {
      const m = s.project.modules.find((x) => x.id === id);
      if (!m) return {};
      const g = gridInfo(s.project);
      let pl = m.placement;
      if (pl.mode !== 'manual') {
        const inst = computeLayout(s.project).find((i) => i.moduleId === id && i.copyIndex === 0);
        pl = { ...pl, x: round2(inst?.x ?? 0), y: round2(inst?.y ?? 0) };
      }
      const sx = g.enabled ? g.cellX : stepMm;
      const sy = g.enabled ? g.cellY : stepMm;
      const placement = { ...pl, mode: 'manual' as const, x: round2(Math.max(0, pl.x + dx * sx)), y: round2(Math.max(0, pl.y + dy * sy)) };
      return mapModule(s, id, (x) => ({ ...x, placement }));
    }),
  rotate: (id) => set((s) => mapModule(s, id, (x) => ({ ...x, placement: { ...x.placement, rotated: !x.placement.rotated } }))),
  rotateAll: () =>
    set((s) => ({
      project: { ...s.project, modules: s.project.modules.map((x) => ({ ...x, placement: { ...x.placement, mode: 'auto', rotated: !x.placement.rotated } })) },
    })),
  shiftLevel: (id, dir) =>
    set((s) => {
      const m = s.project.modules.find((x) => x.id === id);
      if (!m) return {};
      const level = Math.max(1, Math.min(maxLevel(s.project) + 1, m.level + dir));
      return mapModule(s, id, (x) => ({ ...x, level }));
    }),
  selectNext: (dir) =>
    set((s) => {
      const mods = s.project.modules;
      if (mods.length === 0) return {};
      const i = mods.findIndex((m) => m.id === s.selectedId);
      const next = mods[i < 0 ? (dir > 0 ? 0 : mods.length - 1) : (i + dir + mods.length) % mods.length];
      return { selectedId: next.id, selectedCellId: null };
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
  return { selectedId: p.modules.some((m) => m.id === selectedId) ? selectedId : null };
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
