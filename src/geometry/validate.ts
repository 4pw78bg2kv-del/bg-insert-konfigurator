/**
 * Plausibilitätsprüfung: Kollisionen, Überstände und unpassende Maße.
 */
import { cardTrayLayout, gridBoxLayout, gridInfo, layerInfos, moduleContext, usableHeight } from './dimensions';
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
  const layers = layerInfos(project);
  const totalLayers = layers.reduce((s, l) => s + l.height, 0);
  if (totalLayers > usable + EPS) {
    msgs.push({ level: 'error', text: `Die Ebenen sind zusammen ${f(totalLayers)} mm hoch, nutzbar sind ${f(usable)} mm.` });
  }
  for (const l of layers) {
    if (l.available <= print.floorThickness + 1) {
      msgs.push({ level: 'error', text: `${l.layer.name} ist zu niedrig (${f(l.height)} mm).` });
    }
  }
  if (project.grid.enabled) {
    const g = gridInfo(project);
    if (g.cellX < 10 || g.cellY < 10) msgs.push({ level: 'warning', text: 'Rasterzellen unter 10 mm sind sehr fein.' });
  }

  for (const m of project.modules) {
    const ctx = moduleContext(m, project);
    const avail = ctx.layer.available;
    if (m.type === 'cardTray') {
      const l = cardTrayLayout(m, project);
      if (l.requiredInnerHeight > l.cavityHeight + EPS) {
        const what =
          m.orientation === 'standing'
            ? `Karten${m.tab && m.dividerMode !== 'fixed' ? ' mit Trennerlasche' : ''} (${f(l.requiredInnerHeight)} mm)`
            : `Kartenstapel (${f(l.requiredInnerHeight)} mm)`;
        const tip =
          m.orientation === 'standing'
            ? m.tilt > 0
              ? ` Tipp: stärker neigen${m.format === 'portrait' ? ', Querformat' : ''} oder liegend.`
              : m.format === 'portrait'
                ? ' Tipp: Querformat, schräg oder liegend.'
                : ' Tipp: schräg stellen oder liegend.'
            : ' Mehr Fächer oder weniger Karten wählen.';
        msgs.push({ level: 'error', moduleId: m.id, text: `${m.name}: ${what} passen nicht in die Höhe des Fachs (${f(l.cavityHeight)} mm).${tip}` });
      }
      if (m.orientation === 'standing' && m.dividerMode !== 'fixed' && m.totalCards <= 0) {
        msgs.push({ level: 'warning', moduleId: m.id, text: `${m.name}: Anzahl der Karten ist 0.` });
      }
      if (m.orientation === 'standing' && m.dividerMode === 'toothed' && m.tilt > 30) {
        msgs.push({ level: 'warning', moduleId: m.id, text: `${m.name}: Bei mehr als 30° Neigung halten Zacken-Trenner schlechter.` });
      }
    } else {
      const l = gridBoxLayout(m, project);
      const small = l.cells.filter((c) => c.w < MIN_CELL || c.d < MIN_CELL);
      if (small.length) {
        msgs.push({
          level: 'error',
          moduleId: m.id,
          text: `${m.name}: ${small.length} Fach/Fächer sind kleiner als ${MIN_CELL} mm. Aufteilung oder Größe anpassen.`,
        });
      }
      if (l.dividerLowering >= l.height - l.floor && l.cells.length > 1) {
        msgs.push({ level: 'warning', moduleId: m.id, text: `${m.name}: Trennwände sind komplett abgesenkt.` });
      }
      if (l.lid && l.height < l.floor + 8) {
        msgs.push({ level: 'error', moduleId: m.id, text: `${m.name}: Für den Steckdeckel ist die Box zu niedrig.` });
      }
    }
    const total = m.type === 'cardTray' ? cardTrayLayout(m, project).height : gridBoxLayout(m, project).height + (m.lid === 'snap' ? 1.6 : 0);
    if (total > avail + EPS) {
      msgs.push({ level: 'error', moduleId: m.id, text: `${m.name}: Höhe ${f(total)} mm überschreitet die Ebene (${f(avail)} mm).` });
    }
    if (m.heightMode === 'custom' && m.customHeight <= ctx.floor + 1) {
      msgs.push({ level: 'error', moduleId: m.id, text: `${m.name}: Höhe muss größer als die Bodenstärke sein.` });
    }
  }

  // Überstand über die Schachtel
  const reported = new Set<string>();
  for (const inst of layout) {
    const out =
      inst.x < -EPS || inst.y < -EPS || inst.x + inst.width > box.innerWidth + EPS || inst.y + inst.depth > box.innerDepth + EPS;
    if (out && !reported.has(inst.moduleId)) {
      reported.add(inst.moduleId);
      const m = byId.get(inst.moduleId);
      msgs.push({
        level: 'error',
        moduleId: inst.moduleId,
        text: `${m?.name ?? 'Modul'}: passt nicht mehr in die Ebene (ragt über die Schachtel hinaus).`,
      });
    }
  }

  // Kollisionen innerhalb einer Ebene
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      const a = layout[i];
      const b = layout[j];
      if (a.layerId !== b.layerId) continue;
      const hit = a.x < b.x + b.width - EPS && b.x < a.x + a.width - EPS && a.y < b.y + b.depth - EPS && b.y < a.y + a.depth - EPS;
      if (hit) {
        const na = byId.get(a.moduleId)?.name ?? '?';
        const nb = byId.get(b.moduleId)?.name ?? '?';
        msgs.push({ level: 'error', moduleId: b.moduleId, text: `Kollision: ${na} überschneidet sich mit ${nb}.` });
      }
    }
  }

  return msgs;
}

/** Belegte Grundfläche je Ebene in Prozent der Schachtel-Innenfläche. */
export function areaUsage(project: Project, layout: PlacedInstance[], layerId?: string): number {
  const area = project.box.innerWidth * project.box.innerDepth;
  if (area <= 0) return 0;
  const lid = layerId ?? project.layers[0]?.id;
  return (100 * layout.filter((i) => i.layerId === lid).reduce((s, i) => s + i.width * i.depth, 0)) / area;
}
