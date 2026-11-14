import { useEffect } from 'react';
import { loadAllFonts, maxLevel } from '../geometry';
import { useStore } from '../state/store';
import { InventoryDialog, TemplateGallery } from './Dialogs';
import { CheckField, Segmented } from './fields';
import { useGeometryBuilder, useLayout } from './hooks';
import { ModuleEditor, ModuleList } from './ModulePanels';
import { MessagesPanel, PartsPanel } from './PartsPanel';
import { BoxPanel, GridPanel, LabelPanel, PrintPanel } from './SettingsPanels';
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
  const levelView = useStore((s) => s.levelView);
  const setLevelView = useStore((s) => s.setLevelView);
  const rotateAll = useStore((s) => s.rotateAll);
  const levels = useStore((s) => maxLevel(s.project));
  const bumpFonts = useStore((s) => s.bumpFonts);

  // Schriften für die Prüfung der Textgrößen auch im Hauptthread laden.
  useEffect(() => {
    loadAllFonts().then(bumpFonts, () => undefined);
  }, [bumpFonts]);

  return (
    <div className="app">
      <Toolbar />
      <aside className="sidebar">
        <ModuleList layout={layout} />
        <ModuleEditor layout={layout} />
        <BoxPanel />
        <PrintPanel />
        <GridPanel />
        <LabelPanel />
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
            {viewMode === 'all' && <CheckField label="Schachtel" checked={showBox} onChange={setShowBox} />}
            {viewMode === 'all' && (
              <button type="button" className="btn small" title="Alle Module um 90° drehen und neu anordnen (Umschalt+R)" onClick={rotateAll}>
                ⟳ Alles drehen
              </button>
            )}
            {viewMode === 'all' && levels > 1 && (
              <>
                <label className="check" title="Stapelstufen auseinanderziehen">
                  <span>Explosion</span>
                  <input type="range" min={0} max={80} step={1} value={explode} onChange={(e) => setExplode(Number(e.target.value))} />
                </label>
                <label className="check" title="Nur Stapelstufen bis hier zeigen">
                  <span>Stufen</span>
                  <select className="small-select" value={levelView} onChange={(e) => setLevelView(Number(e.target.value))}>
                    <option value={0}>alle</option>
                    {Array.from({ length: levels }, (_, i) => (
                      <option key={i} value={i + 1}>bis {i + 1}</option>
                    ))}
                  </select>
                </label>
              </>
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
      <TemplateGallery />
      <InventoryDialog />
    </div>
  );
}
