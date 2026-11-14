/**
 * Spiel-Preset „Frosthaven“ (Grundspiel, Cephalofair).
 *
 * Nachgebaut nach den vorhandenen Inserts des Nutzers (Maße aus deren STLs,
 * siehe docs/frosthaven.md). Alle Module bleiben voll parametrisch.
 *
 * Schachtel: außen 415 × 300 × 250 mm (Folded Space; Printables nennt 410 mm),
 * Karton ca. 2,5 mm → innen ca. 408 × 293 × 244 mm. Bitte vor dem Druck nachmessen.
 *
 * Karten: Standard 63 × 88 mm, klein 44 × 67 mm (Mini European), jeweils mit
 * Standard-Hüllen. Kartenzahlen pro Fach sind Schätzwerte und lassen sich anpassen.
 */
import { createCardTray, createGridBox, createPocket, createShapeBox, defaultLabel, leaf, split } from '../project';
import { DEFAULT_GRID, DEFAULT_LABELS, DEFAULT_PRINT, newId } from '../project';
import { PROJECT_FORMAT_VERSION, type CardTrayModule, type CellContent, type InsertModule, type Project } from '../types';

const scoop = (): CellContent => ({ type: 'scoop', sides: 'front' });

const at = (x: number, y: number, rotated = false) => ({ mode: 'manual' as const, x, y, rotated });

/** Hängetrenner wie in den Original-Inserts: Kopfleiste 14 mm, Griffschlitz, Schrift rechts. */
const hanging: Partial<CardTrayModule> = {
  orientation: 'standing',
  tilt: 0,
  rows: 1,
  dividerMode: 'loose',
  tab: true,
  tabStyle: 'header',
  tabHeight: 14,
  dividerPlateThickness: 1.2,
  sleeve: 'standard',
  cardThickness: 0.32,
  fingerCutout: 'none',
  heightMode: 'auto',
  label: { ...defaultLabel('cardTray'), sides: 'none' },
};

/**
 * Taschen der Gebietsaufleger-Box (Mitte x/y, Breite, Tiefe, Drehung) – vermessen aus
 * „Gebietsaufleger vollständige Version 1“ (umschreibende Rechtecke der Original-Taschen;
 * drei Taschen leicht verkleinert, damit Stege bleiben). Taschen am Rand werden von
 * `insideBox` auf die Außenwand gekürzt.
 */
const OVERLAY_POCKETS: [number, number, number, number, number][] = [
  [28.6, 19.3, 36, 34, 0], [74.2, 20.1, 38, 39, 0], [118.3, 19.2, 26, 36, 0], [180.4, 21.1, 64, 38, 0], [249.1, 22.0, 69, 33, 0],
  [22.3, 68.9, 41, 31, 0], [72.5, 89.7, 36, 74, 0], [115.8, 91.3, 35, 71, 0], [180.5, 91.4, 64, 80, 0], [249.1, 68.0, 69, 33, 0],
  [21.0, 110.1, 37, 35, 0], [249.5, 113.9, 69, 37, 0], [34.7, 157.0, 67, 25, 0], [119.2, 174.6, 30, 60, 0], [209.9, 162.1, 40, 32, 0],
  [262.7, 162.3, 43, 38, 0], [34.2, 205.1, 66, 25, 0], [190.2, 206.2, 85, 38, 0], [262.7, 206.3, 43, 38, 0], [38.2, 253.5, 74, 30, 0],
  [94.0, 242.0, 27, 64, 0], [166.8, 252.9, 37, 43, 0], [213.7, 252.8, 38, 43, 0], [262.8, 250.0, 43, 40, 0],
];

/** Kürzt achsparallele Taschen so, dass rundum mindestens `margin` Wand bleibt. */
function insideBox(pockets: [number, number, number, number, number][], W: number, D: number, margin: number) {
  return pockets.map(([x, y, w, h, r]) => {
    const x0 = Math.max(margin, x - w / 2);
    const x1 = Math.min(W - margin, x + w / 2);
    const y0 = Math.max(margin, y - h / 2);
    const y1 = Math.min(D - margin, y + h / 2);
    return [(x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, r] as const;
  });
}

function monsterBox(name: string, height: number, x: number, y: number, level: number): InsertModule {
  return createGridBox({
    name: `Monsterbox ${name}`,
    width: 107,
    depth: 104,
    sizeMode: 'manual',
    root: leaf(),
    heightMode: 'custom',
    customHeight: height,
    fingerCutout: 'notch',
    fingerSides: 'leftRight',
    level,
    placement: at(x, y),
    label: { ...defaultLabel('gridBox'), text: name, sides: 'front', onLid: false },
  });
}

export function frosthavenModules(): InsertModule[] {
  return [
    // --- Unterste Lage: Gebietsaufleger und Monsterboxen -------------------
    createShapeBox({
      name: 'Gebietsaufleger',
      sizeMode: 'manual',
      width: 285,
      depth: 275,
      heightMode: 'custom',
      customHeight: 15,
      floorHole: true,
      pocketPlay: 0.3,
      pockets: insideBox(OVERLAY_POCKETS, 285, 275, 2.6).map(([x, y, w, h, rotation]) => createPocket('rect', w, h, {}, { x, y, rotation, count: 6, thickness: 2.2, grip: 'none' })),
      placement: at(0, 0),
      label: { ...defaultLabel('shapeBox'), sides: 'none' },
    }),
    monsterBox('Wache', 14.1, 288, 0, 1),
    monsterBox('Priester', 14.1, 288, 105, 1),
    monsterBox('Späher', 18.4, 288, 0, 2),
    monsterBox('Wicht', 18.4, 288, 105, 2),
    createCardTray({
      name: 'Stadtwachen Angriffsdeck',
      ...hanging,
      cardPreset: 'miniEuropean',
      format: 'portrait',
      tab: false,
      totalCards: 20,
      dividerCount: 0,
      play: 2,
      fingerCutout: 'toFloor',
      floorHole: true,
      placement: at(288, 212),
    }),

    // --- Zweite Lage auf den Gebietsauflegern --------------------------------
    createCardTray({
      name: 'Ereignisse Sommer und Boot',
      ...hanging,
      cardPreset: 'poker',
      format: 'landscape',
      play: 1,
      totalCards: 140,
      dividerLabels: [
        'Aktive Sommer Weg-Ereignisse',
        'Inaktive Sommer Weg-Ereignisse',
        'Aktive Sommer Außenposten-Ereignisse',
        'Inaktive Sommer Außenposten-Ereignisse',
        'Aktive Boot-Ereignisse',
        'Inaktive Boot-Ereignisse',
      ],
      level: 2,
      placement: at(0, 0),
    }),
    createCardTray({
      name: 'Ereignisse Winter und Gebäude',
      ...hanging,
      cardPreset: 'poker',
      format: 'landscape',
      play: 1,
      totalCards: 140,
      dividerLabels: [
        'Aktive Winter Weg-Ereignisse',
        'Inaktive Winter Weg-Ereignisse',
        'Aktive Winter Außenposten-Ereignisse',
        'Inaktive Winter Außenposten-Ereignisse',
        'Aktive Gebäude',
        'Inaktive Gebäude',
      ],
      level: 2,
      placement: at(96, 0),
    }),
    createCardTray({
      name: 'Gegenstände',
      ...hanging,
      cardPreset: 'miniEuropean',
      format: 'portrait',
      play: 2,
      totalCards: 250,
      dividerLabels: [
        'Verfügbar kaufbar',
        'Gesperrt kaufbar',
        'Verfügbar herstellbar',
        'Gesperrt herstellbar',
        'Verfügbare Pläne',
        'Gesperrte Pläne',
        'Zufälliger Gegenstand',
        'Solo-Gegenstand',
      ],
      level: 2,
      placement: at(192, 0),
    }),
    createCardTray({
      name: 'Szenarien und Tiere',
      ...hanging,
      cardPreset: 'miniEuropean',
      format: 'portrait',
      play: 2,
      totalCards: 120,
      dividerLabels: ['Offen', 'Aktiv', 'Inaktiv', 'Abgeschlossen', 'Zufälliges Szenario', 'Verfügbare Tiere', 'Gesperrte Tiere'],
      level: 1,
      placement: at(341, 212),
    }),
    createCardTray({
      name: 'Bosse',
      ...hanging,
      cardPreset: 'custom',
      customCardWidth: 100,
      customCardHeight: 88,
      sleeve: 'none',
      cardThickness: 1.2,
      format: 'portrait',
      play: 2.5,
      totalCards: 30,
      dividerLabels: ['Unbesiegte Bosse Aufsteller', 'Unbesiegte Bosse Wertekarten', 'Besiegte Bosse Aufsteller', 'Besiegte Bosse Wertekarten'],
      level: 2,
      placement: at(0, 76),
    }),
    createGridBox({
      name: 'Schadensmarker Elementmarker Beute',
      sizeMode: 'manual',
      width: 152,
      depth: 136.4,
      heightMode: 'custom',
      customHeight: 24.2,
      root: split('x', [
        split('y', [split('x', [leaf(scoop()), leaf(scoop()), leaf(scoop())]), split('x', [leaf(scoop()), leaf(scoop()), leaf(scoop())])], 94, 'mm'),
        split('y', [leaf(undefined, 1.4), leaf(scoop())]),
      ]),
      level: 2,
      placement: at(108, 129),
      label: { ...defaultLabel('gridBox'), text: 'Marker', sides: 'none' },
    }),
  ];
}

export function createFrosthavenProject(): Project {
  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    name: 'Frosthaven',
    box: { innerWidth: 408, innerDepth: 293, innerHeight: 244, wallThickness: 2.5, floorThickness: 2.5, headroom: 35 },
    // Die Gebietsaufleger-Box (285 × 275 mm) braucht ein großes Druckbett wie im Original.
    print: { ...DEFAULT_PRINT, printer: 'bambu-h2d', bedX: 325, bedY: 320, bedZ: 325 },
    grid: { ...DEFAULT_GRID, enabled: false },
    baseplate: { enabled: false },
    labels: { ...DEFAULT_LABELS, font: 'serif' },
    modules: frosthavenModules().map((m) => ({ ...m, id: newId() })),
  };
}
