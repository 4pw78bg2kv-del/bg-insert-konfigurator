import { beforeAll, describe, expect, it } from 'vitest';
import { buildPart } from '../src/geometry/build';
import { initKernel, type ManifoldToplevel } from '../src/geometry/kernel';
import { checkWatertight, parseBinaryStl, writeBinaryStl } from '../src/geometry/stl';
import {
  createCardTray,
  createDefaultProject,
  createGridBox,
  listParts,
  moduleSize,
  type CardTrayModule,
  type GridBoxModule,
  type InsertModule,
  type PartSpec,
  type Project,
} from '../src/geometry';

let k: ManifoldToplevel;
beforeAll(async () => {
  k = await initKernel();
});

function projectWith(m: InsertModule, opts: { grid?: boolean; baseplate?: boolean } = {}): Project {
  const p = createDefaultProject();
  p.grid.enabled = opts.grid ?? false;
  p.grid.baseplate = opts.baseplate ?? false;
  m.layerId = p.layers[0].id;
  p.modules = [m];
  return p;
}

/** Baut ein Teil, schreibt die STL, liest sie wieder ein und prüft alles. */
function verifyPart(spec: PartSpec, p: Project) {
  const part = buildPart(k, spec, p);
  expect(part.status, spec.name).toBe('NoError');
  expect(part.volume, spec.name).toBeGreaterThan(0);
  const stl = writeBinaryStl(part.mesh);
  const triangles = part.mesh.indices.length / 3;
  expect(stl.byteLength).toBe(84 + 50 * triangles);
  const parsed = parseBinaryStl(stl);
  const report = checkWatertight(parsed);
  expect(report, spec.name).toMatchObject({ watertight: true, openEdges: 0, badlyOrientedEdges: 0, degenerateTriangles: 0 });
  expect(report.triangles).toBe(triangles);
  expect(report.signedVolume).toBeCloseTo(part.volume, 0);
  // Re-Import in Manifold gelingt nur bei echter 2-Mannigfaltigkeit
  const re = new k.Manifold(new k.Mesh({ numProp: 3, vertProperties: parsed.positions, triVerts: parsed.indices }));
  expect(re.status()).toBe('NoError');
  const bb = re.boundingBox();
  re.delete();
  return bb;
}

const tray = (o: Partial<CardTrayModule> = {}) => createCardTray(o);
const gbox = (o: Partial<GridBoxModule> = {}) => createGridBox(o);

const variants: [string, InsertModule, { grid?: boolean; baseplate?: boolean }?][] = [
  ['Kartenfach fest, stehend', tray({ dividerMode: 'fixed' })],
  ['Kartenfach fest, 2 Reihen, Loch, bis Boden', tray({ dividerMode: 'fixed', rows: 2, slots: 3, cardsPerSlot: 20, fingerCutout: 'toFloor', floorHole: true })],
  ['Kartenfach fest, schräg 20°', tray({ dividerMode: 'fixed', tilt: 20 })],
  ['Kartenfach Zacken, Lasche', tray({ dividerMode: 'toothed' })],
  ['Kartenfach Zacken, schräg 15°, 2 Reihen', tray({ dividerMode: 'toothed', tilt: 15, rows: 2, floorHole: true })],
  ['Kartenfach glatt, Querformat', tray({ dividerMode: 'loose', format: 'landscape', fingerCutout: 'none' })],
  ['Kartenfach liegend, 3 Fächer', tray({ orientation: 'flat', slots: 3, cardsPerSlot: 30, sleeve: 'none', heightMode: 'custom', customHeight: 20 })],
  ['Kartenfach liegend quer, 2 Reihen, Loch', tray({ orientation: 'flat', format: 'landscape', rows: 2, slots: 1, cardsPerSlot: 20, floorHole: true, fingerCutout: 'toFloor' })],
  ['Kartenfach Tarot Premium', tray({ cardPreset: 'tarot', sleeve: 'premium', orientation: 'flat', slots: 1, cardsPerSlot: 20 })],
  ['Kartenfach im Raster mit Grundplatte', tray({ dividerMode: 'toothed', tilt: 10 }), { grid: true, baseplate: true }],
  ['Rasterbox 3x2', gbox()],
  ['Rasterbox frei aufgeteilt', gbox({ layout: [{ size: 1, columns: [1, 2, 1] }, { size: 2, columns: [1] }, { size: 1, columns: [3, 1] }] })],
  ['Rasterbox Griffmulden vorne+hinten, Löcher', gbox({ fingerCutout: 'toFloor', fingerSides: 'frontBack', floorHole: true })],
  ['Rasterbox Griffmulden links/rechts', gbox({ fingerCutout: 'notch', fingerSides: 'leftRight' })],
  ['Rasterbox mit Deckel', gbox({ lid: 'snap' })],
  ['Rasterbox abgesenkte Trenner', gbox({ layout: [{ size: 1, columns: [1, 1, 1, 1] }], dividerLowering: 15 })],
  ['Rasterbox Raster+Grundplatte+Deckel', gbox({ lid: 'snap', fingerCutout: 'toFloor', floorHole: true }), { grid: true, baseplate: true }],
  ['Rasterbox Raster gedreht', gbox({ widthCells: 3, depthCells: 5, placement: { mode: 'auto', x: 0, y: 0, gx: 0, gy: 0, rotated: true } }), { grid: true, baseplate: true }],
];

describe('Alle Teile sind wasserdicht (STL-Roundtrip)', () => {
  it.each(variants)('%s', (_label, m, opts) => {
    const p = projectWith(m, opts);
    const parts = listParts(p);
    expect(parts.length).toBeGreaterThan(0);
    for (const spec of parts) {
      const bb = verifyPart(spec, p);
      expect(bb.min[2]).toBeCloseTo(0, 3);
      if (spec.kind === 'module') {
        const size = moduleSize(m, p);
        const lid = m.type === 'gridBox' && m.lid === 'snap' ? 1.6 : 0;
        expect(bb.min[0]).toBeGreaterThanOrEqual(-1e-3);
        expect(bb.max[0]).toBeCloseTo(size.width, 3);
        // Schräge Fächer: Rückseite um 0,05 mm eingerückt (siehe cardTray.ts)
        expect(Math.abs(bb.max[1] - size.depth)).toBeLessThan(0.051);
        expect(bb.max[2]).toBeCloseTo(size.height - lid, 3);
      }
    }
  });
});

describe('Teileliste', () => {
  it('erzeugt Trenner-Varianten, Deckel und Grundplatten', () => {
    const p = createDefaultProject();
    const parts = listParts(p);
    const kinds = parts.map((x) => x.kind);
    expect(kinds).toContain('divider');
    expect(kinds).toContain('lid');
    expect(kinds).toContain('baseplate');
    const dividers = parts.filter((x) => x.kind === 'divider');
    // 4 Trenner versetzt: 2 links, 1 Mitte, 1 rechts
    expect(dividers.map((d) => d.quantity)).toEqual([2, 1, 1]);
    expect(dividers[0].name).toMatch(/Trenner links/);
    for (const spec of parts.filter((x) => x.kind === 'baseplate')) {
      const bb = verifyPart(spec, p);
      expect(bb.max[0] - bb.min[0]).toBeLessThanOrEqual(p.grid.maxTileSize + 1e-6);
      expect(bb.max[1] - bb.min[1]).toBeLessThanOrEqual(p.grid.maxTileSize + 1e-6);
    }
  });
});

describe('Wasserdicht-Prüfung erkennt Fehler', () => {
  const spec = (p: Project): PartSpec => listParts(p)[0];
  it('meldet ein Loch, wenn ein Dreieck fehlt', () => {
    const p = projectWith(gbox());
    const part = buildPart(k, spec(p), p);
    const report = checkWatertight({ positions: part.mesh.positions, indices: part.mesh.indices.slice(3) });
    expect(report.watertight).toBe(false);
    expect(report.openEdges).toBeGreaterThan(0);
  });

  it('meldet falsch orientierte Dreiecke', () => {
    const p = projectWith(gbox());
    const part = buildPart(k, spec(p), p);
    const idx = part.mesh.indices.slice();
    [idx[0], idx[1]] = [idx[1], idx[0]];
    expect(checkWatertight({ positions: part.mesh.positions, indices: idx }).watertight).toBe(false);
  });

  it('lehnt beschädigte STL-Dateien ab', () => {
    expect(() => parseBinaryStl(new ArrayBuffer(10))).toThrow();
    const p = projectWith(gbox());
    const stl = writeBinaryStl(buildPart(k, spec(p), p).mesh);
    expect(() => parseBinaryStl(stl.slice(0, stl.byteLength - 7))).toThrow();
  });
});
