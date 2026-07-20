from __future__ import annotations

import json
import math
from datetime import datetime
from pathlib import Path
from typing import Any

import openpyxl


ROOT = Path(__file__).resolve().parents[1]
SOURCE_FILE = ROOT / "各省装机与发电量.xlsx"
DATA_DIR = ROOT / "data"
OUTPUT_FILE = DATA_DIR / "energy-mix-data.json"
OUTPUT_JS_FILE = DATA_DIR / "energy-mix-data.js"

SHEET_NAME = "2025年"

CAPACITY_FIELDS = [
    ("燃煤", "燃煤（万千瓦）"),
    ("水电", "水电(万千瓦)"),
    ("风电", "风电(万千瓦)"),
    ("光伏", "光伏(万千瓦)"),
    ("燃气", "燃气（万千瓦）"),
    ("核电", "核电(万千瓦)"),
    ("其他", "其他（生物质、储能）"),
]

GENERATION_FIELDS = [
    ("火电", "火电(亿千瓦时)"),
    ("水电", "水电(亿千瓦时)"),
    ("风电", "风电(亿千瓦时)"),
    ("光伏", "光伏(亿千瓦时)"),
    ("核电", "核电(亿千瓦时)"),
]


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def number_value(value: Any) -> float:
    if value in (None, ""):
        return 0
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return 0
    if math.isnan(numeric) or math.isinf(numeric):
        return 0
    return round(numeric, 6)


def build_series(row: tuple[Any, ...], header_map: dict[str, int], fields: list[tuple[str, str]]) -> list[dict[str, Any]]:
    series = []
    for label, header in fields:
        index = header_map.get(header)
        value = number_value(row[index] if index is not None and index < len(row) else None)
        if value > 0:
            series.append({"name": label, "value": value})
    return series


def build_dataset() -> dict[str, Any]:
    workbook = openpyxl.load_workbook(SOURCE_FILE, read_only=True, data_only=True)
    ws = workbook[SHEET_NAME]
    headers = [clean_text(value) for value in next(ws.iter_rows(min_row=2, max_row=2, values_only=True))]
    header_map = {header: index for index, header in enumerate(headers) if header}
    province_col = header_map["省份/电网区域"]

    provinces: dict[str, Any] = {}
    current_region = ""
    for row in ws.iter_rows(min_row=3, values_only=True):
        if clean_text(row[0]):
            current_region = clean_text(row[0])
        province = clean_text(row[province_col] if province_col < len(row) else None)
        if not province:
            continue
        capacity = build_series(row, header_map, CAPACITY_FIELDS)
        generation = build_series(row, header_map, GENERATION_FIELDS)
        provinces[province] = {
            "name": province,
            "region": current_region,
            "capacityTotal": number_value(row[header_map["总装机容量(万千瓦)"]]),
            "generationTotal": number_value(row[header_map["总发电量(亿千瓦时)"]]),
            "capacity": capacity,
            "generation": generation,
        }

    return {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "source": {
            "file": SOURCE_FILE.name,
            "sheet": SHEET_NAME,
            "note": "由 scripts/build_energy_mix.py 根据各省装机与发电量.xlsx 生成。",
        },
        "units": {
            "capacity": "万千瓦",
            "generation": "亿千瓦时",
        },
        "provinces": provinces,
    }


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    payload = build_dataset()
    json_text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    OUTPUT_FILE.write_text(json_text, encoding="utf-8")
    OUTPUT_JS_FILE.write_text(f"window.ENERGY_MIX_DATA={json_text};\n", encoding="utf-8")
    print(f"wrote {OUTPUT_FILE.relative_to(ROOT)} and {OUTPUT_JS_FILE.relative_to(ROOT)} with {len(payload['provinces'])} provinces")


if __name__ == "__main__":
    main()
