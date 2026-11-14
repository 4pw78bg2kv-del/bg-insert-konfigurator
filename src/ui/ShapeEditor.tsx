/**
 * Editor der Aufleger-Box: Taschen in Sonderformen frei anordnen (ziehen),
 * Maßzeichnung der gewählten Form, Schnellgenerator „N Taschen à M Stück“.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  POCKET_GAP,
  SHAPES,
  SHAPE_PRESETS,
  arrangePockets,
  createPocket,
  generatePockets,
  pocketsBounds,
  shapeBoxLayout,
  shapeDef,
  shapeOutline,
  shapeParams,
  type Pocket,
  type ShapeBoxModule,
  type ShapeKind,
  type Pt,
} from '../geometry';
import { useStore } from '../state/store';
import { NumberField, Segmented, SelectField } from './fields';
import { fmt } from './SettingsPanels';

const path = (pts: Pt[], flip: (p: Pt) => Pt) => `M${pts.map((p) => flip(p).map((v) => v.toFixed(2)).join(',')).join('L')}Z`;

export function ShapeEditor({ m, set }: { m: ShapeBoxModule; set(patch: Partial<ShapeBoxModule>): void }) {
  const project = useStore((s) => s.project);
  const selectedId = useStore((s) => s.selectedCellId);
  const selectCell = useStore((s) => s.selectCell);
  const l = shapeBoxLayout(m, project);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; sx: number; sy: number; x: number; y: number } | null>(null);
  const sel = m.pockets.find((pk) => pk.id === selectedId) ?? null;
  const W = l.width;
  const D = l.depth;
  const pad = 6;
  const flip = ([x, y]: Pt): Pt => [x, D - y];

  const setPockets = (pockets: Pocket[]) => set({ pockets });
  const updatePocket = (id: string, patch: Partial<Pocket>) => setPockets(m.pockets.map((pk) => (pk.id === id ? { ...pk, ...patch } : pk)));

  const toMm = (e: ReactPointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const r = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: r.x, y: D - r.y };
  };

  const onDown = (e: ReactPointerEvent, pk: Pocket) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = toMm(e);
    drag.current = { id: pk.id, sx: p.x, sy: p.y, x: pk.x, y: pk.y };
    selectCell(pk.id);
  };
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toMm(e);
    const step = e.shiftKey ? 0.1 : 0.5;
    const snap = (v: number) => Math.round(v / step) * step;
    updatePocket(d.id, { x: snap(d.x + p.x - d.sx), y: snap(d.y + p.y - d.sy) });
  };
  const onUp = () => {
    drag.current = null;
  };

  return (
    <div className="shape-editor">
      <svg
        ref={svgRef}
        className="cell-svg"
        viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${D + 2 * pad}`}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onClick={() => selectCell(null)}
        role="img"
        aria-label="Draufsicht der Taschen"
      >
        <rect x={0} y={0} width={W} height={D} rx={1.5} className="cell-box" />
        {l.pockets.map((pl) => {
          const active = pl.pocket.id === selectedId;
          return (
            <g key={pl.pocket.id} className="pocket" onPointerDown={(e) => onDown(e, pl.pocket)} onClick={(e) => e.stopPropagation()}>
              {pl.grips.map(([gx, gy], i) => (
                <circle key={i} cx={gx} cy={D - gy} r={pl.gripR} className="pocket-grip" />
              ))}
              <path d={path(pl.outline, flip)} className={`pocket-shape ${active ? 'active' : ''}`} />
              <text x={pl.pocket.x + l.dx} y={D - pl.pocket.y - l.dy + 1.2} fontSize={3.4} textAnchor="middle" className="cell-text">
                {pl.pocket.count}×
              </text>
            </g>
          );
        })}
        <text x={W / 2} y={D + pad - 1} fontSize={3.2} textAnchor="middle" className="cell-front">vorne</text>
      </svg>
      <p className="muted small">
        Taschen mit der Maus ziehen (0,5-mm-Schritte, mit Umschalt 0,1 mm). Box {fmt(W)} × {fmt(D)} mm{m.sizeMode === 'auto' ? ', Größe folgt den Taschen' : ''}.
      </p>
      <div className="row gap-s wrap">
        <button type="button" className="btn small" onClick={() => setPockets(arrangePockets(m.pockets, 0, l.play))}>Automatisch anordnen</button>
        <button
          type="button"
          className="btn small"
          onClick={() => {
            const pk = createPocket('ellipse', 30, 30, {}, { x: W / 2 - l.dx, y: D / 2 - l.dy });
            setPockets([...m.pockets, pk]);
            selectCell(pk.id);
          }}
        >
          + Tasche
        </button>
        {sel && (
          <>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                const pk = { ...structuredClone(sel), id: createPocket().id, x: sel.x + 6, y: sel.y + 6 };
                setPockets([...m.pockets, pk]);
                selectCell(pk.id);
              }}
            >
              Duplizieren
            </button>
            <button
              type="button"
              className="btn small danger"
              onClick={() => {
                setPockets(m.pockets.filter((pk) => pk.id !== sel.id));
                selectCell(null);
              }}
            >
              Entfernen
            </button>
          </>
        )}
      </div>

      {sel ? <PocketFields pk={sel} onChange={(patch) => updatePocket(sel.id, patch)} /> : <Generator onCreate={(pockets, replace) => setPockets(replace ? pockets : appendBelow(m.pockets, pockets, l.play))} />}

      <NumberField
        label="Zusätzliches Spiel"
        value={m.pocketPlay}
        min={0}
        max={3}
        step={0.1}
        hint="Kommt zum Spaltmaß hinzu, damit die Aufleger nicht klemmen"
        onChange={(pocketPlay) => set({ pocketPlay })}
      />
    </div>
  );
}

/** Neue Taschen hinter (oberhalb) die vorhandenen setzen. */
function appendBelow(existing: Pocket[], added: Pocket[], play: number): Pocket[] {
  if (existing.length === 0) return added;
  const a = pocketsBounds(existing, play);
  const b = pocketsBounds(added, play);
  const dx = a.x0 - b.x0;
  const dy = a.y1 + POCKET_GAP - b.y0;
  return [...existing, ...added.map((pk) => ({ ...pk, x: pk.x + dx, y: pk.y + dy }))];
}

function presetValue(pk: Pick<Pocket, 'shape' | 'w' | 'h' | 'params'>): string {
  const i = SHAPE_PRESETS.findIndex(
    (p) => p.shape === pk.shape && Math.abs(p.w - pk.w) < 0.01 && Math.abs(p.h - pk.h) < 0.01 && Object.entries(p.params ?? {}).every(([k, v]) => pk.params[k] === v),
  );
  return i < 0 ? '' : String(i);
}

/** Schnellauswahl der Formen als Symbolleiste. */
function ShapePicker({ value, onPick }: { value: string; onPick(i: number): void }) {
  return (
    <div className="shape-picker">
      {SHAPE_PRESETS.map((p, i) => {
        const o = shapeOutline(p.shape, p.w, p.h, p.params ?? {});
        const s = 18 / Math.max(p.w, p.h);
        return (
          <button key={p.label} type="button" title={p.label} className={value === String(i) ? 'active' : ''} onClick={() => onPick(i)}>
            <svg viewBox="-11 -11 22 22" width={26} height={26}>
              <path d={`M${o.map(([x, y]) => `${(x * s).toFixed(2)},${(-y * s).toFixed(2)}`).join('L')}Z`} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function PocketFields({ pk, onChange }: { pk: Pocket; onChange(patch: Partial<Pocket>): void }) {
  const def = shapeDef(pk.shape);
  const params = shapeParams(pk.shape, pk.w, pk.h, pk.params);
  const [focus, setFocus] = useState<string | null>(null);
  return (
    <div className="cell-panel">
      <ShapePicker
        value={presetValue(pk)}
        onPick={(i) => {
          const p = SHAPE_PRESETS[i];
          onChange({ shape: p.shape, w: p.w, h: p.h, params: { ...(p.params ?? {}) } });
        }}
      />
      <SelectField<ShapeKind>
        label="Form"
        value={pk.shape}
        options={SHAPES.map((s) => ({ value: s.id, label: s.label }))}
        onChange={(shape) => onChange({ shape, params: shapeParams(shape, pk.w, pk.h) })}
      />
      <DimDrawing pk={pk} onPick={setFocus} />
      <div className="grid2">
        <Highlight on={focus === 'w'}>
          <NumberField label="Breite" value={pk.w} min={3} max={300} step={0.5} onChange={(w) => onChange({ w })} />
        </Highlight>
        <Highlight on={focus === 'h'}>
          <NumberField label="Höhe" value={pk.h} min={3} max={300} step={0.5} onChange={(h) => onChange({ h })} />
        </Highlight>
        {def.params.map((d) => (
          <Highlight key={d.key} on={focus === d.key}>
            <NumberField
              label={d.label}
              unit={d.unit}
              value={params[d.key]}
              min={d.min}
              max={d.max}
              step={d.unit === '' ? 1 : 0.5}
              integer={d.unit === ''}
              onChange={(v) => onChange({ params: { ...params, [d.key]: v } })}
            />
          </Highlight>
        ))}
        <NumberField label="Drehung" unit="°" value={pk.rotation} min={-360} max={360} step={15} onChange={(rotation) => onChange({ rotation })} />
      </div>
      <div className="grid2">
        <NumberField label="Aufleger im Stapel" unit="" value={pk.count} min={1} max={200} integer onChange={(count) => onChange({ count })} />
        <NumberField label="Dicke je Aufleger" value={pk.thickness} min={0.3} max={20} step={0.1} onChange={(thickness) => onChange({ thickness })} />
      </div>
      <span className="field-label">Griffmulde</span>
      <Segmented
        value={pk.grip}
        options={[
          { value: 'none', label: 'Keine' },
          { value: 'one', label: 'Eine' },
          { value: 'two', label: 'Zwei' },
        ]}
        onChange={(grip) => onChange({ grip })}
      />
      {pk.grip !== 'none' && (
        <Segmented
          value={String(((pk.gripAngle % 360) + 360) % 360) as '270' | '0' | '90' | '180'}
          options={[
            { value: '270', label: 'Vorne' },
            { value: '90', label: 'Hinten' },
            { value: '180', label: 'Links' },
            { value: '0', label: 'Rechts' },
          ]}
          onChange={(v) => onChange({ gripAngle: Number(v) })}
        />
      )}
      <p className="muted small">Taschentiefe {fmt(pk.count * pk.thickness + 0.4)} mm (Stapel + 0,4 mm).</p>
    </div>
  );
}

function Highlight({ on, children }: { on: boolean; children: React.ReactNode }) {
  return <div className={on ? 'dim-focus' : ''}>{children}</div>;
}

/** Maßzeichnung der Form; ein Klick auf ein Maß hebt das passende Feld hervor. */
function DimDrawing({ pk, onPick }: { pk: Pocket; onPick(key: string): void }) {
  const def = shapeDef(pk.shape);
  const params = shapeParams(pk.shape, pk.w, pk.h, pk.params);
  const o = shapeOutline(pk.shape, pk.w, pk.h, params);
  const w = pk.w;
  const h = pk.h;
  const m = Math.max(w, h) * 0.32 + 6;
  const fs = Math.max(w, h) / 11 + 1;
  const dims = [
    { key: 'w', from: [-w / 2, -h / 2] as Pt, to: [w / 2, -h / 2] as Pt, offset: -m * 0.55 },
    { key: 'h', from: [w / 2, -h / 2] as Pt, to: [w / 2, h / 2] as Pt, offset: -m * 0.55 },
    ...(def.dims?.(w, h, params) ?? []),
  ];
  const labelOf = (key: string) => (key === 'w' ? w : key === 'h' ? h : params[key]);
  const unitOf = (key: string) => def.params.find((d) => d.key === key)?.unit ?? 'mm';
  return (
    <svg className="dim-svg" viewBox={`${-w / 2 - m} ${-h / 2 - m} ${w + 2 * m} ${h + 2 * m}`} role="img" aria-label="Maßzeichnung">
      <path d={`M${o.map(([x, y]) => `${x.toFixed(2)},${(-y).toFixed(2)}`).join('L')}Z`} className="dim-shape" />
      {dims.map((d) => {
        const [x1, y1] = d.from;
        const [x2, y2] = d.to;
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        // Normale (nach außen = rechts der Laufrichtung)
        const nx = (y2 - y1) / len;
        const ny = -(x2 - x1) / len;
        const ox = nx * -d.offset;
        const oy = ny * -d.offset;
        const a: Pt = [x1 + ox, y1 + oy];
        const b: Pt = [x2 + ox, y2 + oy];
        const mx = (a[0] + b[0]) / 2;
        const my = (a[1] + b[1]) / 2;
        const side = Math.sign(-d.offset) || 1;
        const unit = unitOf(d.key);
        const value = `${fmt(labelOf(d.key))}${unit === 'mm' ? '' : unit === '%' ? ' %' : ''}`;
        return (
          <g key={d.key} className="dim" onClick={() => onPick(d.key)}>
            <line x1={x1} y1={-y1} x2={a[0]} y2={-a[1]} className="dim-ext" />
            <line x1={x2} y1={-y2} x2={b[0]} y2={-b[1]} className="dim-ext" />
            <line x1={a[0]} y1={-a[1]} x2={b[0]} y2={-b[1]} className="dim-line" />
            <circle cx={a[0]} cy={-a[1]} r={fs * 0.14} className="dim-dot" />
            <circle cx={b[0]} cy={-b[1]} r={fs * 0.14} className="dim-dot" />
            <text x={mx + nx * side * fs * 0.9} y={-(my + ny * side * fs * 0.9) + fs * 0.35} fontSize={fs} textAnchor="middle" className="dim-text">
              {value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Generator({ onCreate }: { onCreate(pockets: Pocket[], replace: boolean): void }) {
  const [preset, setPreset] = useState(0);
  const [n, setN] = useState(9);
  const [per, setPer] = useState(8);
  const [t, setT] = useState(2);
  const [cols, setCols] = useState(0);
  const [grip, setGrip] = useState<Pocket['grip']>('one');
  const p = SHAPE_PRESETS[preset];
  const [w, setW] = useState(p.w);
  const [h, setH] = useState(p.h);
  const make = () => generatePockets({ shape: p.shape, w, h, params: p.params, pockets: n, perStack: per, thickness: t, grip, columns: cols });
  return (
    <div className="cell-panel">
      <h4>Schnellgenerator</h4>
      <ShapePicker
        value={String(preset)}
        onPick={(i) => {
          setPreset(i);
          setW(SHAPE_PRESETS[i].w);
          setH(SHAPE_PRESETS[i].h);
        }}
      />
      <p className="small">
        <strong>{n} × {p.label}</strong> für je {per} Aufleger à {fmt(t)} mm{grip !== 'none' ? ', mit Griffmulde' : ''}
      </p>
      <div className="grid3">
        <NumberField label="Breite" value={w} min={3} onChange={setW} />
        <NumberField label="Höhe" value={h} min={3} onChange={setH} />
        <NumberField label="Taschen" unit="" value={n} min={1} max={100} integer onChange={setN} />
        <NumberField label="Je Stapel" unit="" value={per} min={1} max={200} integer onChange={setPer} />
        <NumberField label="Dicke" value={t} min={0.3} step={0.1} onChange={setT} />
        <NumberField label="Spalten" unit="" value={cols} min={0} max={20} integer hint="0 = automatisch" onChange={setCols} />
      </div>
      <Segmented<Pocket['grip']>
        value={grip}
        options={[
          { value: 'none', label: 'Ohne Griffmulde' },
          { value: 'one', label: 'Eine Griffmulde' },
          { value: 'two', label: 'Zwei' },
        ]}
        onChange={setGrip}
      />
      <div className="row gap-s">
        <button type="button" className="btn small primary" onClick={() => onCreate(make(), true)}>Taschen ersetzen</button>
        <button type="button" className="btn small" onClick={() => onCreate(make(), false)}>Hinzufügen</button>
      </div>
      <p className="muted small">Tipp: Eine Tasche anklicken, um Form, Maße und Drehung einzeln zu ändern.</p>
    </div>
  );
}
