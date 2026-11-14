/**
 * Plausibilitätsprüfung: Kollisionen, Überstände, Druckbett, Deckel,
 * Fächer, Taschen und Beschriftung.
 */
import { LID_LIP_DEPTH, cardFace, gridInfo, hangingDividers, labelSides, leafRequirement, pocketDepth, usableHeight } from './dimensions';
import { cardTrayLayout, gridBoxLayout, moduleSize, shapeBoxLayout } from './layout';
import { dividerLabelList, hasBodyLabel, hasLid, labelText } from './parts';
import { BED_MARGIN, fitsBed } from './printers';
import { polygonDistance } from './shapes';
import { DIRECTION_LABEL, fillReport } from './fill';
import { fitTextHeight, fontLoaded } from './text';
import type { InsertModule, PlacedInstance, Project, ValidationMessage } from './types';

const EPS = 0.01;
const MIN_CELL = 5;
const f = (v: number, d = 1) => v.toFixed(d).replace('.', ',');

function lidHeights(m: InsertModule, p: Project): { body: number; plate: number } {
  if (m.type === 'cardTray') {
    const l = cardTrayLayout(m, p);
    return { body: l.height, plate: l.lid.plate };
  }
  if (m.type === 'gridBox') {
    const l = gridBoxLayout(m, p);
    return { body: l.height, plate: l.lid.plate };
  }
  const l = shapeBoxLayout(m, p);
  return { body: l.height, plate: l.lid.plate };
}

export function validateProject(project: Project, layout: PlacedInstance[]): ValidationMessage[] {
  const msgs: ValidationMessage[] = [];
  const { box, print } = project;
  const usable = usableHeight(box);
  const byId = new Map(project.modules.map((m) => [m.id, m]));

  if (box.headroom >= box.innerHeight) msgs.push({ level: 'error', text: 'Der Kopfraum ist größer als die Innenhöhe der Schachtel.' });
  if (print.wallThickness < 2 * print.nozzle - 0.01) {
    msgs.push({ level: 'warning', text: `Wandstärke unter ${f(2 * print.nozzle)} mm (2 Linien) ist mit einer ${f(print.nozzle)}-mm-Düse kaum druckbar.` });
  }
  if (print.material === 'PETG' && print.clearance < 0.25) {
    msgs.push({ level: 'info', text: 'PETG: Ein Spaltmaß von 0,25 mm oder mehr verhindert, dass Deckel und Trenner klemmen.' });
  }
  if (project.grid.enabled) {
    const g = gridInfo(project);
    if (g.cellX < 4 || g.cellY < 4) msgs.push({ level: 'warning', text: 'Rastermaß unter 4 mm ist sehr fein.' });
  }

  for (const m of project.modules) {
    const name = m.name || 'Modul';
    const size = moduleSize(m, project);
    const lh = lidHeights(m, project);

    if (m.type === 'cardTray') {
      const l = cardTrayLayout(m, project);
      if (l.requiredInnerHeight > l.cavityHeight - l.lid.innerReserve + EPS) {
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
            : ' Tipp: mehr Fächer oder weniger Karten.';
        msgs.push({ level: 'error', moduleId: m.id, text: `${name}: ${what} passen nicht in die Höhe des Fachs (${f(l.cavityHeight - l.lid.innerReserve)} mm).${tip}` });
      }
      if (m.orientation === 'standing' && m.dividerMode !== 'fixed' && m.totalCards <= 0) {
        msgs.push({ level: 'warning', moduleId: m.id, text: `${name}: Anzahl der Karten ist 0.` });
      }
      if (m.orientation === 'standing' && m.dividerMode === 'toothed' && m.tilt > 30) {
        msgs.push({ level: 'warning', moduleId: m.id, text: `${name}: Bei mehr als 30° Neigung halten Zacken-Trenner schlechter.` });
      }
      if (dividerLabelList(m).length > 0 && !m.tab) {
        msgs.push({ level: 'warning', moduleId: m.id, text: `${name}: Für beschriftete Trenner die Lasche einschalten – sonst verdecken die Karten die Schrift.` });
      }
      if (m.tab && m.tabStyle === 'header' && m.orientation === 'standing' && m.dividerMode !== 'fixed' && m.tilt > 0) {
        msgs.push({ level: 'info', moduleId: m.id, text: `${name}: Hängetrenner gibt es nur bei senkrechten Fächern – bei Neigung wird die normale Lasche verwendet.` });
      }
      if (m.lid !== 'none' && hangingDividers(m)) {
        msgs.push({ level: 'info', moduleId: m.id, text: `${name}: Die Kopfleisten der Hängetrenner ragen über die Wände – das Fach bekommt keinen Deckel.` });
      }
      if (m.lid !== 'none' && m.orientation === 'standing' && m.tilt > 0) {
        msgs.push({ level: 'info', moduleId: m.id, text: `${name}: Schräge Kartenfächer bekommen keinen Deckel.` });
      }
      if ((m.label.sides === 'frontBack' || m.label.sides === 'front') && m.orientation === 'standing' && m.tilt > 0) {
        msgs.push({ level: 'info', moduleId: m.id, text: `${name}: Vorne/hinten ist das Fach schräg – Beschriftung „links/rechts“ wählen.` });
      }
    } else if (m.type === 'gridBox') {
      const l = gridBoxLayout(m, project);
      const small = l.cells.filter((c) => c.w < MIN_CELL || c.d < MIN_CELL);
      if (small.length) {
        msgs.push({ level: 'error', moduleId: m.id, text: `${name}: ${small.length} Fach/Fächer sind kleiner als ${MIN_CELL} mm. Aufteilung oder Größe anpassen.` });
      }
      for (const c of l.cells) {
        const ct = c.leaf.content;
        if (ct.type !== 'cards') continue;
        const req = leafRequirement(c.leaf);
        const what = `${ct.count} Karten ${ct.orientation === 'flat' ? 'liegend' : 'stehend'}`;
        if (c.w + EPS < req.w || c.d + EPS < req.d) {
          msgs.push({ level: 'error', moduleId: m.id, text: `${name}: Fach für ${what} ist zu klein (${f(c.w)} × ${f(c.d)} mm, nötig ${f(req.w)} × ${f(req.d)} mm). Tipp: Größe „an Inhalt“ verwenden.` });
        }
        const room = l.height - l.lid.innerReserve - c.floor;
        if (req.h > room + EPS) {
          const face = cardFace(ct, ct.format);
          if (ct.orientation === 'flat') msgs.push({ level: 'error', moduleId: m.id, text: `${name}: Stapel aus ${what} (${f(req.h)} mm) ist höher als das Fach (${f(room)} mm).` });
          else if (hasLid(m)) msgs.push({ level: 'error', moduleId: m.id, text: `${name}: Stehende Karten (${f(face.faceH)} mm) sind höher als die Box – der Deckel schließt nicht.` });
          else msgs.push({ level: 'info', moduleId: m.id, text: `${name}: Stehende Karten ragen ${f(req.h - room)} mm aus der Box (gut zum Greifen).` });
        }
      }
      if (l.dividerLowering >= l.height - l.floor && l.cells.length > 1) {
        msgs.push({ level: 'warning', moduleId: m.id, text: `${name}: Trennwände sind komplett abgesenkt.` });
      }
    } else {
      const l = shapeBoxLayout(m, project);
      const offs = l.pockets.map((pl) => pl.outline);
      const wall = Math.max(0.8, print.nozzle * 2);
      for (let i = 0; i < offs.length; i++) {
        for (let j = i + 1; j < offs.length; j++) {
          const d = polygonDistance(offs[i], offs[j]) - 2 * l.play;
          if (d < wall - EPS) {
            msgs.push({ level: 'error', moduleId: m.id, text: `${name}: Taschen ${i + 1} und ${j + 1} sind sich zu nah (${d <= 0 ? 'überschneiden sich' : `${f(d)} mm Steg`}, mindestens ${f(wall)} mm).` });
          }
        }
        const xs = offs[i].map((pt) => pt[0]);
        const ys = offs[i].map((pt) => pt[1]);
        if (Math.min(...xs) - l.play < 0.8 || Math.min(...ys) - l.play < 0.8 || Math.max(...xs) + l.play > l.width - 0.8 || Math.max(...ys) + l.play > l.depth - 0.8) {
          msgs.push({ level: 'error', moduleId: m.id, text: `${name}: Tasche ${i + 1} ragt über den Rand der Box. Tipp: „Automatisch anordnen“ oder Größe „an Inhalt“.` });
        }
        const pk = l.pockets[i];
        if (pocketDepth(pk.pocket) > l.height - 0.6 + EPS) {
          msgs.push({ level: 'error', moduleId: m.id, text: `${name}: Tasche ${i + 1} (${pk.pocket.count} × ${f(pk.pocket.thickness)} mm) ist tiefer als die Box hoch ist.` });
        }
      }
      if (m.pockets.length === 0) msgs.push({ level: 'warning', moduleId: m.id, text: `${name}: Noch keine Taschen angelegt.` });
    }

    // Deckel
    if (hasLid(m)) {
      if ((m.lid === 'lift' || m.lid === 'snap') && lh.body < project.print.floorThickness + LID_LIP_DEPTH + 4) {
        msgs.push({ level: 'error', moduleId: m.id, text: `${name}: Für diesen Deckel ist die Box zu niedrig.` });
      }
      if (m.lid === 'hinge' && size.width < 40) msgs.push({ level: 'warning', moduleId: m.id, text: `${name}: Für ein Scharnier sollte die Box mindestens 40 mm breit sein.` });
      if (m.lid === 'magnet' && (size.width < 30 || size.depth < 30)) msgs.push({ level: 'warning', moduleId: m.id, text: `${name}: Box ist für vier Magnetpfeiler sehr klein.` });
    }

    // Beschriftung
    if (fontLoaded(project.labels.font) && labelText(m)) {
      const s = labelSides(m);
      if (hasBodyLabel(m)) {
        const len = s.left || s.right ? size.depth : size.width;
        const band = lh.body * 0.55;
        const h = fitTextHeight(labelText(m), project.labels.font, len * 0.86, band, m.label.size);
        if (h < 4) msgs.push({ level: 'warning', moduleId: m.id, text: `${name}: Seitenschrift wird nur ${f(h)} mm hoch – kürzerer Text oder höhere Box druckt sauberer.` });
        if (m.fingerCutout !== 'none' && (s.front || s.back) && !(m.type === 'gridBox' && m.fingerSides === 'leftRight')) msgs.push({ level: 'info', moduleId: m.id, text: `${name}: Griffmulden können die Beschriftung vorne/hinten unterbrechen.` });
      }
    }

    // Höhe und Druckbett
    if (m.heightMode === 'custom' && m.customHeight <= project.print.floorThickness + 1) {
      msgs.push({ level: 'error', moduleId: m.id, text: `${name}: Höhe muss größer als die Bodenstärke sein.` });
    }
    if (!fitsBed(size.width, size.depth, lh.body, print)) {
      msgs.push({
        level: 'error',
        moduleId: m.id,
        text: `${name}: ${f(size.width, 0)} × ${f(size.depth, 0)} × ${f(lh.body, 0)} mm passt nicht aufs Druckbett (${print.bedX} × ${print.bedY} × ${print.bedZ} mm, ${BED_MARGIN} mm Rand). Modul verkleinern oder teilen.`,
      });
    }
  }

  // Lage in der Schachtel
  const reported = new Set<string>();
  for (const inst of layout) {
    const m = byId.get(inst.moduleId);
    const name = m?.name ?? 'Modul';
    const out = inst.x < -EPS || inst.y < -EPS || inst.x + inst.width > box.innerWidth + EPS || inst.y + inst.depth > box.innerDepth + EPS;
    if (out && !reported.has(inst.moduleId)) {
      reported.add(inst.moduleId);
      msgs.push({ level: 'error', moduleId: inst.moduleId, text: `${name}: passt nicht mehr in die Schachtel (kein freier Platz bzw. ragt seitlich heraus).` });
    }
    const top = inst.z + inst.height;
    if (top > usable + EPS && !reported.has(`${inst.moduleId}:h`)) {
      reported.add(`${inst.moduleId}:h`);
      const on = inst.supports.map((id) => byId.get(id)?.name).filter(Boolean).join(', ');
      msgs.push({
        level: 'error',
        moduleId: inst.moduleId,
        text: `${name}: ragt ${f(top - usable)} mm über den nutzbaren Raum${on ? ` (liegt auf ${on})` : ''}. Tipp: niedriger, „bis Deckel“ oder andere Stapelstufe.`,
      });
    }
  }

  // Kollisionen (räumlich)
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      const a = layout[i];
      const b = layout[j];
      const xy = a.x < b.x + b.width - EPS && b.x < a.x + a.width - EPS && a.y < b.y + b.depth - EPS && b.y < a.y + a.depth - EPS;
      const z = a.z < b.z + b.height - EPS && b.z < a.z + a.height - EPS;
      if (xy && z) {
        const na = byId.get(a.moduleId)?.name ?? '?';
        const nb = byId.get(b.moduleId)?.name ?? '?';
        msgs.push({ level: 'error', moduleId: b.moduleId, text: `Kollision: ${na} überschneidet sich mit ${nb}.` });
      }
    }
  }

  // Spielraum: Module, die beim Transport rutschen oder springen können
  if (layout.length > 0) {
    const rep = fillReport(project, layout);
    const side = rep.loose.filter((l) => l.dir !== 'up');
    const up = rep.loose.filter((l) => l.dir === 'up');
    const list = (items: typeof rep.loose) =>
      items
        .slice(0, 6)
        .map((l) => `${byId.get(l.instance.moduleId)?.name ?? '?'} (${f(l.gap)} mm ${DIRECTION_LABEL[l.dir]})`)
        .join(', ') + (items.length > 6 ? ` und ${items.length - 6} weitere` : '');
    if (side.length) {
      msgs.push({
        level: 'warning',
        moduleId: side[0].instance.moduleId,
        text: `Lücken: ${side.length === 1 ? 'Ein Modul kann' : `${side.length} Module können`} verrutschen – ${list(side)}. Tipp: Module vergrößern, Füllstück einsetzen oder „bis Deckel“.`,
      });
    }
    if (up.length) {
      msgs.push({ level: 'info', moduleId: up[0].instance.moduleId, text: `Luft nach oben: ${list(up)}. Ohne Auflage darüber können diese Module springen.` });
    }
  }

  return msgs;
}

/** Belegte Grundfläche je Stapelstufe in Prozent der Schachtel-Innenfläche. */
export function areaUsage(project: Project, layout: PlacedInstance[], level = 1): number {
  const area = project.box.innerWidth * project.box.innerDepth;
  if (area <= 0) return 0;
  return (100 * layout.filter((i) => i.level === level).reduce((s, i) => s + i.width * i.depth, 0)) / area;
}
