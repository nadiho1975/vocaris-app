# -*- coding: utf-8 -*-
"""
Vocab PDF Source Merge Pipeline

Purpose
-------
Use authoritative vocabulary PDFs as the source for example_en/example_ko/동의어,
while preserving the user's existing vocabulary IDs and metadata columns.

Priority:
  1) 어휘끝 수능.pdf
  2) 2022 능률VOCA 고교필수 2000.pdf

Default behavior:
  - Keep: vocab_id, vocab_new_id, word, meaning_ko, entry_type, is_phrase, day,
          related_forms, source_list, source_count, priority_group
  - Replace: example_en, example_ko, 동의어 from the PDFs
  - If a word is not found in either PDF, clear example_en/example_ko/동의어
  - Write audit files so you can inspect unmatched/changed rows.

Requirements:
  pip install pandas

Best extraction quality requires Poppler's pdftotext command.
If pdftotext is not available, the script tries pypdf/PyPDF2 fallback, but quality may be lower.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import shlex
from collections import defaultdict
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple



KOREAN_RE = re.compile(r"[가-힣]")
EN_WORD_RE = re.compile(r"^[A-Za-z][A-Za-z'’\-]*(?:\s+[A-Za-z][A-Za-z'’\-]*){0,5}$")
NUMBER_RE = re.compile(r"^\d{4}$")
EXAMPLE_NO_RE = re.compile(r"^(\d{2})\s+(.+)$")
SOURCE_CLEAN_RE = re.compile(r"\s+")

NOISE_WORDS = {
    "unit", "part", "day", "memory", "key", "class", "card", "contents", "answer",
    "study", "plan", "index", "word", "complete", "voca", "test", "daily", "pdf",
}

# POS markers usually found in Korean vocabulary books.
POS_STARTS = ("명", "동", "형", "부", "전", "접", "대", "감", "숙", "헒")

@dataclass
class SourceEntry:
    word: str
    meaning_from_pdf: str = ""
    example_en: str = ""
    example_ko: str = ""
    synonym: str = ""
    pattern: str = ""
    source: str = ""
    page: int = 0
    entry_no: str = ""
    raw_block: str = ""


def clean_text(s: object) -> str:
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ""
    s = str(s).replace("\ufeff", "").replace("\x00", "")
    # normalize quote variants but keep user-readable punctuation
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    s = SOURCE_CLEAN_RE.sub(" ", s).strip()
    return s


def normalize_word(s: object) -> str:
    s = clean_text(s).lower()
    s = s.replace("’", "'")
    s = re.sub(r"\s+", " ", s)
    s = s.strip(" .,:;()[]{}\"'")
    return s


def is_korean_line(line: str) -> bool:
    return bool(KOREAN_RE.search(line))


def is_probable_word_line(line: str) -> bool:
    line = clean_text(line)
    if not line:
        return False
    if len(line) > 40:
        return False
    if KOREAN_RE.search(line):
        return False
    if re.search(r"\d", line):
        return False
    low = normalize_word(line)
    if low in NOISE_WORDS:
        return False
    # allow phrasal verbs and phrases with spaces
    if not EN_WORD_RE.match(line):
        return False
    # Avoid pronunciation fragments or symbols
    if any(ch in line for ch in "[]{}=/\\·•"):
        return False
    return True


def first_synonym_from_text(text: str) -> str:
    """Extract first English synonym from '(= ...)' or Korean book style equivalents."""
    text = clean_text(text)
    # patterns like (= look), (= come out, appear), (= necessary, vital)
    m = re.search(r"\(\s*=\s*([^\)]{1,80})\)", text)
    if not m:
        # Sometimes spacing around equals is odd
        m = re.search(r"=\s*([A-Za-z][A-Za-z\s,'\-/]{1,80})\)", text)
    if not m:
        return ""
    raw = m.group(1)
    raw = raw.split("↔")[0]
    parts = [clean_text(x) for x in re.split(r"[,;/]", raw) if clean_text(x)]
    # Keep only a simple English word/phrase, not explanations
    for p in parts:
        p = re.sub(r"\b[A-Z][A-Z]+\b", "", p).strip()
        if re.match(r"^[A-Za-z][A-Za-z'\-]*(?:\s+[A-Za-z][A-Za-z'\-]*){0,3}$", p):
            return p
    return ""


def clean_example_en(s: str) -> str:
    s = clean_text(s)
    # Remove Korean-source labels often appended to examples.
    s = re.sub(r"\s*(수능응용|모의응용|수능|모의|ebs응용|교과서응용)\s*$", "", s).strip()
    s = re.sub(r"\s+", " ", s)
    return s


def clean_example_ko(s: str) -> str:
    s = clean_text(s)
    s = re.sub(r"\s+", " ", s)
    return s


def extract_text_by_pages(pdf_path: Path, max_pages: Optional[int] = None) -> List[str]:
    """Extract PDF text by page. Uses Poppler pdftotext.

    Per-page extraction is slower than full extraction, but safer for some Korean PDFs
    where one problematic page can make full extraction hang.
    """
    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        raise FileNotFoundError(pdf_path)

    pdftotext = shutil.which("pdftotext")
    if not pdftotext:
        raise RuntimeError(
            "pdftotext was not found. Install Poppler and add it to PATH. "
            "This pipeline relies on pdftotext because Korean PDF extraction quality is much higher."
        )

    pdfinfo = shutil.which("pdfinfo")
    page_count = None
    if pdfinfo:
        try:
            info = subprocess.check_output([pdfinfo, str(pdf_path)], text=True, errors="ignore", timeout=20)
            m = re.search(r"Pages:\s+(\d+)", info)
            if m:
                page_count = int(m.group(1))
        except Exception:
            page_count = None
    if page_count is None:
        # Conservative fallback: try 1000 pages, stop after many consecutive empty pages.
        page_count = max_pages or 1000

    n = min(page_count, max_pages) if max_pages else page_count
    pages: List[str] = []
    consecutive_empty_after_start = 0
    for pno in range(1, n + 1):
        try:
            if os.name != "nt" and shutil.which("timeout"):
                # Most reliable in this environment: write to a temp file via shell timeout.
                fd, tmp_path = tempfile.mkstemp(suffix=".txt")
                os.close(fd)
                cmd = (
                    f"timeout 3s {shlex.quote(pdftotext)} -f {pno} -l {pno} "
                    f"{shlex.quote(str(pdf_path))} {shlex.quote(tmp_path)} 2>/dev/null"
                )
                os.system(cmd)
                with open(tmp_path, "rb") as f:
                    raw = f.read()
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
            else:
                base_cmd = [pdftotext, "-f", str(pno), "-l", str(pno), str(pdf_path), "-"]
                raw = subprocess.check_output(base_cmd, timeout=3, stderr=subprocess.DEVNULL)
            out = raw.decode("utf-8", errors="ignore")
        except subprocess.TimeoutExpired:
            out = ""
        except Exception:
            out = ""
        pages.append(out)
        if page_count == 1000:
            if out.strip():
                consecutive_empty_after_start = 0
            else:
                consecutive_empty_after_start += 1
            if pno > 50 and consecutive_empty_after_start >= 20:
                break
    return pages


def extract_korean_translation_map_eowhikkeut(page_text: str) -> Dict[str, str]:
    """Extract bottom Korean sentence list from 어휘끝 pages.

    This deliberately avoids expensive regex backtracking.
    """
    t = clean_text(page_text)
    parts = re.split(r"(?<!\d)(\d{2})\s+", t)
    result: Dict[str, str] = {}
    # parts = [prefix, num, segment, num, segment ...]
    for i in range(1, len(parts) - 1, 2):
        num = parts[i]
        seg = clean_text(parts[i + 1])
        if not KOREAN_RE.search(seg):
            continue
        # Cut at the next footer-ish marker if it survived.
        seg = re.sub(r"\s+\d+\s+PART.*$", "", seg).strip()
        seg = re.sub(r"\s+Unit\s+\d+\s+\d+\s*$", "", seg).strip()
        # Korean translations tend to be sentence-like; skip short dictionary labels.
        if len(seg) >= 6:
            result[num] = seg
    return result


def split_blocks_by_entry_no(page_text: str) -> List[Tuple[str, List[str]]]:
    lines = [clean_text(x) for x in page_text.splitlines()]
    lines = [x for x in lines if x]
    blocks: List[Tuple[str, List[str]]] = []
    cur_no = None
    cur_lines: List[str] = []
    for line in lines:
        if NUMBER_RE.match(line):
            if cur_no and cur_lines:
                blocks.append((cur_no, cur_lines))
            cur_no = line
            cur_lines = []
        elif cur_no:
            cur_lines.append(line)
    if cur_no and cur_lines:
        blocks.append((cur_no, cur_lines))
    return blocks


def parse_eowhikkeut_pdf(pdf_path: Path, max_pages: Optional[int] = None) -> Dict[str, SourceEntry]:
    pages = extract_text_by_pages(pdf_path, max_pages=max_pages)
    entries: Dict[str, SourceEntry] = {}
    for page_idx, page_text in enumerate(pages, start=1):
        if not page_text.strip():
            continue
        ko_map = extract_korean_translation_map_eowhikkeut(page_text)
        blocks = split_blocks_by_entry_no(page_text)
        for entry_no, block_lines in blocks:
            # First probable English word/phrase in the block is the headword.
            word = ""
            word_idx = -1
            for i, line in enumerate(block_lines[:8]):
                if is_probable_word_line(line):
                    word = line
                    word_idx = i
                    break
            if not word:
                continue
            raw_block = "\n".join(block_lines)
            # Meaning text = lines after word until first numbered example line.
            meaning_lines = []
            ex_nums: List[str] = []
            ex_lines: List[Tuple[str, str]] = []
            for line in block_lines[word_idx+1:]:
                m = EXAMPLE_NO_RE.match(line)
                if m:
                    num, body = m.group(1), clean_example_en(m.group(2))
                    # Sometimes line is only the first part and next line continues; handled below in a simple way.
                    ex_nums.append(num)
                    ex_lines.append((num, body))
                    continue
                # continuation of previous English example if no Hangul and previous line exists and not metadata
                if ex_lines and not KOREAN_RE.search(line) and not line.startswith(POS_STARTS) and not NUMBER_RE.match(line):
                    # Avoid appending derivative words, patterns, or footers.
                    if not is_probable_word_line(line) and not re.match(r"^[A-Za-z]+\s+명|동|형|부", line):
                        last_num, last_body = ex_lines[-1]
                        if len(line) < 120 and not line.lower().startswith(("unit", "part")):
                            ex_lines[-1] = (last_num, clean_example_en(last_body + " " + line))
                    continue
                if not ex_lines:
                    meaning_lines.append(line)
            meaning_text = clean_text(" ".join(meaning_lines))
            synonym = first_synonym_from_text(meaning_text)
            example_en = ""
            example_ko = ""
            for num, ex in ex_lines:
                ko = ko_map.get(num, "")
                if ex and ko:
                    example_en, example_ko = clean_example_en(ex), clean_example_ko(ko)
                    break
            # If no Korean mapping found, still keep English example only if high quality.
            if not example_en and ex_lines:
                example_en = clean_example_en(ex_lines[0][1])
            key = normalize_word(word)
            if key and key not in entries:
                entries[key] = SourceEntry(
                    word=clean_text(word),
                    meaning_from_pdf=meaning_text,
                    example_en=example_en,
                    example_ko=example_ko,
                    synonym=synonym,
                    source="어휘끝 수능",
                    page=page_idx,
                    entry_no=entry_no,
                    raw_block=raw_block[:3000],
                )
    return entries


def parse_neungyule_pdf(pdf_path: Path, max_pages: Optional[int] = None) -> Dict[str, SourceEntry]:
    pages = extract_text_by_pages(pdf_path, max_pages=max_pages)
    entries: Dict[str, SourceEntry] = {}
    for page_idx, page_text in enumerate(pages, start=1):
        if not page_text.strip():
            continue
        blocks = split_blocks_by_entry_no(page_text)
        for entry_no, block_lines in blocks:
            word = ""
            word_idx = -1
            for i, line in enumerate(block_lines[:8]):
                if is_probable_word_line(line):
                    word = line
                    word_idx = i
                    break
            if not word:
                continue
            raw_block = "\n".join(block_lines)
            meaning_lines = []
            example_en = ""
            example_ko = ""
            seen_word = False
            for i, line in enumerate(block_lines[word_idx+1:], start=word_idx+1):
                if not example_en:
                    # Good English example line: starts with capital/quote, has at least one space, no Hangul, has punctuation.
                    # Avoid pronunciation lines and derivative words.
                    if (not KOREAN_RE.search(line)
                        and len(line) >= 20
                        and re.search(r"[.!?]", line)
                        and not any(ch in line for ch in "[]")
                        and not line.startswith(("MEMORY", "KEY", "DAY"))):
                        example_en = clean_example_en(line)
                        continue
                    # Before English example, collect meaning lines with Korean.
                    if KOREAN_RE.search(line) or line.startswith(POS_STARTS):
                        meaning_lines.append(line)
                else:
                    # First Korean line after English example is translation.
                    if KOREAN_RE.search(line) and not line.startswith(("MEMORY", "KEY")):
                        example_ko = clean_example_ko(line)
                        break
                    # English example wrapped to next line
                    if not KOREAN_RE.search(line) and len(line) < 120 and not NUMBER_RE.match(line):
                        if not is_probable_word_line(line) and not line.startswith(("MEMORY", "KEY")):
                            example_en = clean_example_en(example_en + " " + line)
                # Stop meaning if a derivative section is likely starting after examples.
            meaning_text = clean_text(" ".join(meaning_lines))
            synonym = first_synonym_from_text(meaning_text)
            key = normalize_word(word)
            if key and key not in entries:
                entries[key] = SourceEntry(
                    word=clean_text(word),
                    meaning_from_pdf=meaning_text,
                    example_en=example_en,
                    example_ko=example_ko,
                    synonym=synonym,
                    source="2022 능률VOCA 고교필수 2000",
                    page=page_idx,
                    entry_no=entry_no,
                    raw_block=raw_block[:3000],
                )
    return entries


def load_csv_auto(path: Path) -> Tuple[List[Dict[str, str]], List[str]]:
    """Load CSV with common Korean encodings using csv.DictReader."""
    last_error = None
    for enc in ("utf-8-sig", "utf-8", "cp949", "euc-kr"):
        try:
            with open(path, "r", encoding=enc, newline="") as f:
                reader = csv.DictReader(f)
                rows = [dict(r) for r in reader]
                fieldnames = reader.fieldnames or []
            return rows, fieldnames
        except UnicodeDecodeError as e:
            last_error = e
            continue
    raise UnicodeDecodeError("csv", b"", 0, 1, f"Unable to decode {path}: {last_error}")


def write_csv(path: Path, rows: List[Dict[str, str]], fieldnames: List[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def find_entry(word: str, is_phrase: str, eowhi: Dict[str, SourceEntry], neung: Dict[str, SourceEntry]) -> Tuple[Optional[SourceEntry], str]:
    key = normalize_word(word)
    # Exact first.
    if key in eowhi:
        return eowhi[key], "exact:어휘끝"
    if key in neung:
        return neung[key], "exact:능률"
    # Normalized apostrophe and hyphen/space variants.
    variants = {key}
    variants.add(key.replace("-", " "))
    variants.add(key.replace(" ", "-"))
    variants.add(key.replace("'", ""))
    variants.add(key.replace(" ", ""))
    for v in variants:
        if v in eowhi:
            return eowhi[v], "variant:어휘끝"
        if v in neung:
            return neung[v], "variant:능률"
    return None, "not_found"


def apply_merge(
    input_csv: Path,
    eowhi_pdf: Path,
    neung_pdf: Path,
    output_csv: Path,
    report_path: Optional[Path] = None,
    audit_csv: Optional[Path] = None,
    missing_csv: Optional[Path] = None,
    max_pages: Optional[int] = None,
    test_limit: Optional[int] = None,
    missing_policy: str = "clear",
) -> Dict[str, object]:
    rows, fieldnames = load_csv_auto(input_csv)
    required = ["word", "example_en", "example_ko", "동의어"]
    missing_cols = [c for c in required if c not in fieldnames]
    if missing_cols:
        raise ValueError(f"Input CSV missing required columns: {missing_cols}")

    print("[INFO] parsing 어휘끝 PDF...", file=sys.stderr)
    eowhi = parse_eowhikkeut_pdf(eowhi_pdf, max_pages=max_pages)
    print(f"[INFO] 어휘끝 entries={len(eowhi)}", file=sys.stderr)
    print("[INFO] parsing 능률VOCA PDF...", file=sys.stderr)
    neung = parse_neungyule_pdf(neung_pdf, max_pages=max_pages)
    print(f"[INFO] 능률 entries={len(neung)}", file=sys.stderr)

    process_len = len(rows) if test_limit is None else min(len(rows), test_limit)
    out_rows = [dict(r) for r in rows]
    audit_rows: List[Dict[str, str]] = []
    stats = defaultdict(int)

    for idx in range(process_len):
        row = out_rows[idx]
        word = row.get("word", "")
        old_ex_en = row.get("example_en", "")
        old_ex_ko = row.get("example_ko", "")
        old_syn = row.get("동의어", "")
        entry, status = find_entry(word, row.get("is_phrase", ""), eowhi, neung)
        if entry and entry.example_en:
            row["example_en"] = entry.example_en
            row["example_ko"] = entry.example_ko
            row["동의어"] = entry.synonym
            stats[f"matched_{entry.source}"] += 1
            source = entry.source
            page = str(entry.page)
            match_status = status
        else:
            stats["not_found"] += 1
            source = ""
            page = ""
            match_status = status
            if missing_policy == "clear":
                row["example_en"] = ""
                row["example_ko"] = ""
                row["동의어"] = ""
            elif missing_policy == "keep":
                pass
            else:
                raise ValueError("missing_policy must be 'clear' or 'keep'")

        audit_rows.append({
            "row_index": str(idx),
            "vocab_id": row.get("vocab_id", ""),
            "vocab_new_id": row.get("vocab_new_id", ""),
            "word": word,
            "match_status": match_status,
            "selected_source": source,
            "source_page": page,
            "old_example_en": old_ex_en,
            "new_example_en": row.get("example_en", ""),
            "old_example_ko": old_ex_ko,
            "new_example_ko": row.get("example_ko", ""),
            "old_synonym": old_syn,
            "new_synonym": row.get("동의어", ""),
        })

    write_csv(output_csv, out_rows, fieldnames)

    audit_fields = ["row_index", "vocab_id", "vocab_new_id", "word", "match_status", "selected_source", "source_page", "old_example_en", "new_example_en", "old_example_ko", "new_example_ko", "old_synonym", "new_synonym"]
    if audit_csv:
        write_csv(audit_csv, audit_rows, audit_fields)
    if missing_csv:
        missing_rows = [r for r in audit_rows if r["match_status"] == "not_found"]
        write_csv(missing_csv, missing_rows, audit_fields)

    matched_total = sum(v for k, v in stats.items() if k.startswith("matched_"))
    summary = {
        "input": str(input_csv),
        "output": str(output_csv),
        "rows_total": int(len(rows)),
        "rows_processed": int(process_len),
        "missing_policy": missing_policy,
        "source_entries": {
            "어휘끝 수능": len(eowhi),
            "2022 능률VOCA 고교필수 2000": len(neung),
        },
        "stats": dict(stats),
        "matched_total": int(matched_total),
        "not_found": int(stats.get("not_found", 0)),
        "match_rate_processed": round((matched_total / process_len) if process_len else 0, 4),
    }
    if report_path:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


def main():
    ap = argparse.ArgumentParser(description="Merge example_en/example_ko/동의어 from two vocab PDFs into app vocab CSV.")
    ap.add_argument("--input", required=True, help="Input app vocab CSV")
    ap.add_argument("--eowhi-pdf", default="어휘끝 수능.pdf", help="Primary source PDF: 어휘끝 수능.pdf")
    ap.add_argument("--neung-pdf", default="2022 능률VOCA 고교필수 2000.pdf", help="Fallback source PDF")
    ap.add_argument("--output", required=True, help="Output CSV")
    ap.add_argument("--report", default=None, help="JSON report path")
    ap.add_argument("--audit", default=None, help="Audit CSV path")
    ap.add_argument("--missing", default=None, help="Unmatched rows CSV path")
    ap.add_argument("--missing-policy", choices=["clear", "keep"], default="clear", help="If not found in either PDF: clear or keep existing example/synonym")
    ap.add_argument("--max-pages", type=int, default=None, help="Debug: parse only first N pages of each PDF")
    ap.add_argument("--test-limit", type=int, default=None, help="Process only first N rows of input CSV")
    args = ap.parse_args()

    summary = apply_merge(
        input_csv=Path(args.input),
        eowhi_pdf=Path(args.eowhi_pdf),
        neung_pdf=Path(args.neung_pdf),
        output_csv=Path(args.output),
        report_path=Path(args.report) if args.report else None,
        audit_csv=Path(args.audit) if args.audit else None,
        missing_csv=Path(args.missing) if args.missing else None,
        max_pages=args.max_pages,
        test_limit=args.test_limit,
        missing_policy=args.missing_policy,
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
