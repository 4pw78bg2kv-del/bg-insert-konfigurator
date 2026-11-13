import { describe, expect, it } from 'vitest';
import {
  cardTrayLayout,
  computeLayout,
  createCardTray,
  createDefaultProject,
  createGridBox,
  createLayer,
  effectiveCard,
  gridBoxLayout,
  gridInfo,
  layerInfos,
  moduleSize,
  parseProject,
  partFileName,
  serializeProject,
  uniqueFileNames,
  validateProject,
  type InsertModule,
  type Project,
} from '../src/geometry';

function project(modules: InsertModule[], grid = false): Project {
  const p = createDefaultProject();
  p.grid.enabled = grid;
  modules.forEach((m) => (m.layerId = p.layers[0].id));
  p.modules = modules;
  return p;
}
const errors = (p: Project) => validateProject(p, computeLayout(p)).filter((m) => m.level === 'error');

describe('Sleeves-Kalkulator', () => {
  it('addiert Hüllen-Aufschläge', () => {
    const none = effectiveCard(createCardTray({ sleeve: 'none' }));
    const prem = effectiveCard(createCardTray({ sleeve: 'premium' }));
    expect(none.width).toBe(63.5);
    expect(prem.width).toBeGreaterThan(none.width);
    expect(prem.thickness).toBeGreaterThan(none.thickness);
  });
});

describe('Kartenfach-Maße', () => {
  it('berechnet die Länge aus Karten und Trennern', () => {
    const a = createCardTray({ dividerMode: 'loose', totalCards: 100, dividerCount: 0, sleeve: 'none' });
    const b = createCardTray({ dividerMode: 'loose', totalCards: 200, dividerCount: 0, sleeve: 'none' });
    const c = createCardTray({ dividerMode: 'loose', totalCards: 200, dividerCount: 10, sleeve: 'none' });
    const p = project([a, b, c]);
    const la = cardTrayLayout(a, p), lb = cardTrayLayout(b, p), lc = cardTrayLayout(c, p);
    expect(lb.cavityLength - la.cavityLength).toBeCloseTo(100 * 0.32, 5);
    expect(lc.cavityLength).toBeGreaterThan(lb.cavityLength + 10 * 1.2);
  });

  it('zweireihig halbiert die Länge und verdoppelt die Breite', () => {
    const one = createCardTray({ dividerMode: 'loose', totalCards: 200, rows: 1 });
    const two = createCardTray({ dividerMode: 'loose', totalCards: 200, rows: 2 });
    const p = project([one, two]);
    expect(cardTrayLayout(two, p).cavityLength).toBeLessThan(cardTrayLayout(one, p).cavityLength * 0.6);
    expect(moduleSize(two, p).width).toBeGreaterThan(moduleSize(one, p).width * 1.8);
  });

  it('Querformat tauscht Breite und Höhe der Karte', () => {
    const portrait = createCardTray({ format: 'portrait', cardPreset: 'miniEuropean' });
    const landscape = createCardTray({ format: 'landscape', cardPreset: 'miniEuropean' });
    const p = project([portrait, landscape]);
    expect(cardTrayLayout(portrait, p).cardFaceW).toBeCloseTo(cardTrayLayout(landscape, p).cardFaceH);
    expect(moduleSize(landscape, p).height).toBeLessThan(moduleSize(portrait, p).height);
  });

  it('Höhe automatisch berücksichtigt die Trennerlasche, schräg wird niedriger', () => {
    const noTab = createCardTray({ tab: false, format: 'portrait', cardPreset: 'miniEuropean' });
    const tab = createCardTray({ tab: true, tabHeight: 8, format: 'portrait', cardPreset: 'miniEuropean' });
    const tilted = createCardTray({ tab: true, tabHeight: 8, tilt: 30, format: 'portrait', cardPreset: 'miniEuropean' });
    const p = project([noTab, tab, tilted]);
    expect(moduleSize(tab, p).height - moduleSize(noTab, p).height).toBeCloseTo(8, 5);
    expect(moduleSize(tilted, p).height).toBeLessThan(moduleSize(tab, p).height);
    expect(errors(p)).toEqual([]);
  });
});

describe('Rasterbox-Aufteilung', () => {
  it('teilt Reihen und Spalten nach Anteilen', () => {
    const m = createGridBox({ width: 100, depth: 60, layout: [{ size: 1, columns: [1, 3] }, { size: 2, columns: [1] }] });
    const p = project([m]);
    const l = gridBoxLayout(m, p);
    expect(l.cells).toHaveLength(3);
    expect(l.cells[1].w).toBeCloseTo(l.cells[0].w * 3, 5);
    expect(l.cells[2].d).toBeCloseTo(l.cells[0].d * 2, 5);
  });

  it('senkt Trennwände für den Deckel automatisch ab', () => {
    const m = createGridBox({ lid: 'snap', dividerLowering: 0 });
    expect(gridBoxLayout(m, project([m])).dividerLowering).toBeGreaterThanOrEqual(4);
  });
});

describe('Innenraster', () => {
  it('füllt die Schachtel exakt aus und rundet Module auf ganze Zellen', () => {
    const tray = createCardTray();
    const p = project([tray, createGridBox({ widthCells: 4, depthCells: 3 })], true);
    const g = gridInfo(p);
    expect(g.nx * g.cellX + p.print.clearance).toBeCloseTo(p.box.innerWidth, 6);
    const s = moduleSize(tray, p);
    const cells = (s.width + p.print.clearance) / g.cellX;
    expect(Math.abs(cells - Math.round(cells))).toBeLessThan(1e-6);
    expect(errors(p)).toEqual([]);
  });

  it('platziert Module im Raster ohne Überschneidung', () => {
    const p = createDefaultProject();
    p.modules[1].quantity = 3;
    const layout = computeLayout(p);
    expect(layout).toHaveLength(5);
    expect(errors(p)).toEqual([]);
  });

  it('Grundplatte verringert die verfügbare Höhe der untersten Ebene', () => {
    const p = createDefaultProject();
    const [l0] = layerInfos(p);
    expect(l0.available).toBeCloseTo(l0.height - 1.2, 6);
    p.grid.baseplate = false;
    expect(layerInfos(p)[0].available).toBeCloseTo(l0.height, 6);
  });
});

describe('Ebenen', () => {
  it('verteilt die Höhe auf Auto-Ebenen und stapelt sie', () => {
    const p = createDefaultProject();
    p.layers.push(createLayer(1, { heightMode: 'fixed', height: 20 }));
    const infos = layerInfos(p);
    expect(infos[1].height).toBe(20);
    expect(infos[0].height).toBeCloseTo(95 - 20, 6);
    expect(infos[1].z).toBeCloseTo(infos[0].height, 6);
    const box = createGridBox({ layerId: p.layers[1].id });
    p.modules.push(box);
    const inst = computeLayout(p).find((i) => i.moduleId === box.id)!;
    expect(inst.z).toBeCloseTo(75, 6);
    expect(moduleSize(box, p).height).toBeCloseTo(20, 6);
  });

  it('meldet zu hohe Ebenen', () => {
    const p = createDefaultProject();
    p.layers = [createLayer(0, { heightMode: 'fixed', height: 80 }), createLayer(1, { heightMode: 'fixed', height: 30 })];
    p.modules = [];
    expect(errors(p).some((e) => /Ebenen sind zusammen/.test(e.text))).toBe(true);
  });
});

describe('Validierung', () => {
  it('meldet zu hohe stehende Karten', () => {
    const p = project([createCardTray({ cardPreset: 'tarot', format: 'portrait', heightMode: 'layer' })]);
    expect(errors(p).some((m) => /passen nicht/.test(m.text))).toBe(true);
  });

  it('meldet Überstand', () => {
    const p = project([createGridBox({ width: 400 })]);
    expect(errors(p).some((m) => /ragt über/.test(m.text))).toBe(true);
  });

  it('weicht manuell platzierten Modulen aus (ohne Raster)', () => {
    const p = project([
      createGridBox({ name: 'fix', placement: { mode: 'manual', x: 0.2, y: 0.2, gx: 0, gy: 0, rotated: false } }),
      createGridBox({ name: 'auto' }),
    ]);
    const layout = computeLayout(p);
    expect(errors(p)).toEqual([]);
    expect(layout[1].x).toBeGreaterThanOrEqual(100.2);
  });
});

describe('Dateinamen', () => {
  it('enthält Stückzahl und Name', () => {
    expect(partFileName(createCardTray({ name: 'Kartenfach Poker', quantity: 2 }))).toBe('2x_Kartenfach_Poker.stl');
    expect(partFileName(createGridBox({ name: 'Münzen / Gold', quantity: 1 }))).toBe('1x_Muenzen_Gold.stl');
    expect(uniqueFileNames(['a.stl', 'a.stl', 'b.stl'])).toEqual(['a.stl', 'a_2.stl', 'b.stl']);
  });
});

describe('JSON speichern/laden', () => {
  it('Roundtrip erhält das Projekt', () => {
    const p = createDefaultProject();
    expect(parseProject(serializeProject(p))).toEqual(p);
  });

  it('liest Projektdateien aus Version 1', () => {
    const v1 = {
      formatVersion: 1,
      name: 'Alt',
      box: { innerWidth: 280, innerDepth: 280, innerHeight: 70, wallThickness: 2, floorThickness: 2, headroom: 10 },
      print: { clearance: 0.2, wallThickness: 1.6, floorThickness: 1.2, dividerThickness: 1.2 },
      modules: [
        { id: 'a', type: 'cardTray', name: 'K', quantity: 1, placement: { mode: 'auto', x: 0, y: 0, rotated: false }, heightMode: 'layer', customHeight: 40, cardPreset: 'poker', sleeve: 'none', cardCount: 50, cardThickness: 0.3, slots: 2, orientation: 'flat', play: 1, fingerCutout: true },
        { id: 'b', type: 'gridBox', name: 'B', quantity: 1, placement: { mode: 'auto', x: 0, y: 0, rotated: false }, heightMode: 'layer', customHeight: 30, width: 90, depth: 60, columns: 4, rows: 2, dividerLowering: 0 },
      ],
    };
    const p = parseProject(JSON.stringify(v1));
    expect(p.grid.enabled).toBe(false);
    expect(p.layers).toHaveLength(1);
    const [a, b] = p.modules;
    expect(a.type === 'cardTray' && a.cardsPerSlot).toBe(50);
    expect(a.type === 'cardTray' && a.dividerMode).toBe('fixed');
    expect(a.fingerCutout).toBe('notch');
    expect(b.type === 'gridBox' && b.layout.length).toBe(2);
    expect(b.type === 'gridBox' && b.layout[0].columns.length).toBe(4);
    expect(a.layerId).toBe(p.layers[0].id);
  });

  it('ergänzt fehlende Felder und lehnt Unsinn ab', () => {
    const p = parseProject(JSON.stringify({ formatVersion: 2, box: { innerWidth: 200 }, modules: [{ type: 'gridBox' }, { type: 'xyz' }] }));
    expect(p.box.innerWidth).toBe(200);
    expect(p.print.clearance).toBe(0.2);
    expect(p.modules).toHaveLength(1);
    expect(() => parseProject('kein json')).toThrow();
    expect(() => parseProject('{"foo":1}')).toThrow();
  });
});
