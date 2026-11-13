import { useEffect, useState } from 'react';
import {
  CARD_PRESETS,
  SLEEVES,
  cardTrayLayout,
  effectiveCard,
  gridBoxLayout,
  gridInfo,
  gridRows,
  moduleCells,
  moduleSize,
  normalizedRows,
  suggestName,
  type CardTrayModule,
  type GridBoxModule,
  type GridRow,
  type InsertModule,
  type PlacedInstance,
} from '../geometry';
import { useStore } from '../state/store';
import { CheckField, NumberField, Section, Segmented, SelectField, TextField } from './fields';
import { fmt } from './SettingsPanels';

const TYPE_LABEL: Record<InsertModule['type'], string> = {
  cardTray: 'Kartenfach',
  gridBox: 'Rasterbox',
};

export function ModuleList() {
  const project = useStore((s) => s.project);
  const selectedId = useStore((s) => s.selectedId);
  const activeLayerId = useStore((s) => s.activeLayerId);
  const { select, addModule, move, duplicate, removeModule } = useStore.getState();
  const modules = project.modules;
  const multiLayer = project.layers.length > 1;
  const activeLayer = project.layers.find((l) => l.id === activeLayerId) ?? project.layers[0];

  return (
    <Section
      title="Module"
      actions={
        <div className="row gap-s">
          <button type="button" className="btn small" onClick={() => addModule('cardTray')}>+ Kartenfach</button>
          <button type="button" className="btn small" onClick={() => addModule('gridBox')}>+ Rasterbox</button>
        </div>
      }
    >
      {multiLayer && <p className="muted small">Neue Module kommen in: <strong>{activeLayer.name}</strong></p>}
      {modules.length === 0 && <p className="muted small">Noch keine Module. Füge ein Kartenfach oder eine Box hinzu.</p>}
      <ul className="module-list">
        {modules.map((m, i) => {
          const s = moduleSize(m, project);
          const layer = project.layers.find((l) => l.id === m.layerId);
          return (
            <li key={m.id} className={m.id === selectedId ? 'selected' : ''} onClick={() => select(m.id === selectedId ? null : m.id)}>
              <div className="module-main">
                <span className="module-name">
                  {m.quantity > 1 && <span className="qty">{m.quantity}×</span>} {m.name}
                </span>
                <span className="muted small">
                  {multiLayer && layer && <span className="chip">{layer.name}</span>}
                  {TYPE_LABEL[m.type]} · {fmt(s.width)} × {fmt(s.depth)} × {fmt(s.height)} mm
                  {m.placement.mode === 'manual' && ' · fixiert'}
                </span>
              </div>
              <div className="module-actions" onClick={(e) => e.stopPropagation()}>
                <button type="button" title="Nach oben" disabled={i === 0} onClick={() => move(m.id, -1)}>↑</button>
                <button type="button" title="Nach unten" disabled={i === modules.length - 1} onClick={() => move(m.id, 1)}>↓</button>
                <button type="button" title="Duplizieren" onClick={() => duplicate(m.id)}>⧉</button>
                <button type="button" title="Löschen" className="danger" onClick={() => removeModule(m.id)}>✕</button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="muted small">Die Reihenfolge bestimmt die automatische Anordnung (vorne links zuerst).</p>
    </Section>
  );
}

export function ModuleEditor({ layout }: { layout: PlacedInstance[] }) {
  const m = useStore((s) => s.project.modules.find((x) => x.id === s.selectedId));
  const layers = useStore((s) => s.project.layers);
  const update = useStore((s) => s.updateModule);
  if (!m) return null;
  const set = (patch: Partial<InsertModule>) => update(m.id, patch);

  return (
    <Section title={`${TYPE_LABEL[m.type]} bearbeiten`}>
      <div className="grid-name">
        <TextField label="Name (für STL-Datei)" value={m.name} onChange={(name) => set({ name })} />
        <NumberField label="Stück" value={m.quantity} unit="" min={1} max={99} integer onChange={(quantity) => set({ quantity })} />
      </div>
      <div className="row gap-s spread">
        <button type="button" className="link small" onClick={() => set({ name: suggestName(m) })}>Namen vorschlagen</button>
        {layers.length > 1 && (
          <select className="small-select" value={m.layerId} onChange={(e) => set({ layerId: e.target.value })} aria-label="Ebene">
            {layers.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        )}
      </div>

      {m.type === 'cardTray' ? <CardTrayFields m={m} set={set} /> : <GridBoxFields m={m} set={set} />}

      <h3>Höhe</h3>
      <Segmented
        value={m.heightMode}
        options={
          m.type === 'cardTray'
            ? [
                { value: 'auto', label: 'Automatisch' },
                { value: 'layer', label: 'Ebenenhöhe' },
                { value: 'custom', label: 'Eigene' },
              ]
            : [
                { value: 'layer', label: 'Ebenenhöhe' },
                { value: 'custom', label: 'Eigene' },
              ]
        }
        onChange={(heightMode) => set({ heightMode })}
      />
      {m.heightMode === 'custom' && <NumberField label="Höhe (inkl. Deckel)" value={m.customHeight} min={2} onChange={(customHeight) => set({ customHeight })} />}
      {m.heightMode === 'auto' && <p className="muted small">So hoch wie Karten (und Trennerlaschen) es brauchen, ohne Überstand.</p>}

      <PlacementFields m={m} set={set} layout={layout} />
    </Section>
  );
}

type Setter<T> = (patch: Partial<T>) => void;

function FingerFields({ m, set }: { m: InsertModule; set: Setter<InsertModule> }) {
  return (
    <>
      <span className="field-label">Griffmulde</span>
      <Segmented
        value={m.fingerCutout}
        options={[
          { value: 'none', label: 'Keine' },
          { value: 'notch', label: 'Teilweise' },
          { value: 'toFloor', label: 'Bis zum Boden' },
        ]}
        onChange={(fingerCutout) => set({ fingerCutout })}
      />
      <CheckField label="Griffloch im Boden (von unten herausdrücken)" checked={m.floorHole} onChange={(floorHole) => set({ floorHole })} />
    </>
  );
}

function CardTrayFields({ m, set }: { m: CardTrayModule; set: Setter<CardTrayModule> }) {
  const project = useStore((s) => s.project);
  const card = effectiveCard(m);
  const l = cardTrayLayout(m, project);
  const standing = m.orientation === 'standing';
  const variable = standing && m.dividerMode !== 'fixed';
  return (
    <>
      <h3>Karten</h3>
      <SelectField
        label="Kartengröße"
        value={m.cardPreset}
        options={[...CARD_PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: 'custom' as const, label: 'Eigene Maße' }]}
        onChange={(cardPreset) => set({ cardPreset })}
      />
      {m.cardPreset === 'custom' && (
        <div className="grid2">
          <NumberField label="Kartenbreite" value={m.customCardWidth} min={10} onChange={(customCardWidth) => set({ customCardWidth })} />
          <NumberField label="Kartenhöhe" value={m.customCardHeight} min={10} onChange={(customCardHeight) => set({ customCardHeight })} />
        </div>
      )}
      <div className="grid2">
        <SelectField
          label="Kartenhüllen (Sleeves)"
          value={m.sleeve}
          options={(Object.keys(SLEEVES) as (keyof typeof SLEEVES)[]).map((k) => ({ value: k, label: SLEEVES[k].label }))}
          onChange={(sleeve) => set({ sleeve })}
        />
        <NumberField label="Kartendicke" value={m.cardThickness} min={0.1} step={0.01} onChange={(cardThickness) => set({ cardThickness })} />
      </div>
      <p className="muted small">
        Karte inkl. Hülle {fmt(card.width)} × {fmt(card.height)} × {fmt(card.thickness, 2)} mm
      </p>

      <h3>Lage</h3>
      <div className="seg-row">
        <Segmented
          value={m.orientation}
          options={[
            { value: 'standing', label: 'Stehend' },
            { value: 'flat', label: 'Liegend' },
          ]}
          onChange={(orientation) => set({ orientation })}
        />
        <Segmented
          value={m.format}
          options={[
            { value: 'portrait', label: 'Hochformat' },
            { value: 'landscape', label: 'Querformat' },
          ]}
          onChange={(format) => set({ format })}
        />
      </div>
      {standing && (
        <div className="seg-row">
          <Segmented
            value={m.tilt > 0 ? 'tilt' : 'upright'}
            options={[
              { value: 'upright', label: 'Senkrecht' },
              { value: 'tilt', label: 'Schräg' },
            ]}
            onChange={(v) => set({ tilt: v === 'tilt' ? (m.tilt > 0 ? m.tilt : 20) : 0 })}
          />
          {m.tilt > 0 && <NumberField label="Neigung" unit="°" value={m.tilt} min={1} max={45} onChange={(tilt) => set({ tilt })} />}
        </div>
      )}
      <div className="seg-row">
        <span className="field-label">Reihen</span>
        <Segmented
          value={String(m.rows) as '1' | '2'}
          options={[
            { value: '1', label: '1-reihig' },
            { value: '2', label: '2-reihig' },
          ]}
          onChange={(v) => set({ rows: Number(v) })}
        />
      </div>

      <h3>{standing ? 'Trenner & Inhalt' : 'Fächer & Inhalt'}</h3>
      {standing && (
        <Segmented
          value={m.dividerMode}
          options={[
            { value: 'fixed', label: 'Fest' },
            { value: 'loose', label: 'Variabel, glatt' },
            { value: 'toothed', label: 'Variabel, Zacken' },
          ]}
          onChange={(dividerMode) => set({ dividerMode })}
        />
      )}
      {variable ? (
        <>
          <div className="grid3">
            <NumberField label="Karten gesamt" value={m.totalCards} unit="" min={0} integer onChange={(totalCards) => set({ totalCards })} />
            <NumberField label="Trenner gesamt" value={m.dividerCount} unit="" min={0} max={200} integer onChange={(dividerCount) => set({ dividerCount })} />
            <NumberField label="Trennerstärke" value={m.dividerPlateThickness} min={0.6} step={0.2} onChange={(dividerPlateThickness) => set({ dividerPlateThickness })} />
          </div>
          <p className="muted small">
            {m.dividerMode === 'toothed'
              ? 'Die Seitenwände bekommen ein Zackenmuster, in dem die Trenner fest einrasten.'
              : 'Glatte Wände, die Trenner lassen sich frei verschieben.'}{' '}
            Die Trenner werden als eigene STL exportiert.
          </p>
          <CheckField label="Beschriftungslasche an den Trennern" checked={m.tab} onChange={(tab) => set({ tab })} />
          {m.tab && (
            <>
              <div className="grid2">
                <NumberField label="Überstand der Lasche" value={m.tabHeight} min={2} max={40} onChange={(tabHeight) => set({ tabHeight })} />
                <NumberField label="Laschenbreite" unit="%" value={m.tabWidthPercent} min={10} max={100} onChange={(tabWidthPercent) => set({ tabWidthPercent })} />
              </div>
              <CheckField label="Laschen versetzt (links / Mitte / rechts)" checked={m.tabStaggered} onChange={(tabStaggered) => set({ tabStaggered })} />
            </>
          )}
        </>
      ) : (
        <div className="grid2">
          <NumberField label={standing ? 'Fächer je Reihe' : 'Fächer nebeneinander'} value={m.slots} unit="" min={1} max={50} integer onChange={(slots) => set({ slots })} />
          <NumberField label="Karten je Fach" value={m.cardsPerSlot} unit="" min={1} integer onChange={(cardsPerSlot) => set({ cardsPerSlot })} />
        </div>
      )}
      <p className="muted small">
        {standing ? (
          <>
            Länge innen {fmt(l.cavityLength)} mm{l.rows > 1 ? ' je Reihe' : ''}
            {variable && ` · ${l.rowCards} Karten + ${l.rowDividers} Trenner je Reihe`} · benötigte Höhe {fmt(l.requiredInnerHeight)} mm
          </>
        ) : (
          <>Fach innen {fmt(l.slotInnerX)} × {fmt(l.slotInnerY)} mm · Stapel {fmt(l.requiredInnerHeight)} mm</>
        )}
      </p>

      <h3>Komfort</h3>
      <NumberField
        label="Spiel um Karten"
        value={m.play}
        min={0}
        step={0.5}
        hint="Zusätzlicher Freiraum pro Achse, damit Karten nicht klemmen"
        onChange={(play) => set({ play })}
      />
      <FingerFields m={m} set={set as Setter<InsertModule>} />
    </>
  );
}

/** Eingabe der Spaltenanteile einer Reihe, z. B. „1 2 1“. */
function ColumnsInput({ value, onChange }: { value: number[]; onChange(v: number[]): void }) {
  const fmtCols = (v: number[]) => v.map((x) => String(x).replace('.', ',')).join(' ');
  const [text, setText] = useState(fmtCols(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(fmtCols(value));
  }, [value, focused]);
  const parse = (t: string) =>
    t
      .split(/[\s;]+/)
      .map((x) => Number(x.replace(',', '.')))
      .filter((x) => Number.isFinite(x) && x > 0)
      .slice(0, 50);
  return (
    <input
      className="text-input"
      value={text}
      title="Spaltenanteile, z. B. „1 1 2“ = zwei schmale und eine doppelt breite Spalte"
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        setText(e.target.value);
        const cols = parse(e.target.value);
        if (cols.length) onChange(cols);
      }}
      onBlur={() => setFocused(false)}
    />
  );
}

function GridBoxFields({ m, set }: { m: GridBoxModule; set: Setter<GridBoxModule> }) {
  const project = useStore((s) => s.project);
  const l = gridBoxLayout(m, project);
  const g = gridInfo(project);
  const rows = normalizedRows(m);
  const [quickCols, setQuickCols] = useState(3);
  const [quickRows, setQuickRows] = useState(2);
  const rowDepths = rows.map((_, i) => l.cells.find((c) => c.row === i)?.d ?? 0);

  const setRows = (layout: GridRow[]) => set({ layout });
  const updateRow = (i: number, patch: Partial<GridRow>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <>
      <h3>Maße</h3>
      {g.enabled ? (
        <>
          <div className="grid2">
            <NumberField label="Breite" unit="Zellen" value={m.widthCells} min={1} max={g.nx} integer onChange={(widthCells) => set({ widthCells })} />
            <NumberField label="Tiefe" unit="Zellen" value={m.depthCells} min={1} max={g.ny} integer onChange={(depthCells) => set({ depthCells })} />
          </div>
          <p className="muted small">= {fmt(l.width)} × {fmt(l.depth)} mm außen</p>
        </>
      ) : (
        <div className="grid2">
          <NumberField label="Breite (außen)" value={m.width} min={10} onChange={(width) => set({ width })} />
          <NumberField label="Tiefe (außen)" value={m.depth} min={10} onChange={(depth) => set({ depth })} />
        </div>
      )}

      <h3>Aufteilung</h3>
      <div className="quick-grid">
        <NumberField label="Spalten" unit="" value={quickCols} min={1} max={20} integer onChange={setQuickCols} />
        <span className="times">×</span>
        <NumberField label="Reihen" unit="" value={quickRows} min={1} max={20} integer onChange={setQuickRows} />
        <button type="button" className="btn small" onClick={() => setRows(gridRows(quickCols, quickRows))}>Gleichmäßig</button>
      </div>
      <table className="rows-table">
        <thead>
          <tr>
            <th>Reihe</th>
            <th>Anteil</th>
            <th>Spalten (Anteile)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="muted">{i + 1} <span className="small">({fmt(rowDepths[i])} mm)</span></td>
              <td>
                <NumberField label="" unit="" value={r.size} min={0.1} step={0.5} onChange={(size) => updateRow(i, { size })} />
              </td>
              <td>
                <ColumnsInput value={r.columns} onChange={(columns) => updateRow(i, { columns })} />
              </td>
              <td>
                <button type="button" className="icon" title="Reihe entfernen" disabled={rows.length <= 1} onClick={() => setRows(rows.filter((_, j) => j !== i))}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="link small" onClick={() => setRows([...rows, { size: 1, columns: [1] }])}>+ Reihe hinzufügen</button>
      <p className="muted small">Reihen laufen von vorne nach hinten. „1 2 1“ heißt: mittlere Spalte doppelt so breit. {l.cells.length} Fächer.</p>
      <NumberField
        label="Trennwände absenken um"
        value={m.dividerLowering}
        min={0}
        hint="Niedrigere Trennwände erleichtern das Greifen"
        onChange={(dividerLowering) => set({ dividerLowering })}
      />

      <h3>Griffmulden</h3>
      <FingerFields m={m} set={set as Setter<InsertModule>} />
      {m.fingerCutout !== 'none' && (
        <Segmented
          value={m.fingerSides}
          options={[
            { value: 'front', label: 'Vorne' },
            { value: 'frontBack', label: 'Vorne + hinten' },
            { value: 'leftRight', label: 'Links + rechts' },
          ]}
          onChange={(fingerSides) => set({ fingerSides })}
        />
      )}

      <h3>Deckel</h3>
      <Segmented
        value={m.lid}
        options={[
          { value: 'none', label: 'Ohne' },
          { value: 'snap', label: 'Steckdeckel mit Rastnasen' },
        ]}
        onChange={(lid) => set({ lid })}
      />
      {m.lid === 'snap' && (
        <p className="muted small">
          Der Deckel wird mit der Platte nach unten gedruckt. Seine Lippe greift in die Box, Rastnasen rechts und links klicken in Nuten der Innenwand.
          Vorne gibt es eine kleine Mulde zum Öffnen. Die Trennwände werden dafür automatisch um {fmt(l.dividerLowering)} mm abgesenkt.
        </p>
      )}
    </>
  );
}

function PlacementFields({ m, set, layout }: { m: InsertModule; set: Setter<InsertModule>; layout: PlacedInstance[] }) {
  const project = useStore((s) => s.project);
  const [step, setStep] = useState(1);
  const g = gridInfo(project);
  const inst = layout.find((i) => i.moduleId === m.id && i.copyIndex === 0);
  const p = m.placement;
  const toCell = (x: number, cell: number) => Math.max(0, Math.round((x - g.clearance) / cell));
  const current = () =>
    p.mode === 'manual'
      ? p
      : { ...p, x: round(inst?.x ?? 0), y: round(inst?.y ?? 0), gx: toCell(inst?.x ?? 0, g.cellX), gy: toCell(inst?.y ?? 0, g.cellY) };
  const nudge = (dx: number, dy: number) => useStore.getState().nudge(m.id, dx, dy, step);
  const cells = moduleCells(m, project);
  return (
    <>
      <h3>Position in der Ebene</h3>
      <Segmented
        value={p.mode}
        options={[
          { value: 'auto', label: 'Automatisch' },
          { value: 'manual', label: 'Manuell' },
        ]}
        onChange={(mode) => set({ placement: mode === 'manual' ? { ...current(), mode } : { ...p, mode } })}
      />
      {p.mode === 'manual' ? (
        g.enabled ? (
          <div className="grid2">
            <NumberField label="Zelle X (von links)" unit="" value={p.gx} min={0} max={g.nx - 1} integer onChange={(gx) => set({ placement: { ...p, gx } })} />
            <NumberField label="Zelle Y (von vorne)" unit="" value={p.gy} min={0} max={g.ny - 1} integer onChange={(gy) => set({ placement: { ...p, gy } })} />
          </div>
        ) : (
          <div className="grid2">
            <NumberField label="X (von links)" value={p.x} step={step} onChange={(x) => set({ placement: { ...p, x } })} />
            <NumberField label="Y (von vorne)" value={p.y} step={step} onChange={(y) => set({ placement: { ...p, y } })} />
          </div>
        )
      ) : (
        inst && (
          <p className="muted small">
            {g.enabled ? `Automatisch in Zelle ${toCell(inst.x, g.cellX)} / ${toCell(inst.y, g.cellY)}, belegt ${cells.nx} × ${cells.ny} Zellen.` : `Automatisch bei X ${fmt(inst.x)} / Y ${fmt(inst.y)} mm.`}{' '}
            Verschieben fixiert die Position.
          </p>
        )
      )}
      <div className="nudge">
        <div className="nudge-pad">
          <span />
          <button type="button" title="Nach hinten" onClick={() => nudge(0, 1)}>▲</button>
          <span />
          <button type="button" title="Nach links" onClick={() => nudge(-1, 0)}>◀</button>
          <span className="muted small center">{g.enabled ? '1 Zelle' : `${fmt(step)} mm`}</span>
          <button type="button" title="Nach rechts" onClick={() => nudge(1, 0)}>▶</button>
          <span />
          <button type="button" title="Nach vorne" onClick={() => nudge(0, -1)}>▼</button>
          <span />
        </div>
        <div className="col gap-s">
          {!g.enabled && (
            <Segmented
              value={String(step) as '0.5' | '1' | '5' | '10'}
              options={[
                { value: '0.5', label: '0,5' },
                { value: '1', label: '1' },
                { value: '5', label: '5' },
                { value: '10', label: '10' },
              ]}
              onChange={(v) => setStep(Number(v))}
            />
          )}
          <CheckField label="90° drehen" checked={p.rotated} onChange={(rotated) => set({ placement: { ...p, rotated } })} />
        </div>
      </div>
    </>
  );
}

function round(v: number) {
  return Math.round(v * 100) / 100;
}
