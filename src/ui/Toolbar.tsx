import { useCallback, useRef, useState } from 'react';
import { parseProject, serializeProject } from '../geometry';
import { useStore } from '../state/store';
import { downloadBlob, geometryClient } from '../worker/client';
import { useCommand, type AppCommand } from './shortcuts';

export function Toolbar() {
  const project = useStore((s) => s.project);
  const setName = useStore((s) => s.setName);
  const loadProject = useStore((s) => s.loadProject);
  const newProject = useStore((s) => s.newProject);
  const building = useStore((s) => s.building);
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fileBase = (project.name || 'Insert').replace(/[^A-Za-z0-9._-]+/g, '_');

  const save = () => downloadBlob(serializeProject(project), `${fileBase}.json`, 'application/json');

  const load = async (file: File) => {
    try {
      loadProject(parseProject(await file.text()));
      setStatus(`„${file.name}“ geladen`);
    } catch (e) {
      setStatus(`Laden fehlgeschlagen: ${(e as Error).message}`);
    }
  };

  const exportZip = async () => {
    setExporting(true);
    setStatus(null);
    try {
      const res = await geometryClient().exportZip(project);
      downloadBlob(res.data, res.fileName, res.mime);
      const bad = res.files.filter((f) => !f.watertight);
      setStatus(
        bad.length
          ? `Achtung: ${bad.map((f) => f.name).join(', ')} nicht wasserdicht`
          : `${res.files.length} STL-Dateien exportiert, alle wasserdicht ✓`,
      );
    } catch (e) {
      setStatus(`Export fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const canUndo = useStore((s) => s.canUndo);
  const canRedo = useStore((s) => s.canRedo);
  const setHelpOpen = useStore((s) => s.setHelpOpen);

  const latest = useRef({ save, exportZip });
  latest.current = { save, exportZip };
  useCommand(
    useCallback((cmd: AppCommand) => {
      if (cmd === 'save') latest.current.save();
      else if (cmd === 'open') fileRef.current?.click();
      else void latest.current.exportZip();
    }, []),
  );

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="logo" aria-hidden>▦</span>
        <span>BG-Insert-Konfigurator</span>
      </div>
      <input className="project-name" value={project.name} onChange={(e) => setName(e.target.value)} aria-label="Projektname" />
      <div className="row gap-s">
        <button type="button" className="btn" title="Rückgängig (Strg+Z)" disabled={!canUndo} onClick={undo}>↶</button>
        <button type="button" className="btn" title="Wiederholen (Strg+Y)" disabled={!canRedo} onClick={redo}>↷</button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (confirm('Neues Projekt beginnen? Ungespeicherte Änderungen gehen verloren.')) newProject();
          }}
        >
          Neu
        </button>
        <button type="button" className="btn" title="Strg+O" onClick={() => fileRef.current?.click()}>Laden</button>
        <button type="button" className="btn" title="Strg+S" onClick={save}>Speichern (JSON)</button>
        <button type="button" className="btn primary" title="Strg+E" onClick={exportZip} disabled={exporting || project.modules.length === 0}>
          {exporting ? 'Exportiere…' : 'Alle STL als ZIP'}
        </button>
        <button type="button" className="btn" title="Tastaturbefehle (?)" onClick={() => setHelpOpen(true)}>⌨</button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void load(f);
            e.target.value = '';
          }}
        />
      </div>
      <div className="status small">
        {building ? <span className="muted">Berechne Geometrie…</span> : status && <span>{status}</span>}
      </div>
    </header>
  );
}
