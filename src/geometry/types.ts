/**
 * Datenmodell des Konfigurators.
 *
 * Alle Maße in Millimetern. Koordinatensystem der Geometrie: Z zeigt nach oben
 * (Druckorientierung), X = Breite, Y = Tiefe der Spielschachtel.
 *
 * Dieses Modul ist reines TypeScript ohne Abhängigkeiten zu UI oder WASM,
 * damit es in UI, Web Worker und Tests gleichermaßen genutzt werden kann.
 */

export const PROJECT_FORMAT_VERSION = 1;

/** Maße der Original-Spielschachtel (Karton). */
export interface BoxSettings {
  /** Innenbreite (X) der Schachtel. */
  innerWidth: number;
  /** Innentiefe (Y) der Schachtel. */
  innerDepth: number;
  /** Innenhöhe (Z) der Schachtel, gemessen vom Boden bis zur Deckelunterkante. */
  innerHeight: number;
  /** Wandstärke des Kartons (nur für Außenmaße und Darstellung). */
  wallThickness: number;
  /** Bodenstärke des Kartons (nur für Außenmaße und Darstellung). */
  floorThickness: number;
  /** Oben reservierter Platz für Spielbretter, Tableaus und Anleitungen. */
  headroom: number;
}

/** Globale Druckparameter, gelten für alle Module. */
export interface PrintSettings {
  /** Spaltmaß zwischen Teilen und zur Schachtelwand (Standard 0,2 mm). */
  clearance: number;
  /** Außenwandstärke der gedruckten Module. */
  wallThickness: number;
  /** Bodenstärke der gedruckten Module. */
  floorThickness: number;
  /** Stärke von Trennwänden innerhalb der Module. */
  dividerThickness: number;
}

export type SleeveType = 'none' | 'standard' | 'premium';
export type CardPresetId =
  | 'poker'
  | 'standardAmerican'
  | 'miniEuropean'
  | 'miniAmerican'
  | 'european'
  | 'tarot'
  | 'square';

/** Position eines Moduls in der Schachtel. */
export interface Placement {
  /** `auto` = automatisches Raster, `manual` = feste Position per Zahleneingabe. */
  mode: 'auto' | 'manual';
  /** X-Position der linken vorderen Ecke (nur bei `manual`). */
  x: number;
  /** Y-Position der linken vorderen Ecke (nur bei `manual`). */
  y: number;
  /** Um 90° um die Hochachse gedreht. */
  rotated: boolean;
}

interface ModuleBase {
  id: string;
  /** Anzeigename, wird auch für den STL-Dateinamen verwendet. */
  name: string;
  /** Benötigte Stückzahl (jede Kopie wird in der Schachtel platziert). */
  quantity: number;
  placement: Placement;
  /** `layer` = volle nutzbare Ebenenhöhe, `custom` = eigene Höhe. */
  heightMode: 'layer' | 'custom';
  customHeight: number;
}

export interface CardTrayModule extends ModuleBase {
  type: 'cardTray';
  cardPreset: CardPresetId | 'custom';
  /** Kartenbreite bei `custom` (ohne Hülle). */
  customCardWidth: number;
  /** Kartenhöhe bei `custom` (ohne Hülle). */
  customCardHeight: number;
  sleeve: SleeveType;
  /** Karten pro Fach. */
  cardCount: number;
  /** Dicke einer Karte ohne Hülle. */
  cardThickness: number;
  /** Anzahl fester Fächer. */
  slots: number;
  /** `standing` = Karten hochkant, `flat` = Karten liegend. */
  orientation: 'standing' | 'flat';
  /** Zusätzliches Spiel um den Kartenstapel (gesamt pro Achse). */
  play: number;
  /** Griffmulde zum Herausnehmen der Karten. */
  fingerCutout: boolean;
}

export interface GridBoxModule extends ModuleBase {
  type: 'gridBox';
  /** Außenbreite (X). */
  width: number;
  /** Außentiefe (Y). */
  depth: number;
  columns: number;
  rows: number;
  /** Trennwände werden um diesen Betrag niedriger als die Außenwand gedruckt. */
  dividerLowering: number;
}

export type InsertModule = CardTrayModule | GridBoxModule;
export type ModuleType = InsertModule['type'];

export interface Project {
  formatVersion: number;
  name: string;
  box: BoxSettings;
  print: PrintSettings;
  modules: InsertModule[];
}

/** Berechnete Außenmaße eines Moduls (unrotiert). */
export interface ModuleSize {
  width: number;
  depth: number;
  height: number;
}

/** Eine platzierte Kopie eines Moduls in der Schachtel. */
export interface PlacedInstance {
  moduleId: string;
  copyIndex: number;
  x: number;
  y: number;
  /** Footprint inkl. Rotation. */
  width: number;
  depth: number;
  height: number;
  rotated: boolean;
}

export type WarningLevel = 'error' | 'warning' | 'info';

export interface ValidationMessage {
  level: WarningLevel;
  moduleId?: string;
  text: string;
}
