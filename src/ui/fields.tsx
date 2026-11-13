/**
 * Wiederverwendbare Eingabefelder. Zahlen akzeptieren Komma und Punkt.
 */
import { useEffect, useState, type ReactNode } from 'react';

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="section">
      <header className="section-head">
        <h2>{title}</h2>
        {actions}
      </header>
      <div className="section-body">{children}</div>
    </section>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange(v: number): void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  hint?: string;
}

function fmt(v: number): string {
  return String(Math.round(v * 1000) / 1000).replace('.', ',');
}

export function NumberField({ label, value, onChange, unit = 'mm', min, max, step = 1, integer, hint }: NumberFieldProps) {
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(fmt(value));
  }, [value, focused]);

  const parse = (t: string): number | null => {
    const n = Number(t.replace(',', '.').trim());
    if (t.trim() === '' || !Number.isFinite(n)) return null;
    let v = integer ? Math.round(n) : n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  };

  const commit = (t: string) => {
    const v = parse(t);
    if (v !== null && v !== value) onChange(v);
  };

  const stepBy = (dir: 1 | -1) => {
    const v = parse(text) ?? value;
    const next = parse(String(Math.round((v + dir * step) * 1000) / 1000));
    if (next !== null) {
      setText(fmt(next));
      onChange(next);
    }
  };

  const invalid = parse(text) === null;
  return (
    <label className="field" title={hint}>
      <span className="field-label">{label}</span>
      <span className={`num ${invalid ? 'invalid' : ''}`}>
        <input
          inputMode="decimal"
          value={text}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit(text);
            setText(fmt(parse(text) ?? value));
          }}
          onChange={(e) => {
            setText(e.target.value);
            commit(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') { e.preventDefault(); stepBy(1); }
            if (e.key === 'ArrowDown') { e.preventDefault(); stepBy(-1); }
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        {unit && <span className="unit">{unit}</span>}
      </span>
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange(v: T): void;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function TextField({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange(v: T): void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
