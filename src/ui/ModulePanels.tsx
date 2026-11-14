import { useRef, useState } from 'react';
import {
  CARD_PRESETS,
  SLEEVES,
  cardTrayLayout,
  dividerTotal,
  effectiveCard,
  firstColumn,
  gridBoxLayout,
  gridInfo,
  lidAllowed,
  maxLevel,
  moduleAvail,
  moduleSize,
  parseTableFile,
  suggestName,
  type CardTrayModule,
  type GridBoxModule,
  type InsertModule,
  type LabelSides,
  type LidType,
  type PlacedInstance,
} from '../geometry';
import { useStore } from '../state/store';
import { CellEditor } from './CellEditor';
import { CheckField, NumberField, Section, Segmented, SelectField, TextField } from './fields';
import { ShapeEditor } from './ShapeEditor';
import { fmt } from './SettingsPanels';

export const TYPE_LABEL: Record<InsertModule['type'], string> = {
  cardTray: 'Kartenfach',
  gridBox: 'Fächerbox',
  shapeBox: 'Aufleger-Box',
};

export function ModuleList({ layout }: { layout: PlacedInstance[] }) {
  const project = useStore((s) => s.project);
  const selectedId = useStore((s) => s.selectedId);
  const { select, addModule, move, duplicate, removeModule, setGalleryOpen, setInventoryOpen } = useStore.getState();
  const modules = project.modules;
  const levels = maxLevel(project);

  return (
    <Section
      title="Module"
      actions={
        <div className="row gap-s">
          <button type="button" className="btn small primary" onClick={() => setGalleryOpen(true)}>+ Aus Vorlage</button>
          <button type="button" className="btn small" title="Teileliste importieren und Insert automatisch erstellen" onClick={() => setInventoryOpen(true)}>Inventar</button>
        </div>
      }
    >
      <div className="row gap-s wrap">
        <button type="button" className="btn small" title="Taste K" onClick={() => addModule('cardTray')}>+ Kartenfach</button>
        <button type="button" className="btn small" title="Taste G" onClick={() => addModule('gridBox')}>+ Fächerbox</button>
        <button type="button" className="btn small" title="Taste F" onClick={() => addModule('shapeBox')}>+ Aufleger-Box</button>
      </div>
      {modules.length === 0 && <p className="muted small">Noch keine Module. Wähle eine Vorlage oder importiere deine Teileliste.</p>}
      <ul className="module-list">
        {modules.map((m, i) => {
          const s = moduleSize(m, project);
          const outside = layout.some((inst) => inst.moduleId === m.id && (inst.x + inst.width > project.box.innerWidth + 0.01 || inst.y + inst.depth > project.box.innerDepth + 0.01));
          return (
            <li key={m.id} className={m.id === selectedId ? 'selected' : ''} onClick={() => select(m.id === selectedId ? null : m.id)}>
              <div className="module-main">
                <span className="module-name">
                  {levels > 1 && <span className="chip" title="Stapelstufe">S{m.level}</span>}
                  {m.quantity > 1 && <span className="qty">{m.quantity}×</span>} {m.name}
                  {outside && <span className="bad small" title="Passt nicht in die Schachtel"> ⛔</span>}
                </span>
                <span className="muted small">
                  {TYPE_LABEL[m.type]} · {fmt(s.width)} × {fmt(s.depth)} × {fmt(s.height)} mm
                  {m.placement.rotated && ' · gedreht'}
                  {m.placement.mode === 'manual' && ' · fixiert'}
                </span>
              </div>
              <div className="module-actions" onClick={(e) => e.stopPropagation()}>
                <button type="button" title="Nach oben (wird früher platziert)" disabled={i === 0} onClick={() => move(m.id, -1)}>↑</button>
                <button type="button" title="Nach unten" disabled={i === modules.length - 1} onClick={() => move(m.id, 1)}>↓</button>
                <button type="button" title="Duplizieren (Strg+D)" onClick={() => duplicate(m.id)}>⧉</button>
                <button type="button" title="Löschen (Entf)" className="danger" onClick={() => removeModule(m.id)}>✕</button>
              </div>
            </li>
          );
        })}
      </ul>
      {modules.length > 1 && <p className="muted small">Die Reihenfolge bestimmt die automatische Anordnung (vorne links zuerst).</p>}
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
        <TextField label="Name (auch für die STL-Datei)" value={m.name} onChange={(name) => set({ name })} />
        <NumberField label="Stück" value={m.quantity} unit="" min={1} max={99} integer onChange={(quantity) => set({ quantity })} />
      </div>
      <button type="button" className="link small" onClick={() => set({ name: suggestName(m) })}>Namen vorschlagen</button>

      <PlacementFields m={m} set={set} layout={layout} />

      {m.type === 'cardTray' && <CardTrayFields m={m} set={set as Setter<CardTrayModule>} />}
      {m.type === 'gridBox' && <GridBoxFields m={m} set={set as Setter<GridBoxModule>} />}
      {m.type === 'shapeBox' && (
        <>
          <h3>Taschen</h3>
          <SizeModeFields m={m} set={set} />
          <ShapeEditor m={m} set={set} />
        </>
      )}

      <HeightFields m={m} set={set} />
      <LidFields m={m} set={set} />
      <LabelFields m={m} set={set} />
      {m.type === 'shapeBox' && (
        <CheckField label="Grifflöcher im Boden (Stapel von unten herausdrücken)" checked={m.floorHole} onChange={(floorHole) => set({ floorHole })} />
      )}
    </Section>
  );
}

type Setter<T> = (patch: Partial<T>) => void;

// ---------------------------------------------------------------------------

function PlacementFields({ m, set, layout }: { m: InsertModule; set: Setter<InsertModule>; layout: PlacedInstance[] }) {
  const project = useStore((s) => s.project);
  const { nudge, rotate, shiftLevel } = useStore.getState();
  const [step, setStep] = useState(1);
  const g = gridInfo(project);
  const inst = layout.find((i) => i.moduleId === m.id && i.copyIndex === 0);
  const p = m.placement;
  const names = new Map(project.modules.map((x) => [x.id, x.name]));
  const supports = [...new Set(inst?.supports ?? [])].map((id) => names.get(id) ?? '?');
  const levels = maxLevel(project);

  return (
    <>
      <h3>Lage in der Schachtel</h3>
      <div className="level-row">
        <span className="field-label">Stapelstufe</span>
        <button type="button" className="btn small" disabled={m.level <= 1} title="Bild ↓" onClick={() => shiftLevel(m.id, -1)}>−</button>
        <strong className="level-value">{m.level}</strong>
        <button type="button" className="btn small" disabled={m.level > levels} title="Bild ↑" onClick={() => shiftLevel(m.id, 1)}>+</button>
        <span className="muted small">
          {supports.length ? `liegt auf ${supports.join(', ')}` : project.baseplate.enabled ? 'liegt auf der Grundplatte' : 'liegt auf dem Boden'}
          {inst && inst.z > 0.05 ? ` (ab ${fmt(inst.z)} mm Höhe)` : ''}
        </span>
      </div>
      <p className="muted small">
        Module einer höheren Stufe legen sich auf das, was darunter liegt, auch auf Module unterschiedlicher Höhe (z. B. „Stufe 1,5“ auf einem flachen Kartenfach).
      </p>
      <div className="row gap-s wrap">
        <Segmented
          value={p.mode}
          options={[
            { value: 'auto', label: 'Automatisch' },
            { value: 'manual', label: 'Manuell' },
          ]}
          onChange={(mode) => (mode === 'manual' ? nudge(m.id, 0, 0) : set({ placement: { ...p, mode } }))}
        />
        <button type="button" className="btn small" title="Taste R" onClick={() => rotate(m.id)}>
          ⟳ 90° drehen{p.rotated ? ' (gedreht)' : ''}
        </button>
      </div>
      {p.mode === 'manual' ? (
        <div className="grid2">
          <NumberField label="X (von links)" value={p.x} step={g.enabled ? g.cellX : step} onChange={(x) => set({ placement: { ...p, x } })} />
          <NumberField label="Y (von vorne)" value={p.y} step={g.enabled ? g.cellY : step} onChange={(y) => set({ placement: { ...p, y } })} />
        </div>
      ) : (
        inst && <p className="muted small">Automatisch bei X {fmt(inst.x)} / Y {fmt(inst.y)} mm. Verschieben fixiert die Position.</p>
      )}
      <div className="nudge">
        <div className="nudge-pad">
          <span />
          <button type="button" title="Nach hinten" onClick={() => nudge(m.id, 0, 1, step)}>▲</button>
          <span />
          <button type="button" title="Nach links" onClick={() => nudge(m.id, -1, 0, step)}>◀</button>
          <span className="muted small center">{g.enabled ? '1 Feld' : `${fmt(step)} mm`}</span>
          <button type="button" title="Nach rechts" onClick={() => nudge(m.id, 1, 0, step)}>▶</button>
          <span />
          <button type="button" title="Nach vorne" onClick={() => nudge(m.id, 0, -1, step)}>▼</button>
          <span />
        </div>
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
      </div>
    </>
  );
}

function HeightFields({ m, set }: { m: InsertModule; set: Setter<InsertModule> }) {
  const project = useStore((s) => s.project);
  const avail = moduleAvail(m, project);
  const s = moduleSize(m, project);
  return (
    <>
      <h3>Höhe</h3>
      <Segmented
        value={m.heightMode}
        options={[
          { value: 'auto', label: 'Nach Inhalt' },
          { value: 'fill', label: 'Bis zum Deckel' },
          { value: 'custom', label: 'Eigene' },
        ]}
        onChange={(heightMode) => set({ heightMode, customHeight: heightMode === 'custom' ? Math.round(s.height * 10) / 10 : m.customHeight })}
      />
      {m.heightMode === 'custom' && <NumberField label="Höhe (inkl. Deckel)" value={m.customHeight} min={3} onChange={(customHeight) => set({ customHeight })} />}
      <p className="muted small">
        {m.heightMode === 'auto' && 'So hoch, wie der Inhalt es braucht. '}
        {m.heightMode === 'fill' && 'Füllt den Platz bis unter den Schachteldeckel bzw. Kopfraum. '}
        Aktuell {fmt(s.height)} mm, Platz bis oben {fmt(avail)} mm.
      </p>
    </>
  );
}

const LID_OPTIONS: { value: LidType; label: string; hint: string }[] = [
  { value: 'none', label: 'Ohne', hint: '' },
  { value: 'lift', label: 'Stülpdeckel', hint: 'Einfacher Deckel mit Lippe, die innen in die Box greift. Hält durch Passung.' },
  { value: 'snap', label: 'Rastdeckel', hint: 'Wie der Stülpdeckel, zusätzlich rasten Nasen links und rechts in Nuten ein. Vorne eine Mulde zum Öffnen.' },
  { value: 'slide', label: 'Schiebedeckel', hint: 'Gleitet in schrägen Nuten von vorne ein; eine kleine Noppe hält ihn geschlossen. Ideal für flache Boxen.' },
  { value: 'magnet', label: 'Magnetdeckel', hint: 'Vier Magnete in den Ecken von Box und Deckel. Beim Einkleben auf die Polung achten!' },
  { value: 'hinge', label: 'Klappdeckel', hint: 'Scharnier hinten mit einem Stück 1,75-mm-Filament als Achse. Box und Deckel werden getrennt gedruckt.' },
];

function LidFields({ m, set }: { m: InsertModule; set: Setter<InsertModule> }) {
  if (!lidAllowed(m)) {
    return (
      <>
        <h3>Deckel</h3>
        <p className="muted small">Schräg stehende Karten brauchen eine offene Oberseite, deshalb gibt es hier keinen Deckel.</p>
      </>
    );
  }
  const opt = LID_OPTIONS.find((o) => o.value === m.lid) ?? LID_OPTIONS[0];
  return (
    <>
      <h3>Deckel</h3>
      <SelectField<LidType> label="Deckelart" value={m.lid} options={LID_OPTIONS} onChange={(lid) => set({ lid })} />
      {opt.hint && <p className="muted small">{opt.hint}</p>}
      {m.lid === 'magnet' && (
        <div className="grid2">
          <NumberField label="Magnet Ø" value={m.magnetDiameter} min={2} max={20} step={0.5} onChange={(magnetDiameter) => set({ magnetDiameter })} />
          <NumberField label="Magnet Höhe" value={m.magnetHeight} min={0.5} max={10} step={0.5} onChange={(magnetHeight) => set({ magnetHeight })} />
        </div>
      )}
    </>
  );
}

function LabelFields({ m, set }: { m: InsertModule; set: Setter<InsertModule> }) {
  const l = m.label;
  const setL = (patch: Partial<InsertModule['label']>) => set({ label: { ...l, ...patch } });
  const tilted = m.type === 'cardTray' && m.orientation === 'standing' && m.tilt > 0;
  return (
    <>
      <h3>Beschriftung</h3>
      <TextField label="Text (leer = Modulname)" value={l.text} onChange={(text) => setL({ text })} />
      <SelectField<LabelSides>
        label="Seitenwände"
        value={l.sides}
        options={[
          { value: 'none', label: 'Keine' },
          { value: 'front', label: 'Nur vorne' },
          { value: 'frontBack', label: 'Vorne und hinten' },
          { value: 'leftRight', label: 'Links und rechts' },
        ]}
        onChange={(sides) => setL({ sides })}
      />
      {tilted && (l.sides === 'front' || l.sides === 'frontBack') && <p className="muted small">Bei schrägen Karten wird vorne/hinten nicht beschriftet.</p>}
      {m.lid !== 'none' && lidAllowed(m) && <CheckField label="Auf dem Deckel" checked={l.onLid} onChange={(onLid) => setL({ onLid })} />}
      <NumberField label="Schrifthöhe" value={l.size} min={0} max={40} step={0.5} hint="0 = automatisch so groß wie möglich" onChange={(size) => setL({ size })} />
    </>
  );
}

function SizeModeFields({ m, set }: { m: InsertModule & { sizeMode: 'auto' | 'manual'; width: number; depth: number }; set: Setter<InsertModule> }) {
  const project = useStore((s) => s.project);
  const s = moduleSize(m, project);
  return (
    <>
      <Segmented
        value={m.sizeMode}
        options={[
          { value: 'auto', label: 'Größe nach Inhalt' },
          { value: 'manual', label: 'Außenmaße vorgeben' },
        ]}
        onChange={(sizeMode) => set({ sizeMode, width: Math.round(s.width), depth: Math.round(s.depth) } as Partial<InsertModule>)}
      />
      {m.sizeMode === 'manual' && (
        <div className="grid2">
          <NumberField label="Breite (außen)" value={m.width} min={10} onChange={(width) => set({ width } as Partial<InsertModule>)} />
          <NumberField label="Tiefe (außen)" value={m.depth} min={10} onChange={(depth) => set({ depth } as Partial<InsertModule>)} />
        </div>
      )}
      {gridInfo(project).enabled && <p className="muted small">Mit Raster aufgerundet auf {fmt(s.width)} × {fmt(s.depth)} mm.</p>}
    </>
  );
}

// ---------------------------------------------------------------------------

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

function GridBoxFields({ m, set }: { m: GridBoxModule; set: Setter<GridBoxModule> }) {
  const project = useStore((s) => s.project);
  const l = gridBoxLayout(m, project);
  return (
    <>
      <h3>Maße und Fächer</h3>
      <SizeModeFields m={m} set={set as Setter<InsertModule>} />
      <CellEditor m={m} set={set} />
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
      {l.cells.some((c) => c.leaf.content.type === 'cards') && <p className="muted small">Kartenfächer bekommen automatisch eine Daumenkerbe statt der Griffmulde.</p>}
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
          label="Kartenhüllen"
          value={m.sleeve}
          options={(Object.keys(SLEEVES) as (keyof typeof SLEEVES)[]).map((k) => ({ value: k, label: SLEEVES[k].label }))}
          onChange={(sleeve) => set({ sleeve })}
        />
        <NumberField label="Kartendicke" value={m.cardThickness} min={0.1} step={0.01} onChange={(cardThickness) => set({ cardThickness })} />
      </div>
      <p className="muted small">
        Karte mit Hülle {fmt(card.width)} × {fmt(card.height)} × {fmt(card.thickness, 2)} mm. Zum Nachmessen gibt es die Kartenformate 1:1 im Rasterbogen (Werkzeugleiste).
      </p>

      <h3>Lage der Karten</h3>
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
            { value: '1', label: '1 Reihe' },
            { value: '2', label: '2 Reihen' },
          ]}
          onChange={(v) => set({ rows: Number(v) })}
        />
      </div>

      <h3>{standing ? 'Trenner und Inhalt' : 'Fächer und Inhalt'}</h3>
      {standing && (
        <Segmented
          value={m.dividerMode}
          options={[
            { value: 'fixed', label: 'Feste Fächer' },
            { value: 'loose', label: 'Trenner, glatt' },
            { value: 'toothed', label: 'Trenner, Zacken' },
          ]}
          onChange={(dividerMode) => set({ dividerMode })}
        />
      )}
      {variable ? (
        <>
          <div className="grid3">
            <NumberField label="Karten gesamt" value={m.totalCards} unit="" min={0} integer onChange={(totalCards) => set({ totalCards })} />
            <NumberField
              label="Trenner gesamt"
              value={dividerTotal(m)}
              unit=""
              min={0}
              max={200}
              integer
              hint={m.dividerLabels.some((s) => s.trim()) ? 'Ergibt sich aus der Beschriftungsliste' : undefined}
              onChange={(dividerCount) => set({ dividerCount })}
            />
            <NumberField label="Trennerstärke" value={m.dividerPlateThickness} min={0.6} step={0.2} onChange={(dividerPlateThickness) => set({ dividerPlateThickness })} />
          </div>
          <p className="muted small">
            {m.dividerMode === 'toothed'
              ? 'Die Seitenwände bekommen ein Zackenmuster, in dem die Trenner einrasten.'
              : 'Glatte Wände, die Trenner lassen sich frei verschieben.'}{' '}
            Die Trenner werden als eigene STL-Dateien exportiert.
          </p>
          <CheckField label="Lasche zum Beschriften an den Trennern" checked={m.tab} onChange={(tab) => set({ tab })} />
          {m.tab && (
            <>
              <div className="grid2">
                <NumberField label="Überstand der Lasche" value={m.tabHeight} min={2} max={40} onChange={(tabHeight) => set({ tabHeight })} />
                <NumberField label="Laschenbreite" unit="%" value={m.tabWidthPercent} min={10} max={100} onChange={(tabWidthPercent) => set({ tabWidthPercent })} />
              </div>
              <CheckField label="Laschen versetzt (links / Mitte / rechts)" checked={m.tabStaggered} onChange={(tabStaggered) => set({ tabStaggered })} />
              <DividerLabels m={m} set={set} />
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
          <>
            Fach innen {fmt(l.slotInnerX)} × {fmt(l.slotInnerY)} mm · Stapel {fmt(l.requiredInnerHeight)} mm
          </>
        )}
      </p>

      <h3>Komfort</h3>
      <NumberField
        label="Spiel um die Karten"
        value={m.play}
        min={0}
        step={0.5}
        hint="Zusätzlicher Freiraum je Achse, damit die Karten nicht klemmen"
        onChange={(play) => set({ play })}
      />
      <FingerFields m={m} set={set as Setter<InsertModule>} />
    </>
  );
}

/** Beschriftete Trenner: eine Zeile je Trenner, Import aus CSV/Excel. */
function DividerLabels({ m, set }: { m: CardTrayModule; set: Setter<CardTrayModule> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const text = m.dividerLabels.join('\n');
  const count = m.dividerLabels.filter((s) => s.trim()).length;
  const load = async (f: File) => {
    try {
      const rows = parseTableFile(f.name, new Uint8Array(await f.arrayBuffer()));
      const list = firstColumn(rows);
      set({ dividerLabels: list });
      setMsg(`${list.length} Einträge aus „${f.name}“ übernommen.`);
    } catch (e) {
      setMsg(`Import fehlgeschlagen: ${(e as Error).message}`);
    }
  };
  return (
    <div className="divider-labels">
      <label className="field">
        <span className="field-label">Beschriftung der Trenner (eine Zeile je Trenner)</span>
        <textarea
          rows={Math.min(8, Math.max(3, m.dividerLabels.length + 1))}
          value={text}
          placeholder={'z. B.\nAktionen\nGebäude\nEreignisse'}
          onChange={(e) => set({ dividerLabels: e.target.value.split('\n') })}
        />
      </label>
      <div className="row gap-s wrap">
        <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>Aus CSV / Excel importieren</button>
        {count > 0 && (
          <button type="button" className="link small" onClick={() => set({ dividerLabels: [] })}>
            Liste leeren
          </button>
        )}
        <span className="muted small">{count > 0 ? `${count} beschriftete Trenner, jeder als eigene STL mit erhabener Schrift.` : 'Leer = unbeschriftete Trenner.'}</span>
      </div>
      <p className="muted small">Erste Spalte der Tabelle wird verwendet, eine Überschrift wird erkannt und übersprungen.</p>
      {msg && <p className="small">{msg}</p>}
      <input
        ref={fileRef}
        type="file"
        hidden
        accept=".csv,.txt,.tsv,.xlsx"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void load(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
