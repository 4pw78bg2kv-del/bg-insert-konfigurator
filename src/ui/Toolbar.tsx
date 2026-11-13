import { useRef, useState } from 'react';
import { parseProject, serializeProject } from '../geometry';
import { useStore } from '../state/store';
import { downloadBlob, geometryClient } from '../worker/client';

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

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="logo" aria-hidden>▦</span>
        <span>BG-Insert-Konfigurator</span>
      </div>
      <input className="project-name" value={project.name} onChange={(e) => setName(e.target.value)} aria-label="Projektname" />
      <div className="row gap-s">
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (confirm('Neues Projekt beginnen? Ungespeicherte Änderungen gehen verloren.')) newProject();
          }}
        >
          Neu
        </button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Laden</button>
        <button type="button" className="btn" onClick={save}>Speichern (JSON)</button>
        <button type="button" className="btn primary" onClick={exportZip} disabled={exporting || project.modules.length === 0}>
          {exporting ? 'Exportiere…' : 'Alle STL als ZIP'}
        </button>
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
