# BG-Insert-Konfigurator

Parametrischer Web-Konfigurator für 3D-druckbare Brettspiel-Inserts mit direktem,
geprüft wasserdichtem STL-Export. Läuft komplett im Browser, ohne Server.

**Live-Vorschau:** https://4pw78bg2kv-del.github.io/bg-insert-konfigurator/

## Funktionsumfang

- **Spielschachtel:** Innenmaße, Karton-Wand/Boden (→ Außenmaße), reservierter Kopfraum, nutzbare Höhe.
- **Drucker und Material:** Profile für Bambu Lab (H3C, H2S, H2D, X1, P2S, P1, A1, A1 mini), Prusa, Creality, Elegoo, Voron
  oder eigene Bettgröße. Teile, die nicht aufs Druckbett passen, werden als Fehler gemeldet; die Grundplatte wird automatisch
  passend geteilt. Empfohlene Wandstärken und Spaltmaße für PLA und PETG je Düse.
- **Stapelstufen statt starrer Ebenen:** Jedes Modul hat eine Stufe; höhere Stufen legen sich auf das, was darunter liegt,
  auch auf Module unterschiedlicher Höhe („Stufe 1,5“). Höhe nach Inhalt, bis zum Deckel oder frei.
- **Raster:** frei wählbares Rastermaß (z. B. 5 mm), Module werden auf ganze Felder aufgerundet; der Zuwachs geht wahlweise
  in den Innenraum oder in dickere Wände. Optional eine **Grundplatte**, deren Rippen die unterste Lage festhalten.
- **Kartenfach:** 7 Presets oder eigene Maße, Sleeves-Kalkulator, stehend oder liegend, Hoch-/Querformat, senkrecht oder schräg,
  1- oder 2-reihig, feste Fächer oder Trenner (glatt oder mit Zacken), Laschen auch versetzt.
  **Einzeln beschriftete Trenner** (erhabene Schrift), Liste per Hand oder aus CSV/Excel (erste Spalte).
  **Hängetrenner:** durchgehende Kopfleiste, die auf den Fachwänden aufliegt, mit Griffschlitz; lange Beschriftungen zweizeilig.
- **Fächerbox mit visuellem Editor:** Fächer anklicken, nebeneinander/hintereinander teilen, verbinden, Größe als Anteil, in mm
  oder passend zum Inhalt. Inhalt je Fach: leer, Token-Mulde (gerundet) oder Karten liegend/stehend, z. B. 2 Standardkarten
  liegend + 2 Minikarten stehend + 2 Token-Mulden in einer Box.
- **Aufleger-Box:** Taschen in 16 Formen (Kreis, Oval, Rechteck, Dreieck, Raute, Vieleck, Stern, Pfeil, Doppelpfeil, Kreuz,
  Herz, Blitz, Fahne, Sprechblase …) oder als **Freiform** (Umriss aus Punkten im Projekt-JSON), frei per Maus platzierbar,
  drehbar, mit **Maßzeichnung**, Griffmulden, **Beschriftung im Taschenboden** (automatisch an der breitesten Stelle) und
  **Schnellgenerator** („9 Kreise für je 8 Aufleger mit Griffmulde“).
- **Deckel:** Stülp-, Rast-, Schiebe-, Magnet- (4 Magnete, Größe wählbar) und Klappdeckel (Scharnier mit 1,75-mm-Filament).
- **Beschriftung:** Name 2 mm tief in Deckel und Seitenwände, in druckgeeigneten Schriften (Droid Sans/Serif Bold, Optimer Bold).
  Die Schrift wird zusätzlich als eigenes Teil exportiert, um sie im Slicer in einer anderen Farbe zu drucken.
- **Vorlagen-Galerie:** 14 fertige Module (Nachziehstapel, Kombi-Box, Spieler-Box, Sortierkasten mit Magnetdeckel,
  Kartenbox mit Schiebedeckel, Würfelschale, Stiftehalter, Münzen, Sechsecke, Sonderformen …).
- **Spiel-Presets:** komplette Inserts zum Laden, derzeit **Frosthaven** (lückenlos für 403 × 286 × 240 mm, mit Einräumplan,
  siehe [docs/frosthaven.md](docs/frosthaven.md)).
- **Insert aus Teileliste:** Excel-/CSV-Vorlage herunterladen, Teile mit Kategorie, Bauteilart und Anzahl eintragen, wieder
  hochladen; daraus entstehen Kartenfächer, Aufleger-Boxen und Fächerboxen, die bei Platzmangel automatisch gestapelt werden.
- **Rasterbogen A4:** Raster mit Lineal und 100-mm-Prüfstrecke zum Auslegen der Teile sowie alle Kartenformate in Originalgröße
  (mit und ohne Hülle) zum Nachmessen.
- **Layout:** automatische Anordnung, manuelle Position (Pfeiltasten), 90°-Drehung je Modul oder für die ganze Anordnung.
- **Prüfungen:** Kollisionen, Überstand, Druckbett, zu hohe Karten/Module, zu kleine Fächer, zu enge Taschen, Schriftgröße.
  **Lückenprüfung:** Füllgrad der Schachtel, Warnung bei Modulen, die mehr als 3 mm verrutschen können, Hinweis bei Luft nach oben.
- **Export:** Binär-STL pro Teil oder alles als ZIP inkl. `projekt.json`, **Einräumanleitung (HTML)** und
  **Explosionszeichnung (SVG)** mit nummerierter Reihenfolge.
- **Projekt:** Speichern/Laden als JSON (Dateien aus früheren Versionen werden übernommen), Autosave, Rückgängig/Wiederholen.

## Tastaturbefehle

| Taste | Aktion |
| --- | --- |
| Pfeiltasten (Umschalt = 10 mm) | Modul verschieben |
| R / Umschalt+R | Modul / ganze Anordnung um 90° drehen |
| A | automatisch ↔ manuell |
| Bild ↑ / Bild ↓ | Modul eine Stapelstufe höher / tiefer |
| Tab / Umschalt+Tab | nächstes / vorheriges Modul |
| Entf, Strg+D, Esc | löschen, duplizieren, Auswahl aufheben |
| K / G / F | neues Kartenfach / Fächerbox / Aufleger-Box |
| V / I | Vorlagen / Insert aus Teileliste |
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
    printers.ts    Druckerprofile, Druckbett-Prüfung
    shapes.ts      Formen der Aufleger-Box (Umrisse, Maßlinien)
    text.ts        Schriften (typeface.json, Latin-1) → Umrisse
    templates.ts   Vorlagen-Galerie
    games/         Spiel-Presets (komplette Projekte, z. B. frosthaven.ts)
    inventory.ts   Teileliste: Vorlage (XLSX/CSV), Import, automatisches Insert
    assembly.ts    Einräumanleitung und Explosionszeichnung (SVG)
    sheets.ts      Rasterbogen A4 und Kartenformate 1:1
    parts.ts       Stückliste (Modul, Schrift, Deckel, Trenner, Grundplatten) und Vorschau-Platzierung
    parts/         Bauteile: cardTray, gridBox, shapeBox, lids, divider, baseplate, common (Deckelaufnahmen, Schrift)
    fonts/         Schriften mit Lizenzen
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
3. Runde 3 ✓: Deckelarten, Stapelstufen, Fächer-Editor, Aufleger-Box, Beschriftung, Vorlagen, Teileliste-Import, Druckbett, Einräumanleitung
4. Ideen: Druckbett-Ansicht mit Auto-Nesting, Schnittansicht, Würfelturm, Spielertableau-Halter, Schubladen, Waben-Aussparungen
