/**
 * Spiel-Preset „Frosthaven“ (Grundspiel, Cephalofair) – komplettes, lückenloses Insert.
 *
 * Schachtel innen 403 × 286 × 240 mm (vom Nutzer gemessen). Oben bleiben 50 mm für
 * Regelbuch, Szenario- und Abschnittsbuch, Rätselbuch, Spielplan, Kampagnenblock und
 * Bögen; alles andere außer den Kartenteilen liegt im Insert.
 *
 * Aufbau (Draufsicht, vorne = unten):
 *
 *   ┌──────────────────────────────────────────────┬────────────────┐
 *   │ Gegenstände I | Gegenstände II   (Mini)      │ Bosse          │
 *   ├──────────┬──────────┬────────┬───────────────┤ Miniaturen B   │
 *   │ Ereign.  │ Ereign.  │Kampagne│ Ziele         ├────────────────┤
 *   │ Sommer   │ Winter   │ (Mini) │ (Mini)        │ Monster 12–22  │
 *   ├──────────┴──────────┴────────┴───────────────┼────────────────┤
 *   │ 17 Charakterboxen, hochkant                  │ Monster 1–11   │
 *   └──────────────────────────────────────────────┴────────────────┘
 *   darunter (links): zwei Schalen für die Gebietsaufleger
 *   darüber: Miniaturen A + Marker auf den Ereignissen, Kartendecks auf Kampagne/Ziele,
 *   Standfüße + Stadtwache auf den Gegenständen
 *
 * Alle Positionen werden aus den tatsächlichen Modulmaßen berechnet; jede Lücke ist
 * höchstens 3 mm groß, und jeder Stapel endet genau unter dem Kopfraum.
 */
import { moduleSizeWith } from '../dimensions';
import { createCardTray, createGridBox, createPocket, createShapeBox, defaultLabel, leaf, split } from '../project';
import { DEFAULT_GRID, DEFAULT_LABELS, DEFAULT_PRINT, newId } from '../project';
import {
  PROJECT_FORMAT_VERSION,
  type CardSpec,
  type CardTrayModule,
  type CellContent,
  type CellNode,
  type GridBoxModule,
  type InsertModule,
  type Project,
} from '../types';
import { OVERLAYS_1, OVERLAYS_2, parseOutline, type OverlayPocket } from './frosthavenOverlays';

// ---------------------------------------------------------------------------
// Schachtel und Raster

const BOX = { innerWidth: 403, innerDepth: 286, innerHeight: 240, wallThickness: 2.5, floorThickness: 2.5, headroom: 50 };
const PRINT = { ...DEFAULT_PRINT, printer: 'bambu-h2d', bedX: 325, bedY: 320, bedZ: 325 };
/** Spaltmaß zwischen Modulen und Abstand zur Schachtelwand. */
const GAP = PRINT.clearance;
const EDGE = GAP / 2;
/**
 * Schrift 0,6 mm tief: Die Namen vorne an den Monsterboxen brauchen so keine dickere
 * Wand (der Innenraum bleibt 104 mm für die Wertekarte), und die Beschriftungen in den
 * Taschenböden der Aufleger-Schalen lassen genug Boden stehen.
 */
const LABELS = { ...DEFAULT_LABELS, font: 'serif' as const, depth: 0.6 };
/** Nutzbare Höhe unter dem Kopfraum. */
const TOP = BOX.innerHeight - BOX.headroom;

/** Höhe der Aufleger-Schalen wie im Original. */
const OVERLAY_H = 15;
/** Monsterbox: Innenraum für die quadratische Wertekarte (103 × 103 mm) plus Spiel. */
const MONSTER_INNER = 104;
const MONSTER = MONSTER_INNER + 2 * PRINT.wallThickness;
/** Zwei Monstertürme mit je 11 Boxen. */
const MONSTERS_PER_STACK = 11;
/** Charakterbox (groß) und Miniaturen-Schachteln laut Nutzer. */
const CHAR_BOX = { w: 122, h: 153, t: 17, count: 17 };
const MINI_H = 55;

// ---------------------------------------------------------------------------
// Hilfen

const sizing: Project = {
  formatVersion: PROJECT_FORMAT_VERSION,
  name: 'sizing',
  box: BOX,
  print: PRINT,
  grid: { ...DEFAULT_GRID, enabled: false },
  baseplate: { enabled: false },
  labels: LABELS,
  modules: [],
};

/** Außenmaße (unrotiert) bei voller verfügbarer Höhe. */
const sizeOf = (m: InsertModule) => moduleSizeWith(m, sizing, TOP);

const at = (x: number, y: number, rotated = false) => ({ mode: 'manual' as const, x, y, rotated });
const noLabel = <T extends InsertModule['type']>(type: T) => ({ ...defaultLabel(type), sides: 'none' as const, onLid: false });
const scoop = (): CellContent => ({ type: 'scoop', sides: 'front' });

/** Kleine Karten mit Standard-Hülle (44 × 68 → 46,5 × 71,5 mm). */
const MINI: CardSpec = { cardPreset: 'miniEuropean', customCardWidth: 44, customCardHeight: 68, sleeve: 'standard', cardThickness: 0.32 };
/** Standardkarten mit Standard-Hülle (63,5 × 88 → 66 × 91,5 mm). */
const STANDARD: CardSpec = { cardPreset: 'poker', customCardWidth: 63.5, customCardHeight: 88, sleeve: 'standard', cardThickness: 0.32 };

const deck = (count: number, spec: CardSpec = MINI): CellContent => ({ type: 'cards', orientation: 'standing', format: 'portrait', count, raise: false, ...spec });

/** Hängetrenner wie in den Original-Inserts: Kopfleiste, Griffschlitz, Schrift auf dem Trenner. */
const hanging: Partial<CardTrayModule> = {
  orientation: 'standing',
  tilt: 0,
  rows: 1,
  dividerMode: 'loose',
  tab: true,
  tabStyle: 'header',
  tabHeight: 14,
  dividerPlateThickness: 1.2,
  fingerCutout: 'none',
  heightMode: 'auto',
  label: noLabel('cardTray'),
};

/**
 * Kartenfach, dessen Länge (Stapelrichtung) möglichst genau `length` erreicht: Die
 * Kartenzahl ist die Kapazität des Fachs (der Rest bleibt Platz für Nachschub).
 */
function trayToLength(base: Partial<CardTrayModule>, length: number): CardTrayModule {
  let lo = 0;
  let hi = 2000;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (sizeOf(createCardTray({ ...base, totalCards: mid })).depth <= length + 1e-6) lo = mid;
    else hi = mid - 1;
  }
  return createCardTray({ ...base, totalCards: lo });
}

/** Fächer für hochkant stehende Schachteln (Miniaturen): Spalten von links nach rechts, je Spalte Fächer von vorne nach hinten. */
function boxGrid(columns: number[]): CellNode {
  return split(
    'x',
    columns.map((n) => (n <= 1 ? leaf() : split('y', Array.from({ length: n }, () => leaf())))),
  );
}

function overlayTray(name: string, pockets: readonly OverlayPocket[], level: number, width: number, depth: number): InsertModule {
  // Taschen mittig in die (größere) Schale setzen
  const dx = (width - 285) / 2;
  const dy = (depth - 275) / 2;
  return createShapeBox({
    name,
    sizeMode: 'manual',
    width,
    depth,
    heightMode: 'custom',
    customHeight: OVERLAY_H,
    floorHole: false,
    pocketPlay: 0.2,
    level,
    placement: at(EDGE, EDGE),
    label: noLabel('shapeBox'),
    pockets: pockets.map(([x, y, label, outline]) => {
      const points = parseOutline(outline);
      const xs = points.map((q) => q[0]);
      const ys = points.map((q) => q[1]);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      // 6 Aufleger à 2,2 mm → 13,6 mm tief wie die Originale (13,8 mm)
      return createPocket('custom', w, h, {}, { x: x + dx, y: y + dy, count: 6, thickness: 2.2, grip: 'none', points, label });
    }),
  });
}

function monsterBox(name: string, level: number, x: number, y: number, top: boolean): GridBoxModule {
  return createGridBox({
    name,
    sizeMode: 'manual',
    width: MONSTER,
    depth: MONSTER,
    // Zwei Monsterarten je Box: Aufsteller liegend in zwei Fächern, darüber die
    // Fähigkeitskarten und obenauf die Wertekarten (die Trennwand ist abgesenkt).
    root: split('x', [leaf(), leaf()]),
    dividerLowering: 5,
    heightMode: top ? 'fill' : 'custom',
    customHeight: Math.floor((TOP / MONSTERS_PER_STACK) * 10) / 10,
    fingerCutout: 'notch',
    fingerSides: 'leftRight',
    level,
    placement: at(x, y),
    label: { ...defaultLabel('gridBox'), sides: 'front', onLid: false },
  });
}

// ---------------------------------------------------------------------------

export function frosthavenModules(): InsertModule[] {
  const mods: InsertModule[] = [];

  // --- Charakterboxen: 17 Schachteln hochkant, Breitseite nach vorne -------
  const chars = createCardTray({
    name: 'Charakterboxen',
    cardPreset: 'custom',
    customCardWidth: CHAR_BOX.w,
    customCardHeight: CHAR_BOX.h,
    sleeve: 'none',
    cardThickness: CHAR_BOX.t,
    orientation: 'standing',
    format: 'portrait',
    tilt: 0,
    rows: 1,
    dividerMode: 'loose',
    dividerCount: 0,
    tab: false,
    totalCards: CHAR_BOX.count,
    play: 1.6,
    heightMode: 'fill',
    fingerCutout: 'notch',
    label: noLabel('cardTray'),
    level: 3,
    placement: at(EDGE, EDGE, true),
  });
  const charSize = sizeOf(chars);
  const leftW = charSize.depth; // gedreht: Länge des Halters = Breite des linken Bereichs
  const bandA = charSize.width;
  const rightX = EDGE + leftW + GAP;

  // --- Unterste Lage links: die beiden Aufleger-Schalen --------------------
  const overlayDepth = BOX.innerDepth - 2 * EDGE;
  mods.push(overlayTray('Gebietsaufleger 1', OVERLAYS_1, 1, leftW, overlayDepth));
  mods.push(overlayTray('Gebietsaufleger 2', OVERLAYS_2, 2, leftW, overlayDepth));
  mods.push(chars);

  // --- Mittleres Band: Ereignisse, Gebäude, Kampagne, Ziele ----------------
  const yB = EDGE + bandA + GAP;
  const bandB = MONSTER;
  const summer = trayToLength(
    {
      name: 'Ereignisse Sommer und Boot',
      ...hanging,
      ...STANDARD,
      format: 'landscape',
      play: 1,
      dividerLabels: [
        'Aktive Sommer Weg-Ereignisse',
        'Inaktive Sommer Weg-Ereignisse',
        'Aktive Sommer Außenposten-Ereignisse',
        'Inaktive Sommer Außenposten-Ereignisse',
        'Aktive Boot-Ereignisse',
        'Inaktive Boot-Ereignisse',
      ],
      level: 3,
    },
    bandB,
  );
  const winter = trayToLength(
    {
      name: 'Ereignisse Winter und Gebäude',
      ...hanging,
      ...STANDARD,
      format: 'landscape',
      play: 1,
      dividerLabels: [
        'Aktive Winter Weg-Ereignisse',
        'Inaktive Winter Weg-Ereignisse',
        'Aktive Winter Außenposten-Ereignisse',
        'Inaktive Winter Außenposten-Ereignisse',
        'Aktive Gebäude',
        'Inaktive Gebäude',
      ],
      level: 3,
    },
    bandB,
  );
  // Kleine Karten: Kopfleiste 13,5 mm, damit die Kartendecks darüber genau bis unter den Kopfraum reichen.
  const miniTray: Partial<CardTrayModule> = { ...hanging, ...MINI, format: 'portrait', play: 1.2, tabHeight: 13.5, level: 3 };
  const campaign = trayToLength(
    {
      name: 'Kampagne Szenarien und Tiere',
      ...miniTray,
      dividerLabels: ['Offen', 'Aktiv', 'Inaktiv', 'Abgeschlossen', 'Zufälliges Szenario', 'Verfügbare Tiere', 'Gesperrte Tiere'],
    },
    bandB,
  );
  const goals = trayToLength(
    {
      name: 'Ziele und Herausforderungen',
      ...miniTray,
      dividerLabels: ['Kampfziele', 'Persönliche Ziele', 'Herausforderungen', 'Zufällige Räume', 'Zufällige Aufbauten'],
    },
    bandB,
  );
  let x = EDGE;
  for (const t of [summer, winter, campaign, goals]) {
    t.placement = at(x, yB);
    x += sizeOf(t).width + GAP;
    mods.push(t);
  }
  const eventsW = sizeOf(summer).width + GAP + sizeOf(winter).width;
  const xMini = EDGE + eventsW + GAP;
  const miniW = leftW - eventsW - GAP;

  // --- Hinteres Band: Gegenstände (zwei lange Fächer, quer) -----------------
  const yC = yB + bandB + GAP;
  const bandC = sizeOf(campaign).width;
  const itemLen = (leftW - GAP) / 2;
  const items1 = trayToLength(
    {
      name: 'Gegenstände kaufen und herstellen',
      ...miniTray,
      dividerLabels: ['Verfügbar kaufbar', 'Gesperrt kaufbar', 'Verfügbar herstellbar', 'Gesperrt herstellbar'],
    },
    itemLen,
  );
  const items2 = trayToLength(
    {
      name: 'Gegenstände Pläne',
      ...miniTray,
      dividerLabels: ['Verfügbare Pläne', 'Gesperrte Pläne', 'Zufälliger Gegenstand', 'Solo-Gegenstände'],
    },
    itemLen,
  );
  items1.placement = at(EDGE, yC, true);
  items2.placement = at(EDGE + sizeOf(items1).depth + GAP, yC, true);
  mods.push(items1, items2);

  // --- Obere Lage links ------------------------------------------------------
  // Miniaturen A auf den Ereignissen: 2 Spalten für Viererboxen (51 × 29), 4 Spalten für Einzelboxen (30 × 29)
  mods.push(
    createGridBox({
      name: 'Miniaturen A',
      sizeMode: 'manual',
      width: eventsW,
      depth: bandB,
      root: boxGrid([2, 2, 3, 3, 3, 3]),
      heightMode: 'custom',
      customHeight: PRINT.floorThickness + MINI_H,
      fingerCutout: 'none',
      level: 4,
      placement: at(EDGE, yB),
      label: noLabel('gridBox'),
    }),
    createGridBox({
      name: 'Marker',
      sizeMode: 'manual',
      width: eventsW,
      depth: bandB,
      root: split('y', [split('x', [leaf(scoop()), leaf(scoop()), leaf(scoop()), leaf(scoop())]), split('x', [leaf(scoop()), leaf(scoop()), leaf(scoop()), leaf(scoop())])]),
      heightMode: 'fill',
      fingerCutout: 'none',
      level: 5,
      placement: at(EDGE, yB),
      label: noLabel('gridBox'),
    }),
  );
  // Kartendecks auf Kampagne und Zielen: Angriffsmodifikatoren und Beute, je Deck ein Fach
  mods.push(
    createGridBox({
      name: 'Kartendecks',
      sizeMode: 'manual',
      width: miniW,
      depth: bandB,
      root: split('x', [
        split('y', [leaf(deck(20), 1, 'auto'), leaf(deck(20), 1, 'auto'), leaf(deck(20), 1, 'auto'), leaf(deck(20), 1, 'auto')], 1, 'auto'),
        split('y', [leaf(deck(20), 1, 'auto'), leaf(deck(20), 1, 'auto'), leaf(deck(20), 1, 'auto'), leaf(deck(20), 1, 'auto'), leaf(deck(59), 1, 'auto')], 1, 'auto'),
      ]),
      // Trennwände niedriger als die Karten: Decks lassen sich seitlich greifen
      dividerLowering: 28,
      heightMode: 'fill',
      fingerCutout: 'none',
      level: 4,
      placement: at(xMini, yB),
      label: noLabel('gridBox'),
    }),
  );
  // Standfüße und Stadtwachen-Deck auf den Gegenständen (quer)
  mods.push(
    createGridBox({
      name: 'Standfüße und Stadtwache',
      sizeMode: 'manual',
      width: bandC,
      depth: leftW,
      root: split('y', [leaf(deck(55), 30, 'mm'), leaf(scoop()), leaf(scoop()), leaf(scoop()), leaf(scoop())]),
      dividerLowering: 20,
      heightMode: 'fill',
      fingerCutout: 'none',
      level: 4,
      placement: at(EDGE, yC, true),
      label: noLabel('gridBox'),
    }),
  );

  // --- Rechte Spalte: zwei Monstertürme, Bosse, Miniaturen B ---------------
  let n = 1;
  for (let stack = 0; stack < 2; stack++) {
    const y = EDGE + stack * (MONSTER + GAP);
    for (let i = 0; i < MONSTERS_PER_STACK; i++) {
      mods.push(monsterBox(`Monster ${String(n).padStart(2, '0')}`, i + 1, rightX, y, i === MONSTERS_PER_STACK - 1));
      n++;
    }
  }
  const ySlot = EDGE + 2 * (MONSTER + GAP);
  const slotDepth = BOX.innerDepth - EDGE - ySlot;
  mods.push(
    trayToLength(
      {
        name: 'Bosse',
        ...hanging,
        cardPreset: 'custom',
        customCardWidth: 100,
        customCardHeight: 88,
        sleeve: 'none',
        cardThickness: 1,
        format: 'portrait',
        // Trennerkörper 102,4 mm breit wie die Original-Trenner
        play: 2.8,
        dividerLabels: ['Unbesiegte Bosse Aufsteller', 'Unbesiegte Bosse Wertekarten', 'Besiegte Bosse Aufsteller', 'Besiegte Bosse Wertekarten'],
        level: 1,
        placement: at(rightX, ySlot),
      },
      slotDepth,
    ),
    createGridBox({
      name: 'Miniaturen B',
      sizeMode: 'manual',
      width: MONSTER,
      depth: slotDepth,
      root: split('y', [split('x', [leaf(), leaf(), leaf()]), split('x', [leaf(), leaf(), leaf()])]),
      heightMode: 'custom',
      customHeight: PRINT.floorThickness + MINI_H,
      fingerCutout: 'none',
      level: 2,
      placement: at(rightX, ySlot),
      label: noLabel('gridBox'),
    }),
    createGridBox({
      name: 'Elemente und Szenario-Marker',
      sizeMode: 'manual',
      width: MONSTER,
      depth: slotDepth,
      root: split('y', [split('x', [leaf(scoop()), leaf(scoop())]), split('x', [leaf(scoop()), leaf(scoop())])]),
      heightMode: 'fill',
      fingerCutout: 'none',
      level: 3,
      placement: at(rightX, ySlot),
      label: noLabel('gridBox'),
    }),
  );
  return mods;
}

export function createFrosthavenProject(): Project {
  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    name: 'Frosthaven',
    box: { ...BOX },
    // Gebietsaufleger-Schalen und Charakterbox-Halter brauchen ein großes Druckbett (≈ 294 × 286 mm).
    print: { ...PRINT },
    grid: { ...DEFAULT_GRID, enabled: false },
    baseplate: { enabled: false },
    labels: { ...LABELS },
    modules: frosthavenModules().map((m) => ({ ...m, id: newId() })),
  };
}
