/**
 * Datenmodell des Konfigurators.
 *
 * Alle Maße in Millimetern. Koordinatensystem der Geometrie: Z zeigt nach oben
 * (Druckorientierung), X = Breite, Y = Tiefe der Spielschachtel.
 *
 * Dieses Modul ist reines TypeScript ohne Abhängigkeiten zu UI oder WASM,
 * damit es in UI, Web Worker und Tests gleichermaßen genutzt werden kann.
 */

export const PROJECT_FORMAT_VERSION = 3;

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

export type Material = 'PLA' | 'PETG';

/** Globale Druckparameter, gelten für alle Module. */
export interface PrintSettings {
  material: Material;
  /** Düsendurchmesser (für Empfehlungen und Warnungen). */
  nozzle: number;
  /** Druckerprofil (`custom` = eigene Bettgröße). */
  printer: string;
  /** Nutzbare Druckfläche und -höhe. */
  bedX: number;
  bedY: number;
  bedZ: number;
  /** Spaltmaß zwischen Teilen, zur Schachtelwand und bei Steckverbindungen. */
  clearance: number;
  /** Außenwandstärke der gedruckten Module. */
  wallThickness: number;
  /** Bodenstärke der gedruckten Module. */
  floorThickness: number;
  /** Stärke von festen Trennwänden innerhalb der Module. */
  dividerThickness: number;
  /** Fase an der Unterkante gegen den „Elefantenfuß“ (0 = aus). */
  bottomChamfer: number;
}

/**
 * Innenraster: Modulgrößen werden auf ganze Rastereinheiten aufgerundet und
 * die Module an den Rasterlinien ausgerichtet.
 */
export interface GridSettings {
  enabled: boolean;
  /** Rastermaß (z. B. 5 mm oder 21 mm). */
  pitch: number;
  /**
   * `stretch` = Rastermaß minimal anpassen, damit die Schachtel genau gefüllt wird;
   * `exact` = Rastermaß exakt, der Rest bleibt als Rand.
   */
  fit: 'stretch' | 'exact';
  /** Wohin der Platz beim Aufrunden geht: in den Innenraum oder in dickere Wände. */
  grow: 'inner' | 'wall';
}

/** Grundplatte: Rippen entlang der Modulkanten halten die unterste Lage fest. */
export interface BaseplateSettings {
  enabled: boolean;
}

export type FontId = 'sans' | 'serif' | 'optimer';

/** Gemeinsame Schrift-Einstellungen aller Beschriftungen. */
export interface LabelStyle {
  font: FontId;
  /** Tiefe der vertieften Schrift. */
  depth: number;
  /** Höhe der erhabenen Schrift auf Kartentrennern. */
  raised: number;
}

export type LabelSides = 'none' | 'frontBack' | 'leftRight' | 'front';

/** Beschriftung eines Moduls (vertieft, als Einleger in anderer Farbe druckbar). */
export interface ModuleLabel {
  /** Leer = Modulname. */
  text: string;
  onLid: boolean;
  sides: LabelSides;
  /** Schrifthöhe (Versalhöhe); 0 = automatisch. */
  size: number;
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

/** Kartenangaben (für Kartenfach und Karten-Fächer in Boxen). */
export interface CardSpec {
  cardPreset: CardPresetId | 'custom';
  /** Kartenbreite bei `custom` (ohne Hülle). */
  customCardWidth: number;
  /** Kartenhöhe bei `custom` (ohne Hülle). */
  customCardHeight: number;
  sleeve: SleeveType;
  /** Dicke einer Karte ohne Hülle. */
  cardThickness: number;
}

/** Position eines Moduls in der Schachtel. */
export interface Placement {
  /** `auto` = automatische Anordnung, `manual` = feste Position. */
  mode: 'auto' | 'manual';
  /** X/Y-Position der linken vorderen Ecke in mm (mit Raster: wird auf die Rasterlinie gerundet). */
  x: number;
  y: number;
  /** Um 90° um die Hochachse gedreht. */
  rotated: boolean;
}

/** Griffmulden-Varianten. */
export type FingerCutout = 'none' | 'notch' | 'toFloor';

/** Deckelarten. */
export type LidType = 'none' | 'lift' | 'snap' | 'slide' | 'magnet' | 'hinge';

/**
 * Höhe:
 * - `auto`   = so hoch wie der Inhalt es verlangt,
 * - `fill`   = bis unter den Schachteldeckel (bzw. Kopfraum),
 * - `custom` = eigene Höhe.
 */
export type HeightMode = 'auto' | 'fill' | 'custom';

interface ModuleBase {
  id: string;
  /** Anzeigename, wird auch für den STL-Dateinamen verwendet. */
  name: string;
  /** Benötigte Stückzahl (jede Kopie wird in der Schachtel platziert). */
  quantity: number;
  /**
   * Stapelstufe: 1 liegt auf dem Boden, 2 liegt auf dem, was darunter liegt
   * (Module unterschiedlicher Höhe sind erlaubt – das Modul „fällt“ auf die
   * höchste Oberkante unter sich).
   */
  level: number;
  placement: Placement;
  heightMode: HeightMode;
  customHeight: number;
  /** Griffmulde in den Wänden. */
  fingerCutout: FingerCutout;
  /** Griffloch im Boden (Inhalt von unten herausdrücken). */
  floorHole: boolean;
  lid: LidType;
  /** Magnetgröße bei Magnetdeckel (Durchmesser × Höhe). */
  magnetDiameter: number;
  magnetHeight: number;
  label: ModuleLabel;
}

export type DividerMode = 'fixed' | 'loose' | 'toothed';
export type TabStyle = 'tab' | 'header';

export interface CardTrayModule extends ModuleBase, CardSpec {
  type: 'cardTray';
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
  /**
   * `tab` = schmale Lasche über den Karten;
   * `header` = Hängetrenner: durchgehende Kopfleiste, die auf den Fachwänden
   * aufliegt, mit Griffschlitz in der Mitte (nur senkrechte Fächer).
   */
  tabStyle: TabStyle;
  /** Überstand der Lasche über die Karten (bei Hängetrennern: Höhe der Kopfleiste). */
  tabHeight: number;
  /** Breite der Lasche in Prozent der Trennerbreite. */
  tabWidthPercent: number;
  /** Laschen versetzt (links/Mitte/rechts) für bessere Lesbarkeit. */
  tabStaggered: boolean;
  /** Zusätzliches Spiel um den Kartenstapel (gesamt pro Achse). */
  play: number;
  /** Einzeln beschriftete Trenner (ein Eintrag = ein Trenner). */
  dividerLabels: string[];
}

// ---------------------------------------------------------------------------
// Fächerbox: freie Aufteilung als Baum aus Teilungen

/** `fr` = Anteil am Rest, `mm` = feste Größe, `auto` = so groß wie der Inhalt. */
export type SizeUnit = 'fr' | 'mm' | 'auto';

export type CellContent =
  | { type: 'empty' }
  /** Token-Mulde: gerundeter Übergang zum Boden, damit man Teile herausschieben kann. */
  | { type: 'scoop'; sides: 'front' | 'both' }
  /** Karten liegend (Stapel) oder stehend (hintereinander). */
  | ({ type: 'cards'; orientation: 'flat' | 'standing'; format: 'portrait' | 'landscape'; count: number; raise: boolean } & CardSpec);

interface CellBase {
  id: string;
  /** Größe innerhalb der übergeordneten Teilung. */
  size: number;
  unit: SizeUnit;
}

export interface CellLeaf extends CellBase {
  kind: 'leaf';
  content: CellContent;
}

export interface CellSplit extends CellBase {
  kind: 'split';
  /** `x` = nebeneinander (Spalten), `y` = hintereinander (Reihen, von vorne nach hinten). */
  dir: 'x' | 'y';
  children: CellNode[];
}

export type CellNode = CellLeaf | CellSplit;

export interface GridBoxModule extends ModuleBase {
  type: 'gridBox';
  /** `auto` = Größe aus dem Inhalt, `manual` = Außenmaße vorgeben. */
  sizeMode: 'auto' | 'manual';
  /** Außenbreite (X) bei `manual` (mit Raster: aufgerundet). */
  width: number;
  /** Außentiefe (Y) bei `manual`. */
  depth: number;
  /** Aufteilung. */
  root: CellNode;
  /** Trennwände werden um diesen Betrag niedriger als die Außenwand gedruckt. */
  dividerLowering: number;
  /** Auf welchen Seiten die Griffmulden sitzen. */
  fingerSides: 'front' | 'frontBack' | 'leftRight';
}

// ---------------------------------------------------------------------------
// Aufleger-Box: Taschen in Sonderformen

export type ShapeKind =
  | 'rect'
  | 'roundRect'
  | 'ellipse'
  | 'triangle'
  | 'rightTriangle'
  | 'diamond'
  | 'polygon'
  | 'star'
  | 'arrow'
  | 'doubleArrow'
  | 'cross'
  | 'heart'
  | 'lightning'
  | 'flag'
  | 'callout'
  | 'ovalCallout'
  /** Freiform: Umriss aus `Pocket.points` (z. B. aus einem vorhandenen Insert übernommen). */
  | 'custom';

export interface Pocket {
  id: string;
  shape: ShapeKind;
  /** Breite und Höhe des Aufleger-Umrisses (ohne Spiel). */
  w: number;
  h: number;
  /** Formabhängige Zusatzmaße (siehe `SHAPES`). */
  params: Record<string, number>;
  /**
   * Nur bei `custom`: Umriss als Punktliste (Mittelpunkt im Ursprung). Er wird auf
   * Breite × Höhe skaliert, sodass sich die Tasche wie jede andere Form ändern lässt.
   */
  points?: [number, number][];
  /** Beschriftung, vertieft in den Taschenboden (z. B. „5× Wasser“). */
  label?: string;
  /** Mittelpunkt der Tasche, gemessen von der linken vorderen Außenecke. */
  x: number;
  y: number;
  /** Drehung in Grad (gegen den Uhrzeigersinn). */
  rotation: number;
  /** Anzahl Aufleger im Stapel. */
  count: number;
  /** Dicke eines Auflegers. */
  thickness: number;
  /** Griffmulden: keine, eine oder zwei gegenüberliegende. */
  grip: 'none' | 'one' | 'two';
  /** Richtung der Griffmulde in Grad (0 = nach rechts, 270 = nach vorne). */
  gripAngle: number;
}

export interface ShapeBoxModule extends ModuleBase {
  type: 'shapeBox';
  sizeMode: 'auto' | 'manual';
  width: number;
  depth: number;
  pockets: Pocket[];
  /** Zusätzliches Spiel um jeden Aufleger (zum Spaltmaß hinzu). */
  pocketPlay: number;
}

export type InsertModule = CardTrayModule | GridBoxModule | ShapeBoxModule;
export type ModuleType = InsertModule['type'];

export interface Project {
  formatVersion: number;
  name: string;
  box: BoxSettings;
  print: PrintSettings;
  grid: GridSettings;
  baseplate: BaseplateSettings;
  labels: LabelStyle;
  modules: InsertModule[];
}

/** Berechnete Außenmaße eines Moduls (unrotiert, inkl. Deckel). */
export interface ModuleSize {
  width: number;
  depth: number;
  height: number;
}

/** Eine platzierte Kopie eines Moduls in der Schachtel. */
export interface PlacedInstance {
  moduleId: string;
  copyIndex: number;
  level: number;
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
  /** Module, auf denen diese Kopie aufliegt (leer = Boden bzw. Grundplatte). */
  supports: string[];
}

export type WarningLevel = 'error' | 'warning' | 'info';

export interface ValidationMessage {
  level: WarningLevel;
  moduleId?: string;
  text: string;
}

export type PartKind = 'module' | 'lid' | 'divider' | 'baseplate' | 'inlay' | 'lidInlay';

/** Ein einzelnes druckbares Teil (eine STL-Datei). */
export interface PartSpec {
  /** Eindeutige ID, z. B. `<modulId>`, `<modulId>:lid`, `<modulId>:div:1`, `baseplate:0`. */
  id: string;
  kind: PartKind;
  moduleId?: string;
  /** Laschenposition bei Trennern (0 = links, 1 = Mitte, 2 = rechts). */
  variant?: number;
  /** Beschriftung bei einzeln beschrifteten Trennern. */
  text?: string;
  /** Kachel bei Grundplatten. */
  tile?: BaseplateTile;
  name: string;
  quantity: number;
  /** Hinweis für den Druck (z. B. Farbwechsel). */
  note?: string;
}

export interface BaseplateTile {
  index: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Zukaufteile (Magnete, Scharnierstifte). */
export interface HardwareItem {
  name: string;
  quantity: number;
}
