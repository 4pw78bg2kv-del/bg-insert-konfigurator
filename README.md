# BG-Insert-Konfigurator

Parametrischer Web-Konfigurator für 3D-druckbare Brettspiel-Inserts mit direktem,
geprüft wasserdichtem STL-Export. Läuft komplett im Browser, ohne Server.

**Live-Vorschau:** https://4pw78bg2kv-del.github.io/bg-insert-konfigurator/ (nach dem ersten Deploy von `main`)

## Funktionsumfang (Meilenstein 1 – MVP)

- **Spielschachtel:** Innenmaße, Karton-Wand/Boden (→ Außenmaße), reservierter Kopfraum, nutzbare Ebenenhöhe.
- **Kartenfach:** Presets (Poker, Standard American, Mini European, Mini American, Standard European, Tarot, Square) oder eigene Maße,
  Sleeves-Kalkulator (ohne / Standard / Premium) für Breite, Höhe und Stapeldicke, feste Fächer, stehend oder liegend, Griffmulde.
- **Rasterbox:** Spalten × Reihen, optional abgesenkte Trennwände.
- **Layout:** automatische Anordnung (Reihenfolge der Modulliste), pro Modul umschaltbar auf manuelle Position
  (Zahleneingabe, Pfeil-Buttons mit 0,5/1/5/10 mm, 90°-Drehung). Automatische Module weichen fixierten aus.
- **Prüfungen:** Kollisionen, Überstand über die Schachtel, zu hohe Karten/Module, zu kleine Fächer.
- **3D-Vorschau:** Gesamtansicht mit transparenter Schachtel und Kopfraum-Ebene, Einzelteilansicht, Klick zum Auswählen.
- **Globale Druckparameter:** Spaltmaß (Standard 0,2 mm), Wand-, Boden- und Trennwandstärke.
- **Export:** Binär-STL pro Teil oder alle Teile als ZIP (`2x_Kartenfach_Poker.stl` usw., inkl. `projekt.json`).
- **Projekt:** Speichern/Laden als JSON, automatische Zwischenspeicherung im Browser.

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
    parts/         Ein Modul pro Bauteil-Typ (cardTray, gridBox)
    build.ts       Modul → Mesh
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

1. **MVP** (dieser Stand)
2. Deckel (Schiebe-, Magnet-, Stülpdeckel), Fingermulden im Boden, 45°-Fasen, Magnet-Stückliste
3. Mehrere Ebenen mit Stapelkanten, Druckbett-Ansicht mit Auto-Nesting, Schnittansichten
4. Bibliothek: Token-Schalen mit Scoop, Kartenhalter, Hex-Halter, Würfelturm, Stiftehalter, Dashboards, Schubladen
5. Komfort: Waben-Aussparungen, Text-Prägung, Vertical-Storage-Clips
