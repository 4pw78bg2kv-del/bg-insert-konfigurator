import { beforeAll, describe, expect, it } from 'vitest';
import { buildPart } from '../src/geometry/build';
import { initKernel, type ManifoldToplevel } from '../src/geometry/kernel';
import { checkWatertight, parseBinaryStl, writeBinaryStl } from '../src/geometry/stl';
import {
  GAME_PRESETS,
  cardTrayLayout,
  computeLayout,
  createCardTray,
  createDefaultProject,
  createFrosthavenProject,
  listParts,
  loadAllFonts,
  moduleSize,
  parseProject,
  serializeProject,
  validateProject,
  type CardTrayModule,
} from '../src/geometry';
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

describe('Spiel-Preset Frosthaven', () => {
  it('ist in der Galerie eingetragen', () => {
    expect(GAME_PRESETS.map((g) => g.id)).toContain('frosthaven');
  });

  it('hat keine Fehler, Warnungen oder Hinweise (Kollision, Überstand, Druckbett, Höhe)', () => {
    const p = createFrosthavenProject();
    const msgs = validateProject(p, computeLayout(p));
    expect(msgs).toEqual([]);
  });

  it('übernimmt die Maße der Original-Inserts', () => {
    const p = createFrosthavenProject();
    const size = (name: string) => moduleSize(p.modules.find((m) => m.name === name)!, p);
    expect(size('Gebietsaufleger')).toMatchObject({ width: 285, depth: 275, height: 15 });
    expect(size('Monsterbox Wache')).toMatchObject({ width: 107, depth: 104, height: 14.1 });
    expect(size('Monsterbox Wicht').height).toBeCloseTo(18.4, 5);
    expect(size('Schadensmarker Elementmarker Beute')).toMatchObject({ width: 152, depth: 136.4, height: 24.2 });
    // Kopfleiste wie im Original: 14 mm, Trennerbreite ≈ 48 mm (klein) bzw. ≈ 92 mm (Standard)
    const items = p.modules.find((m) => m.name === 'Gegenstände') as CardTrayModule;
    const events = p.modules.find((m) => m.name === 'Ereignisse Sommer und Boot') as CardTrayModule;
    expect(cardTrayLayout(items, p).dividerWidth).toBeCloseTo(48.1, 1);
    expect(cardTrayLayout(events, p).dividerWidth).toBeCloseTo(92.1, 1);
  });

  it('übersteht Speichern und Laden als JSON', () => {
    const p = createFrosthavenProject();
    const back = parseProject(serializeProject(p));
    expect(back).toEqual(p);
  });

  it('alle Teile sind wasserdicht', { timeout: 120_000 }, () => {
    const p = createFrosthavenProject();
    for (const spec of listParts(p)) {
      const part = buildPart(k, spec, p);
      expect(part.status, spec.name).toBe('NoError');
      expect(checkWatertight(parseBinaryStl(writeBinaryStl(part.mesh))).watertight, spec.name).toBe(true);
    }
  });
});
