import { useState } from 'react';
import { areaUsage, fileNameFor, fitsBed, listHardware, listParts, maxLevel, type PlacedInstance, type ValidationMessage } from '../geometry';
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

function bbox(p: Float32Array): [number, number, number] | null {
  if (p.length === 0) return null;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.length; i += 3)
    for (let a = 0; a < 3; a++) {
      if (p[i + a] < min[a]) min[a] = p[i + a];
      if (p[i + a] > max[a]) max[a] = p[i + a];
    }
  return [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
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
  const levels = maxLevel(project);
  const usage = Array.from({ length: levels }, (_, i) => `${levels > 1 ? `Stufe ${i + 1} ` : ''}${fmt(areaUsage(project, layout, i + 1), 0)} %`).join(' · ');
  const hardware = listHardware(project);

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
            const b = p ? bbox(p.positions) : null;
            const fits = !b || fitsBed(b[0], b[1], b[2], project.print);
            return (
              <tr
                key={spec.id}
                className={`${spec.moduleId && spec.moduleId === selectedId ? 'selected' : ''} ${spec.kind !== 'module' ? 'sub' : ''}`}
                onClick={() => spec.moduleId && select(spec.moduleId)}
              >
                <td className="mono" title={spec.note}>
                  {fileNameFor(spec.name, spec.quantity)}
                  {spec.note && <span className="note"> ⓘ {spec.note}</span>}
                </td>
                <td className={fits ? '' : 'bad'} title={fits ? undefined : 'Zu groß für das Druckbett'}>
                  {b ? `${fmt(b[0])} × ${fmt(b[1])} × ${fmt(b[2])} mm` : p ? '–' : '…'}
                  {!fits && ' ⛔'}
                </td>
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
      {hardware.length > 0 && (
        <p className="small">
          <strong>Zukaufteile:</strong> {hardware.map((h) => `${h.quantity}× ${h.name}`).join(' · ')}
        </p>
      )}
      <p className="muted small">
        Belegte Grundfläche: {usage} · gesamt ≈ {fmt(totalGrams, 0)} g PLA (Vollmaterial-Schätzung)
      </p>
      {error && <p className="bad small">{error}</p>}
    </div>
  );
}
