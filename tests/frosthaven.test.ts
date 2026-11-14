import { beforeAll, describe, expect, it } from 'vitest';
import { buildPart } from '../src/geometry/build';
import { initKernel, type ManifoldToplevel } from '../src/geometry/kernel';
import { checkWatertight, parseBinaryStl, writeBinaryStl } from '../src/geometry/stl';
import {
  GAME_PRESETS,
  LOOSE_LIMIT,
  cardTrayLayout,
  computeLayout,
  createCardTray,
  createDefaultProject,
  createFrosthavenProject,
  createPocket,
  createShapeBox,
  fillReport,
  gridBoxLayout,
  listParts,
  loadAllFonts,
  moduleSize,
  parseProject,
  serializeProject,
  validateProject,
  type CardTrayModule,
  type GridBoxModule,
  type Project,
} from '../src/geometry';
import { labelAnchor, shapeOutline } from '../src/geometry/shapes';
import { dividerOutline as outline, labelLines } from '../src/geometry/parts/divider';

let k: ManifoldToplevel;
beforeAll(async () => {
  k = await initKernel();
  await loadAllFonts();
});

describe('Hängetrenner', () => {
  const tray = (o: Partial<CardTrayModule> = {}) =>
    createCardTray({ cardPreset: 'miniEuropean', format: 'portrait', dividerMode: 'loose', tab: true, tabStyle: 'header', tabHeight: 14, dividerCount: 3, totalCards: 60, ...o });

  it('Fach braucht nur Kartenhöhe, die Kopfleiste zählt zur Gesamthöhe', () => {
    const p = createDefaultProject();
    const hang = tray();
    const tab = tray({ tabStyle: 'tab' });
    p.modules = [hang, tab];
    const lh = cardTrayLayout(hang, p);
    const lt = cardTrayLayout(tab, p);
    expect(lh.requiredInnerHeight).toBeLessThan(lt.requiredInnerHeight);
    expect(lh.headerHeight).toBe(14);
    expect(lh.total).toBeCloseTo(lh.height + 14, 5);
    expect(lh.dividerBodyHeight).toBeCloseTo(lh.cavityHeight, 5);
    // Kopfleiste liegt auf den Wänden, ragt aber nicht über die Außenkante
    const { pts } = outline(hang, p, 1);
    const xs = pts.map((q) => q[0]);
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(lh.rowX[0] + p.print.clearance + Math.min(...xs)).toBeGreaterThanOrEqual(-1e-6);
    expect(lh.rowX[0] + p.print.clearance + Math.max(...xs)).toBeLessThanOrEqual(lh.width + 1e-6);
    expect(Math.max(...pts.map((q) => q[1]))).toBeCloseTo(lh.dividerBodyHeight + 14, 5);
  });

  it('schaltet bei Neigung auf die normale Lasche und sperrt den Deckel', () => {
    const p = createDefaultProject();
    const tilted = tray({ tilt: 20 });
    p.modules = [tilted];
    expect(cardTrayLayout(tilted, p).headerHeight).toBe(0);
    const lidded = tray({ lid: 'snap' });
    p.modules = [lidded];
    expect(listParts(p).some((x) => x.kind === 'lid')).toBe(false);
    expect(validateProject(p, computeLayout(p)).some((m) => m.text.includes('Hängetrenner'))).toBe(true);
  });

  it('bricht lange Beschriftungen auf zwei Zeilen um', () => {
    const r = labelLines('Inaktive Sommer Außenposten-Ereignisse', 'serif', 40, 12);
    expect(r.lines).toHaveLength(2);
    expect(labelLines('Aktiv', 'serif', 40, 12).lines).toHaveLength(1);
  });

  it('Trenner und Fach sind wasserdicht', () => {
    const p = createDefaultProject();
    p.modules = [tray({ dividerLabels: ['Verfügbare Pläne', 'Aktiv'] })];
    for (const spec of listParts(p)) {
      const part = buildPart(k, spec, p);
      expect(part.status, spec.name).toBe('NoError');
      expect(checkWatertight(parseBinaryStl(writeBinaryStl(part.mesh))).watertight, spec.name).toBe(true);
    }
  });
});

describe('Freiform-Taschen und Beschriftung im Taschenboden', () => {
  const tri: [number, number][] = [[-10, -5], [10, -5], [0, 5]];

  it('skaliert den Freiform-Umriss auf Breite × Höhe', () => {
    const o = shapeOutline('custom', 40, 20, {}, tri);
    const xs = o.map((q) => q[0]);
    const ys = o.map((q) => q[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(40, 5);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(20, 5);
    // ohne Punkte: Rechteck
    expect(shapeOutline('custom', 40, 20, {})).toHaveLength(4);
  });

  it('findet den breitesten Platz für die Schrift', () => {
    // L-Form: der große Schenkel liegt rechts
    const L: [number, number][] = [[0, 0], [60, 0], [60, 40], [40, 40], [40, 10], [0, 10]];
    const a = labelAnchor(L);
    expect(a.x).toBeGreaterThan(45);
    expect(a.r).toBeGreaterThan(9);
    expect(a.spanY).toBeGreaterThan(a.spanX);
  });

  it('übersteht Speichern und Laden, Beschriftung wird vertieft', () => {
    const p = createDefaultProject();
    const box = createShapeBox({
      name: 'Freiform',
      heightMode: 'custom',
      customHeight: 10,
      floorHole: false,
      pockets: [createPocket('custom', 50, 30, {}, { x: 30, y: 20, count: 3, thickness: 2, grip: 'none', points: tri, label: '5× Wasser' })],
      label: { text: '', onLid: false, sides: 'none', size: 0 },
    });
    p.modules = [box];
    const back = parseProject(serializeProject(p));
    expect(back).toEqual(p);
    const spec = listParts(p).find((x) => x.kind === 'module')!;
    const withLabel = buildPart(k, spec, p);
    expect(checkWatertight(parseBinaryStl(writeBinaryStl(withLabel.mesh))).watertight).toBe(true);
    const plain = buildPart(k, spec, { ...p, modules: [{ ...box, pockets: box.pockets.map((pk) => ({ ...pk, label: undefined })) }] });
    expect(withLabel.volume).toBeLessThan(plain.volume - 1);
  });
});

describe('Spiel-Preset Frosthaven', () => {
  const find = (p: Project, name: string) => {
    const m = p.modules.find((x) => x.name === name);
    if (!m) throw new Error(`Modul fehlt: ${name}`);
    return m;
  };

  it('ist in der Galerie eingetragen', () => {
    expect(GAME_PRESETS.map((g) => g.id)).toContain('frosthaven');
  });

  it('hat keine Fehler, Warnungen oder Hinweise (Kollision, Überstand, Druckbett, Höhe, Lücken)', () => {
    const p = createFrosthavenProject();
    const msgs = validateProject(p, computeLayout(p));
    expect(msgs).toEqual([]);
  });

  it('füllt die Schachtel lückenlos bis unter den Kopfraum', () => {
    const p = createFrosthavenProject();
    expect(p.box).toMatchObject({ innerWidth: 403, innerDepth: 286, innerHeight: 240 });
    const layout = computeLayout(p);
    const rep = fillReport(p, layout);
    expect(rep.fill).toBeGreaterThan(0.97);
    expect(rep.loose).toEqual([]);
    for (const i of rep.instances) for (const v of Object.values(i.free)) expect(v).toBeLessThanOrEqual(LOOSE_LIMIT);
    // Jeder Stapel endet genau unter dem Kopfraum
    const top = p.box.innerHeight - p.box.headroom;
    const columns = layout.filter((a) => !layout.some((b) => b !== a && b.z >= a.z + a.height - 0.01 && b.x < a.x + a.width && a.x < b.x + b.width && b.y < a.y + a.depth && a.y < b.y + b.depth));
    for (const c of columns) expect(c.z + c.height).toBeCloseTo(top, 5);
  });

  it('hat für jedes Spielmaterial einen Platz', () => {
    const p = createFrosthavenProject();
    // 17 Charakterboxen 153 × 122 × 17 hochkant
    const chars = find(p, 'Charakterboxen') as CardTrayModule;
    const cl = cardTrayLayout(chars, p);
    expect(chars.totalCards).toBe(17);
    expect(cl.rowInnerX).toBeGreaterThanOrEqual(122);
    expect(cl.cavityLength).toBeGreaterThanOrEqual(17 * 17);
    expect(cl.cavityHeight).toBeGreaterThanOrEqual(153);
    // 22 Monsterboxen für 43 Monsterarten, Innenraum für die Wertekarte 103 × 103
    const monsters = p.modules.filter((m) => m.name.startsWith('Monster ')) as GridBoxModule[];
    expect(monsters).toHaveLength(22);
    for (const m of monsters) {
      const l = gridBoxLayout(m, p);
      expect(l.width - l.walls.left - l.walls.right).toBeGreaterThanOrEqual(104);
      expect(l.depth - l.walls.front - l.walls.back).toBeGreaterThanOrEqual(104);
      expect(l.height - l.floor).toBeGreaterThanOrEqual(15);
    }
    // 18 Miniaturen-Schachteln: 4 × 51 × 29 und 14 × 30 × 29, 55 mm hoch
    const cells = ['Miniaturen A', 'Miniaturen B'].flatMap((n) => gridBoxLayout(find(p, n) as GridBoxModule, p).cells);
    const big = cells.filter((c) => Math.max(c.w, c.d) >= 51.2 && Math.min(c.w, c.d) >= 29.2);
    const small = cells.filter((c) => !big.includes(c) && Math.max(c.w, c.d) >= 30.2 && Math.min(c.w, c.d) >= 29.2);
    expect(big.length).toBeGreaterThanOrEqual(4);
    expect(small.length).toBeGreaterThanOrEqual(14);
    for (const n of ['Miniaturen A', 'Miniaturen B']) expect(gridBoxLayout(find(p, n) as GridBoxModule, p).height - p.print.floorThickness).toBeGreaterThanOrEqual(55);
    // Gebietsaufleger: alle 46 Taschen der beiden Original-Schalen, beschriftet
    const overlays = p.modules.filter((m) => m.type === 'shapeBox');
    expect(overlays.flatMap((m) => (m.type === 'shapeBox' ? m.pockets : [])).filter((pk) => pk.shape === 'custom' && pk.label)).toHaveLength(46);
    // Kartenfächer: Kapazität für Ereignisse (247) und Gebäude (29), Gegenstände (379 + 15)
    const cap = (...names: string[]) => names.reduce((s, n) => s + (find(p, n) as CardTrayModule).totalCards, 0);
    expect(cap('Ereignisse Sommer und Boot', 'Ereignisse Winter und Gebäude')).toBeGreaterThanOrEqual(247 + 29);
    expect(cap('Gegenstände kaufen und herstellen', 'Gegenstände Pläne')).toBeGreaterThanOrEqual(379 + 15);
  });

  it('übernimmt die Maße der Original-Inserts', () => {
    const p = createFrosthavenProject();
    // Hängetrenner wie im Original: Kopfleiste 14 mm, Trennerkörper ≈ 92 mm (Standard) und 102,4 mm (Bosse)
    const events = find(p, 'Ereignisse Sommer und Boot') as CardTrayModule;
    expect(events.tabHeight).toBe(14);
    expect(cardTrayLayout(events, p).dividerWidth).toBeCloseTo(92.1, 1);
    expect(cardTrayLayout(find(p, 'Bosse') as CardTrayModule, p).dividerWidth).toBeCloseTo(102.4, 1);
    // Aufleger-Schalen 15 mm hoch, Taschen 13,6 mm tief
    for (const m of p.modules) if (m.type === 'shapeBox') expect(moduleSize(m, p).height).toBe(15);
  });

  it('übersteht Speichern und Laden als JSON', () => {
    const p = createFrosthavenProject();
    const back = parseProject(serializeProject(p));
    expect(back).toEqual(p);
  });

  it('alle Teile sind wasserdicht', { timeout: 600_000 }, () => {
    const p = createFrosthavenProject();
    for (const spec of listParts(p)) {
      const part = buildPart(k, spec, p);
      expect(part.status, spec.name).toBe('NoError');
      expect(checkWatertight(parseBinaryStl(writeBinaryStl(part.mesh))).watertight, spec.name).toBe(true);
    }
  });
});
