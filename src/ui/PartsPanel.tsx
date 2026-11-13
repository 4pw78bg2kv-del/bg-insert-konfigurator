import { useState } from 'react';
import { areaUsage, moduleSize, partFileName, type PlacedInstance, type ValidationMessage } from '../geometry';
import { useStore } from '../state/store';
import { downloadBlob, geometryClient } from '../worker/client';
import { fmt } from './SettingsPanels';

/** PLA-Dichte für eine grobe Gewichtsschätzung (Vollmaterial). */
const PLA_G_PER_MM3 = 1.24 / 1000;

export function MessagesPanel({ messages }: { messages: ValidationMessage[] }) {
  const select = useStore((s) => s.select);
  if (messages.length === 0) return <div className="msg ok">✓ Alles passt: keine Kollisionen, alle Teile in der Schachtel.</div>;
  return (
    <ul className="messages">
      {messages.map((m, i) => (
        <li key={i} className={`msg ${m.level}`} onClick={() => m.moduleId && select(m.moduleId)}>
          {m.level === 'error' ? '⛔' : m.level === 'warning' ? '⚠️' : 'ℹ️'} {m.text}
        </li>
      ))}
    </ul>
  );
}

export function PartsPanel({ layout }: { layout: PlacedInstance[] }) {
  const project = useStore((s) => s.project);
  const parts = useStore((s) => s.parts);
  const select = useStore((s) => s.select);
  const selectedId = useStore((s) => s.selectedId);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportOne = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      const res = await geometryClient().exportPart(project, id);
      downloadBlob(res.data, res.fileName, res.mime);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const totalGrams = project.modules.reduce((s, m) => s + (parts[m.id]?.volume ?? 0) * m.quantity * PLA_G_PER_MM3, 0);

  return (
    <div className="parts">
      <table>
        <thead>
          <tr>
            <th>Datei</th>
            <th>Maße (B × T × H)</th>
            <th className="right">≈ PLA</th>
            <th>Prüfung</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {project.modules.map((m) => {
            const p = parts[m.id];
            const s = moduleSize(m, project);
            return (
              <tr key={m.id} className={m.id === selectedId ? 'selected' : ''} onClick={() => select(m.id)}>
                <td className="mono">{partFileName(m)}</td>
                <td>
                  {fmt(s.width)} × {fmt(s.depth)} × {fmt(s.height)} mm
                </td>
                <td className="right">{p ? `${fmt(p.volume * PLA_G_PER_MM3 * m.quantity, 0)} g` : '…'}</td>
                <td>
                  {!p ? (
                    <span className="muted">…</span>
                  ) : p.error ? (
                    <span className="bad" title={p.error}>Fehler</span>
                  ) : p.watertight ? (
                    <span className="good" title={`${p.triangles} Dreiecke, geschlossen und korrekt orientiert`}>✓ wasserdicht</span>
                  ) : (
                    <span className="bad">nicht wasserdicht</span>
                  )}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="btn small" disabled={busy !== null} onClick={() => exportOne(m.id)}>
                    {busy === m.id ? '…' : 'STL'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">
        Belegte Grundfläche {fmt(areaUsage(project, layout), 0)} % · gesamt ≈ {fmt(totalGrams, 0)} g PLA (Vollmaterial-Schätzung)
      </p>
      {error && <p className="bad small">{error}</p>}
    </div>
  );
}
