import { outerBoxSize, usableHeight } from '../geometry';
import { useStore } from '../state/store';
import { NumberField, Section } from './fields';

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
          hint="Platz oben für Spielbretter, Tableaus und Anleitungen"
          onChange={(v) => setBox({ headroom: v })}
        />
      </div>
      <p className="muted small">
        Außenmaße {fmt(outer.width)} × {fmt(outer.depth)} × {fmt(outer.height)} mm · nutzbare Ebenenhöhe{' '}
        <strong>{fmt(usableHeight(box))} mm</strong>
      </p>
    </Section>
  );
}

export function PrintPanel() {
  const print = useStore((s) => s.project.print);
  const setPrint = useStore((s) => s.setPrint);
  return (
    <Section title="3D-Druck">
      <div className="grid2">
        <NumberField
          label="Spaltmaß (Clearance)"
          value={print.clearance}
          min={0}
          max={5}
          step={0.05}
          hint="Abstand zwischen Teilen und zur Schachtelwand"
          onChange={(v) => setPrint({ clearance: v })}
        />
        <NumberField label="Außenwand" value={print.wallThickness} min={0.4} step={0.4} onChange={(v) => setPrint({ wallThickness: v })} />
        <NumberField label="Boden" value={print.floorThickness} min={0.2} step={0.2} onChange={(v) => setPrint({ floorThickness: v })} />
        <NumberField label="Trennwand" value={print.dividerThickness} min={0.4} step={0.4} onChange={(v) => setPrint({ dividerThickness: v })} />
      </div>
    </Section>
  );
}

export function fmt(v: number, digits = 1): string {
  return v.toLocaleString('de-DE', { maximumFractionDigits: digits });
}
