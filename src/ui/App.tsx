import { useStore } from '../state/store';
import { Segmented, CheckField } from './fields';
import { useGeometryBuilder, useLayout } from './hooks';
import { ModuleEditor, ModuleList } from './ModulePanels';
import { MessagesPanel, PartsPanel } from './PartsPanel';
import { BoxPanel, GridPanel, LayersPanel, PrintPanel } from './SettingsPanels';
import { Toolbar } from './Toolbar';
import { Viewport } from './Viewport';
import { ShortcutHelp, useShortcuts } from './shortcuts';

export function App() {
  useGeometryBuilder();
  useShortcuts();
  const { layout, messages } = useLayout();
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const showBox = useStore((s) => s.showBox);
  const setShowBox = useStore((s) => s.setShowBox);
  const buildError = useStore((s) => s.buildError);
  const explode = useStore((s) => s.explode);
  const setExplode = useStore((s) => s.setExplode);
  const layerCount = useStore((s) => s.project.layers.length);

  return (
    <div className="app">
      <Toolbar />
      <aside className="sidebar">
        <BoxPanel />
        <PrintPanel />
        <GridPanel />
        <LayersPanel />
        <ModuleList />
        <ModuleEditor layout={layout} />
      </aside>
      <main className="main">
        <div className="viewport">
          <Viewport layout={layout} />
          <div className="view-controls">
            <Segmented
              value={viewMode}
              options={[
                { value: 'all', label: 'Gesamtansicht' },
                { value: 'single', label: 'Einzelteil' },
              ]}
              onChange={setViewMode}
            />
            {viewMode === 'all' && <CheckField label="Schachtel zeigen" checked={showBox} onChange={setShowBox} />}
            {viewMode === 'all' && layerCount > 1 && (
              <label className="check" title="Ebenen auseinanderziehen">
                <span>Explosion</span>
                <input type="range" min={0} max={80} step={1} value={explode} onChange={(e) => setExplode(Number(e.target.value))} />
              </label>
            )}
          </div>
          {buildError && <div className="build-error">Geometriefehler: {buildError}</div>}
        </div>
        <div className="bottom">
          <MessagesPanel messages={messages} />
          <PartsPanel layout={layout} />
        </div>
      </main>
      <ShortcutHelp />
    </div>
  );
}
