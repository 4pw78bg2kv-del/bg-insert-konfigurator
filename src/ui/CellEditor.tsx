/**
 * Visueller Fächer-Editor: Draufsicht der Box, Fächer anklicken, teilen,
 * verbinden und mit Inhalt (Mulde, Karten) belegen.
 */
import { useState } from 'react';
import {
  CARD_PRESETS,
  SLEEVES,
  cardsContent,
  gridBoxLayout,
  gridTree,
  leaf,
  leafRequirement,
  split,
  type CellContent,
  type CellNode,
  type GridBoxModule,
  type SizeUnit,
} from '../geometry';
import { useStore } from '../state/store';
import { findNode, isLeaf, mergeWithNeighbour, neighbours, removeCell, setContent, setSize, splitCell } from './cellTree';
import { CheckField, NumberField, Segmented, SelectField } from './fields';
import { fmt } from './SettingsPanels';

type CardsContent = Extract<CellContent, { type: 'cards' }>;

/** Schnellvorlagen für die Aufteilung. */
const LAYOUTS: { label: string; make(): CellNode }[] = [
  { label: '1 Fach', make: () => leaf({ type: 'scoop', sides: 'front' }) },
  { label: '2 × 1', make: () => gridTree(2, 1, () => ({ type: 'scoop', sides: 'front' })) },
  { label: '3 × 2', make: () => gridTree(3, 2, () => ({ type: 'scoop', sides: 'front' })) },
  { label: '4 × 3', make: () => gridTree(4, 3, () => ({ type: 'scoop', sides: 'front' })) },
  {
    label: 'Karten + Token',
    make: () =>
      split('x', [
        leaf(cardsContent({ orientation: 'flat' }), 1, 'auto'),
        split('y', [leaf({ type: 'scoop', sides: 'front' }), leaf({ type: 'scoop', sides: 'front' })]),
      ]),
  },
  {
    label: '2 Karten liegend, 2 Mini stehend, 2 Token',
    make: () =>
      split('x', [
        leaf(cardsContent({ orientation: 'flat' }), 1, 'auto'),
        leaf(cardsContent({ orientation: 'flat' }), 1, 'auto'),
        split(
          'y',
          [
            leaf(cardsContent({ orientation: 'standing', format: 'landscape', cardPreset: 'miniAmerican', count: 30, raise: false }), 1, 'auto'),
            leaf(cardsContent({ orientation: 'standing', format: 'landscape', cardPreset: 'miniAmerican', count: 30, raise: false }), 1, 'auto'),
            leaf({ type: 'scoop', sides: 'front' }),
            leaf({ type: 'scoop', sides: 'front' }),
          ],
          1,
          'fr',
        ),
      ]),
  },
];

function contentLabel(c: CellContent): string {
  if (c.type === 'scoop') return 'Mulde';
  if (c.type === 'cards') return `${c.count} Karten ${c.orientation === 'flat' ? 'liegend' : 'stehend'}`;
  return '';
}

export function CellEditor({ m, set }: { m: GridBoxModule; set(patch: Partial<GridBoxModule>): void }) {
  const project = useStore((s) => s.project);
  const selectedCellId = useStore((s) => s.selectedCellId);
  const selectCell = useStore((s) => s.selectCell);
  const l = gridBoxLayout(m, project);
  const [parts, setParts] = useState(2);
  const sel = selectedCellId ? findNode(m.root, selectedCellId) : null;
  const selLeaf = isLeaf(sel) ? sel : null;
  const setRoot = (root: CellNode) => set({ root });

  const pad = 6;
  const W = l.width;
  const D = l.depth;
  // SVG-Y zeigt nach unten → vorne (y = 0) unten zeichnen
  const fy = (y: number, h: number) => D - y - h;

  return (
    <div className="cell-editor">
      <div className="chips">
        {LAYOUTS.map((t) => (
          <button
            key={t.label}
            type="button"
            className="chip-btn"
            onClick={() => {
              const root = t.make();
              setRoot(root);
              selectCell(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <svg className="cell-svg" viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${D + 2 * pad}`} role="img" aria-label="Draufsicht der Fächer">
        <rect x={0} y={0} width={W} height={D} rx={1.5} className="cell-box" />
        {l.cells.map((c) => {
          const active = c.id === selectedCellId;
          const req = leafRequirement(c.leaf);
          const tooSmall = c.w + 0.01 < req.w || c.d + 0.01 < req.d;
          const fs = Math.max(2.4, Math.min(5, c.w / 7, c.d / 3.5));
          return (
            <g key={c.id} onClick={() => selectCell(active ? null : c.id)} className="cell-hit">
              <rect
                x={c.x}
                y={fy(c.y, c.d)}
                width={Math.max(0.1, c.w)}
                height={Math.max(0.1, c.d)}
                className={`cell ${c.leaf.content.type} ${active ? 'active' : ''} ${tooSmall ? 'bad' : ''}`}
              />
              {c.leaf.content.type === 'scoop' && (
                <line x1={c.x + 1} x2={c.x + c.w - 1} y1={fy(c.y, 0) - Math.min(6, c.d / 3)} y2={fy(c.y, 0) - Math.min(6, c.d / 3)} className="cell-scoop" />
              )}
              <text x={c.x + c.w / 2} y={fy(c.y, c.d) + c.d / 2} fontSize={fs} textAnchor="middle" className="cell-text">
                {fmt(c.w, 0)} × {fmt(c.d, 0)}
              </text>
              {c.leaf.content.type !== 'empty' && (
                <text x={c.x + c.w / 2} y={fy(c.y, c.d) + c.d / 2 + fs * 1.2} fontSize={fs * 0.8} textAnchor="middle" className="cell-text sub">
                  {contentLabel(c.leaf.content)}
                </text>
              )}
            </g>
          );
        })}
        <text x={W / 2} y={D + pad - 1} fontSize={3.2} textAnchor="middle" className="cell-front">vorne</text>
      </svg>
      <p className="muted small">
        Fach anklicken, dann teilen oder Inhalt wählen. Maße innen in mm. {l.cells.length} Fächer, Box {fmt(l.width)} × {fmt(l.depth)} mm.
      </p>

      {selLeaf ? (
        <div className="cell-panel">
          <div className="row gap-s wrap">
            <span className="field-label">Teilen in</span>
            <Segmented
              value={String(parts) as '2' | '3' | '4'}
              options={[
                { value: '2', label: '2' },
                { value: '3', label: '3' },
                { value: '4', label: '4' },
              ]}
              onChange={(v) => setParts(Number(v))}
            />
            <button type="button" className="btn small" onClick={() => setRoot(splitCell(m.root, selLeaf.id, 'x', parts))}>◫ nebeneinander</button>
            <button type="button" className="btn small" onClick={() => setRoot(splitCell(m.root, selLeaf.id, 'y', parts))}>⊟ hintereinander</button>
          </div>
          <MergeButtons root={m.root} id={selLeaf.id} onChange={setRoot} onRemoved={() => selectCell(null)} />
          <SizeFields
            size={selLeaf.size}
            unit={selLeaf.unit}
            dir={neighbours(m.root, selLeaf.id).dir}
            onChange={(size, unit) => setRoot(setSize(m.root, selLeaf.id, size, unit))}
          />
          <span className="field-label">Inhalt</span>
          <Segmented
            value={selLeaf.content.type}
            options={[
              { value: 'empty', label: 'Leer' },
              { value: 'scoop', label: 'Mulde (Token)' },
              { value: 'cards', label: 'Karten' },
            ]}
            onChange={(type) =>
              setRoot(
                setContent(m.root, selLeaf.id, type === 'cards' ? cardsContent() : type === 'scoop' ? { type: 'scoop', sides: 'front' } : { type: 'empty' }),
              )
            }
          />
          {selLeaf.content.type === 'scoop' && (
            <Segmented
              value={selLeaf.content.sides}
              options={[
                { value: 'front', label: 'Rundung vorne' },
                { value: 'both', label: 'Vorne und hinten' },
              ]}
              onChange={(sides) => setRoot(setContent(m.root, selLeaf.id, { type: 'scoop', sides }))}
            />
          )}
          {selLeaf.content.type === 'cards' && (
            <CardContentFields c={selLeaf.content} onChange={(c) => setRoot(setContent(m.root, selLeaf.id, c))} />
          )}
        </div>
      ) : (
        <p className="muted small">Kein Fach gewählt.</p>
      )}
    </div>
  );
}

function MergeButtons({ root, id, onChange, onRemoved }: { root: CellNode; id: string; onChange(r: CellNode): void; onRemoved(): void }) {
  const nb = neighbours(root, id);
  if (!nb.dir) return null;
  const [a, b] = nb.dir === 'x' ? ['links', 'rechts'] : ['vorne', 'hinten'];
  return (
    <div className="row gap-s wrap">
      <span className="field-label">Verbinden mit</span>
      <button type="button" className="btn small" disabled={!nb.prev} onClick={() => onChange(mergeWithNeighbour(root, id, -1))}>Fach {a}</button>
      <button type="button" className="btn small" disabled={!nb.next} onClick={() => onChange(mergeWithNeighbour(root, id, 1))}>Fach {b}</button>
      <button
        type="button"
        className="btn small danger"
        onClick={() => {
          onChange(removeCell(root, id));
          onRemoved();
        }}
      >
        Fach entfernen
      </button>
    </div>
  );
}

function SizeFields({ size, unit, dir, onChange }: { size: number; unit: SizeUnit; dir: 'x' | 'y' | null; onChange(size: number, unit: SizeUnit): void }) {
  if (!dir) return null;
  return (
    <div className="grid2">
      <SelectField<SizeUnit>
        label={dir === 'x' ? 'Breite' : 'Tiefe'}
        value={unit}
        options={[
          { value: 'fr', label: 'Anteil am Rest' },
          { value: 'mm', label: 'Feste Größe (mm)' },
          { value: 'auto', label: 'Passend zum Inhalt' },
        ]}
        onChange={(u) => onChange(u === 'mm' ? 30 : 1, u)}
      />
      {unit !== 'auto' && (
        <NumberField
          label={unit === 'fr' ? 'Anteil' : 'Größe'}
          unit={unit === 'fr' ? '×' : 'mm'}
          value={size}
          min={unit === 'fr' ? 0.1 : 5}
          step={unit === 'fr' ? 0.5 : 1}
          onChange={(v) => onChange(v, unit)}
        />
      )}
    </div>
  );
}

function CardContentFields({ c, onChange }: { c: CardsContent; onChange(c: CardsContent): void }) {
  const set = (patch: Partial<CardsContent>) => onChange({ ...c, ...patch });
  return (
    <>
      <SelectField
        label="Kartengröße"
        value={c.cardPreset}
        options={[...CARD_PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: 'custom' as const, label: 'Eigene Maße' }]}
        onChange={(cardPreset) => set({ cardPreset })}
      />
      {c.cardPreset === 'custom' && (
        <div className="grid2">
          <NumberField label="Kartenbreite" value={c.customCardWidth} min={10} onChange={(customCardWidth) => set({ customCardWidth })} />
          <NumberField label="Kartenhöhe" value={c.customCardHeight} min={10} onChange={(customCardHeight) => set({ customCardHeight })} />
        </div>
      )}
      <div className="grid2">
        <SelectField
          label="Hüllen"
          value={c.sleeve}
          options={(Object.keys(SLEEVES) as (keyof typeof SLEEVES)[]).map((k) => ({ value: k, label: SLEEVES[k].label }))}
          onChange={(sleeve) => set({ sleeve })}
        />
        <NumberField label="Anzahl Karten" unit="" value={c.count} min={1} integer onChange={(count) => set({ count })} />
      </div>
      <div className="seg-row">
        <Segmented
          value={c.orientation}
          options={[
            { value: 'flat', label: 'Liegend' },
            { value: 'standing', label: 'Stehend' },
          ]}
          onChange={(orientation) => set({ orientation })}
        />
        <Segmented
          value={c.format}
          options={[
            { value: 'portrait', label: 'Hochformat' },
            { value: 'landscape', label: 'Querformat' },
          ]}
          onChange={(format) => set({ format })}
        />
      </div>
      {c.orientation === 'flat' && (
        <CheckField label="Fachboden anheben (Stapel liegt oben bündig, leichter zu greifen)" checked={c.raise} onChange={(raise) => set({ raise })} />
      )}
    </>
  );
}
