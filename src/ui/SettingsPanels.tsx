import {
  BED_MARGIN,
  FONTS,
  PRINTERS,
  baseplateTiles,
  gridInfo,
  outerBoxSize,
  printerPreset,
  recommendedPrint,
  usableHeight,
  type FontId,
  type Material,
} from '../geometry';
import { useStore } from '../state/store';
import { CheckField, NumberField, Section, Segmented, SelectField } from './fields';

export function fmt(v: number, digits = 1): string {
  return v.toLocaleString('de-DE', { maximumFractionDigits: digits });
}

export function BoxPanel() {
  const box = useStore((s) => s.project.box);
  const setBox = useStore((s) => s.setBox);
  const outer = outerBoxSize(box);
  return (
    <Section title="Spielschachtel">
      <div className="grid3">
        <NumberField label="Innen Breite" value={box.innerWidth} min={10} onChange={(v) => setBox({ innerWidth: v })} />
        <NumberField label="Innen Tiefe" value={box.innerDepth} min={10} onChange={(v) => setBox({ innerDepth: v })} />
        <NumberField label="Innen Höhe" value={box.innerHeight} min={5} onChange={(v) => setBox({ innerHeight: v })} />
      </div>
      <div className="grid3">
        <NumberField label="Kartonwand" value={box.wallThickness} min={0} step={0.5} onChange={(v) => setBox({ wallThickness: v })} />
        <NumberField label="Kartonboden" value={box.floorThickness} min={0} step={0.5} onChange={(v) => setBox({ floorThickness: v })} />
        <NumberField
          label="Kopfraum"
          value={box.headroom}
          min={0}
          hint="Platz oben für Spielbrett, Tableaus und Anleitung"
          onChange={(v) => setBox({ headroom: v })}
        />
      </div>
      <p className="muted small">
        Außenmaße {fmt(outer.width)} × {fmt(outer.depth)} × {fmt(outer.height)} mm · nutzbare Höhe <strong>{fmt(usableHeight(box))} mm</strong>
      </p>
    </Section>
  );
}

export function PrintPanel() {
  const print = useStore((s) => s.project.print);
  const setPrint = useStore((s) => s.setPrint);
  const rec = recommendedPrint(print.material, print.nozzle);
  const differs = (Object.keys(rec) as (keyof typeof rec)[]).some((k) => Math.abs(rec[k] - print[k]) > 1e-6);
  const preset = printerPreset(print.printer);
  return (
    <Section title="3D-Drucker und Material">
      <SelectField
        label="Drucker"
        value={print.printer}
        options={[...PRINTERS.map((p) => ({ value: p.id, label: `${p.label} (${p.bedX} × ${p.bedY} × ${p.bedZ})` })), { value: 'custom', label: 'Eigene Bettgröße' }]}
        onChange={(printer) => {
          const p = printerPreset(printer);
          setPrint(p ? { printer, bedX: p.bedX, bedY: p.bedY, bedZ: p.bedZ } : { printer });
        }}
      />
      {!preset && (
        <div className="grid3">
          <NumberField label="Bett X" value={print.bedX} min={50} onChange={(bedX) => setPrint({ bedX })} />
          <NumberField label="Bett Y" value={print.bedY} min={50} onChange={(bedY) => setPrint({ bedY })} />
          <NumberField label="Bauhöhe" value={print.bedZ} min={20} onChange={(bedZ) => setPrint({ bedZ })} />
        </div>
      )}
      <p className="muted small">
        Größtes Teil: {fmt(print.bedX - BED_MARGIN)} × {fmt(print.bedY - BED_MARGIN)} × {fmt(print.bedZ)} mm ({BED_MARGIN} mm Rand für Skirt/Brim). Größere Teile werden als Fehler gemeldet.
      </p>
      <div className="grid2">
        <label className="field">
          <span className="field-label">Material</span>
          <Segmented<Material>
            value={print.material}
            options={[
              { value: 'PLA', label: 'PLA' },
              { value: 'PETG', label: 'PETG' },
            ]}
            onChange={(material) => setPrint({ material })}
          />
        </label>
        <SelectField
          label="Düse"
          value={String(print.nozzle)}
          options={['0.2', '0.4', '0.6', '0.8'].map((v) => ({ value: v, label: `${v.replace('.', ',')} mm` }))}
          onChange={(v) => setPrint({ nozzle: Number(v) })}
        />
      </div>
      <div className="grid2">
        <NumberField label="Spaltmaß" value={print.clearance} min={0} max={5} step={0.05} hint="Abstand zwischen Teilen, zur Schachtelwand und bei Deckeln" onChange={(clearance) => setPrint({ clearance })} />
        <NumberField label="Außenwand" value={print.wallThickness} min={0.4} step={0.4} onChange={(wallThickness) => setPrint({ wallThickness })} />
        <NumberField label="Boden" value={print.floorThickness} min={0.2} step={0.2} onChange={(floorThickness) => setPrint({ floorThickness })} />
        <NumberField label="Trennwand" value={print.dividerThickness} min={0.4} step={0.4} onChange={(dividerThickness) => setPrint({ dividerThickness })} />
        <NumberField
          label="Bodenfase"
          value={print.bottomChamfer}
          min={0}
          max={2}
          step={0.1}
          hint="Kleine Fase an der Unterkante gegen den Elefantenfuß (mit Grundplatte automatisch 1,6 mm)"
          onChange={(bottomChamfer) => setPrint({ bottomChamfer })}
        />
      </div>
      {differs && (
        <button type="button" className="link small" onClick={() => setPrint(rec)}>
          Empfehlung für {print.material} mit {fmt(print.nozzle)}-mm-Düse übernehmen (Wand {fmt(rec.wallThickness)}, Spalt {fmt(rec.clearance, 2)} mm)
        </button>
      )}
    </Section>
  );
}

export function GridPanel() {
  const project = useStore((s) => s.project);
  const setGrid = useStore((s) => s.setGrid);
  const setBaseplate = useStore((s) => s.setBaseplate);
  const grid = project.grid;
  const g = gridInfo(project);
  const tiles = project.baseplate.enabled ? baseplateTiles(project).length : 0;
  return (
    <Section title="Raster und Grundplatte">
      <CheckField label="Module auf ein Raster ausrichten" checked={grid.enabled} onChange={(enabled) => setGrid({ enabled })} />
      {grid.enabled && (
        <>
          <NumberField label="Rastermaß" value={grid.pitch} min={3} max={200} step={1} hint="z. B. 5 mm für feines Raster oder 21 mm wie Gridfinity" onChange={(pitch) => setGrid({ pitch })} />
          <span className="field-label">Schachtel füllen</span>
          <Segmented
            value={grid.fit}
            options={[
              { value: 'stretch', label: 'Raster leicht strecken' },
              { value: 'exact', label: 'Rastermaß exakt' },
            ]}
            onChange={(fit) => setGrid({ fit })}
          />
          <span className="field-label">Aufgerundeter Platz geht in</span>
          <Segmented
            value={grid.grow}
            options={[
              { value: 'inner', label: 'Innenraum' },
              { value: 'wall', label: 'Dickere Wände' },
            ]}
            onChange={(grow) => setGrid({ grow })}
          />
          <p className="muted small">
            {g.nx} × {g.ny} Felder à {fmt(g.cellX, 2)} × {fmt(g.cellY, 2)} mm. Jedes Modul wird auf ganze Felder aufgerundet.
          </p>
        </>
      )}
      <CheckField label="Grundplatte (hält die unterste Lage fest)" checked={project.baseplate.enabled} onChange={(enabled) => setBaseplate({ enabled })} />
      {project.baseplate.enabled && (
        <p className="muted small">
          Flache Platte mit Rippen entlang der Modulkanten; die Module haben unten eine passende Fase. {tiles > 1 ? `Wird fürs Druckbett in ${tiles} Teile geteilt.` : 'Passt in einem Stück aufs Druckbett.'}
        </p>
      )}
    </Section>
  );
}

export function LabelPanel() {
  const labels = useStore((s) => s.project.labels);
  const setLabels = useStore((s) => s.setLabels);
  return (
    <Section title="Beschriftung">
      <SelectField<FontId> label="Schrift" value={labels.font} options={FONTS.map((f) => ({ value: f.id, label: f.label }))} onChange={(font) => setLabels({ font })} />
      <div className="grid2">
        <NumberField label="Schrifttiefe" value={labels.depth} min={0.4} max={4} step={0.2} hint="Vertiefte Schrift in Wänden und Deckeln" onChange={(depth) => setLabels({ depth })} />
        <NumberField label="Erhaben (Trenner)" value={labels.raised} min={0.2} max={2} step={0.2} hint="Höhe der erhabenen Schrift auf Kartentrennern" onChange={(raised) => setLabels({ raised })} />
      </div>
      <p className="muted small">
        Die Schrift wird zusätzlich als eigenes Teil exportiert. Im Slicer als Teil desselben Objekts laden und eine andere Farbe zuweisen, dann wird sie mehrfarbig gedruckt.
      </p>
    </Section>
  );
}
