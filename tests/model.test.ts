import { describe, expect, it } from 'vitest';
import {
  assemblySvg,
  cardTrayLayout,
  createShapeBox,
  firstColumn,
  fitsBed,
  gridTree,
  inventoryTemplateXlsx,
  inventoryToModules,
  leaf,
  optimizeStacking,
  parseDelimited,
  parseInventory,
  parseXlsx,
  printSheetsHtml,
  split,
  TEMPLATES,
  computeLayout,
  createCardTray,
  createDefaultProject,
  createGridBox,
  effectiveCard,
  gridBoxLayout,
  gridInfo,
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
  p.baseplate.enabled = false;
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

describe('Fächerbox-Aufteilung', () => {
  it('teilt nach Anteilen, festen und passenden Größen', () => {
    const root = split('y', [split('x', [leaf(), leaf(undefined, 3)]), leaf(undefined, 2)]);
    const m = createGridBox({ width: 100, depth: 60, root });
    const p = project([m]);
    const l = gridBoxLayout(m, p);
    expect(l.cells).toHaveLength(3);
    expect(l.cells[1].w).toBeCloseTo(l.cells[0].w * 3, 5);
    expect(l.cells[2].d).toBeCloseTo(l.cells[0].d * 2, 5);
    const fixed = createGridBox({ width: 100, depth: 60, root: split('x', [leaf(undefined, 30, 'mm'), leaf()]) });
    expect(gridBoxLayout(fixed, project([fixed])).cells[0].w).toBeCloseTo(30, 5);
  });

  it('Größe nach Inhalt passt um liegende Karten', () => {
    const m = createGridBox({ sizeMode: 'auto', root: leaf({ type: 'cards', orientation: 'flat', format: 'portrait', count: 20, raise: true, cardPreset: 'poker', customCardWidth: 60, customCardHeight: 90, sleeve: 'none', cardThickness: 0.3 }) });
    const p = project([m]);
    const c = gridBoxLayout(m, p).cells[0];
    expect(c.w).toBeGreaterThanOrEqual(63.5);
    expect(c.d).toBeGreaterThanOrEqual(88);
    expect(errors(p)).toEqual([]);
  });
});

describe('Raster', () => {
  it('streckt das Raster auf die Schachtel und rundet Module auf ganze Felder', () => {
    const tray = createCardTray();
    const p = project([tray, createGridBox({ root: gridTree(4, 3) })], true);
    const g = gridInfo(p);
    expect(g.nx * g.cellX + p.print.clearance).toBeCloseTo(p.box.innerWidth, 6);
    const s = moduleSize(tray, p);
    const cells = (s.width + p.print.clearance) / g.cellX;
    expect(Math.abs(cells - Math.round(cells))).toBeLessThan(1e-6);
    expect(errors(p)).toEqual([]);
  });

  it('exaktes 5-mm-Raster lässt den Rest als Rand', () => {
    const p = project([createGridBox({ width: 52 })], true);
    p.grid = { ...p.grid, pitch: 5, fit: 'exact' };
    const g = gridInfo(p);
    expect(g.cellX).toBe(5);
    expect(moduleSize(p.modules[0], p).width).toBeCloseTo(55 - p.print.clearance, 6);
  });

  it('Zuwachs in die Wände statt in den Innenraum', () => {
    const inner = createGridBox({ width: 52 });
    const p = project([inner], true);
    p.grid = { ...p.grid, pitch: 5, fit: 'exact', grow: 'wall' };
    const l = gridBoxLayout(inner, p);
    expect(l.walls.left).toBeGreaterThan(p.print.wallThickness);
  });
});

describe('Stapelstufen', () => {
  it('Module einer höheren Stufe liegen auf dem darunter (auch auf verschiedenen Höhen)', () => {
    const fix = (x: number) => ({ mode: 'manual' as const, x, y: 0.1, rotated: false });
    const low = createGridBox({ name: 'flach', width: 60, heightMode: 'custom', customHeight: 15, placement: fix(0.1) });
    const high = createGridBox({ name: 'hoch', width: 60, heightMode: 'custom', customHeight: 30, placement: fix(60.4) });
    const top = createGridBox({ name: 'oben', width: 110, level: 2, heightMode: 'custom', customHeight: 10, placement: fix(5) });
    const p = project([low, high, top]);
    const inst = computeLayout(p).find((i) => i.moduleId === top.id)!;
    expect(inst.z).toBeCloseTo(30, 6);
    expect(inst.supports).toEqual([high.id]);
  });

  it('freie Bodenfläche wird auch von höheren Stufen genutzt', () => {
    const p = project([createGridBox(), createGridBox({ level: 2 })]);
    const inst = computeLayout(p)[1];
    expect(inst.z).toBe(0);
    expect(errors(p)).toEqual([]);
  });

  it('meldet Überstand über den nutzbaren Raum', () => {
    const fix = { mode: 'manual' as const, x: 0.1, y: 0.1, rotated: false };
    const p = project([createGridBox({ heightMode: 'custom', customHeight: 60, placement: fix }), createGridBox({ heightMode: 'custom', customHeight: 60, level: 2, placement: fix })]);
    expect(errors(p).some((e) => /ragt .* über den nutzbaren Raum/.test(e.text))).toBe(true);
  });

  it('optimizeStacking legt Überzähliges eine Stufe höher', () => {
    const mods = Array.from({ length: 12 }, () => createGridBox({ width: 90, depth: 90, heightMode: 'custom', customHeight: 20 }));
    const p = optimizeStacking(project(mods));
    expect(p.modules.some((m) => m.level > 1)).toBe(true);
    expect(errors(p).filter((e) => /passt nicht mehr/.test(e.text))).toEqual([]);
  });
});

describe('Druckbett', () => {
  it('prüft Teile gegen das Druckbett (mit Drehung)', () => {
    const bed = { bedX: 256, bedY: 256, bedZ: 256 };
    expect(fitsBed(250, 100, 50, bed)).toBe(true);
    expect(fitsBed(255, 100, 50, bed)).toBe(false);
    expect(fitsBed(170, 100, 50, { bedX: 150, bedY: 250, bedZ: 200 })).toBe(true);
  });

  it('meldet zu große Module', () => {
    const p = project([createGridBox({ width: 200, depth: 200 })]);
    p.print = { ...p.print, printer: 'bambu-a1mini', bedX: 180, bedY: 180, bedZ: 180 };
    expect(errors(p).some((e) => /Druckbett/.test(e.text))).toBe(true);
  });
});

describe('Inventar', () => {
  it('liest CSV mit Semikolon und Anführungszeichen', () => {
    const rows = parseDelimited('Kategorie;Bauteilart;Anzahl\n"Geld; Gold";Münze / Chip;40\nAktion;Karte Poker;90');
    expect(rows[1][0]).toBe('Geld; Gold');
    const inv = parseInventory(rows);
    expect(inv).toHaveLength(2);
    expect(inv[1].count).toBe(90);
  });

  it('Excel-Vorlage lässt sich wieder einlesen', () => {
    const rows = parseXlsx(inventoryTemplateXlsx());
    const inv = parseInventory(rows);
    expect(inv.length).toBeGreaterThan(5);
    expect(inv[0].type).toBe('Karte Poker');
  });

  it('baut Module aus der Teileliste', () => {
    const p = project([]);
    const inv = parseInventory(parseDelimited('Kategorie;Bauteilart;Anzahl;Breite;Länge;Dicke;Bemerkung\nA;Karte Poker;60;;;;Grundspiel\nA;Karte Poker;30;;;;Erweiterung\nGeld;Münze / Chip;30;25;;2;\nHolz;Holzwürfel / Ressource;40;;;;'));
    const res = inventoryToModules(inv, p);
    const types = res.modules.map((m) => m.type).sort();
    expect(types).toEqual(['cardTray', 'gridBox', 'shapeBox']);
    const tray = res.modules.find((m) => m.type === 'cardTray');
    expect(tray?.type === 'cardTray' && tray.dividerLabels).toEqual(['Grundspiel', 'Erweiterung']);
  });

  it('erste Spalte für Trennerbeschriftungen, Kopfzeile übersprungen', () => {
    expect(firstColumn([['Name'], ['Aktionen'], [''], ['Gebäude']])).toEqual(['Aktionen', 'Gebäude']);
  });
});

describe('Ausdrucke', () => {
  it('Rasterbogen enthält A4-Seiten mit Prüfstrecke und Kartenformaten', () => {
    const html = printSheetsHtml(10);
    expect(html).toContain('size: A4');
    expect(html).toContain('Prüfstrecke');
    expect(html).toContain('Kartenformate');
  });

  it('Explosionszeichnung nummeriert alle Kopien', () => {
    const p = createDefaultProject();
    const svg = assemblySvg(p, computeLayout(p), { explode: 20 });
    expect(svg.startsWith('<svg')).toBe(true);
    expect((svg.match(/<circle/g) ?? []).length).toBeGreaterThanOrEqual(computeLayout(p).length);
  });

  it('Aufleger-Box nach Inhalt ist fehlerfrei', () => {
    const p = project([createShapeBox()]);
    expect(errors(p)).toEqual([]);
  });
});

describe('Vorlagen', () => {
  it.each(TEMPLATES.map((t) => [t.label, t] as const))('%s ist für sich fehlerfrei', (_l, t) => {
    expect(errors(project([t.create()]))).toEqual([]);
  });
});

describe('Validierung', () => {
  it('meldet zu hohe stehende Karten', () => {
    const p = project([createCardTray({ cardPreset: 'tarot', format: 'portrait', heightMode: 'custom', customHeight: 40 })]);
    expect(errors(p).some((m) => /passen nicht/.test(m.text))).toBe(true);
  });

  it('meldet Module außerhalb der Schachtel', () => {
    const p = project([createGridBox({ width: 400 })]);
    expect(errors(p).some((m) => /passt nicht mehr in die Schachtel/.test(m.text))).toBe(true);
  });

  it('weicht manuell platzierten Modulen aus (ohne Raster)', () => {
    const p = project([
      createGridBox({ name: 'fix', placement: { mode: 'manual', x: 0.2, y: 0.2, rotated: false } }),
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
    const [a, b] = p.modules;
    expect(a.type === 'cardTray' && a.cardsPerSlot).toBe(50);
    expect(a.type === 'cardTray' && a.dividerMode).toBe('fixed');
    expect(a.fingerCutout).toBe('notch');
    expect(a.level).toBe(1);
    expect(b.type === 'gridBox' && b.root.kind === 'split' && b.root.children.length).toBe(2);
    const row = b.type === 'gridBox' && b.root.kind === 'split' ? b.root.children[0] : null;
    expect(row?.kind === 'split' && row.children.length).toBe(4);
  });

  it('übernimmt Ebenen aus Version 2 als Stapelstufen', () => {
    const v2 = {
      formatVersion: 2,
      name: 'V2',
      box: { innerWidth: 280, innerDepth: 280, innerHeight: 70, wallThickness: 2, floorThickness: 2, headroom: 0 },
      grid: { enabled: true, targetCell: 21, baseplate: true, maxTileSize: 200 },
      layers: [
        { id: 'L1', name: 'Unten', heightMode: 'fixed', height: 30, visible: true },
        { id: 'L2', name: 'Oben', heightMode: 'auto', height: 0, visible: true },
      ],
      modules: [
        { id: 'a', type: 'gridBox', name: 'A', quantity: 1, layerId: 'L1', placement: { mode: 'manual', x: 0, y: 0, gx: 2, gy: 1, rotated: false }, heightMode: 'layer', customHeight: 30, widthCells: 4, depthCells: 3, layout: [{ size: 1, columns: [1, 1] }] },
        { id: 'b', type: 'gridBox', name: 'B', quantity: 1, layerId: 'L2', placement: { mode: 'auto', x: 0, y: 0, rotated: false }, heightMode: 'layer', customHeight: 30, widthCells: 2, depthCells: 2, layout: [{ size: 1, columns: [1] }] },
      ],
    };
    const p = parseProject(JSON.stringify(v2));
    expect(p.formatVersion).toBe(3);
    expect(p.grid.pitch).toBe(21);
    expect(p.baseplate.enabled).toBe(true);
    const [a, b] = p.modules;
    expect(a.level).toBe(1);
    expect(b.level).toBe(2);
    expect(a.heightMode).toBe('custom');
    expect(a.placement.x).toBeGreaterThan(0);
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
