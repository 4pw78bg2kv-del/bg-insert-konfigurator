import { useStore } from '../state/store';
import { Segmented, CheckField } from './fields';
import { useGeometryBuilder, useLayout } from './hooks';
import { ModuleEditor, ModuleList } from './ModulePanels';
import { MessagesPanel, PartsPanel } from './PartsPanel';
import { BoxPanel, PrintPanel } from './SettingsPanels';
import { Toolbar } from './Toolbar';
import { Viewport } from './Viewport';

export function App() {
  useGeometryBuilder();
  const { layout, messages } = useLayout();
  const viewMode = useStore((s) => s.viewMode);
  const setViewMode = useStore((s) => s.setViewMode);
  const showBox = useStore((s) => s.showBox);
  const setShowBox = useStore((s) => s.setShowBox);
  const buildError = useStore((s) => s.buildError);

  return (
    <div className="app">
      <Toolbar />
      <aside className="sidebar">
        <BoxPanel />
        <PrintPanel />
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
          </div>
          {buildError && <div className="build-error">Geometriefehler: {buildError}</div>}
        </div>
        <div className="bottom">
          <MessagesPanel messages={messages} />
          <PartsPanel layout={layout} />
        </div>
      </main>
    </div>
  );
}
