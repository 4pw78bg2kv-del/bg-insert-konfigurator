/**
 * Kartengrößen-Presets und Sleeves-Kalkulator.
 */
import type { CardPresetId, CardTrayModule, SleeveType } from './types';

export interface CardPreset {
  id: CardPresetId;
  label: string;
  width: number;
  height: number;
}

export const CARD_PRESETS: readonly CardPreset[] = [
  { id: 'poker', label: 'Poker (63,5 × 88)', width: 63.5, height: 88 },
  { id: 'standardAmerican', label: 'Standard American (56 × 87)', width: 56, height: 87 },
  { id: 'miniEuropean', label: 'Mini European (44 × 68)', width: 44, height: 68 },
  { id: 'miniAmerican', label: 'Mini American (41 × 63)', width: 41, height: 63 },
  { id: 'european', label: 'Standard European (59 × 92)', width: 59, height: 92 },
  { id: 'tarot', label: 'Tarot (70 × 120)', width: 70, height: 120 },
  { id: 'square', label: 'Square (70 × 70)', width: 70, height: 70 },
];

export interface SleeveSpec {
  label: string;
  /** Aufschlag auf Kartenbreite. */
  addWidth: number;
  /** Aufschlag auf Kartenhöhe. */
  addHeight: number;
  /** Aufschlag auf die Dicke pro Karte. */
  addThickness: number;
}

export const SLEEVES: Readonly<Record<SleeveType, SleeveSpec>> = {
  none: { label: 'Ohne Hülle', addWidth: 0, addHeight: 0, addThickness: 0 },
  standard: { label: 'Standard-Hülle', addWidth: 2.5, addHeight: 3.5, addThickness: 0.12 },
  premium: { label: 'Premium / dick', addWidth: 3, addHeight: 4.5, addThickness: 0.25 },
};

export function getCardPreset(id: CardPresetId): CardPreset {
  const preset = CARD_PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unbekanntes Karten-Preset: ${id}`);
  return preset;
}

export interface EffectiveCard {
  /** Breite inkl. Hülle. */
  width: number;
  /** Höhe inkl. Hülle. */
  height: number;
  /** Dicke pro Karte inkl. Hülle. */
  thickness: number;
}

/** Effektive Kartenmaße inklusive Sleeves-Aufschlag. */
export function effectiveCard(m: Pick<CardTrayModule, 'cardPreset' | 'customCardWidth' | 'customCardHeight' | 'sleeve' | 'cardThickness'>): EffectiveCard {
  const base =
    m.cardPreset === 'custom'
      ? { width: m.customCardWidth, height: m.customCardHeight }
      : getCardPreset(m.cardPreset);
  const s = SLEEVES[m.sleeve];
  const thickness = m.cardThickness + s.addThickness;
  return {
    width: base.width + s.addWidth,
    height: base.height + s.addHeight,
    thickness,
  };
}

export function cardPresetShortName(m: CardTrayModule): string {
  if (m.cardPreset === 'custom') return `${m.customCardWidth}x${m.customCardHeight}`;
  return getCardPreset(m.cardPreset).label.split(' (')[0];
}
