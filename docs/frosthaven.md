# Spiel-Preset „Frosthaven“

Laden: **Aus Vorlage → Spiel-Presets → Frosthaven** (ersetzt das aktuelle Projekt).
Quelltext: `src/geometry/games/frosthaven.ts`.

Das Preset bildet die vorhandenen Inserts des Nutzers mit den Modulen der App nach.
Die Maße stammen aus den Original-STLs (Bounding Box, Höhenkarte von oben, Umriss der Trenner).

## Schachtel (Annahme – bitte nachmessen)

| Wert | mm | Quelle |
| --- | --- | --- |
| Außenmaß | 415 × 300 × 250 | Folded Space (Printables nennt 410 × 300 × 250) |
| Kartonstärke | 2,5 | Annahme |
| Innenmaß | 408 × 293 × 244 | abgeleitet |
| Kopfraum | 35 | Annahme für Regelbuch, Szenariobücher, Kampagnenbogen, Tableaus |
| Drucker | Bambu Lab H2D (325 × 320) | Die Gebietsaufleger-Box ist wie im Original 285 × 275 mm groß |

Kartenformate laut fitcheck.vaultx.com: 841 Standardkarten 63 × 88 mm und 1503 kleine Karten 44 × 67 mm
(in der App „Mini European 44 × 68“), jeweils mit Standard-Hüllen gerechnet.

## Vermessene Original-Teile → Module

| Original-STL | Maße (mm) | Modul im Preset |
| --- | --- | --- |
| Gebietsaufleger vollständige Version 1/2 | 285 × 275 × 15, 24 Taschen, Boden 1,2, Grifflöcher | Aufleger-Box 285 × 275 × 15, 24 Rechteck-Taschen (umschreibende Rechtecke), Bodenloch |
| Monsterbox Wache / Priester | 106,9 × 104 × 14,1 | Fächerbox 107 × 104 × 14,1, Name vorne |
| Monsterbox Späher / Wicht | 106,9 × 104 × 18,4 | Fächerbox 107 × 104 × 18,4, Stufe 2 |
| Schadensmarker, Elementmarker, Beute | 152 × 136,4 × 24,2 | Fächerbox: 2 × 3 Token-Mulden, rechts Beute (tief) und Elemente |
| Stadtwachen Angriffsdeck | 54,8 × 44,9 × 83,5 | Kartenfach klein, stehend, Bodenloch |
| Kleine Trenner (Aktiv, Inaktiv, Offen, Abgeschlossen, Gesperrt/Verfügbar …, Zufälliger Gegenstand/Szenario, Solo, Umschlag 88) | 52,2 × 82,1 × 1,2 (+0,3 Schrift), Körper 48 breit, Kopfleiste 14 mm, Griffschlitz | Hängetrenner (neu), Trennerkörper 48,1 mm |
| Große Trenner (Gebäude, Sommer/Winter Weg- und Außenposten-Ereignisse, Umschlag B = Boot-Ereignisse) | 97,8 × 82,1 × 1,2, Körper 92 breit | Hängetrenner, Trennerkörper 92,1 mm |
| Bosse Aufsteller / Wertekarten (besiegt/unbesiegt) | 108,3 × 105,5 × 1,2, Körper 102,4 breit | Kartenfach „Bosse“ (100 × 88 mm, 1,2 mm je Teil) |
| Priester, Späher, Wache Token, Wicht | 51 × 13–17 × 2,1 | nicht nachgebaut (Namensschilder; die Monsterboxen bekommen eine vertiefte Beschriftung) |

Die Trenner-Beschriftungen wurden von den Original-STLs abgelesen
(„Umschlag 88“ = Verfügbare/Gesperrte Tiere, „Umschlag B“ = Aktive/Inaktive Boot-Ereignisse).

## Aufbau in der Schachtel

- **Stufe 1:** Gebietsaufleger (links, 285 × 275), rechts daneben Monsterbox Wache und Priester,
  dahinter Stadtwachen-Angriffsdeck und Kartenfach „Szenarien und Tiere“.
- **Stufe 2:** auf den Gebietsauflegern die Kartenfächer „Ereignisse Sommer und Boot“, „Ereignisse Winter und Gebäude“,
  „Gegenstände“, „Bosse“ und die Markerbox; auf den Monsterboxen Späher und Wicht.

Oben bleibt Platz für weitere Monsterboxen, Charakterboxen und Spielmaterial.

## Schätzwerte zum Anpassen

Kartenzahlen pro Fach (Ereignisse je 140, Gegenstände 250, Szenarien/Tiere 120, Bosse 30 Teile, Angriffsdeck 20)
sind Schätzungen; die Fächer passen ihre Tiefe automatisch an.
