# Raubfisch-Assistent Temmels

Eine installierbare Offline-Web-App für das Uferangeln an der Mosel bei Temmels.

## Funktionen

- Filter für vier Fischarten (Barsch, Zander, Hecht, Rapfen), Wassertrübung, Licht/Wetter, Strömung und Rig.
- Bis zu drei Empfehlungen aus 18 Kombinationen, mit Köder, Haken, Startgewicht, Führung und einer Materialliste. Hecht benötigt immer ein bissfestes Stahlvorfach.
- Köder, Schnüre, Vorfächer, Snaps, Stopper, Perlen, Wirbel, Gewichte und Haken werden mengenbasiert im lokalen Bestand geführt. Direktkäufe erhöhen den Bestand sofort; Online-Bestellungen erst nach der Lieferbestätigung. Fehlende Teile stehen direkt in jeder Empfehlung.
- Offline-Nutzung nach dem ersten vollständigen Laden über einen Service Worker.
- Shop-Links und vier **historische** CAMO-Preise mit Prüfdatum 27.09.2026. Es findet keine automatische Preisaktualisierung statt.
- Bei jedem Öffnen mit Internet werden die aktuell veröffentlichten Daten geladen. Neue Marktangebote werden redaktionell recherchiert und nach Prüfung in den Katalog übernommen; die Seite führt keine Live-Shop-Suche aus.

## Start

Die Dateien über einen lokalen Webserver oder HTTPS bereitstellen. Beispiel: `python3 -m http.server 8000`, dann `http://localhost:8000` öffnen. Ein direktes Öffnen der HTML-Datei über `file://` unterstützt den Service Worker nicht.

Für GitHub Pages: Repository-Einstellungen → Pages → `Deploy from a branch` → `main` / `/ (root)` wählen. Die App liegt anschließend unter `https://cecconsteve-cell.github.io/raubfisch-assistent-temmels/`.

## Datenbasis

`data/catalog.json` stammt aus `Raubfisch_Assistent_Temmels_Datenbasis.xlsx` vom 27.09.2026. `tools/export_data.py` exportiert diese vier Tabellen erneut, wenn die Excel-Datei im übergeordneten Verzeichnis `source/` liegt. `data/additions.json` ergänzt die recherchierten Hecht-/Rapfen-Vorschläge, Materialgrößen, Quellen und das Prüfdatum. Der Export überschreibt diese Ergänzungen nicht.

Die Empfehlung passt die Basisbewertungen an Wasser, Licht, Strömung und vorsichtiges Beißverhalten an. Gewichte und Materialstärken sind redaktionelle Startwerte für die Mosel, keine gemessenen Fangquoten; Gewässerkontakt, Ködergröße und Tragkraft müssen vor Ort geprüft werden. Wenn kein direkter Wasser-Treffer vorliegt, wird das in der App angezeigt. Die App nutzt keine Live-Wetter-, Wasserstands- oder Shop-API. Materialbestand liegt nur im jeweiligen Browser und wird nicht synchronisiert.

## Pflege der Empfehlungen

Neue Rigs und Köder erst nach Abgleich mit offiziellen Produkt- oder Herstellerseiten in `data/additions.json` übernehmen, den Link unter `sources` dokumentieren und `reviewedAt` aktualisieren. CAMO Tackle zuerst prüfen, ergänzend Hersteller und internationale Quellen. Keine aktuellen Preise ohne Datum übernehmen. Nach Änderungen `node tools/test_app.mjs` ausführen, dann `sw.js` für einen neuen Offline-Cache aktualisieren.

