/**
 * Einstiegspunkt der Geometrie: erzeugt für ein Teil (PartSpec) ein Mesh in
 * Druckorientierung (Unterseite auf Z = 0, linke vordere Ecke im Ursprung).
 */
import { moduleContext, moduleSize } from './dimensions';
import { Scope, type ManifoldToplevel, type Manifold } from './kernel';
import { buildBaseplate, buildGrooves } from './parts/baseplate';
import { buildCardTray } from './parts/cardTray';
import { buildDivider } from './parts/divider';
import { buildGridBox, buildLid } from './parts/gridBox';
import { checkWatertight, parseBinaryStl, writeBinaryStl } from './stl';
import type { InsertModule, PartSpec, Project } from './types';

/** Indiziertes Dreiecksnetz, wie es Three.js und der STL-Writer benötigen. */
export interface MeshData {
  /** xyz-Koordinaten, 3 Werte pro Vertex. */
  positions: Float32Array;
  /** Vertex-Indizes, 3 pro Dreieck (gegen den Uhrzeigersinn = außen). */
  indices: Uint32Array;
}

export interface PartResult {
  mesh: MeshData;
  /** Volumen in mm³ (für Filamentschätzung). */
  volume: number;
  /** Status des Manifold-Kernels, 'NoError' bei gültiger Geometrie. */
  status: string;
}

function buildModuleSolid(k: ManifoldToplevel, s: Scope, m: InsertModule, p: Project): Manifold {
  const solid = m.type === 'cardTray' ? buildCardTray(k, s, m, p) : buildGridBox(k, s, m, p);
  const ctx = moduleContext(m, p);
  if (!ctx.layer.interlock || !ctx.grid.enabled) return solid;
  const size = moduleSize(m, p);
  const cellX = m.placement.rotated ? ctx.grid.cellY : ctx.grid.cellX;
  const cellY = m.placement.rotated ? ctx.grid.cellX : ctx.grid.cellY;
  return s.track(solid.subtract(buildGrooves(k, s, size.width, size.depth, cellX, cellY, ctx.grid)));
}

function buildSolid(k: ManifoldToplevel, s: Scope, spec: PartSpec, p: Project): Manifold {
  if (spec.kind === 'baseplate') {
    if (!spec.tile) throw new Error('Grundplatte ohne Kachel');
    return buildBaseplate(k, s, spec.tile, p);
  }
  const m = p.modules.find((x) => x.id === spec.moduleId);
  if (!m) throw new Error(`Modul ${spec.moduleId} nicht gefunden`);
  switch (spec.kind) {
    case 'module':
      return buildModuleSolid(k, s, m, p);
    case 'lid':
      if (m.type !== 'gridBox') throw new Error('Deckel nur für Rasterboxen');
      return buildLid(k, s, m, p);
    case 'divider':
      if (m.type !== 'cardTray') throw new Error('Trenner nur für Kartenfächer');
      return buildDivider(k, s, m, p, spec.variant ?? 1);
  }
}

export function manifoldToMesh(solid: Manifold): MeshData {
  const mesh = solid.getMesh();
  const n = mesh.numProp;
  const vertCount = mesh.vertProperties.length / n;
  const positions = new Float32Array(vertCount * 3);
  for (let i = 0; i < vertCount; i++) {
    positions[i * 3] = mesh.vertProperties[i * n];
    positions[i * 3 + 1] = mesh.vertProperties[i * n + 1];
    positions[i * 3 + 2] = mesh.vertProperties[i * n + 2];
  }
  return { positions, indices: new Uint32Array(mesh.triVerts) };
}

const SIMPLIFY_STEPS = [0.001, 0.005, 0.02];

/** Baut ein Teil und gibt sämtlichen WASM-Speicher wieder frei. */
export function buildPart(k: ManifoldToplevel, spec: PartSpec, p: Project): PartResult {
  const s = new Scope();
  try {
    const solid = buildSolid(k, s, spec, p);
    // STL speichert Koordinaten nur als float32. Winzige Splitterdreiecke
    // (< 1 µm) könnten dabei zusammenfallen; deshalb vereinfachen wir minimal
    // und prüfen das Ergebnis nach float32-Rundung. Reicht das nicht, wird die
    // Toleranz schrittweise erhöht (weiterhin weit unter Druckgenauigkeit).
    let best: { mesh: MeshData; volume: number; status: string } | null = null;
    for (const tol of SIMPLIFY_STEPS) {
      const simplified = s.track(solid.simplify(tol));
      const mesh = manifoldToMesh(simplified);
      const candidate = { mesh, volume: simplified.volume(), status: simplified.status() };
      best ??= candidate;
      if (checkWatertight(parseBinaryStl(writeBinaryStl(mesh))).watertight) return candidate;
    }
    return best!;
  } finally {
    s.dispose();
  }
}
