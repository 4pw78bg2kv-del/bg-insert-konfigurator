/**
 * Hilfsfunktionen zum Bearbeiten des Aufteilungsbaums einer Fächerbox.
 * Alle Funktionen sind unveränderlich (liefern einen neuen Baum).
 */
import { leaf, newId, split, type CellContent, type CellLeaf, type CellNode, type SizeUnit } from '../geometry';

export function findNode(n: CellNode, id: string): CellNode | null {
  if (n.id === id) return n;
  if (n.kind === 'split') for (const c of n.children) {
    const r = findNode(c, id);
    if (r) return r;
  }
  return null;
}

export function findParent(n: CellNode, id: string): CellNode & { kind: 'split' } | null {
  if (n.kind !== 'split') return null;
  for (const c of n.children) {
    if (c.id === id) return n;
    const r = findParent(c, id);
    if (r) return r;
  }
  return null;
}

/** Ersetzt den Knoten `id` durch das Ergebnis von `fn`. */
export function mapNode(n: CellNode, id: string, fn: (n: CellNode) => CellNode): CellNode {
  if (n.id === id) return fn(n);
  if (n.kind === 'leaf') return n;
  return { ...n, children: n.children.map((c) => mapNode(c, id, fn)) };
}

/** Fasst einzelne Kinder zusammen (eine Teilung mit nur einem Kind wird zum Kind). */
function normalize(n: CellNode): CellNode {
  if (n.kind === 'leaf') return n;
  const children = n.children.map(normalize).flatMap((c) =>
    // gleiche Richtung verschachtelt → einebnen (nur bei Anteilsgrößen)
    c.kind === 'split' && c.dir === n.dir && c.unit === 'fr' && c.children.every((k) => k.unit === 'fr')
      ? c.children.map((k) => ({ ...k, size: (k.size * c.size) / c.children.reduce((s, x) => s + x.size, 0) }))
      : [c],
  );
  if (children.length === 1) return { ...children[0], size: n.size, unit: n.unit };
  return { ...n, children };
}

/**
 * Teilt das Fach `id` in `parts` gleiche Teile. `dir` = 'x' nebeneinander,
 * 'y' hintereinander. Liegt das Fach bereits in einer Teilung gleicher
 * Richtung, werden Geschwister eingefügt.
 */
export function splitCell(root: CellNode, id: string, dir: 'x' | 'y', parts = 2): CellNode {
  const target = findNode(root, id);
  if (!target) return root;
  const parent = findParent(root, id);
  const copies = (n: CellNode, size: number): CellNode[] =>
    Array.from({ length: parts }, (_, i) =>
      i === 0 ? { ...n, size, unit: 'fr' as SizeUnit } : leaf(n.kind === 'leaf' ? structuredClone(n.content) : { type: 'empty' }, size),
    );
  if (parent && parent.dir === dir && target.unit === 'fr') {
    return normalize(
      mapNode(root, parent.id, (p) => {
        const sp = p as CellNode & { kind: 'split' };
        return { ...sp, children: sp.children.flatMap((c) => (c.id === id ? copies(c, c.size / parts) : [c])) };
      }),
    );
  }
  return normalize(mapNode(root, id, (n) => ({ ...split(dir, copies(n, 1), n.size, n.unit), id: newId() })));
}

/** Entfernt ein Fach; der Nachbar übernimmt den Platz. */
export function removeCell(root: CellNode, id: string): CellNode {
  const parent = findParent(root, id);
  if (!parent) return root;
  return normalize(
    mapNode(root, parent.id, (p) => {
      const sp = p as CellNode & { kind: 'split' };
      return { ...sp, children: sp.children.filter((c) => c.id !== id) };
    }),
  );
}

/** Verbindet ein Fach mit seinem Nachbarn (vorher/nachher in derselben Teilung). */
export function mergeWithNeighbour(root: CellNode, id: string, dir: -1 | 1): CellNode {
  const parent = findParent(root, id);
  if (!parent) return root;
  const i = parent.children.findIndex((c) => c.id === id);
  const j = i + dir;
  if (j < 0 || j >= parent.children.length) return root;
  const a = parent.children[i];
  const b = parent.children[j];
  const merged = { ...a, size: a.unit === b.unit ? a.size + b.size : a.size };
  return normalize(
    mapNode(root, parent.id, (p) => {
      const sp = p as CellNode & { kind: 'split' };
      return { ...sp, children: sp.children.filter((c) => c.id !== b.id).map((c) => (c.id === a.id ? merged : c)) };
    }),
  );
}

/** Nachbarn eines Fachs in seiner Teilung (für Verbinden-Schaltflächen). */
export function neighbours(root: CellNode, id: string): { dir: 'x' | 'y' | null; prev: boolean; next: boolean } {
  const parent = findParent(root, id);
  if (!parent) return { dir: null, prev: false, next: false };
  const i = parent.children.findIndex((c) => c.id === id);
  return { dir: parent.dir, prev: i > 0, next: i < parent.children.length - 1 };
}

export function setContent(root: CellNode, id: string, content: CellContent): CellNode {
  return mapNode(root, id, (n) => (n.kind === 'leaf' ? { ...n, content } : n));
}

export function setSize(root: CellNode, id: string, size: number, unit: SizeUnit): CellNode {
  return mapNode(root, id, (n) => ({ ...n, size, unit }));
}

export function isLeaf(n: CellNode | null): n is CellLeaf {
  return !!n && n.kind === 'leaf';
}
