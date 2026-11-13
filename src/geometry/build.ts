/**
 * Einstiegspunkt der Geometrie: erzeugt für ein Modul ein Mesh in
 * Druckorientierung (Boden auf Z = 0, linke vordere Ecke im Ursprung).
 */
import { Scope, type ManifoldToplevel, type Manifold } from './kernel';
import { buildCardTray } from './parts/cardTray';
import { buildGridBox } from './parts/gridBox';
import type { InsertModule, Project } from './types';

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

function buildManifold(k: ManifoldToplevel, s: Scope, m: InsertModule, project: Project): Manifold {
  switch (m.type) {
    case 'cardTray':
      return buildCardTray(k, s, m, project.print, project.box);
    case 'gridBox':
      return buildGridBox(k, s, m, project.print, project.box);
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

/** Baut ein Modul und gibt sämtlichen WASM-Speicher wieder frei. */
export function buildPart(k: ManifoldToplevel, m: InsertModule, project: Project): PartResult {
  const s = new Scope();
  try {
    const solid = buildManifold(k, s, m, project);
    return { mesh: manifoldToMesh(solid), volume: solid.volume(), status: solid.status() };
  } finally {
    s.dispose();
  }
}
