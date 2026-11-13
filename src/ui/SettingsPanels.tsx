import { baseplateTiles, gridInfo, layerInfos, outerBoxSize, usableHeight } from '../geometry';
import { useStore } from '../state/store';
import { CheckField, NumberField, Section } from './fields';

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

export function GridPanel() {
  const project = useStore((s) => s.project);
  const setGrid = useStore((s) => s.setGrid);
  const grid = project.grid;
  const g = gridInfo(project);
  const tiles = grid.enabled && grid.baseplate ? baseplateTiles(project).length : 0;
  return (
    <Section title="Innenraster">
      <CheckField label="Alle Module nach Innenraster aufbauen" checked={grid.enabled} onChange={(enabled) => setGrid({ enabled })} />
      {grid.enabled && (
        <>
          <div className="grid2">
            <NumberField label="Zellgröße (Ziel)" value={grid.targetCell} min={5} max={200} onChange={(targetCell) => setGrid({ targetCell })} />
            <NumberField label="Max. Kachelgröße" value={grid.maxTileSize} min={20} hint="Größte Kante einer Grundplatten-Kachel (Druckbett)" onChange={(maxTileSize) => setGrid({ maxTileSize })} />
          </div>
          <CheckField label="Grundplatte zum Einrasten (Module verrutschen nicht)" checked={grid.baseplate} onChange={(baseplate) => setGrid({ baseplate })} />
          <p className="muted small">
            {g.nx} × {g.ny} Zellen à {fmt(g.cellX, 2)} × {fmt(g.cellY, 2)} mm
            {tiles > 0 && ` · Grundplatte in ${tiles} Kachel${tiles > 1 ? 'n' : ''}`}. Module belegen ganze Zellen; die Grundplatte hat Rippen auf den Rasterlinien, die Module passende Nuten im Boden.
          </p>
        </>
      )}
    </Section>
  );
}

export function LayersPanel() {
  const project = useStore((s) => s.project);
  const activeLayerId = useStore((s) => s.activeLayerId);
  const { addLayer, updateLayer, removeLayer, setActiveLayer } = useStore.getState();
  const infos = layerInfos(project);
  const total = infos.reduce((s, l) => s + l.height, 0);
  const usable = usableHeight(project.box);
  return (
    <Section
      title="Ebenen"
      actions={<button type="button" className="btn small" onClick={addLayer}>+ Ebene</button>}
    >
      <ul className="layer-list">
        {[...infos].reverse().map((info) => {
          const l = info.layer;
          const count = project.modules.filter((m) => m.layerId === l.id).length;
          return (
            <li key={l.id} className={l.id === activeLayerId ? 'active' : ''} onClick={() => setActiveLayer(l.id)}>
              <button
                type="button"
                className="icon"
                title={l.visible ? 'Ausblenden' : 'Einblenden'}
                onClick={(e) => {
                  e.stopPropagation();
                  updateLayer(l.id, { visible: !l.visible });
                }}
              >
                {l.visible ? '👁' : '◌'}
              </button>
              <input className="layer-name" value={l.name} onClick={(e) => e.stopPropagation()} onChange={(e) => updateLayer(l.id, { name: e.target.value })} />
              <span className="muted small">{count} Mod.</span>
              <select
                className="small-select"
                value={l.heightMode}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateLayer(l.id, { heightMode: e.target.value as 'auto' | 'fixed', height: Math.round(info.height * 10) / 10 })}
              >
                <option value="auto">Auto</option>
                <option value="fixed">Fest</option>
              </select>
              {l.heightMode === 'fixed' ? (
                <span className="layer-height" onClick={(e) => e.stopPropagation()}>
                  <NumberField label="" value={l.height} min={2} onChange={(height) => updateLayer(l.id, { height })} />
                </span>
              ) : (
                <span className="small layer-height">{fmt(info.height)} mm</span>
              )}
              <button
                type="button"
                className="icon danger"
                title="Ebene löschen"
                disabled={project.layers.length <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  removeLayer(l.id);
                }}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
      <p className={`small ${total > usable + 0.01 ? 'bad' : 'muted'}`}>
        Ebenen gesamt {fmt(total)} von {fmt(usable)} mm. Oberste Ebene steht oben in der Liste; „Auto“-Ebenen teilen sich die restliche Höhe.
      </p>
    </Section>
  );
}
