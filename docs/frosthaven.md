# Spiel-Preset „Frosthaven“

Laden: **Aus Vorlage → Spiel-Presets → Frosthaven** (ersetzt das aktuelle Projekt).
Quelltext: `src/geometry/games/frosthaven.ts`, Taschenumrisse der Gebietsaufleger in
`src/geometry/games/frosthavenOverlays.ts`.

**Alles außer den Kartenteilen (Map Tiles) liegt im Insert.** Regelbuch, Szenario-, Abschnitts- und
Rätselbuch, Spielplan, Kampagnenblock und Bögen liegen obenauf im Kopfraum.

Ergebnis der App-eigenen Prüfung: **Füllgrad 99 %**, keine Kollisionen, **kein Modul hat mehr als 3 mm Spiel**
(größte Lücke 2,9 mm rechts neben den Bossen), und jeder Stapel endet bündig unter dem Kopfraum. Beim Transport
kann also nichts rutschen oder springen.

## Schachtel und Drucker

| Wert | mm | Quelle |
| --- | --- | --- |
| Innenmaß | 403 × 286 × 240 | vom Nutzer gemessen |
| Kopfraum | 50 | **Schätzung** für Bücher, Spielplan und Bögen – bei Bedarf anpassen |
| Nutzbare Höhe | 190 | Innenhöhe − Kopfraum |
| Spaltmaß | 0,2 zwischen Modulen, 0,1 zur Schachtelwand | Druckprofil |
| Drucker | Bambu Lab H2D (325 × 320 × 325) | größte Teile: Aufleger-Schalen 293,8 × 285,8 × 15, Charakterbox-Halter 293,8 × 126,8 × 160 |

Karten: kleine Karten 44 × 68 mm, Standardkarten 63,5 × 88 mm, jeweils mit Standard-Hülle
(46,5 × 71,5 bzw. 66 × 91,5 mm) und 0,44 mm je Karte samt Hülle gerechnet.

## Was wohin kommt

| Inhalt | Menge | Modul | Platz |
| --- | --- | --- | --- |
| Charakterboxen 153 × 122 × 17 mm | 17 | **Charakterboxen** (Halter, Schachteln hochkant, Breitseite nach vorne) | 17 |
| Miniaturen-Schachteln 30 × 29 × 55 mm | 14 | **Miniaturen A** (12 Fächer) und **Miniaturen B** (6 Fächer) | 18 |
| Miniaturen-Schachteln „4x“ 51 × 29 × 55 mm | 4 | **Miniaturen A** (4 lange Fächer) | 4 |
| Monster: Wertekarte 103 × 103 mm, Aufsteller, Fähigkeitskarten | 2 Monsterarten je Box | **Monster 01–22** (Innenraum 104 × 104, zwei Fächer 51,4 × 104, Trennwand 5 mm abgesenkt, Griffmulden links/rechts, Name vorne) | 44 Monsterarten |
| Gebietsaufleger (Overlay-Plättchen) | 46 Sorten | **Gebietsaufleger 1** (24 Taschen) und **2** (22 Taschen), Taschenumriss und Beschriftung wie im Original | je 6 Plättchen à 2,2 mm |
| Sommer-, Boot-Ereignisse | 6 Trenner | **Ereignisse Sommer und Boot** (Standardkarten quer) | 213 Karten |
| Winter-Ereignisse, Gebäude | 6 Trenner | **Ereignisse Winter und Gebäude** | 213 Karten |
| Szenarien, Tiere | 7 Trenner | **Kampagne Szenarien und Tiere** (kleine Karten) | 209 Karten |
| Kampfziele, persönliche Ziele, Herausforderungen, zufällige Räume und Aufbauten | 5 Trenner | **Ziele und Herausforderungen** | 216 Karten |
| Gegenstände kaufen / herstellen | 4 Trenner | **Gegenstände kaufen und herstellen** | 310 Karten |
| Pläne, zufälliger Gegenstand, Solo-Gegenstände | 4 Trenner | **Gegenstände Pläne** | 310 Karten |
| Boss-Aufsteller und -Wertekarten | 4 Trenner | **Bosse** (Trenner 102,4 mm breit wie im Original) | 59 Teile à 1 mm |
| Angriffsmodifikator- und Beutedecks | 8 × 20 + 59 Karten | **Kartendecks** (je Deck ein Fach, Trennwände abgesenkt) | 9 Decks |
| Stadtwachen-Deck und Standfüße | 55 Karten | **Standfüße und Stadtwache** (Kartenfach + 4 Mulden) | |
| Schadens-, Zustands- und sonstige Marker | | **Marker** (8 Mulden) | |
| Elementmarker und Szenario-Marker | | **Elemente und Szenario-Marker** (4 Mulden) | |

Die Kartenfächer sind so lang, dass sie ihren Platz genau ausfüllen; die Kapazität liegt deshalb über der
Kartenzahl des Grundspiels, der Rest ist Platz für Nachschub und Hüllen.

## Einräumplan

Draufsicht, vorne = unten. Links ein 293,8 mm breiter Block, rechts eine 107,2 mm breite Spalte.

```
 hinten
┌───────────────────────────────────────────────┬──────────────────┐
│ Gegenstände kaufen  │ Gegenstände Pläne       │ Bosse            │
│ (quer)              │ (quer)                  │ → Miniaturen B   │
│ → Standfüße und Stadtwache (darüber, quer)    │ → Elemente       │
├───────────┬───────────┬──────────┬────────────┼──────────────────┤
│ Ereign.   │ Ereign.   │ Kampagne │ Ziele      │                  │
│ Sommer    │ Winter    │          │            │ Monster 12–22    │
│ → Miniaturen A        │ → Kartendecks         │ (Turm, 11 Boxen) │
│ → Marker              │                       │                  │
├───────────┴───────────┴──────────┴────────────┼──────────────────┤
│                                               │                  │
│ Charakterboxen (17 Schachteln hochkant)       │ Monster 01–11    │
│                                               │ (Turm, 11 Boxen) │
└───────────────────────────────────────────────┴──────────────────┘
 vorne                       unter dem linken Block: Gebietsaufleger 1 und 2
```

Höhen von unten nach oben (z in mm, Oberkante 190 = Unterkante Kopfraum):

| Bereich | Stapel |
| --- | --- |
| Links, ganz unten | Gebietsaufleger 1 (0–15), Gebietsaufleger 2 (15–30) |
| Links vorne | Charakterboxen (30–190) |
| Links Mitte, Ereignisse | Ereignisse Sommer / Winter (30–112,2) → Miniaturen A (112,2–168,4) → Marker (168,4–190) |
| Links Mitte, kleine Karten | Kampagne / Ziele (30–117,2) → Kartendecks (117,2–190) |
| Links hinten | Gegenstände kaufen / Pläne (30–117,2) → Standfüße und Stadtwache (117,2–190) |
| Rechts vorne und Mitte | je 11 Monsterboxen à 17,2 mm, die oberste 18 mm (0–190) |
| Rechts hinten | Bosse (0–104,2) → Miniaturen B (104,2–160,4) → Elemente und Szenario-Marker (160,4–190) |

Einräumen in dieser Reihenfolge: Gebietsaufleger 1 und 2, dann die Kartenfächer und der Charakterbox-Halter
darauf, dann die oberen Boxen (Miniaturen A, Marker, Kartendecks, Standfüße). Die rechte Spalte (Monstertürme,
Bosse) ist unabhängig vom linken Block. Der ZIP-Export enthält zusätzlich eine Einräumanleitung (HTML) und eine
Explosionszeichnung (SVG).

## Module

| Modul | Typ | Außenmaß (mm) | Stufe |
| --- | --- | --- | --- |
| Gebietsaufleger 1 / 2 | Aufleger-Box, 24 / 22 Freiform-Taschen | 293,8 × 285,8 × 15 | 1 / 2 |
| Charakterboxen | Kartenfach, gedreht | 293,8 × 126,8 × 160 | 3 |
| Ereignisse Sommer und Boot / Winter und Gebäude | Kartenfach, Hängetrenner | 95,7 × 106,9 × 82,2 | 3 |
| Kampagne Szenarien und Tiere / Ziele und Herausforderungen | Kartenfach, Hängetrenner | 50,9 × 106,9 × 87,2 | 3 |
| Gegenstände kaufen und herstellen / Pläne | Kartenfach, Hängetrenner, gedreht | 146,8 × 50,9 × 87,2 | 3 |
| Miniaturen A | Fächerbox, 16 Fächer | 191,6 × 107,2 × 56,2 | 4 |
| Marker | Fächerbox, 8 Mulden | 191,6 × 107,2 × 21,6 | 5 |
| Kartendecks | Fächerbox, 9 Kartenfächer | 102 × 107,2 × 72,8 | 4 |
| Standfüße und Stadtwache | Fächerbox, gedreht | 293,8 × 50,9 × 72,8 | 4 |
| Monster 01–22 | Fächerbox, 2 Fächer | 107,2 × 107,2 × 17,2 (oberste 18) | 1–11 |
| Bosse | Kartenfach, Hängetrenner | 106 × 71 × 104,2 | 1 |
| Miniaturen B | Fächerbox, 6 Fächer | 107,2 × 71 × 56,2 | 2 |
| Elemente und Szenario-Marker | Fächerbox, 4 Mulden | 107,2 × 71 × 29,6 | 3 |

Die Trenner-Beschriftungen stammen aus den Original-Inserts des Nutzers.

## Gebietsaufleger: Taschen wie im Original

Die Taschenumrisse wurden aus den Original-STLs („Gebietsaufleger vollständige Version 1/2“) übernommen:
Höhenkarte von oben (0,5 mm Raster), Konturen der Taschen einschließlich der Griffmulden am Rand, geglättet
und um 0,2 mm Spiel verkleinert. Jede Tasche trägt die Beschriftung des Originals (z. B. „5× Sarkophag“),
jetzt 0,6 mm tief in den Taschenboden graviert statt erhaben. Die Schalen sind 293,8 × 285,8 mm statt
285 × 275 mm groß, damit sie den linken Block lückenlos ausfüllen; die Taschen sitzen mittig.

## Schätzwerte zum Anpassen

- **Kopfraum 50 mm** für Bücher und Bögen: bei mehr oder weniger Material den Kopfraum ändern; die Monstertürme,
  der Charakterbox-Halter und alle Boxen mit „bis Deckel“ passen sich an.
- **Kartenzahlen** (z. B. 8 Angriffsmodifikator-Decks à 20 Karten, Beutedeck 59, Stadtwache 55) stammen aus einer
  nicht geprüften Liste.
- **Bosse:** Kartenmaß 100 × 88 mm angenommen (die Original-Trenner sind 102,4 mm breit).
- **Monsterboxen** heißen „Monster 01–22“ und sind alle 17,2 mm hoch. Die Namen bitte durch die Monsterarten
  ersetzen (Feld „Name“ der Box; die Beschriftung vorne folgt automatisch).
- **Miniaturen:** 18 kleine und 4 große Fächer für 14 kleine und 4 große Schachteln; 4 kleine Fächer bleiben frei.
