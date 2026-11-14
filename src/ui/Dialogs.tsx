/**
 * Dialoge: Vorlagen-Galerie und Inventar-Import („Insert aus Teileliste“).
 */
import { useRef, useState, type ReactNode } from 'react';
import {
  GAME_PRESETS,
  TEMPLATES,
  computeLayout,
  inventoryTemplateCsv,
  inventoryTemplateXlsx,
  inventoryToModules,
  moduleSize,
  optimizeStacking,
  parseInventory,
  parseTableFile,
  printSheetsHtml,
  type InventoryRow,
  type InventoryResult,
} from '../geometry';
import { useStore } from '../state/store';
import { downloadBlob } from '../worker/client';
import { TYPE_LABEL } from './ModulePanels';
import { fmt } from './SettingsPanels';

function Modal({ title, onClose, children, wide }: { title: string; onClose(): void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="help-backdrop" onClick={onClose}>
      <div className={`help ${wide ? 'wide' : ''}`} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="row spread">
          <h2>{title}</h2>
          <button type="button" className="icon" onClick={onClose} aria-label="Schließen">✕</button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function TemplateGallery() {
  const open = useStore((s) => s.galleryOpen);
  const setOpen = useStore((s) => s.setGalleryOpen);
  const addTemplate = useStore((s) => s.addTemplate);
  const loadProject = useStore((s) => s.loadProject);
  if (!open) return null;
  const groups = [...new Set(TEMPLATES.map((t) => t.group))];
  return (
    <Modal title="Vorlagen" onClose={() => setOpen(false)} wide>
      <h3>Spiel-Presets</h3>
      <p className="muted small">Komplette Inserts für bestimmte Spiele (ersetzen das aktuelle Projekt).</p>
      <div className="gallery">
        {GAME_PRESETS.map((g) => (
          <button
            key={g.id}
            type="button"
            className="tile"
            onClick={() => {
              if (useStore.getState().project.modules.length === 0 || confirm(`Projekt durch das Preset „${g.label}“ ersetzen? Ungespeicherte Änderungen gehen verloren.`)) {
                loadProject(g.create());
                setOpen(false);
              }
            }}
          >
            <span className="tile-icon" aria-hidden>{g.icon}</span>
            <strong>{g.label}</strong>
            <span className="muted small">{g.description}</span>
          </button>
        ))}
      </div>
      <p className="muted small">Fertig eingestellte Module. Nach dem Einfügen lässt sich alles anpassen.</p>
      {groups.map((g) => (
        <div key={g}>
          <h3>{g}</h3>
          <div className="gallery">
            {TEMPLATES.filter((t) => t.group === g).map((t) => (
              <button key={t.id} type="button" className="tile" onClick={() => addTemplate(t.id)}>
                <span className="tile-icon" aria-hidden>{t.icon}</span>
                <strong>{t.label}</strong>
                <span className="muted small">{t.description}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  );
}

export function InventoryDialog() {
  const open = useStore((s) => s.inventoryOpen);
  const setOpen = useStore((s) => s.setInventoryOpen);
  const project = useStore((s) => s.project);
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<InventoryRow[] | null>(null);
  const [result, setResult] = useState<InventoryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [stack, setStack] = useState(true);
  if (!open) return null;

  const close = () => {
    setOpen(false);
    setRows(null);
    setResult(null);
    setError(null);
  };

  const load = async (f: File) => {
    setError(null);
    try {
      const table = parseTableFile(f.name, new Uint8Array(await f.arrayBuffer()));
      const r = parseInventory(table);
      if (r.length === 0) throw new Error('Keine Zeilen mit Bauteilart und Anzahl gefunden.');
      setRows(r);
      setResult(inventoryToModules(r, project));
      setFileName(f.name);
    } catch (e) {
      setRows(null);
      setResult(null);
      setError((e as Error).message);
    }
  };

  const apply = (replace: boolean) => {
    if (!result) return;
    const mods = structuredClone(result.modules);
    let next = { ...project, modules: replace ? mods : [...project.modules, ...mods] };
    if (stack) next = optimizeStacking(next);
    useStore.setState({ project: next, selectedId: mods[0]?.id ?? null, selectedCellId: null });
    close();
  };

  const preview = result ? { ...project, modules: result.modules } : null;
  const outside = preview
    ? computeLayout(preview).filter((i) => i.x + i.width > project.box.innerWidth + 0.01 || i.y + i.depth > project.box.innerDepth + 0.01).length
    : 0;

  return (
    <Modal title="Insert aus Teileliste" onClose={close} wide>
      <ol className="steps">
        <li>
          <strong>Vorlage herunterladen</strong> und alle Spielteile eintragen: Kategorie (z. B. „Spieler Rot“), Bauteilart (Auswahlliste) und Anzahl. Maße nur, wenn sie vom Standard abweichen.
          <div className="row gap-s wrap">
            <button type="button" className="btn small" onClick={() => downloadBlob(inventoryTemplateXlsx(), 'Inventar-Vorlage.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}>
              Excel-Vorlage (.xlsx)
            </button>
            <button type="button" className="btn small" onClick={() => downloadBlob('﻿' + inventoryTemplateCsv(), 'Inventar-Vorlage.csv', 'text/csv;charset=utf-8')}>
              CSV-Vorlage
            </button>
            <button type="button" className="btn small" onClick={() => downloadBlob(printSheetsHtml(project.grid.pitch, `Rasterbogen – ${project.name}`), 'Rasterbogen-A4.html', 'text/html')}>
              Rasterbogen A4 zum Ausdrucken
            </button>
          </div>
          <p className="muted small">
            Der Rasterbogen enthält Raster und Lineal im eingestellten Rastermaß zum Auslegen der Teile sowie die gängigen Kartenformate in Originalgröße. Im Browser öffnen und mit 100 % drucken.
          </p>
        </li>
        <li>
          <strong>Ausgefüllte Datei laden</strong> (Excel .xlsx oder als CSV gespeichert).
          <div className="row gap-s">
            <button type="button" className="btn small primary" onClick={() => fileRef.current?.click()}>Datei wählen…</button>
            {fileName && <span className="muted small">{fileName}</span>}
          </div>
          {error && <p className="bad small">{error}</p>}
        </li>
        {result && rows && (
          <li>
            <strong>Vorschlag prüfen</strong>: {rows.length} Zeilen → {result.modules.length} Module.
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Modul</th>
                  <th>Art</th>
                  <th>Maße</th>
                </tr>
              </thead>
              <tbody>
                {result.modules.map((m) => {
                  const s = moduleSize(m, project);
                  return (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td>{TYPE_LABEL[m.type]}</td>
                      <td>
                        {fmt(s.width)} × {fmt(s.depth)} × {fmt(s.height)} mm
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {result.notes.length > 0 && (
              <ul className="small">
                {result.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
            {outside > 0 && <p className="small">Nebeneinander auf dem Boden passen {outside} Teile nicht in die Schachtel.</p>}
            <label className="check">
              <input type="checkbox" checked={stack} onChange={(e) => setStack(e.target.checked)} />
              <span>Automatisch stapeln (was nicht passt, kommt eine Stufe höher)</span>
            </label>
            <div className="row gap-s">
              <button type="button" className="btn primary" onClick={() => apply(true)}>Module ersetzen</button>
              <button type="button" className="btn" onClick={() => apply(false)}>Zu bestehenden hinzufügen</button>
            </div>
          </li>
        )}
      </ol>
      <input
        ref={fileRef}
        type="file"
        hidden
        accept=".xlsx,.csv,.txt,.tsv"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void load(f);
          e.target.value = '';
        }}
      />
    </Modal>
  );
}
