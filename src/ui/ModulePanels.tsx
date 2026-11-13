import {
  CARD_PRESETS,
  SLEEVES,
  cardTrayLayout,
  effectiveCard,
  gridBoxLayout,
  moduleSize,
  suggestName,
  type CardTrayModule,
  type GridBoxModule,
  type InsertModule,
  type PlacedInstance,
} from '../geometry';
import { useStore } from '../state/store';
import { CheckField, NumberField, Section, Segmented, SelectField, TextField } from './fields';
import { fmt } from './SettingsPanels';
import { useState } from 'react';

const TYPE_LABEL: Record<InsertModule['type'], string> = {
  cardTray: 'Kartenfach',
  gridBox: 'Rasterbox',
};

export function ModuleList() {
  const modules = useStore((s) => s.project.modules);
  const selectedId = useStore((s) => s.selectedId);
  const { select, addModule, move, duplicate, removeModule } = useStore.getState();
  const project = useStore((s) => s.project);

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
      {modules.length === 0 && <p className="muted small">Noch keine Module. Füge ein Kartenfach oder eine Box hinzu.</p>}
      <ul className="module-list">
        {modules.map((m, i) => {
          const s = moduleSize(m, project);
          return (
            <li
              key={m.id}
              className={m.id === selectedId ? 'selected' : ''}
              onClick={() => select(m.id === selectedId ? null : m.id)}
            >
              <div className="module-main">
                <span className="module-name">
                  {m.quantity > 1 && <span className="qty">{m.quantity}×</span>} {m.name}
                </span>
                <span className="muted small">
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
      <p className="muted small">Die Reihenfolge bestimmt die automatische Anordnung (links → rechts, vorne → hinten).</p>
    </Section>
  );
}

export function ModuleEditor({ layout }: { layout: PlacedInstance[] }) {
  const m = useStore((s) => s.project.modules.find((x) => x.id === s.selectedId));
  const update = useStore((s) => s.updateModule);
  if (!m) return null;
  const set = (patch: Partial<InsertModule>) => update(m.id, patch);

  return (
    <Section title={`${TYPE_LABEL[m.type]} bearbeiten`}>
      <div className="grid-name">
        <TextField label="Name (für STL-Datei)" value={m.name} onChange={(name) => set({ name })} />
        <NumberField label="Stück" value={m.quantity} unit="" min={1} max={99} integer onChange={(quantity) => set({ quantity })} />
      </div>
      <button type="button" className="link small" onClick={() => set({ name: suggestName(m) })}>Namen vorschlagen</button>

      {m.type === 'cardTray' ? <CardTrayFields m={m} set={set} /> : <GridBoxFields m={m} set={set} />}

      <h3>Höhe</h3>
      <Segmented
        value={m.heightMode}
        options={[
          { value: 'layer', label: 'Ebenenhöhe' },
          { value: 'custom', label: 'Eigene Höhe' },
        ]}
        onChange={(heightMode) => set({ heightMode })}
      />
      {m.heightMode === 'custom' && (
        <NumberField label="Höhe" value={m.customHeight} min={2} onChange={(customHeight) => set({ customHeight })} />
      )}

      <PlacementFields m={m} set={set} layout={layout} />
    </Section>
  );
}

type Setter<T> = (patch: Partial<T>) => void;

function CardTrayFields({ m, set }: { m: CardTrayModule; set: Setter<CardTrayModule> }) {
  const project = useStore((s) => s.project);
  const card = effectiveCard(m);
  const l = cardTrayLayout(m, project.print, project.box);
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
      <SelectField
        label="Kartenhüllen (Sleeves)"
        value={m.sleeve}
        options={(Object.keys(SLEEVES) as (keyof typeof SLEEVES)[]).map((k) => ({ value: k, label: SLEEVES[k].label }))}
        onChange={(sleeve) => set({ sleeve })}
      />
      <div className="grid3">
        <NumberField label="Karten je Fach" value={m.cardCount} unit="" min={1} integer onChange={(cardCount) => set({ cardCount })} />
        <NumberField label="Kartendicke" value={m.cardThickness} min={0.1} step={0.01} onChange={(cardThickness) => set({ cardThickness })} />
        <NumberField label="Fächer" value={m.slots} unit="" min={1} max={50} integer onChange={(slots) => set({ slots })} />
      </div>
      <p className="muted small">
        Karte inkl. Hülle {fmt(card.width)} × {fmt(card.height)} mm, Stapel {fmt(card.stack)} mm · Fach innen{' '}
        {fmt(l.slotInnerX)} × {fmt(l.slotInnerY)} mm
      </p>
      <h3>Ausrichtung & Komfort</h3>
      <Segmented
        value={m.orientation}
        options={[
          { value: 'standing', label: 'Stehend' },
          { value: 'flat', label: 'Liegend' },
        ]}
        onChange={(orientation) => set({ orientation })}
      />
      <div className="grid2">
        <NumberField
          label="Spiel um Karten"
          value={m.play}
          min={0}
          step={0.5}
          hint="Zusätzlicher Freiraum pro Achse, damit Karten nicht klemmen"
          onChange={(play) => set({ play })}
        />
      </div>
      <CheckField label="Griffmulde" checked={m.fingerCutout} onChange={(fingerCutout) => set({ fingerCutout })} />
    </>
  );
}

function GridBoxFields({ m, set }: { m: GridBoxModule; set: Setter<GridBoxModule> }) {
  const project = useStore((s) => s.project);
  const l = gridBoxLayout(m, project.print, project.box);
  return (
    <>
      <h3>Maße & Einteilung</h3>
      <div className="grid2">
        <NumberField label="Breite (außen)" value={m.width} min={10} onChange={(width) => set({ width })} />
        <NumberField label="Tiefe (außen)" value={m.depth} min={10} onChange={(depth) => set({ depth })} />
        <NumberField label="Spalten" value={m.columns} unit="" min={1} max={50} integer onChange={(columns) => set({ columns })} />
        <NumberField label="Reihen" value={m.rows} unit="" min={1} max={50} integer onChange={(rows) => set({ rows })} />
      </div>
      <NumberField
        label="Trennwände absenken um"
        value={m.dividerLowering}
        min={0}
        hint="Niedrigere Trennwände erleichtern das Greifen"
        onChange={(dividerLowering) => set({ dividerLowering })}
      />
      <p className="muted small">
        Fach innen {fmt(l.cellX)} × {fmt(l.cellY)} mm
      </p>
    </>
  );
}

function PlacementFields({ m, set, layout }: { m: InsertModule; set: Setter<InsertModule>; layout: PlacedInstance[] }) {
  const [step, setStep] = useState(1);
  const inst = layout.find((i) => i.moduleId === m.id && i.copyIndex === 0);
  const p = m.placement;
  const nudge = (dx: number, dy: number) => {
    const base = p.mode === 'manual' ? p : { ...p, x: inst?.x ?? 0, y: inst?.y ?? 0 };
    set({ placement: { ...base, mode: 'manual', x: round(base.x + dx), y: round(base.y + dy) } });
  };
  return (
    <>
      <h3>Position in der Schachtel</h3>
      <Segmented
        value={p.mode}
        options={[
          { value: 'auto', label: 'Automatisch' },
          { value: 'manual', label: 'Manuell' },
        ]}
        onChange={(mode) =>
          set({ placement: { ...p, mode, x: mode === 'manual' ? round(inst?.x ?? p.x) : p.x, y: mode === 'manual' ? round(inst?.y ?? p.y) : p.y } })
        }
      />
      {p.mode === 'manual' ? (
        <div className="grid2">
          <NumberField label="X (von links)" value={p.x} step={step} onChange={(x) => set({ placement: { ...p, x } })} />
          <NumberField label="Y (von vorne)" value={p.y} step={step} onChange={(y) => set({ placement: { ...p, y } })} />
        </div>
      ) : (
        inst && (
          <p className="muted small">
            Automatisch bei X {fmt(inst.x)} / Y {fmt(inst.y)} mm. Verschieben fixiert die Position.
          </p>
        )
      )}
      <div className="nudge">
        <div className="nudge-pad">
          <span />
          <button type="button" title="Nach hinten" onClick={() => nudge(0, step)}>▲</button>
          <span />
          <button type="button" title="Nach links" onClick={() => nudge(-step, 0)}>◀</button>
          <span className="muted small center">{step} mm</span>
          <button type="button" title="Nach rechts" onClick={() => nudge(step, 0)}>▶</button>
          <span />
          <button type="button" title="Nach vorne" onClick={() => nudge(0, -step)}>▼</button>
          <span />
        </div>
        <div className="col gap-s">
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
          <CheckField label="90° drehen" checked={p.rotated} onChange={(rotated) => set({ placement: { ...p, rotated } })} />
        </div>
      </div>
    </>
  );
}

function round(v: number) {
  return Math.round(v * 100) / 100;
}
