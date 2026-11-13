/**
 * Datenmodell des Konfigurators.
 *
 * Alle Maße in Millimetern. Koordinatensystem der Geometrie: Z zeigt nach oben
 * (Druckorientierung), X = Breite, Y = Tiefe der Spielschachtel.
 *
 * Dieses Modul ist reines TypeScript ohne Abhängigkeiten zu UI oder WASM,
 * damit es in UI, Web Worker und Tests gleichermaßen genutzt werden kann.
 */

export const PROJECT_FORMAT_VERSION = 2;

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
  /** Spaltmaß zwischen Teilen, zur Schachtelwand und bei Steckverbindungen (Standard 0,2 mm). */
  clearance: number;
  /** Außenwandstärke der gedruckten Module. */
  wallThickness: number;
  /** Bodenstärke der gedruckten Module. */
  floorThickness: number;
  /** Stärke von festen Trennwänden innerhalb der Module. */
  dividerThickness: number;
}

/**
 * Innenraster: Alle Module belegen ganze Rasterzellen. Optional sorgt eine
 * Grundplatte mit Rippen dafür, dass die Module ineinandergreifen und nicht
 * verrutschen (die Module haben passende Nuten im Boden).
 */
export interface GridSettings {
  enabled: boolean;
  /** Gewünschte Zellgröße; die tatsächliche Größe füllt die Schachtel exakt aus. */
  targetCell: number;
  /** Grundplatte mit Verriegelungsrippen erzeugen. */
  baseplate: boolean;
  /** Maximale Kachelgröße der Grundplatte (Druckbett). */
  maxTileSize: number;
}

/** Eine Ebene für gestapelte Module. Ebene 0 liegt unten. */
export interface Layer {
  id: string;
  name: string;
  /** `auto` = teilt sich die verbleibende Höhe mit anderen Auto-Ebenen. */
  heightMode: 'auto' | 'fixed';
  height: number;
  visible: boolean;
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

/** Position eines Moduls in seiner Ebene. */
export interface Placement {
  /** `auto` = automatische Anordnung, `manual` = feste Position. */
  mode: 'auto' | 'manual';
  /** X-Position der linken vorderen Ecke in mm (ohne Raster). */
  x: number;
  /** Y-Position der linken vorderen Ecke in mm (ohne Raster). */
  y: number;
  /** Rasterzelle X (mit Raster). */
  gx: number;
  /** Rasterzelle Y (mit Raster). */
  gy: number;
  /** Um 90° um die Hochachse gedreht. */
  rotated: boolean;
}

/** Griffmulden-Varianten. */
export type FingerCutout = 'none' | 'notch' | 'toFloor';

interface ModuleBase {
  id: string;
  /** Anzeigename, wird auch für den STL-Dateinamen verwendet. */
  name: string;
  /** Benötigte Stückzahl (jede Kopie wird in der Schachtel platziert). */
  quantity: number;
  /** Ebene, in der das Modul liegt. */
  layerId: string;
  placement: Placement;
  /**
   * `auto` = so hoch wie nötig (Kartenfach) bzw. Ebenenhöhe (Box),
   * `layer` = volle Ebenenhöhe, `custom` = eigene Höhe.
   */
  heightMode: 'auto' | 'layer' | 'custom';
  customHeight: number;
  /** Griffmulde in den Wänden. */
  fingerCutout: FingerCutout;
  /** Griffloch im Boden (Inhalt von unten herausdrücken). */
  floorHole: boolean;
}

export type DividerMode = 'fixed' | 'loose' | 'toothed';

export interface CardTrayModule extends ModuleBase {
  type: 'cardTray';
  cardPreset: CardPresetId | 'custom';
  /** Kartenbreite bei `custom` (ohne Hülle). */
  customCardWidth: number;
  /** Kartenhöhe bei `custom` (ohne Hülle). */
  customCardHeight: number;
  sleeve: SleeveType;
  /** Dicke einer Karte ohne Hülle. */
  cardThickness: number;
  /** `standing` = Karten hochkant, `flat` = Karten liegend. */
  orientation: 'standing' | 'flat';
  /** Hochformat (lange Seite senkrecht bzw. in Tiefe) oder Querformat. */
  format: 'portrait' | 'landscape';
  /** Neigung stehender Karten in Grad (0 = senkrecht). */
  tilt: number;
  /** Anzahl Kartenreihen nebeneinander (1 oder 2). */
  rows: number;
  /**
   * `fixed` = feste, mitgedruckte Fächer;
   * `loose` = separate Trenner, frei verschiebbar (glatte Wände);
   * `toothed` = separate Trenner, rasten im Zackenmuster der Wände ein.
   */
  dividerMode: DividerMode;
  /** Feste Fächer pro Reihe (`fixed`). */
  slots: number;
  /** Karten pro Fach (`fixed`). */
  cardsPerSlot: number;
  /** Karten insgesamt (`loose`/`toothed`), verteilt auf alle Reihen. */
  totalCards: number;
  /** Trenner insgesamt (`loose`/`toothed`), verteilt auf alle Reihen. */
  dividerCount: number;
  /** Stärke der separaten Trenner. */
  dividerPlateThickness: number;
  /** Beschriftungslasche an den separaten Trennern. */
  tab: boolean;
  /** Überstand der Lasche über die Karten. */
  tabHeight: number;
  /** Breite der Lasche in Prozent der Trennerbreite. */
  tabWidthPercent: number;
  /** Laschen versetzt (links/mitte/rechts) für bessere Lesbarkeit. */
  tabStaggered: boolean;
  /** Zusätzliches Spiel um den Kartenstapel (gesamt pro Achse). */
  play: number;
}

export type LidType = 'none' | 'snap';

/** Eine Reihe einer Rasterbox: relative Tiefe und relative Spaltenbreiten. */
export interface GridRow {
  size: number;
  columns: number[];
}

export interface GridBoxModule extends ModuleBase {
  type: 'gridBox';
  /** Außenbreite (X) ohne Innenraster. */
  width: number;
  /** Außentiefe (Y) ohne Innenraster. */
  depth: number;
  /** Breite in Rasterzellen (mit Innenraster). */
  widthCells: number;
  /** Tiefe in Rasterzellen (mit Innenraster). */
  depthCells: number;
  /** Freie Aufteilung: Reihen von vorne nach hinten, je mit eigenen Spalten. */
  layout: GridRow[];
  /** Trennwände werden um diesen Betrag niedriger als die Außenwand gedruckt. */
  dividerLowering: number;
  /** Auf welchen Seiten die Griffmulden sitzen. */
  fingerSides: 'front' | 'frontBack' | 'leftRight';
  lid: LidType;
}

export type InsertModule = CardTrayModule | GridBoxModule;
export type ModuleType = InsertModule['type'];

export interface Project {
  formatVersion: number;
  name: string;
  box: BoxSettings;
  print: PrintSettings;
  grid: GridSettings;
  layers: Layer[];
  modules: InsertModule[];
}

/** Berechnete Außenmaße eines Moduls (unrotiert, ohne Deckel). */
export interface ModuleSize {
  width: number;
  depth: number;
  height: number;
}

/** Eine platzierte Kopie eines Moduls in der Schachtel. */
export interface PlacedInstance {
  moduleId: string;
  copyIndex: number;
  layerId: string;
  x: number;
  y: number;
  /** Unterkante des Moduls. */
  z: number;
  /** Footprint inkl. Rotation. */
  width: number;
  depth: number;
  /** Höhe inkl. Deckel. */
  height: number;
  rotated: boolean;
}

export type WarningLevel = 'error' | 'warning' | 'info';

export interface ValidationMessage {
  level: WarningLevel;
  moduleId?: string;
  text: string;
}

/** Ein einzelnes druckbares Teil (eine STL-Datei). */
export interface PartSpec {
  /** Eindeutige ID, z. B. `<modulId>`, `<modulId>:lid`, `<modulId>:div:1`, `baseplate:<key>`. */
  id: string;
  kind: 'module' | 'lid' | 'divider' | 'baseplate';
  moduleId?: string;
  /** Variante (Laschenposition bei Trennern). */
  variant?: number;
  /** Kachel-Maße bei Grundplatten. */
  tile?: BaseplateTile;
  name: string;
  quantity: number;
}

export interface BaseplateTile {
  /** Erste Rasterlinie und Anzahl Zellen je Achse. */
  cx: number;
  cy: number;
  nx: number;
  ny: number;
}
