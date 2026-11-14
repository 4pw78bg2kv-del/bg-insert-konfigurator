/**
 * Vorlagen-Galerie: fertig eingestellte Module für typische Aufgaben.
 */
import {
  cardsContent,
  createCardTray,
  createGridBox,
  createPocket,
  createShapeBox,
  generatePockets,
  gridTree,
  leaf,
  split,
} from './project';
import type { InsertModule } from './types';

export interface ModuleTemplate {
  id: string;
  label: string;
  description: string;
  /** Kurzes Symbol für die Kachel. */
  icon: string;
  group: 'Karten' | 'Boxen' | 'Plättchen';
  create(): InsertModule;
}

const scoop = () => ({ type: 'scoop' as const, sides: 'front' as const });

export const TEMPLATES: readonly ModuleTemplate[] = [
  {
    id: 'cards-standing',
    label: 'Kartenfach mit Trennern',
    description: 'Karten stehend, Trenner rasten in Zacken ein, beschriftbare Laschen.',
    icon: '🂠',
    group: 'Karten',
    create: () => createCardTray(),
  },
  {
    id: 'cards-draw',
    label: 'Nachziehstapel schräg',
    description: 'Karten 20° geneigt, ohne Trenner – man greift bequem die vordere Karte.',
    icon: '⟋',
    group: 'Karten',
    create: () => createCardTray({ name: 'Nachziehstapel', tilt: 20, dividerMode: 'loose', dividerCount: 0, totalCards: 80, tab: false }),
  },
  {
    id: 'cards-flat',
    label: 'Karten liegend',
    description: 'Zwei Stapel nebeneinander, Daumenmulden vorne.',
    icon: '▭▭',
    group: 'Karten',
    create: () => createCardTray({ name: 'Karten liegend', orientation: 'flat', format: 'portrait', slots: 2, cardsPerSlot: 30, heightMode: 'auto' }),
  },
  {
    id: 'combo',
    label: 'Kombi-Box Karten + Tokens',
    description: '2 Fächer Standardkarten liegend, 2 Fächer Minikarten stehend, 2 Token-Mulden.',
    icon: '▦',
    group: 'Boxen',
    create: () =>
      createGridBox({
        name: 'Kombi-Box',
        sizeMode: 'auto',
        heightMode: 'fill',
        root: split('x', [
          split('y', [leaf(cardsContent({ count: 25 }), 1, 'auto'), leaf(cardsContent({ count: 25 }), 1, 'auto')], 1, 'auto'),
          split('y', [leaf(cardsContent({ orientation: 'standing', cardPreset: 'miniEuropean', count: 40 }), 1, 'auto'), leaf(cardsContent({ orientation: 'standing', cardPreset: 'miniEuropean', count: 40 }), 1, 'auto')], 1, 'auto'),
          split('y', [leaf(scoop()), leaf(scoop())], 32, 'mm'),
        ]),
      }),
  },
  {
    id: 'token-tray',
    label: 'Token-Schale mit Mulden',
    description: '3 × 2 Fächer mit gerundetem Boden – Teile lassen sich herausschieben.',
    icon: '◡◡',
    group: 'Boxen',
    create: () => createGridBox({ name: 'Token-Schale', width: 126, depth: 84, root: gridTree(3, 2, scoop), heightMode: 'custom', customHeight: 28 }),
  },
  {
    id: 'player-box',
    label: 'Spieler-Box mit Deckel',
    description: 'Ein großes Fach für Figuren, drei Mulden für Ressourcen, Rastdeckel und Name.',
    icon: '♟',
    group: 'Boxen',
    create: () =>
      createGridBox({
        name: 'Spieler',
        width: 105,
        depth: 84,
        root: split('y', [split('x', [leaf(scoop()), leaf(scoop()), leaf(scoop())]), leaf(scoop())]),
        lid: 'snap',
        heightMode: 'custom',
        customHeight: 30,
      }),
  },
  {
    id: 'resource-sorter',
    label: 'Sortierkasten mit Magnetdeckel',
    description: '4 × 3 Mulden für viele kleine Ressourcen, Deckel hält mit 8 Magneten.',
    icon: '⊞',
    group: 'Boxen',
    create: () => createGridBox({ name: 'Sortierkasten', width: 168, depth: 105, root: gridTree(4, 3, scoop), lid: 'magnet', heightMode: 'custom', customHeight: 32 }),
  },
  {
    id: 'slide-cardbox',
    label: 'Kartenbox mit Schiebedeckel',
    description: 'Ein Fach für 60 stehende Karten, Deckel wird von vorne eingeschoben.',
    icon: '⇥',
    group: 'Boxen',
    create: () =>
      createGridBox({
        name: 'Kartenbox',
        sizeMode: 'auto',
        heightMode: 'auto',
        root: leaf(cardsContent({ orientation: 'standing', format: 'landscape', count: 60 })),
        lid: 'slide',
      }),
  },
  {
    id: 'dice-tray',
    label: 'Würfelschale',
    description: 'Ein großes Fach mit Mulden vorne und hinten, Klappdeckel mit Scharnier.',
    icon: '⚄',
    group: 'Boxen',
    create: () => createGridBox({ name: 'Würfel', width: 84, depth: 84, root: leaf({ type: 'scoop', sides: 'both' }), lid: 'hinge', heightMode: 'custom', customHeight: 34 }),
  },
  {
    id: 'pencils',
    label: 'Stifte- und Blockhalter',
    description: 'Schmales Fach für Stifte, breites Fach für Wertungsblock.',
    icon: '✎',
    group: 'Boxen',
    create: () => createGridBox({ name: 'Stifte und Block', width: 126, depth: 105, root: split('x', [leaf(undefined, 22, 'mm'), leaf()]), fingerCutout: 'notch', fingerSides: 'front', heightMode: 'custom', customHeight: 24 }),
  },
  {
    id: 'circles',
    label: '9 Kreise für je 8 Aufleger',
    description: 'Aufleger-Box mit 9 runden Taschen (Ø 30 mm, je 8 × 2 mm) und Griffmulden.',
    icon: '◯',
    group: 'Plättchen',
    create: () => createShapeBox(),
  },
  {
    id: 'coins',
    label: 'Münzen / Chips',
    description: '6 runde Stapel Ø 25 mm für je 12 Münzen, Rastdeckel.',
    icon: '◎',
    group: 'Plättchen',
    create: () => createShapeBox({ name: 'Münzen', lid: 'snap', pockets: generatePockets({ shape: 'ellipse', w: 25, h: 25, pockets: 6, perStack: 12, thickness: 2.2, grip: 'one', columns: 3 }) }),
  },
  {
    id: 'hex',
    label: 'Sechseck-Plättchen',
    description: '4 Stapel Sechsecke (34,6 × 30 mm) für je 10 Plättchen.',
    icon: '⬡',
    group: 'Plättchen',
    create: () => createShapeBox({ name: 'Sechsecke', pockets: generatePockets({ shape: 'polygon', w: 34.6, h: 30, params: { sides: 6 }, pockets: 4, perStack: 10, thickness: 2, grip: 'one', columns: 2 }) }),
  },
  {
    id: 'shapes',
    label: 'Sonderformen (frei)',
    description: 'Pfeil, Stern, Fahne und Herz als Startpunkt – Formen frei ändern, ergänzen und verschieben.',
    icon: '➜',
    group: 'Plättchen',
    create: () =>
      createShapeBox({
        name: 'Aufleger Sonderformen',
        pockets: [
          createPocket('arrow', 50, 26, { shaft: 12, head: 18 }, { x: 0, y: 0, count: 6 }),
          createPocket('star', 34, 32, { points: 5, inner: 45 }, { x: 50, y: 0, count: 6 }),
          createPocket('flag', 30, 40, { pole: 4, flagH: 22 }, { x: 0, y: 46, count: 6 }),
          createPocket('heart', 32, 30, {}, { x: 50, y: 44, count: 6 }),
        ],
      }),
  },
];
