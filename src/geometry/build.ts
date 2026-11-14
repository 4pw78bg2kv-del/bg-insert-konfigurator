/**
 * Einstiegspunkt der Geometrie: erzeugt für ein Teil (PartSpec) ein Mesh in
 * Druckorientierung (Unterseite auf Z = 0, linke vordere Ecke im Ursprung).
 */
import { lidInfo, baseWalls } from './dimensions';
import { Scope, type ManifoldToplevel, type Manifold } from './kernel';
import { cardTrayLayout, gridBoxLayout, moduleSize } from './layout';
import { labelText } from './parts';
import { buildBaseplate } from './parts/baseplate';
import { buildCardTrayParts } from './parts/cardTray';
import { buildDivider } from './parts/divider';
import { buildGridBoxParts, type BodyResult } from './parts/gridBox';
import { buildLidInlay, buildLidPart, type LidContext } from './parts/lids';
import { buildShapeBoxParts } from './parts/shapeBox';
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

function bodyParts(k: ManifoldToplevel, s: Scope, m: InsertModule, p: Project): BodyResult {
  if (m.type === 'cardTray') return buildCardTrayParts(k, s, m, p);
  if (m.type === 'gridBox') return buildGridBoxParts(k, s, m, p);
  return buildShapeBoxParts(k, s, m, p);
}

function lidContext(m: InsertModule, p: Project): LidContext {
  const size = moduleSize(m, p);
  const m2 = Math.max(2, p.print.wallThickness);
  const walls = m.type === 'shapeBox' ? { left: m2, right: m2, front: m2, back: m2 } : bodyWalls(m, p);
  return { W: size.width, D: size.depth, walls, hollow: m.type !== 'shapeBox' };
}

function bodyWalls(m: InsertModule, p: Project) {
  // Die tatsächlichen Wände (inkl. Rundungsrest) liefert das Modul-Layout.
  return layoutWalls(m, p) ?? baseWalls(m, p);
}

function layoutWalls(m: InsertModule, p: Project) {
  if (m.type === 'cardTray') return cardTrayLayout(m, p).walls;
  if (m.type === 'gridBox') return gridBoxLayout(m, p).walls;
  return null;
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
      return bodyParts(k, s, m, p).body;
    case 'inlay': {
      const t = bodyParts(k, s, m, p).text;
      if (!t) throw new Error('Keine Beschriftung');
      return t;
    }
    case 'lid':
      if (lidInfo(m, p).type === 'none') throw new Error('Modul hat keinen Deckel');
      return buildLidPart(k, s, m, p, lidContext(m, p), m.label.onLid ? labelText(m) : '');
    case 'lidInlay':
      return buildLidInlay(k, s, m, p, lidContext(m, p), labelText(m));
    case 'divider':
      if (m.type !== 'cardTray') throw new Error('Trenner nur für Kartenfächer');
      return buildDivider(k, s, m, p, spec.variant ?? 1, spec.text);
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
