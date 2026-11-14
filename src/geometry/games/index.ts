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
      'Grundspiel, lückenlos (Füllgrad 99 %): 17 Charakterboxen, 18 Miniaturen-Schachteln, 22 Monsterboxen, zwei Gebietsaufleger-Schalen mit Originaltaschen, Kartenfächer mit beschrifteten Hängetrennern, Kartendecks und Marker.',
    icon: '❄',
    create: createFrosthavenProject,
  },
];

export { createFrosthavenProject, frosthavenModules } from './frosthaven';
