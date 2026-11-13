/**
 * Automatische Anordnung der Module in der Schachtel.
 *
 * Verfahren: Regal-Packung (Shelf Packing) in Listenreihenfolge. Module werden
 * von links nach rechts (X) gesetzt; passt ein Modul nicht mehr in die Reihe,
 * beginnt eine neue Reihe weiter hinten (Y). Zwischen allen Teilen und zur
 * Schachtelwand bleibt das globale Spaltmaß frei.
 *
 * Module mit `placement.mode === 'manual'` behalten ihre Position (die
 * Kopien eines manuellen Moduls werden daneben aufgereiht) und werden von der
 * Auto-Anordnung als Hindernisse berücksichtigt.
 */
import { moduleSize } from './dimensions';
import type { PlacedInstance, Project } from './types';

interface Rect {
  x: number;
  y: number;
  width: number;
  depth: number;
}

const EPS = 1e-6;

function overlaps(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x < b.x + b.width + gap - EPS &&
    b.x < a.x + a.width + gap - EPS &&
    a.y < b.y + b.depth + gap - EPS &&
    b.y < a.y + a.depth + gap - EPS
  );
}

export function computeLayout(project: Project): PlacedInstance[] {
  const { box, print } = project;
  const gap = print.clearance;
  const result: PlacedInstance[] = [];

  // 1) Manuell platzierte Module zuerst – sie sind Hindernisse für den Rest.
  for (const m of project.modules) {
    if (m.placement.mode !== 'manual') continue;
    const s = moduleSize(m, project);
    const w = m.placement.rotated ? s.depth : s.width;
    const d = m.placement.rotated ? s.width : s.depth;
    for (let i = 0; i < Math.max(1, m.quantity); i++) {
      result.push({
        moduleId: m.id,
        copyIndex: i,
        x: m.placement.x + i * (w + gap),
        y: m.placement.y,
        width: w,
        depth: d,
        height: s.height,
        rotated: m.placement.rotated,
      });
    }
  }
  const obstacles: Rect[] = result.map((r) => ({ ...r }));

  // 2) Automatisches Regal-Packen. Kandidatenpositionen: Reihenanfang und
  //    rechts neben Hindernissen, so dass manuelle Teile umflossen werden.
  let cursorX = gap;
  let rowY = gap;
  let rowDepth = 0;

  for (const m of project.modules) {
    if (m.placement.mode !== 'auto') continue;
    const s = moduleSize(m, project);
    const w = m.placement.rotated ? s.depth : s.width;
    const d = m.placement.rotated ? s.width : s.depth;

    for (let i = 0; i < Math.max(1, m.quantity); i++) {
      let placed: Rect | null = null;
      // Mehrere Reihen versuchen, bis Platz gefunden oder Schachtel voll.
      for (let guard = 0; guard < 500 && !placed; guard++) {
        const candidate: Rect = { x: cursorX, y: rowY, width: w, depth: d };
        const fitsX = candidate.x + w <= box.innerWidth - gap + EPS;
        if (!fitsX && cursorX > gap + EPS) {
          // Neue Reihe.
          rowY += rowDepth + gap;
          cursorX = gap;
          rowDepth = 0;
          continue;
        }
        const blocker = obstacles.find((o) => overlaps(candidate, o, gap));
        if (blocker) {
          cursorX = blocker.x + blocker.width + gap;
          if (cursorX + w > box.innerWidth - gap + EPS) {
            // Hinter das Hindernis in eine neue Reihe ausweichen.
            rowY = Math.max(rowY + Math.max(rowDepth, EPS) + gap, rowY + EPS);
            cursorX = gap;
            rowDepth = 0;
          }
          continue;
        }
        // Passt nicht und Reihe ist leer: trotzdem setzen (Validierung warnt).
        placed = candidate;
      }
      if (!placed) placed = { x: cursorX, y: rowY, width: w, depth: d };

      obstacles.push(placed);
      result.push({
        moduleId: m.id,
        copyIndex: i,
        x: placed.x,
        y: placed.y,
        width: w,
        depth: d,
        height: s.height,
        rotated: m.placement.rotated,
      });
      cursorX = placed.x + w + gap;
      rowDepth = Math.max(rowDepth, d);
    }
  }

  return result;
}
