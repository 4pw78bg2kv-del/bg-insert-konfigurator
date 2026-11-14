/**
 * Spiel-Presets: komplette, sofort ladbare Projekte für bestimmte Spiele.
 * Neue Spiele hier eintragen (eine Datei je Spiel in diesem Ordner).
 */
import type { Project } from '../types';
import { createFrosthavenProject } from './frosthaven';

export interface GamePreset {
  id: string;
  label: string;
  description: string;
  icon: string;
  create(): Project;
}

export const GAME_PRESETS: readonly GamePreset[] = [
  {
    id: 'frosthaven',
    label: 'Frosthaven',
    description:
      'Grundspiel: Gebietsaufleger, 4 Monsterboxen, Markerbox, Kartenfächer mit beschrifteten Hängetrennern für Ereignisse, Gebäude, Gegenstände, Szenarien, Tiere und Bosse.',
    icon: '❄',
    create: createFrosthavenProject,
  },
];

export { createFrosthavenProject, frosthavenModules } from './frosthaven';
