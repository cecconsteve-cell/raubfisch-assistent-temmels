# Raubfisch-Assistent Temmels

Eine installierbare Offline-Web-App für das Uferangeln an der Mosel bei Temmels (±500 m).

## Funktionen

- Filter für Fischart, Wassertrübung, Licht/Wetter und Rig.
- Bis zu drei Empfehlungen aus acht vorhandenen Barsch-/Zander-Kombinationen, mit Köder, Haken, Gewicht und Führung.
- Bestand von zehn Produkten, lokal im Browser gespeichert. Vorhandene Köder erhalten einen kleinen Vorrang bei gleicher Eignung.
- Offline-Nutzung nach dem ersten vollständigen Laden über einen Service Worker.
- Shop-Links und vier **historische** CAMO-Preise mit Prüfdatum 27.09.2026. Es findet keine automatische Preisaktualisierung statt.
- Hecht und Rapfen sind als Filter vorbereitet. Es gibt noch keine bewerteten Vorschläge für diese Fischarten.

## Start

Die Dateien über einen lokalen Webserver oder HTTPS bereitstellen. Beispiel: `python3 -m http.server 8000`, dann `http://localhost:8000` öffnen. Ein direktes Öffnen der HTML-Datei über `file://` unterstützt den Service Worker nicht.

Für GitHub Pages: Repository-Einstellungen → Pages → `Deploy from a branch` → `main` / `/ (root)` wählen. Die App liegt anschließend unter `https://cecconsteve-cell.github.io/raubfisch-assistent-temmels/`.

## Datenbasis

`data/catalog.json` stammt aus `Raubfisch_Assistent_Temmels_Datenbasis.xlsx` vom 27.09.2026. `tools/export_data.py` exportiert vier Tabellen erneut, wenn die Excel-Datei im übergeordneten Verzeichnis `source/` liegt. Die Empfehlung passt die vorhandenen Basisbewertungen an Übereinstimmungen mit Wasser, Licht und vorsichtigem Beißverhalten an. Wenn kein direkter Wasser-Treffer vorliegt, wird das in der App ausdrücklich angezeigt. Die App nutzt noch keine Live-Wetter-, Wasserstands- oder Shop-API.
