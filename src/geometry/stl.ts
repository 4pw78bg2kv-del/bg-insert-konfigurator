/**
 * Binärer STL-Export, STL-Parser und Wasserdicht-Prüfung.
 *
 * Die Prüfung arbeitet bewusst auf der *exportierten* Datei: Sie liest die
 * STL wieder ein, verschmilzt Vertices mit identischen Koordinaten und prüft,
 * dass jede Kante von genau zwei Dreiecken mit entgegengesetzter Richtung
 * geteilt wird (geschlossen + konsistent orientiert) und das Volumen positiv ist.
 */
import type { MeshData } from './build';

const HEADER_BYTES = 80;
const TRI_BYTES = 50;

export function writeBinaryStl(mesh: MeshData, header = 'BG-Insert-Konfigurator'): ArrayBuffer {
  const { positions: p, indices } = mesh;
  const triCount = indices.length / 3;
  const buffer = new ArrayBuffer(HEADER_BYTES + 4 + triCount * TRI_BYTES);
  const view = new DataView(buffer);
  const head = new TextEncoder().encode(header.slice(0, 79));
  new Uint8Array(buffer, 0, HEADER_BYTES).set(head);
  view.setUint32(HEADER_BYTES, triCount, true);

  let o = HEADER_BYTES + 4;
  for (let t = 0; t < triCount; t++) {
    const a = indices[t * 3] * 3;
    const b = indices[t * 3 + 1] * 3;
    const c = indices[t * 3 + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    view.setFloat32(o, nx, true);
    view.setFloat32(o + 4, ny, true);
    view.setFloat32(o + 8, nz, true);
    o += 12;
    for (const idx of [a, b, c]) {
      view.setFloat32(o, p[idx], true);
      view.setFloat32(o + 4, p[idx + 1], true);
      view.setFloat32(o + 8, p[idx + 2], true);
      o += 12;
    }
    view.setUint16(o, 0, true);
    o += 2;
  }
  return buffer;
}

/** Liest eine binäre STL in ein indiziertes Mesh (Vertices per Koordinate verschmolzen). */
export function parseBinaryStl(buffer: ArrayBuffer): MeshData {
  if (buffer.byteLength < HEADER_BYTES + 4) throw new Error('STL zu kurz');
  const view = new DataView(buffer);
  const triCount = view.getUint32(HEADER_BYTES, true);
  if (buffer.byteLength !== HEADER_BYTES + 4 + triCount * TRI_BYTES) {
    throw new Error(`STL-Größe passt nicht zur Dreiecksanzahl (${triCount})`);
  }
  const map = new Map<string, number>();
  const pos: number[] = [];
  const indices = new Uint32Array(triCount * 3);
  let o = HEADER_BYTES + 4;
  for (let t = 0; t < triCount; t++) {
    o += 12; // Normale überspringen
    for (let v = 0; v < 3; v++) {
      const x = view.getFloat32(o, true);
      const y = view.getFloat32(o + 4, true);
      const z = view.getFloat32(o + 8, true);
      o += 12;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) throw new Error('Ungültige Koordinate in STL');
      const key = `${x},${y},${z}`;
      let idx = map.get(key);
      if (idx === undefined) {
        idx = pos.length / 3;
        map.set(key, idx);
        pos.push(x, y, z);
      }
      indices[t * 3 + v] = idx;
    }
    o += 2;
  }
  return { positions: new Float32Array(pos), indices };
}

export interface WatertightReport {
  watertight: boolean;
  triangles: number;
  vertices: number;
  /** Kanten, die nicht von genau zwei Dreiecken geteilt werden. */
  openEdges: number;
  /** Kanten mit falscher (nicht entgegengesetzter) Orientierung. */
  badlyOrientedEdges: number;
  /** Degenerierte Dreiecke (doppelte Vertices). */
  degenerateTriangles: number;
  /** Vorzeichenbehaftetes Volumen in mm³ (positiv = Normalen zeigen nach außen). */
  signedVolume: number;
}

export function checkWatertight(mesh: MeshData): WatertightReport {
  const { positions: p, indices } = mesh;
  const triCount = indices.length / 3;
  const directed = new Map<string, number>();
  let degenerate = 0;
  let vol = 0;

  for (let t = 0; t < triCount; t++) {
    const tri = [indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]];
    if (tri[0] === tri[1] || tri[1] === tri[2] || tri[0] === tri[2]) degenerate++;
    for (let e = 0; e < 3; e++) {
      const key = `${tri[e]}>${tri[(e + 1) % 3]}`;
      directed.set(key, (directed.get(key) ?? 0) + 1);
    }
    const [a, b, c] = tri.map((i) => i * 3);
    vol +=
      (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) -
        p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) +
        p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) /
      6;
  }

  let openEdges = 0;
  let badlyOriented = 0;
  for (const [key, count] of directed) {
    const [a, b] = key.split('>');
    const reverse = directed.get(`${b}>${a}`) ?? 0;
    if (count > 1) badlyOriented++;
    if (reverse === 0) openEdges++;
    else if (reverse !== count) badlyOriented++;
  }

  return {
    watertight: triCount > 0 && openEdges === 0 && badlyOriented === 0 && degenerate === 0 && vol > 0,
    triangles: triCount,
    vertices: p.length / 3,
    openEdges,
    badlyOrientedEdges: badlyOriented,
    degenerateTriangles: degenerate,
    signedVolume: vol,
  };
}
