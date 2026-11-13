# BG-Insert-Konfigurator

Parametrischer Web-Konfigurator für 3D-druckbare Brettspiel-Inserts mit direktem,
geprüft wasserdichtem STL-Export. Läuft komplett im Browser, ohne Server.

**Live-Vorschau:** https://4pw78bg2kv-del.github.io/bg-insert-konfigurator/ (nach dem ersten Deploy von `main`)

## Funktionsumfang

- **Spielschachtel:** Innenmaße, Karton-Wand/Boden (→ Außenmaße), reservierter Kopfraum, nutzbare Höhe.
- **Ebenen:** beliebig viele gestapelte Ebenen (feste Höhe oder „Auto“ = Resthöhe teilen), einzeln ein-/ausblendbar, Explosionsansicht.
- **Innenraster:** alle Module belegen ganze Rasterzellen, die die Schachtel exakt füllen. Optional eine **Grundplatte mit
  Verriegelungsrippen** (45°-Flanken, stützfrei), in die die Module mit Nuten im Boden einrasten. Die Platte wird automatisch in
  druckbare Kacheln geteilt.
- **Kartenfach:** 7 Presets oder eigene Maße, Sleeves-Kalkulator, stehend oder liegend, **Hoch-/Querformat**, **senkrecht oder schräg**
  (Neigung frei wählbar), **1- oder 2-reihig**.
  - **Feste Fächer** (mitgedruckt) oder **variable Trenner**: glatte Wände (frei verschiebbar) oder **Zackenmuster** (Trenner rasten ein).
  - Variable Trenner: **Karten und Trenner gesamt** angeben, die Länge wird automatisch berechnet. Trenner werden als eigene STL
    exportiert, optional mit **Beschriftungslasche** (auch versetzt links/Mitte/rechts).
  - **Höhe automatisch:** so hoch wie Karten plus Lasche, ohne Überstand.
  - Griffmulde (teilweise oder bis zum Boden), Griffloch im Boden.
- **Rasterbox:** freie Aufteilung (Reihen mit eigenen Spaltenanteilen, z. B. „1 2 1“), abgesenkte Trennwände,
  Griffmulden (teilweise / bis zum Boden; vorne, vorne+hinten oder links+rechts), Grifflöcher im Boden,
  **Steckdeckel mit Rastnasen** (eigene STL, mit Öffnungsmulde).
- **Layout:** automatische Anordnung, pro Modul umschaltbar auf manuelle Position (Zelle bzw. mm, Pfeiltasten, 90°-Drehung).
- **Prüfungen:** Kollisionen, Überstand, zu hohe Karten/Module/Ebenen, zu kleine Fächer.
- **3D-Vorschau:** Gesamtansicht mit transparenter Schachtel, Deckeln, Trennern und Grundplatte; Einzelteilansicht in Druckorientierung.
- **Export:** Binär-STL pro Teil oder alles als ZIP (`2x_Kartenfach_Poker_Trenner_links.stl` usw., inkl. `projekt.json`).
- **Projekt:** Speichern/Laden als JSON (alte Dateien werden übernommen), Autosave im Browser, Rückgängig/Wiederholen.

## Tastaturbefehle

| Taste | Aktion |
| --- | --- |
| Pfeiltasten (Umschalt = 10 mm) | Modul verschieben |
| R / A | 90° drehen / automatisch ↔ manuell |
| Bild ↑ / Bild ↓ | Modul eine Ebene höher / tiefer |
| Tab / Umschalt+Tab | nächstes / vorheriges Modul |
| Entf, Strg+D, Esc | löschen, duplizieren, Auswahl aufheben |
| K / G | neues Kartenfach / neue Rasterbox |
| Strg+Z / Strg+Y | rückgängig / wiederholen |
| Strg+S / Strg+O / Strg+E | speichern / laden / ZIP-Export |
| 1 / 2 / B | Gesamtansicht / Einzelteil / Schachtel ein-aus |
| ? | Übersicht aller Tastaturbefehle |

## STL-Qualität

Die Geometrie entsteht ausschließlich über Boolesche Operationen in [Manifold](https://github.com/elalish/manifold),
das garantiert geschlossene, korrekt orientierte Meshes liefert. Zusätzlich wird **jede exportierte STL wieder eingelesen und geprüft**:
jede Kante muss von genau zwei Dreiecken mit entgegengesetzter Richtung geteilt werden, keine degenerierten Dreiecke,
positives Volumen. Das Ergebnis steht in der Teileliste („✓ wasserdicht“). Die Tests (`npm test`) prüfen das für viele
Parameter-Kombinationen und importieren jede STL zusätzlich zurück in Manifold.

## Architektur

```
src/
  geometry/        Reines TypeScript, keine UI-Abhängigkeit
    types.ts       Datenmodell (Projekt, Schachtel, Module)
    cards.ts       Kartengrößen-Presets, Sleeves-Kalkulator
    dimensions.ts  Maßberechnung (gemeinsam für Geometrie, Layout, Prüfung)
    layout.ts      Automatische Anordnung
    validate.ts    Kollisions- und Plausibilitätsprüfung
    project.ts     Standardwerte, Dateinamen, JSON laden/speichern
    kernel.ts      Manifold-WASM-Initialisierung, Speicherverwaltung
    parts.ts       Stückliste (Modul, Deckel, Trenner, Grundplatten) und Vorschau-Platzierung
    parts/         Bauteile: cardTray, divider, gridBox (+ Deckel), baseplate (+ Nuten)
    build.ts       Teil → Mesh (inkl. float32-sicherer Vereinfachung)
    stl.ts         Binär-STL schreiben/lesen, Wasserdicht-Prüfung
  worker/          Web Worker: Geometrie + Export abseits des UI-Threads (mit Cache)
  state/           Zustand-Store
  ui/              React-Komponenten, 3D-Viewport (react-three-fiber)
tests/             Vitest: Geometrie/STL und Datenmodell
```

Koordinaten: X = Breite, Y = Tiefe, Z = Höhe (Druckorientierung), alle Maße in mm.
Jedes Teil wird mit Boden auf Z = 0 exportiert und kann direkt in den Slicer.

## Entwicklung

```bash
npm install
npm run dev        # Entwicklungsserver
npm test           # Tests
npm run build      # Produktions-Build nach dist/
```

## Fahrplan

1. **MVP** ✓
2. Runde 2 ✓: Innenraster mit Grundplatte, Ebenen, variable Trenner, Steckdeckel, Tastaturbefehle
3. Weitere Deckel (Schiebe-, Magnetdeckel), Stapelkanten zwischen Ebenen, Druckbett-Ansicht mit Auto-Nesting, Schnittansichten
4. Bibliothek: Token-Schalen mit Scoop, Kartenhalter, Hex-Halter, Würfelturm, Stiftehalter, Dashboards, Schubladen
5. Komfort: Waben-Aussparungen, Text-Prägung, Vertical-Storage-Clips
