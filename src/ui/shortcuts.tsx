/**
 * Tastaturbefehle. Werden ignoriert, solange ein Eingabefeld den Fokus hat
 * (außer Escape sowie Speichern/Exportieren mit Strg).
 */
import { useEffect } from 'react';
import { useStore } from '../state/store';

/** Aktionen der Werkzeugleiste, die per Tastatur ausgelöst werden. */
export type AppCommand = 'save' | 'open' | 'export';

export function sendCommand(cmd: AppCommand) {
  window.dispatchEvent(new CustomEvent<AppCommand>('bgi-command', { detail: cmd }));
}

export function useCommand(handler: (cmd: AppCommand) => void) {
  useEffect(() => {
    const fn = (e: Event) => handler((e as CustomEvent<AppCommand>).detail);
    window.addEventListener('bgi-command', fn);
    return () => window.removeEventListener('bgi-command', fn);
  }, [handler]);
}

export const SHORTCUTS: { keys: string; text: string }[] = [
  { keys: 'Pfeiltasten', text: 'Gewähltes Modul verschieben (Raster: 1 Feld, sonst 1 mm)' },
  { keys: 'Umschalt + Pfeiltasten', text: 'Ohne Raster: in 10-mm-Schritten verschieben' },
  { keys: 'R', text: 'Gewähltes Modul um 90° drehen' },
  { keys: 'A', text: 'Position automatisch / manuell umschalten' },
  { keys: 'Umschalt + R', text: 'Ganze Anordnung um 90° drehen' },
  { keys: 'Bild ↑ / Bild ↓', text: 'Modul eine Stapelstufe höher / tiefer legen' },
  { keys: 'Tab / Umschalt + Tab', text: 'Nächstes / vorheriges Modul wählen' },
  { keys: 'Esc', text: 'Auswahl aufheben' },
  { keys: 'Entf', text: 'Gewähltes Modul löschen' },
  { keys: 'Strg + D', text: 'Gewähltes Modul duplizieren' },
  { keys: 'K / G / F', text: 'Neues Kartenfach / neue Fächerbox / neue Aufleger-Box' },
  { keys: 'V', text: 'Vorlagen öffnen' },
  { keys: 'I', text: 'Insert aus Teileliste (Inventar)' },
  { keys: 'Strg + Z', text: 'Rückgängig' },
  { keys: 'Strg + Y  oder  Strg + Umschalt + Z', text: 'Wiederholen' },
  { keys: 'Strg + S', text: 'Projekt speichern (JSON)' },
  { keys: 'Strg + O', text: 'Projekt laden' },
  { keys: 'Strg + E', text: 'Alle STL als ZIP exportieren' },
  { keys: '1 / 2', text: 'Gesamtansicht / Einzelteilansicht' },
  { keys: 'B', text: 'Schachtel ein-/ausblenden' },
  { keys: '?', text: 'Diese Übersicht' },
];

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['checkbox', 'radio', 'range', 'button', 'file'].includes(type);
  }
  return tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && ['s', 'o', 'e'].includes(key)) {
        e.preventDefault();
        sendCommand(key === 's' ? 'save' : key === 'o' ? 'open' : 'export');
        return;
      }
      if (e.key === 'Escape') {
        if (st.helpOpen) st.setHelpOpen(false);
        else if (st.galleryOpen) st.setGalleryOpen(false);
        else if (st.inventoryOpen) st.setInventoryOpen(false);
        else if (isTyping(e.target)) (e.target as HTMLElement).blur();
        else st.select(null);
        return;
      }
      if (isTyping(e.target)) return;
      if (st.galleryOpen || st.inventoryOpen) return;

      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        st.redo();
        return;
      }
      const sel = st.selectedId;
      if (mod && key === 'd') {
        e.preventDefault();
        if (sel) st.duplicate(sel);
        return;
      }
      if (mod || e.altKey) return;

      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        st.setHelpOpen(!st.helpOpen);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        st.selectNext(e.shiftKey ? -1 : 1);
        return;
      }
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, 1],
        ArrowDown: [0, -1],
      };
      if (arrows[e.key] && sel) {
        e.preventDefault();
        const [dx, dy] = arrows[e.key];
        st.nudge(sel, dx, dy, e.shiftKey ? 10 : 1);
        return;
      }
      if ((e.key === 'PageUp' || e.key === 'PageDown') && sel) {
        e.preventDefault();
        st.shiftLevel(sel, e.key === 'PageUp' ? 1 : -1);
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault();
        st.removeModule(sel);
        return;
      }
      switch (key) {
        case 'r':
          if (e.shiftKey) st.rotateAll();
          else if (sel) st.rotate(sel);
          break;
        case 'a':
          if (sel) {
            const m = st.project.modules.find((x) => x.id === sel);
            if (m?.placement.mode === 'manual') st.updateModule(sel, { placement: { ...m.placement, mode: 'auto' } });
            else st.nudge(sel, 0, 0);
          }
          break;
        case 'k':
          st.addModule('cardTray');
          break;
        case 'g':
          st.addModule('gridBox');
          break;
        case 'f':
          st.addModule('shapeBox');
          break;
        case 'v':
          st.setGalleryOpen(true);
          break;
        case 'i':
          st.setInventoryOpen(true);
          break;
        case '1':
          st.setViewMode('all');
          break;
        case '2':
          st.setViewMode('single');
          break;
        case 'b':
          st.setShowBox(!st.showBox);
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Overlay mit allen Tastaturbefehlen. */
export function ShortcutHelp() {
  const open = useStore((s) => s.helpOpen);
  const setOpen = useStore((s) => s.setHelpOpen);
  if (!open) return null;
  return (
    <div className="help-backdrop" onClick={() => setOpen(false)}>
      <div className="help" role="dialog" aria-label="Tastaturbefehle" onClick={(e) => e.stopPropagation()}>
        <header className="row spread">
          <h2>Tastaturbefehle</h2>
          <button type="button" className="icon" onClick={() => setOpen(false)} aria-label="Schließen">✕</button>
        </header>
        <table>
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.keys}>
                <td><kbd>{s.keys}</kbd></td>
                <td>{s.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">Auf dem Mac gilt ⌘ statt Strg.</p>
      </div>
    </div>
  );
}
