/**
 * Inventar-Import: Aus einer Tabelle (Kategorie, Bauteilart, Anzahl, Maße)
 * wird automatisch ein Insert-Vorschlag erzeugt – Kartenfächer für Karten,
 * Aufleger-Boxen für Plättchen und Münzen, Fächerboxen mit Mulden für
 * Kleinteile. Danach werden die Module so gestapelt, dass möglichst alles in
 * die Schachtel passt.
 *
 * Außerdem: Einlesen von CSV/TSV/Text und Excel (.xlsx, ohne Fremdbibliothek)
 * und Erzeugen der Excel-Vorlage.
 */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { CARD_PRESETS, effectiveCard } from './cards';
import { usableHeight } from './dimensions';
import { computeLayout } from './layout';
import { arrangePockets, createCardTray, createGridBox, createPocket, createShapeBox, leaf, split, DEFAULT_CARD } from './project';
import type { CardPresetId, CellNode, InsertModule, Pocket, Project } from './types';

// ---------------------------------------------------------------------------
// Bauteilarten

export type PartCategory = 'card' | 'tile' | 'bulk';

export interface PartType {
  label: string;
  kind: PartCategory;
  card?: CardPresetId | 'custom';
  shape?: 'round' | 'rect' | 'hex';
  /** Standardmaße (Breite/Länge/Dicke), falls nicht angegeben. */
  w: number;
  l: number;
  t: number;
}

export const PART_TYPES: readonly PartType[] = [
  ...CARD_PRESETS.map((c) => ({ label: `Karte ${c.label.split(' (')[0]}`, kind: 'card' as const, card: c.id, w: c.width, l: c.height, t: 0.32 })),
  { label: 'Karte eigene Maße', kind: 'card', card: 'custom', w: 60, l: 90, t: 0.32 },
  { label: 'Plättchen rund', kind: 'tile', shape: 'round', w: 25, l: 25, t: 2 },
  { label: 'Plättchen eckig', kind: 'tile', shape: 'rect', w: 30, l: 30, t: 2 },
  { label: 'Plättchen sechseckig', kind: 'tile', shape: 'hex', w: 34.6, l: 30, t: 2 },
  { label: 'Münze / Chip', kind: 'tile', shape: 'round', w: 25, l: 25, t: 2.5 },
  { label: 'Würfel', kind: 'bulk', w: 16, l: 16, t: 16 },
  { label: 'Holzwürfel / Ressource', kind: 'bulk', w: 8, l: 8, t: 8 },
  { label: 'Meeple / Figur', kind: 'bulk', w: 16, l: 16, t: 10 },
  { label: 'Token / Marker', kind: 'bulk', w: 15, l: 15, t: 4 },
  { label: 'Sonstiges Kleinteil', kind: 'bulk', w: 15, l: 15, t: 8 },
];

export function findPartType(text: string): PartType | undefined {
  const t = text.trim().toLowerCase();
  if (!t) return undefined;
  return (
    PART_TYPES.find((p) => p.label.toLowerCase() === t) ??
    PART_TYPES.find((p) => t.includes(p.label.toLowerCase()) || p.label.toLowerCase().includes(t)) ??
    (t.includes('karte') ? PART_TYPES.find((p) => p.card === 'poker') : undefined) ??
    (t.includes('würfel') ? PART_TYPES.find((p) => p.label === 'Würfel') : undefined) ??
    (t.includes('münze') || t.includes('chip') ? PART_TYPES.find((p) => p.label.startsWith('Münze')) : undefined)
  );
}

export interface InventoryRow {
  category: string;
  type: string;
  count: number;
  width?: number;
  length?: number;
  thickness?: number;
  note: string;
}

// ---------------------------------------------------------------------------
// Tabellen einlesen

/** Zerlegt CSV/TSV/Text in Zeilen und Zellen (Trennzeichen wird erkannt). */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const first = clean.split('\n')[0] ?? '';
  const delim = first.includes('\t') ? '\t' : (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) && first.includes(';') ? ';' : first.includes(',') ? ',' : '\t';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

const decodeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');

function colIndex(ref: string): number {
  const letters = ref.replace(/[0-9]/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Liest das erste Tabellenblatt einer .xlsx-Datei. */
export function parseXlsx(data: Uint8Array): string[][] {
  const files = unzipSync(data);
  const text = (name: string) => (files[name] ? strFromU8(files[name]) : '');
  const shared: string[] = [];
  const ss = text('xl/sharedStrings.xml');
  for (const si of ss.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    shared.push(decodeXml((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join('')));
  }
  // Erstes Blatt laut Workbook (Fallback sheet1)
  const sheetName = Object.keys(files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0] ?? 'xl/worksheets/sheet1.xml';
  const sheet = text(sheetName);
  const rows: string[][] = [];
  for (const rowXml of sheet.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? []) {
    const row: string[] = [];
    for (const c of rowXml.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) ?? []) {
      const ref = c.match(/r="([A-Z]+)\d+"/)?.[1] ?? 'A';
      const type = c.match(/t="([^"]+)"/)?.[1];
      let v = '';
      if (type === 's') v = shared[Number(c.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? -1)] ?? '';
      else if (type === 'inlineStr') v = decodeXml((c.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join(''));
      else v = decodeXml(c.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '');
      row[colIndex(ref)] = v.trim();
    }
    rows.push(Array.from(row, (x) => x ?? ''));
  }
  return rows.filter((r) => r.some((c) => c !== ''));
}

/** Liest eine Tabellendatei (xlsx, csv, tsv, txt). */
export function parseTableFile(name: string, data: Uint8Array): string[][] {
  if (/\.xlsx$/i.test(name) || (data[0] === 0x50 && data[1] === 0x4b)) return parseXlsx(data);
  return parseDelimited(new TextDecoder('utf-8').decode(data));
}

/** Erste Spalte als Liste (für Trennerbeschriftungen); eine Kopfzeile „Name/Beschriftung“ wird übersprungen. */
export function firstColumn(rows: string[][]): string[] {
  const list = rows.map((r) => (r[0] ?? '').trim()).filter((s) => s !== '');
  if (list.length > 1 && /^(name|beschriftung|text|trenner|kategorie|titel)$/i.test(list[0])) list.shift();
  return list;
}

const toNum = (s: string | undefined): number | undefined => {
  if (!s) return undefined;
  const n = Number(s.replace(',', '.').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Wandelt Tabellenzeilen der Inventar-Vorlage in Datensätze. */
export function parseInventory(rows: string[][]): InventoryRow[] {
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.toLowerCase());
  const hasHeader = header.some((h) => h.includes('kategorie') || h.includes('anzahl') || h.includes('bauteil'));
  const find = (...keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  const idx = hasHeader
    ? {
        cat: find('kategorie', 'gruppe'),
        type: find('bauteil', 'art', 'typ'),
        count: find('anzahl', 'menge', 'stück'),
        w: find('breite', 'durchmesser'),
        l: find('länge', 'laenge', 'höhe', 'hoehe'),
        t: find('dicke', 'stärke'),
        note: find('bemerkung', 'name', 'beschriftung', 'notiz'),
      }
    : { cat: 0, type: 1, count: 2, w: 3, l: 4, t: 5, note: 6 };
  const body = hasHeader ? rows.slice(1) : rows;
  return body
    .map((r) => ({
      category: (r[idx.cat] ?? '').trim() || 'Allgemein',
      type: (r[idx.type] ?? '').trim(),
      count: Math.round(toNum(r[idx.count]) ?? 0),
      width: toNum(r[idx.w]),
      length: toNum(r[idx.l]),
      thickness: toNum(r[idx.t]),
      note: (r[idx.note] ?? '').trim(),
    }))
    .filter((r) => r.count > 0 && r.type !== '');
}

// ---------------------------------------------------------------------------
// Vorlage

const TEMPLATE_HEADER = ['Kategorie', 'Bauteilart', 'Anzahl', 'Breite / Ø (mm)', 'Länge (mm)', 'Dicke (mm)', 'Bemerkung'];
const TEMPLATE_EXAMPLES: string[][] = [
  ['Aktionskarten', 'Karte Poker', '90', '', '', '', 'Grundspiel'],
  ['Aktionskarten', 'Karte Poker', '30', '', '', '', 'Erweiterung'],
  ['Ereignisse', 'Karte Mini European', '40', '', '', '', ''],
  ['Geld', 'Münze / Chip', '40', '25', '', '2,5', ''],
  ['Landschaften', 'Plättchen sechseckig', '24', '34,6', '30', '2', ''],
  ['Spieler Rot', 'Meeple / Figur', '8', '', '', '', ''],
  ['Spieler Rot', 'Holzwürfel / Ressource', '20', '', '', '', ''],
  ['Ressourcen', 'Holzwürfel / Ressource', '60', '10', '10', '10', 'Holz'],
  ['Ressourcen', 'Holzwürfel / Ressource', '60', '10', '10', '10', 'Stein'],
  ['Würfel', 'Würfel', '6', '16', '', '', ''],
];

export function inventoryTemplateCsv(): string {
  const q = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return '﻿' + [TEMPLATE_HEADER, ...TEMPLATE_EXAMPLES].map((r) => r.map(q).join(';')).join('\r\n') + '\r\n';
}

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function colName(i: number): string {
  let s = '';
  i++;
  while (i > 0) {
    const m = (i - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

function sheetXml(rows: string[][], opts: { widths?: number[]; validation?: string; numeric?: number[]; boldFirst?: boolean } = {}): string {
  const cells = rows
    .map((r, ri) => {
      const cs = r
        .map((v, ci) => {
          const ref = `${colName(ci)}${ri + 1}`;
          const style = opts.boldFirst && ri === 0 ? ' s="1"' : '';
          const n = Number(v.replace(',', '.'));
          if (ri > 0 && opts.numeric?.includes(ci) && v !== '' && Number.isFinite(n)) return `<c r="${ref}"${style}><v>${n}</v></c>`;
          if (v === '') return '';
          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
        })
        .join('');
      return `<row r="${ri + 1}">${cs}</row>`;
    })
    .join('');
  const cols = opts.widths ? `<cols>${opts.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const pane = opts.boldFirst ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${pane}${cols}<sheetData>${cells}</sheetData>${opts.validation ?? ''}</worksheet>`;
}

/** Excel-Vorlage mit Auswahlliste für die Bauteilart. */
export function inventoryTemplateXlsx(): Uint8Array {
  const types = PART_TYPES.map((t) => [t.label]);
  const validation = `<dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Bauteilart" error="Bitte eine Bauteilart aus der Liste wählen." sqref="B2:B1000"><formula1>Listen!$A$1:$A$${types.length}</formula1></dataValidation></dataValidations>`;
  const hints = [
    ['So funktioniert die Vorlage'],
    ['1. Im Blatt „Inventar“ je Zeile eine Teilesorte eintragen: Kategorie, Bauteilart (Auswahlliste), Anzahl.'],
    ['2. Maße sind optional – ohne Angabe werden übliche Werte verwendet (z. B. Würfel 16 mm).'],
    ['3. Gleiche Kategorie = gemeinsame Box. Bei Karten wird jede Zeile ein eigenes, beschriftetes Trennerfach (Bemerkung = Beschriftung).'],
    ['4. Datei speichern (als .xlsx oder als CSV) und im Konfigurator unter „Inventar importieren“ laden.'],
  ];
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Inventar" sheetId="1" r:id="rId1"/><sheet name="Listen" sheetId="2" r:id="rId2"/><sheet name="Hinweise" sheetId="3" r:id="rId3"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    ),
    'xl/styles.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(sheetXml([TEMPLATE_HEADER, ...TEMPLATE_EXAMPLES], { widths: [18, 26, 9, 15, 12, 11, 24], validation, numeric: [2, 3, 4, 5], boldFirst: true })),
    'xl/worksheets/sheet2.xml': strToU8(sheetXml(types, { widths: [30] })),
    'xl/worksheets/sheet3.xml': strToU8(sheetXml(hints, { widths: [110] })),
  };
  return zipSync(files, { level: 6 });
}

// ---------------------------------------------------------------------------
// Vorschlag erzeugen

/** Grobes Schüttvolumen pro Stück in mm³ (inkl. Luft zwischen den Teilen). */
function bulkVolume(r: InventoryRow, t: PartType): number {
  const w = r.width ?? t.w;
  const l = r.length ?? r.width ?? t.l;
  const h = r.thickness ?? (t.label === 'Würfel' ? w : t.t);
  return w * l * h * 1.7;
}

function presetFor(r: InventoryRow, t: PartType) {
  if (t.card && t.card !== 'custom') return { cardPreset: t.card, customCardWidth: DEFAULT_CARD.customCardWidth, customCardHeight: DEFAULT_CARD.customCardHeight };
  return { cardPreset: 'custom' as const, customCardWidth: r.width ?? t.w, customCardHeight: r.length ?? t.l };
}

export interface InventoryResult {
  modules: InsertModule[];
  notes: string[];
}

export function inventoryToModules(rows: InventoryRow[], p: Project): InventoryResult {
  const notes: string[] = [];
  const modules: InsertModule[] = [];
  const usable = usableHeight(p.box);
  const cats = [...new Set(rows.map((r) => r.category))];

  for (const cat of cats) {
    const items = rows.filter((r) => r.category === cat).map((r) => ({ r, t: findPartType(r.type) }));
    for (const it of items) if (!it.t) notes.push(`„${it.r.type}“ (${cat}) ist unbekannt und wurde als Kleinteil behandelt.`);
    const typed = items.map(({ r, t }) => ({ r, t: t ?? PART_TYPES.find((x) => x.label === 'Sonstiges Kleinteil')! }));

    // Karten: je Kartengröße ein Kartenfach, jede Zeile ein beschriftetes Trennerfach
    const cards = typed.filter((x) => x.t.kind === 'card');
    const bySize = new Map<string, typeof cards>();
    for (const c of cards) {
      const pr = presetFor(c.r, c.t);
      const key = `${pr.cardPreset}:${pr.customCardWidth}:${pr.customCardHeight}`;
      bySize.set(key, [...(bySize.get(key) ?? []), c]);
    }
    for (const group of bySize.values()) {
      const pr = presetFor(group[0].r, group[0].t);
      const total = group.reduce((s, g) => s + g.r.count, 0);
      const labels = group.length > 1 ? group.map((g, i) => g.r.note || `${cat} ${i + 1}`) : [];
      const tray = createCardTray({
        name: `${cat}${bySize.size > 1 ? ` ${group[0].t.label.replace('Karte ', '')}` : ''}`,
        ...pr,
        cardThickness: group[0].r.thickness ?? 0.32,
        totalCards: total,
        dividerCount: labels.length ? labels.length : Math.min(6, Math.max(0, Math.round(total / 40))),
        dividerLabels: labels,
        tab: true,
        rows: total > 240 ? 2 : 1,
      });
      const card = effectiveCard(tray);
      // Stehend passt nicht unter den Deckel → liegend
      if (Math.min(card.width, card.height) + tray.tabHeight + 6 > usable) {
        tray.orientation = 'flat';
        tray.format = 'portrait';
        tray.slots = Math.min(3, Math.max(1, group.length));
        tray.cardsPerSlot = Math.ceil(total / tray.slots);
        tray.dividerLabels = [];
        notes.push(`${cat}: Karten liegen flach, weil sie stehend nicht unter den Deckel passen.`);
      }
      modules.push(tray);
    }

    // Plättchen und Münzen: eine Aufleger-Box je Kategorie
    const tiles = typed.filter((x) => x.t.kind === 'tile');
    if (tiles.length) {
      const pockets: Pocket[] = [];
      for (const { r, t } of tiles) {
        const w = r.width ?? t.w;
        const l = t.shape === 'round' ? w : (r.length ?? t.l);
        const th = r.thickness ?? t.t;
        const maxStack = Math.max(1, Math.floor(Math.min(30, usable - 8) / th));
        const stacks = Math.ceil(r.count / maxStack);
        for (let i = 0; i < stacks; i++) {
          const count = Math.min(maxStack, r.count - i * maxStack);
          const shape = t.shape === 'round' ? 'ellipse' : t.shape === 'hex' ? 'polygon' : 'roundRect';
          pockets.push(createPocket(shape, w, l, shape === 'polygon' ? { sides: 6 } : shape === 'roundRect' ? { r: 1 } : {}, { count, thickness: th, grip: 'one' }));
        }
      }
      modules.push(createShapeBox({ name: `${cat}${cards.length || typed.some((x) => x.t.kind === 'bulk') ? ' Plättchen' : ''}`, pockets: arrangePockets(pockets, Math.ceil(Math.sqrt(pockets.length * 1.4))), label: { text: cat, onLid: true, sides: 'none', size: 0 } }));
    }

    // Kleinteile: Fächerbox mit Mulden, ein Fach je Zeile, Größe nach Volumen
    const bulk = typed.filter((x) => x.t.kind === 'bulk');
    if (bulk.length) {
      const hEff = 22;
      const areas = bulk.map(({ r, t }) => Math.max(18 * 18, (bulkVolume(r, t) * r.count) / hEff));
      const totalA = areas.reduce((s, a) => s + a, 0);
      const depth = Math.min(110, Math.max(40, Math.sqrt(totalA / Math.max(1, Math.ceil(bulk.length / 3)))));
      const wall = p.print.wallThickness;
      const div = p.print.dividerThickness;
      // In Reihen zu höchstens 3 Fächern aufteilen
      const perRow = bulk.length <= 3 ? bulk.length : Math.ceil(bulk.length / Math.ceil(bulk.length / 3));
      const rowsList: number[][] = [];
      for (let i = 0; i < bulk.length; i += perRow) rowsList.push(areas.slice(i, i + perRow));
      const rowWidths = rowsList.map((ra) => ra.reduce((s, a) => s + Math.max(18, a / depth), 0) + (ra.length - 1) * div);
      const width = Math.max(...rowWidths) + 2 * wall;
      const rowNodes: CellNode[] = rowsList.map((ra) => (ra.length === 1 ? leaf({ type: 'scoop', sides: 'front' }) : split('x', ra.map((a) => leaf({ type: 'scoop', sides: 'front' }, Math.max(18, a / depth))))));
      const root = rowNodes.length === 1 ? rowNodes[0] : split('y', rowNodes);
      modules.push(
        createGridBox({
          name: `${cat}${cards.length || tiles.length ? ' Kleinteile' : ''}`,
          sizeMode: 'manual',
          width,
          depth: depth * rowsList.length + (rowsList.length - 1) * div + 2 * wall,
          root,
          lid: 'snap',
          heightMode: 'custom',
          customHeight: Math.min(usable, hEff + p.print.floorThickness + 8),
          label: { text: cat, onLid: true, sides: 'frontBack', size: 0 },
        }),
      );
    }
  }
  return { modules, notes };
}

/**
 * Stapelt die Module so, dass möglichst alles in die Schachtel passt:
 * Was auf Stufe 1 keinen Platz findet, wandert (kleinste zuerst) eine Stufe höher.
 */
export function optimizeStacking(p: Project, maxLevels = 3): Project {
  let proj = { ...p, modules: p.modules.map((m) => ({ ...m, level: 1, placement: { ...m.placement, mode: 'auto' as const } })) };
  for (let iter = 0; iter < p.modules.length * maxLevels; iter++) {
    const layout = computeLayout(proj);
    const bad = layout.filter((i) => i.y >= proj.box.innerDepth || i.x + i.width > proj.box.innerWidth + 0.01);
    if (bad.length === 0) break;
    const area = (id: string) => {
      const i = layout.find((x) => x.moduleId === id);
      return i ? i.width * i.depth : 0;
    };
    const candidates = [...new Set(bad.map((b) => b.moduleId))].map((id) => proj.modules.find((m) => m.id === id)!).filter((m) => m.level < maxLevels);
    if (candidates.length === 0) break;
    candidates.sort((a, b) => area(a.id) - area(b.id));
    const move = candidates[0];
    proj = { ...proj, modules: proj.modules.map((m) => (m.id === move.id ? { ...m, level: m.level + 1 } : m)) };
  }
  return proj;
}
