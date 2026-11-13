import { describe, expect, it } from 'vitest';
import {
  computeLayout,
  createCardTray,
  createDefaultProject,
  createGridBox,
  effectiveCard,
  parseProject,
  partFileName,
  serializeProject,
  uniqueFileNames,
  validateProject,
  type Project,
} from '../src/geometry';

describe('Sleeves-Kalkulator', () => {
  it('addiert Hüllen-Aufschläge', () => {
    const none = effectiveCard(createCardTray({ sleeve: 'none', cardCount: 10 }));
    const prem = effectiveCard(createCardTray({ sleeve: 'premium', cardCount: 10 }));
    expect(none.width).toBe(63.5);
    expect(prem.width).toBeGreaterThan(none.width);
    expect(prem.height).toBeGreaterThan(none.height);
    expect(prem.stack).toBeGreaterThan(none.stack);
    expect(none.stack).toBeCloseTo(3.2);
  });
});

describe('Dateinamen', () => {
  it('enthält Stückzahl und Name', () => {
    expect(partFileName(createCardTray({ name: 'Kartenfach Poker', quantity: 2 }))).toBe('2x_Kartenfach_Poker.stl');
    expect(partFileName(createGridBox({ name: 'Münzen / Gold', quantity: 1 }))).toBe('1x_Muenzen_Gold.stl');
    expect(uniqueFileNames(['a.stl', 'a.stl', 'b.stl'])).toEqual(['a.stl', 'a_2.stl', 'b.stl']);
  });
});

describe('Automatisches Layout', () => {
  it('platziert Module ohne Überschneidung innerhalb der Schachtel', () => {
    const project = createDefaultProject();
    project.modules[1].quantity = 2;
    const layout = computeLayout(project);
    expect(layout).toHaveLength(4);
    expect(validateProject(project, layout).filter((m) => m.level === 'error')).toEqual([]);
    for (const i of layout) {
      expect(i.x).toBeGreaterThanOrEqual(project.print.clearance - 1e-9);
      expect(i.x + i.width).toBeLessThanOrEqual(project.box.innerWidth);
    }
  });

  it('weicht manuell platzierten Modulen aus', () => {
    const project: Project = {
      ...createDefaultProject(),
      modules: [
        createGridBox({ name: 'fix', placement: { mode: 'manual', x: 0.2, y: 0.2, rotated: false } }),
        createGridBox({ name: 'auto' }),
      ],
    };
    const layout = computeLayout(project);
    expect(validateProject(project, layout).filter((m) => m.level === 'error')).toEqual([]);
    expect(layout[1].x).toBeGreaterThanOrEqual(100.2);
  });

  it('meldet Überstand und Kollision', () => {
    const project: Project = {
      ...createDefaultProject(),
      modules: [
        createGridBox({ width: 400 }),
        createGridBox({ placement: { mode: 'manual', x: 0, y: 0, rotated: false } }),
      ],
    };
    const texts = validateProject(project, computeLayout(project)).map((m) => m.text).join('\n');
    expect(texts).toMatch(/ragt über die Schachtel/);
  });

  it('meldet zu hohe stehende Karten', () => {
    const project: Project = { ...createDefaultProject(), modules: [createCardTray({ cardPreset: 'tarot' })] };
    const msgs = validateProject(project, computeLayout(project));
    expect(msgs.some((m) => m.level === 'error' && /stehend/.test(m.text))).toBe(true);
  });
});

describe('JSON speichern/laden', () => {
  it('Roundtrip erhält das Projekt', () => {
    const p = createDefaultProject();
    expect(parseProject(serializeProject(p))).toEqual(p);
  });

  it('ergänzt fehlende Felder und lehnt Unsinn ab', () => {
    const p = parseProject(JSON.stringify({ box: { innerWidth: 200 }, modules: [{ type: 'gridBox' }, { type: 'xyz' }] }));
    expect(p.box.innerWidth).toBe(200);
    expect(p.print.clearance).toBe(0.2);
    expect(p.modules).toHaveLength(1);
    expect(() => parseProject('kein json')).toThrow();
    expect(() => parseProject('{"foo":1}')).toThrow();
  });
});
