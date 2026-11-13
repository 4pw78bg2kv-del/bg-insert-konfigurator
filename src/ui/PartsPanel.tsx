import { useState } from 'react';
import { areaUsage, fileNameFor, listParts, type PlacedInstance, type ValidationMessage } from '../geometry';
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

function bboxSize(p: Float32Array): string {
  if (p.length === 0) return '–';
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3)
    for (let a = 0; a < 3; a++) {
      if (p[i + a] < min[a]) min[a] = p[i + a];
      if (p[i + a] > max[a]) max[a] = p[i + a];
    }
  return `${fmt(max[0] - min[0])} × ${fmt(max[1] - min[1])} × ${fmt(max[2] - min[2])} mm`;
}

export function PartsPanel({ layout }: { layout: PlacedInstance[] }) {
  const project = useStore((s) => s.project);
  const parts = useStore((s) => s.parts);
  const select = useStore((s) => s.select);
  const selectedId = useStore((s) => s.selectedId);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const specs = listParts(project);

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

  const totalGrams = specs.reduce((s, spec) => s + (parts[spec.id]?.volume ?? 0) * spec.quantity * PLA_G_PER_MM3, 0);
  const usage = project.layers.map((l) => `${l.name} ${fmt(areaUsage(project, layout, l.id), 0)} %`).join(' · ');

  return (
    <div className="parts">
      <table>
        <thead>
          <tr>
            <th>Datei</th>
            <th>Druckmaße</th>
            <th className="right">≈ PLA</th>
            <th>Prüfung</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {specs.map((spec) => {
            const p = parts[spec.id];
            return (
              <tr
                key={spec.id}
                className={`${spec.moduleId && spec.moduleId === selectedId ? 'selected' : ''} ${spec.kind !== 'module' ? 'sub' : ''}`}
                onClick={() => spec.moduleId && select(spec.moduleId)}
              >
                <td className="mono">{fileNameFor(spec.name, spec.quantity)}</td>
                <td>{p ? bboxSize(p.positions) : '…'}</td>
                <td className="right">{p ? `${fmt(p.volume * PLA_G_PER_MM3 * spec.quantity, 0)} g` : '…'}</td>
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
                  <button type="button" className="btn small" disabled={busy !== null} onClick={() => exportOne(spec.id)}>
                    {busy === spec.id ? '…' : 'STL'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted small">
        Belegte Grundfläche: {usage} · gesamt ≈ {fmt(totalGrams, 0)} g PLA (Vollmaterial-Schätzung)
      </p>
      {error && <p className="bad small">{error}</p>}
    </div>
  );
}
