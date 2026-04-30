"""Import VOCARIS vocab CSV into Supabase.

Usage:
  1) Copy your final CSV to project root as vocab_final.csv
  2) Set .env.local values, especially SUPABASE_SERVICE_ROLE_KEY
  3) pip install supabase python-dotenv
  4) python scripts/import_vocab_to_supabase.py vocab_final.csv

The app uses vocab.id as the stable key. This importer uses vocab_new_id first,
then id, then vocab_id. Keep vocab_new_id stable across DB updates to preserve user records.
"""

from __future__ import annotations

import csv
import os
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import create_client

BATCH_SIZE = 500


def as_bool(value: str | None) -> bool:
    if value is None:
        return False
    return str(value).strip().lower() in {"true", "1", "yes", "y"}


def as_int(value: str | None) -> int | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        return int(float(str(value).strip()))
    except ValueError:
        return None


def clean(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


def row_to_vocab(row: dict[str, str]) -> dict[str, Any]:
    stable_id = as_int(row.get("vocab_new_id")) or as_int(row.get("id")) or as_int(row.get("vocab_id"))
    if stable_id is None:
        raise ValueError(f"Missing stable id in row: {row}")

    return {
        "id": stable_id,
        "word": clean(row.get("word")) or "",
        "meaning_ko": clean(row.get("meaning_ko")),
        "example_en": clean(row.get("example_en")),
        "example_ko": clean(row.get("example_ko")),
        "synonym": clean(row.get("동의어")) or clean(row.get("synonym")),
        "entry_type": clean(row.get("entry_type")),
        "is_phrase": as_bool(row.get("is_phrase")),
        "day": as_int(row.get("day")),
        "related_forms": clean(row.get("related_forms")),
        "source_list": clean(row.get("source_list")),
        "source_count": as_int(row.get("source_count")),
        "priority_group": clean(row.get("priority_group")),
    }


def main() -> None:
    load_dotenv(".env.local")
    load_dotenv(".env")

    csv_path = Path(sys.argv[1] if len(sys.argv) > 1 else "vocab_final.csv")
    if not csv_path.exists():
        raise FileNotFoundError(csv_path)

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local")

    supabase = create_client(url, key)

    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        batch: list[dict[str, Any]] = []
        total = 0
        for row in reader:
            item = row_to_vocab(row)
            if not item["word"]:
                continue
            batch.append(item)
            if len(batch) >= BATCH_SIZE:
                supabase.table("vocab").upsert(batch, on_conflict="id").execute()
                total += len(batch)
                print(f"Imported {total} rows")
                batch.clear()
        if batch:
            supabase.table("vocab").upsert(batch, on_conflict="id").execute()
            total += len(batch)
    print(f"Done. Imported/upserted {total} vocab rows from {csv_path}")


if __name__ == "__main__":
    main()
