/**
 * Plausibilitätsprüfung: Kollisionen, Überstände und unpassende Maße.
 */
import { effectiveCard } from './cards';
import { cardTrayLayout, gridBoxLayout, usableHeight } from './dimensions';
import type { PlacedInstance, Project, ValidationMessage } from './types';

const EPS = 0.01;
const MIN_CELL = 5;
const f = (v: number) => v.toFixed(1).replace('.', ',');

export function validateProject(project: Project, layout: PlacedInstance[]): ValidationMessage[] {
  const msgs: ValidationMessage[] = [];
  const { box, print } = project;
  const usable = usableHeight(box);
  const byId = new Map(project.modules.map((m) => [m.id, m]));

  if (box.headroom >= box.innerHeight) {
    msgs.push({ level: 'error', text: 'Der Kopfraum ist größer als die Innenhöhe der Schachtel.' });
  }
  if (print.wallThickness < 0.8) {
    msgs.push({ level: 'warning', text: 'Wandstärke unter 0,8 mm ist mit einer 0,4-mm-Düse kaum druckbar.' });
  }

  for (const m of project.modules) {
    if (m.type === 'cardTray') {
      const l = cardTrayLayout(m, print, box);
      const card = effectiveCard(m);
      const innerH = l.height - print.floorThickness;
      if (m.orientation === 'standing' && card.height + print.floorThickness > usable + EPS) {
        msgs.push({
          level: 'error',
          moduleId: m.id,
          text: `${m.name}: Karten (${f(card.height)} mm hoch + Boden) passen stehend nicht in die nutzbare Höhe von ${f(usable)} mm. Tipp: Ausrichtung „liegend“.`,
        });
      } else if (m.orientation === 'flat' && l.requiredInnerHeight > innerH + EPS) {
        msgs.push({
          level: 'error',
          moduleId: m.id,
          text: `${m.name}: Kartenstapel (${f(l.requiredInnerHeight)} mm) ist höher als das Fach (${f(innerH)} mm). Mehr Fächer oder weniger Karten wählen.`,
        });
      }
    } else {
      const l = gridBoxLayout(m, print, box);
      if (l.cellX < MIN_CELL || l.cellY < MIN_CELL) {
        msgs.push({
          level: 'error',
          moduleId: m.id,
          text: `${m.name}: Fächer sind zu klein (${f(l.cellX)} × ${f(l.cellY)} mm). Weniger Spalten/Reihen oder größere Box wählen.`,
        });
      }
      if (m.dividerLowering >= l.height - print.floorThickness) {
        msgs.push({ level: 'warning', moduleId: m.id, text: `${m.name}: Trennwände sind komplett abgesenkt.` });
      }
    }
    if (m.heightMode === 'custom' && m.customHeight > usable + EPS) {
      msgs.push({
        level: 'error',
        moduleId: m.id,
        text: `${m.name}: Höhe ${m.customHeight} mm überschreitet die nutzbare Höhe (${f(usable)} mm).`,
      });
    }
    if (m.heightMode === 'custom' && m.customHeight <= print.floorThickness) {
      msgs.push({ level: 'error', moduleId: m.id, text: `${m.name}: Höhe muss größer als die Bodenstärke sein.` });
    }
  }

  // Überstand über die Schachtel
  const reported = new Set<string>();
  for (const inst of layout) {
    const out =
      inst.x < -EPS ||
      inst.y < -EPS ||
      inst.x + inst.width > box.innerWidth + EPS ||
      inst.y + inst.depth > box.innerDepth + EPS;
    if (out && !reported.has(inst.moduleId)) {
      reported.add(inst.moduleId);
      const m = byId.get(inst.moduleId);
      msgs.push({ level: 'error', moduleId: inst.moduleId, text: `${m?.name ?? 'Modul'}: ragt über die Schachtel hinaus.` });
    }
  }

  // Kollisionen zwischen Modulen
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      const a = layout[i];
      const b = layout[j];
      const hit =
        a.x < b.x + b.width - EPS && b.x < a.x + a.width - EPS && a.y < b.y + b.depth - EPS && b.y < a.y + a.depth - EPS;
      if (hit) {
        const na = byId.get(a.moduleId)?.name ?? '?';
        const nb = byId.get(b.moduleId)?.name ?? '?';
        msgs.push({ level: 'error', moduleId: b.moduleId, text: `Kollision: ${na} überschneidet sich mit ${nb}.` });
      }
    }
  }

  return msgs;
}

/** Belegte Grundfläche in Prozent der Schachtel-Innenfläche. */
export function areaUsage(project: Project, layout: PlacedInstance[]): number {
  const area = project.box.innerWidth * project.box.innerDepth;
  if (area <= 0) return 0;
  return (100 * layout.reduce((s, i) => s + i.width * i.depth, 0)) / area;
}
