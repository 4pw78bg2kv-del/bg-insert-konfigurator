/**
 * Anwendungszustand (Zustand). Enthält nur Daten und Aktionen – keine
 * Geometrie-Berechnung. Das Projekt wird automatisch im Browser
 * zwischengespeichert, damit beim Neuladen nichts verloren geht.
 */
import { create } from 'zustand';
import {
  createCardTray,
  createDefaultProject,
  createGridBox,
  duplicateModule,
  parseProject,
  serializeProject,
  suggestName,
  type BoxSettings,
  type InsertModule,
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
  parts: Record<string, PartPreview>;
  building: boolean;
  buildError: string | null;
  viewMode: ViewMode;
  showBox: boolean;

  setName(name: string): void;
  setBox(patch: Partial<BoxSettings>): void;
  setPrint(patch: Partial<PrintSettings>): void;
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
}

export const useStore = create<State>((set) => ({
  project: loadInitial(),
  selectedId: null,
  parts: {},
  building: false,
  buildError: null,
  viewMode: 'all',
  showBox: true,

  setName: (name) => set((s) => ({ project: { ...s.project, name } })),
  setBox: (patch) => set((s) => ({ project: { ...s.project, box: { ...s.project.box, ...patch } } })),
  setPrint: (patch) => set((s) => ({ project: { ...s.project, print: { ...s.project.print, ...patch } } })),
  addModule: (type) =>
    set((s) => {
      const m = type === 'cardTray' ? createCardTray() : createGridBox();
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
  select: (id) => set({ selectedId: id }),
  loadProject: (p) => set({ project: p, selectedId: null, parts: {} }),
  newProject: () => set({ project: createDefaultProject(), selectedId: null, parts: {} }),
  setParts: (parts) => set({ parts: Object.fromEntries(parts.map((p) => [p.moduleId, p])) }),
  setBuilding: (building, error = null) => set({ building, buildError: error }),
  setViewMode: (viewMode) => set({ viewMode }),
  setShowBox: (showBox) => set({ showBox }),
}));

// Autosave im Browser (best effort).
useStore.subscribe((s, prev) => {
  if (s.project === prev.project) return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeProject(s.project));
  } catch {
    /* ignorieren */
  }
});
