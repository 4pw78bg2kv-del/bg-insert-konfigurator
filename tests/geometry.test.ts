import { beforeAll, describe, expect, it } from 'vitest';
import { buildPart } from '../src/geometry/build';
import { initKernel, type ManifoldToplevel } from '../src/geometry/kernel';
import { checkWatertight, parseBinaryStl, writeBinaryStl } from '../src/geometry/stl';
import {
  cardsContent,
  createCardTray,
  createDefaultProject,
  createGridBox,
  createPocket,
  createShapeBox,
  generatePockets,
  gridTree,
  leaf,
  listParts,
  loadAllFonts,
  moduleSize,
  split,
  TEMPLATES,
  type CardTrayModule,
  type GridBoxModule,
  type InsertModule,
  type PartSpec,
  type Project,
  type ShapeBoxModule,
} from '../src/geometry';

let k: ManifoldToplevel;
beforeAll(async () => {
  k = await initKernel();
  await loadAllFonts();
});

interface Opts {
  grid?: boolean;
  baseplate?: boolean;
  pitch?: number;
  grow?: 'inner' | 'wall';
}

function projectWith(m: InsertModule, opts: Opts = {}): Project {
  const p = createDefaultProject();
  p.grid.enabled = opts.grid ?? false;
  p.grid.pitch = opts.pitch ?? 21;
  p.grid.grow = opts.grow ?? 'inner';
  p.baseplate.enabled = opts.baseplate ?? false;
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
const gbox = (o: Partial<GridBoxModule> = {}) => createGridBox({ label: { text: '', onLid: false, sides: 'none', size: 0 }, ...o });
const sbox = (o: Partial<ShapeBoxModule> = {}) => createShapeBox({ label: { text: '', onLid: false, sides: 'none', size: 0 }, ...o });
const label = (sides: 'frontBack' | 'leftRight' | 'front' | 'none', onLid = true, text = 'Ressourcen') => ({ text, onLid, sides, size: 0 });

const variants: [string, InsertModule, Opts?][] = [
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
  ['Kartenfach beschriftete Trenner, Deckel, Seitenschrift', tray({ dividerLabels: ['Wald', 'Wüste', 'Gebirge', 'Meer'], lid: 'snap', label: label('frontBack', true, 'Landschaften') })],
  ['Kartenfach schräg, Schrift links/rechts', tray({ tilt: 15, label: label('leftRight', false, 'Nachziehstapel') })],
  ['Box 3x2', gbox()],
  ['Box frei aufgeteilt', gbox({ root: split('y', [split('x', [leaf(), leaf(undefined, 2), leaf()]), leaf(undefined, 2), split('x', [leaf(undefined, 3), leaf()])]) })],
  ['Box Griffmulden vorne+hinten, Löcher', gbox({ fingerCutout: 'toFloor', fingerSides: 'frontBack', floorHole: true })],
  ['Box Griffmulden links/rechts', gbox({ fingerCutout: 'notch', fingerSides: 'leftRight' })],
  ['Box abgesenkte Trenner', gbox({ root: gridTree(4, 1), dividerLowering: 15 })],
  ['Box Token-Mulden beidseitig', gbox({ root: gridTree(3, 2, () => ({ type: 'scoop', sides: 'both' })) })],
  [
    'Kombi-Box Karten liegend + stehend + Tokens (auto)',
    gbox({
      sizeMode: 'auto',
      heightMode: 'fill',
      root: split('x', [
        split('y', [leaf(cardsContent({ count: 20 }), 1, 'auto'), leaf(cardsContent({ count: 20 }), 1, 'auto')], 1, 'auto'),
        split('y', [leaf(cardsContent({ orientation: 'standing', cardPreset: 'miniEuropean', count: 40 })), leaf(cardsContent({ orientation: 'standing', cardPreset: 'miniEuropean', count: 40 }))], 1, 'auto'),
        split('y', [leaf({ type: 'scoop', sides: 'front' }), leaf({ type: 'scoop', sides: 'front' })], 30, 'mm'),
      ]),
    }),
  ],
  ['Box Auflegedeckel', gbox({ lid: 'lift', label: label('none') })],
  ['Box Rastdeckel + Schrift überall', gbox({ lid: 'snap', label: label('frontBack') })],
  ['Box Schiebedeckel + Schrift', gbox({ lid: 'slide', label: label('front') })],
  ['Box Magnetdeckel', gbox({ lid: 'magnet', label: label('leftRight') })],
  ['Box Klappdeckel (Scharnier)', gbox({ lid: 'hinge', label: label('frontBack') })],
  ['Box Raster+Grundplatte+Deckel', gbox({ lid: 'snap', fingerCutout: 'toFloor', floorHole: true }), { grid: true, baseplate: true }],
  ['Box Raster 5 mm, dicke Wände', gbox({ width: 97, depth: 61, lid: 'magnet' }), { grid: true, baseplate: true, pitch: 5, grow: 'wall' }],
  ['Box Raster gedreht', gbox({ width: 60, depth: 100, placement: { mode: 'auto', x: 0, y: 0, rotated: true } }), { grid: true, baseplate: true }],
  ['Aufleger 9 Kreise', sbox()],
  ['Aufleger Formenmix, Rastdeckel, Schrift', sbox({
    lid: 'snap',
    label: label('frontBack', true, 'Marker'),
    pockets: [
      createPocket('arrow', 50, 26, { shaft: 12, head: 18 }, { x: 0, y: 0, rotation: 30 }),
      createPocket('star', 34, 32, { points: 5, inner: 45 }, { x: 55, y: 0, grip: 'two' }),
      createPocket('heart', 30, 28, {}, { x: 0, y: 45 }),
      createPocket('flag', 30, 40, {}, { x: 50, y: 45, grip: 'none' }),
      createPocket('callout', 40, 32, {}, { x: 100, y: 20 }),
      createPocket('lightning', 24, 40, {}, { x: 100, y: 70 }),
    ],
  })],
  ['Aufleger Schiebedeckel', sbox({ lid: 'slide', pockets: generatePockets({ shape: 'polygon', w: 34.6, h: 30, params: { sides: 6 }, pockets: 4, perStack: 6, thickness: 2, grip: 'one' }) })],
  ['Aufleger Klappdeckel', sbox({ lid: 'hinge' })],
  ['Aufleger Magnetdeckel', sbox({ lid: 'magnet', floorHole: true })],
];

describe('Alle Teile sind wasserdicht (STL-Roundtrip)', () => {
  it.each(variants)('%s', (_label, m, opts) => {
    const p = projectWith(m, opts);
    const parts = listParts(p);
    expect(parts.length).toBeGreaterThan(0);
    for (const spec of parts) {
      const bb = verifyPart(spec, p);
      if (spec.kind !== 'inlay' && spec.kind !== 'lidInlay') expect(bb.min[2], spec.name).toBeCloseTo(0, 3);
      if (spec.kind === 'module') {
        const size = moduleSize(m, p);
        expect(bb.min[0]).toBeGreaterThanOrEqual(-1e-3);
        expect(bb.max[0]).toBeLessThanOrEqual(size.width + 1e-3);
        expect(bb.max[0]).toBeGreaterThan(size.width - 0.01);
        // Schräge Fächer: Rückseite um 0,05 mm eingerückt (siehe cardTray.ts)
        expect(Math.abs(bb.max[1] - size.depth)).toBeLessThan(0.051);
        expect(bb.max[2]).toBeLessThanOrEqual(size.height + 1e-3);
      }
    }
  });
});

describe('Alle Vorlagen sind wasserdicht', () => {
  it.each(TEMPLATES.map((t) => [t.label, t] as const))('%s', (_label, t) => {
    const p = projectWith(t.create());
    for (const spec of listParts(p)) verifyPart(spec, p);
  });

  it('alle Vorlagen zusammen im Standardprojekt (Raster und Grundplatte wie voreingestellt)', () => {
    const p = createDefaultProject();
    p.modules.push(...TEMPLATES.map((t) => t.create()));
    for (const spec of listParts(p)) verifyPart(spec, p);
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
      expect(bb.max[0] - bb.min[0]).toBeLessThanOrEqual(p.print.bedX);
      expect(bb.max[1] - bb.min[1]).toBeLessThanOrEqual(p.print.bedY);
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
