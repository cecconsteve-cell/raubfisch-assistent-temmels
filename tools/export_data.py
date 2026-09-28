"""Export the agreed Excel data basis to the static app bundle."""

import json
from pathlib import Path
import openpyxl

root = Path(__file__).resolve().parents[1]
source = root.parent / "source" / "Raubfisch_Assistent_Temmels_Datenbasis.xlsx"
workbook = openpyxl.load_workbook(source, read_only=True, data_only=True)
names = {
    "Produkte": "products",
    "Rig-Komponenten": "components",
    "Kombinationen": "combinations",
    "CAMO-Preise": "prices",
}
data = {"sourceDate": "2026-09-27", "region": "Temmels · Mosel ±500 m"}
for sheet_name, key in names.items():
    rows = workbook[sheet_name].iter_rows(values_only=True)
    headers = [str(value).strip() for value in next(rows)]
    data[key] = [
        {header: value for header, value in zip(headers, row) if value is not None}
        for row in rows if any(value is not None for value in row)
    ]
(root / "data" / "catalog.json").write_text(
    json.dumps(data, ensure_ascii=False, indent=2, default=str) + "\n", encoding="utf-8"
)
