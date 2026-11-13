import { beforeAll, describe, expect, it } from 'vitest';
import { buildPart } from '../src/geometry/build';
import { initKernel, type ManifoldToplevel } from '../src/geometry/kernel';
import { checkWatertight, parseBinaryStl, writeBinaryStl } from '../src/geometry/stl';
import {
  createCardTray,
  createDefaultProject,
  createGridBox,
  moduleSize,
  type InsertModule,
  type Project,
} from '../src/geometry';

let k: ManifoldToplevel;
beforeAll(async () => {
  k = await initKernel();
});

function projectWith(...modules: InsertModule[]): Project {
  return { ...createDefaultProject(), modules };
}

const variants: [string, InsertModule][] = [
  ['Kartenfach stehend, Mulde', createCardTray()],
  ['Kartenfach stehend, ohne Mulde, 1 Fach', createCardTray({ fingerCutout: false, slots: 1 })],
  ['Kartenfach liegend, 3 Fächer', createCardTray({ orientation: 'flat', slots: 3, cardCount: 30, sleeve: 'none' })],
  ['Kartenfach Tarot Premium', createCardTray({ cardPreset: 'tarot', sleeve: 'premium', orientation: 'flat', slots: 1, cardCount: 20 })],
  ['Kartenfach eigene Höhe', createCardTray({ heightMode: 'custom', customHeight: 45, cardPreset: 'miniEuropean' })],
  ['Kartenfach Custom-Karte', createCardTray({ cardPreset: 'custom', customCardWidth: 80, customCardHeight: 50, slots: 4 })],
  ['Rasterbox 3x2', createGridBox()],
  ['Rasterbox 1x1', createGridBox({ columns: 1, rows: 1 })],
  ['Rasterbox abgesenkte Trenner', createGridBox({ columns: 4, rows: 3, dividerLowering: 15 })],
  ['Rasterbox flach', createGridBox({ heightMode: 'custom', customHeight: 12, columns: 6, rows: 1 })],
];

describe('STL-Export ist wasserdicht', () => {
  it.each(variants)('%s', (_label, m) => {
    const project = projectWith(m);
    const part = buildPart(k, m, project);
    expect(part.status).toBe('NoError');
    expect(part.volume).toBeGreaterThan(0);

    // Direkt aus dem Kernel: geschlossen
    expect(checkWatertight(part.mesh).watertight).toBe(true);

    // Export + erneutes Einlesen der Binär-STL
    const stl = writeBinaryStl(part.mesh);
    const triangles = part.mesh.indices.length / 3;
    expect(stl.byteLength).toBe(84 + 50 * triangles);
    const parsed = parseBinaryStl(stl);
    const report = checkWatertight(parsed);
    expect(report).toMatchObject({ watertight: true, openEdges: 0, badlyOrientedEdges: 0, degenerateTriangles: 0 });
    expect(report.triangles).toBe(triangles);
    expect(report.signedVolume).toBeCloseTo(part.volume, 0);

    // Re-Import in Manifold muss gelingen (Manifold akzeptiert nur echte 2-Mannigfaltigkeiten)
    const reimported = new k.Manifold(
      new k.Mesh({ numProp: 3, vertProperties: parsed.positions, triVerts: parsed.indices }),
    );
    expect(reimported.status()).toBe('NoError');
    expect(reimported.genus()).toBeGreaterThanOrEqual(0);

    // Bounding Box entspricht den berechneten Außenmaßen, Boden auf Z = 0
    const bb = reimported.boundingBox();
    const size = moduleSize(m, project);
    expect(bb.min[0]).toBeCloseTo(0, 3);
    expect(bb.min[1]).toBeCloseTo(0, 3);
    expect(bb.min[2]).toBeCloseTo(0, 3);
    expect(bb.max[0]).toBeCloseTo(size.width, 3);
    expect(bb.max[1]).toBeCloseTo(size.depth, 3);
    expect(bb.max[2]).toBeCloseTo(size.height, 3);
    reimported.delete();
  });
});

describe('Wasserdicht-Prüfung erkennt Fehler', () => {
  it('meldet ein Loch, wenn ein Dreieck fehlt', () => {
    const m = createGridBox();
    const part = buildPart(k, m, projectWith(m));
    const broken = { positions: part.mesh.positions, indices: part.mesh.indices.slice(3) };
    const report = checkWatertight(broken);
    expect(report.watertight).toBe(false);
    expect(report.openEdges).toBeGreaterThan(0);
  });

  it('meldet falsch orientierte Dreiecke', () => {
    const m = createGridBox();
    const part = buildPart(k, m, projectWith(m));
    const idx = part.mesh.indices.slice();
    [idx[0], idx[1]] = [idx[1], idx[0]];
    expect(checkWatertight({ positions: part.mesh.positions, indices: idx }).watertight).toBe(false);
  });

  it('lehnt beschädigte STL-Dateien ab', () => {
    expect(() => parseBinaryStl(new ArrayBuffer(10))).toThrow();
    const m = createGridBox();
    const stl = writeBinaryStl(buildPart(k, m, projectWith(m)).mesh);
    expect(() => parseBinaryStl(stl.slice(0, stl.byteLength - 7))).toThrow();
  });
});
