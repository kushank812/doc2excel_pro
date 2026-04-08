from __future__ import annotations

import base64
import io
import json
import re
from pathlib import Path
from typing import Any

from openai import OpenAI
from PIL import Image
import pypdfium2 as pdfium

from app.core.config import get_settings


PAGE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "page_number": {"type": "integer"},
        "document_type": {"type": "string"},
        "key_values": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "label": {"type": "string"},
                    "value": {"type": "string"},
                },
                "required": ["label", "value"],
            },
        },
        "tables": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "title": {"type": "string"},
                    "columns": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "rows": {
                        "type": "array",
                        "items": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                    },
                },
                "required": ["title", "columns", "rows"],
            },
        },
        "raw_lines": {
            "type": "array",
            "items": {"type": "string"},
        },
        "notes": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["page_number", "document_type", "key_values", "tables", "raw_lines", "notes"],
}

WORKBOOK_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "workbook_title": {"type": "string"},
        "sheets": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "name": {"type": "string"},
                    "kind": {"type": "string"},
                    "columns": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "rows": {
                        "type": "array",
                        "items": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                    },
                },
                "required": ["name", "kind", "columns", "rows"],
            },
        },
    },
    "required": ["workbook_title", "sheets"],
}


class AIScanParserService:
    def __init__(self) -> None:
        self.settings = get_settings()

        self.ai_api_key = getattr(self.settings, "AI_API_KEY", "") or ""
        self.ai_model = getattr(self.settings, "AI_MODEL", "gpt-5.4") or "gpt-5.4"

        if not self.ai_api_key.strip():
            raise RuntimeError("AI_API_KEY is missing in .env")

        self.client = OpenAI(api_key=self.ai_api_key.strip())
        self.model = self.ai_model.strip()

    # ------------------------------------------------------------------
    # PUBLIC METHODS
    # ------------------------------------------------------------------

    def extract_document(self, file_path: str | Path) -> dict[str, Any]:
        file_path = Path(file_path)
        suffix = file_path.suffix.lower()

        if suffix == ".pdf":
            page_images = self._pdf_to_images(file_path)
        elif suffix in {".png", ".jpg", ".jpeg", ".webp"}:
            page_images = [self._load_image_bytes(file_path)]
        else:
            raise ValueError(f"Unsupported file type: {suffix}")

        page_results: list[dict[str, Any]] = []

        for idx, image_bytes in enumerate(page_images, start=1):
            page_json = self._extract_page_with_ai(image_bytes=image_bytes, page_number=idx)
            page_results.append(page_json)

        merged_model = self._merge_page_results(page_results)
        preliminary_workbook = self._build_preliminary_workbook_plan(
            merged_model=merged_model,
            source_name=file_path.stem,
        )
        workbook_plan = self._refine_workbook_plan_with_ai(
            page_results=page_results,
            preliminary_workbook=preliminary_workbook,
        )

        return {
            "source_file": file_path.name,
            "pages": page_results,
            "merged_model": merged_model,
            "workbook": workbook_plan,
        }

    def parse_image_to_layout(self, file_path: str | Path) -> dict[str, Any]:
        file_path = Path(file_path)
        suffix = file_path.suffix.lower()

        if suffix not in {".png", ".jpg", ".jpeg", ".webp"}:
            raise ValueError(f"Unsupported image type for AI scan: {suffix}")

        image_bytes = self._load_image_bytes(file_path)
        page_json = self._extract_page_with_ai(image_bytes=image_bytes, page_number=1)

        image = Image.open(io.BytesIO(image_bytes))
        width, height = image.size

        layout_items, raw_text = self._page_json_to_layout_items(page_json, width=float(width))

        return {
            "raw_text": raw_text,
            "tables": [],
            "warnings": ["AI image extraction used. Please review complex layouts carefully."],
            "meta": {
                "source_type": "IMAGE_AI",
                "document_type": page_json.get("document_type", "unknown"),
                "layout_pages": [
                    {
                        "page_no": 1,
                        "page_width": float(width),
                        "page_height": float(height),
                        "items": layout_items,
                    }
                ],
            },
        }

    def parse_pdf_to_layout(self, file_path: str | Path) -> dict[str, Any]:
        file_path = Path(file_path)
        if file_path.suffix.lower() != ".pdf":
            raise ValueError("parse_pdf_to_layout only supports PDF files")

        page_images = self._pdf_to_images(file_path)
        layout_pages: list[dict[str, Any]] = []
        page_results: list[dict[str, Any]] = []
        raw_pages: list[str] = []

        for idx, image_bytes in enumerate(page_images, start=1):
            page_json = self._extract_page_with_ai(image_bytes=image_bytes, page_number=idx)
            page_results.append(page_json)

            img = Image.open(io.BytesIO(image_bytes))
            width, height = img.size
            layout_items, raw_text = self._page_json_to_layout_items(page_json, width=float(width))

            raw_pages.append(raw_text)

            layout_pages.append(
                {
                    "page_no": idx,
                    "page_width": float(width),
                    "page_height": float(height),
                    "items": layout_items,
                }
            )

        merged_model = self._merge_page_results(page_results)
        preliminary_workbook = self._build_preliminary_workbook_plan(
            merged_model=merged_model,
            source_name=file_path.stem,
        )
        workbook_plan = self._refine_workbook_plan_with_ai(
            page_results=page_results,
            preliminary_workbook=preliminary_workbook,
        )

        return {
            "raw_text": "\n\n".join([t for t in raw_pages if t.strip()]).strip(),
            "tables": [],
            "warnings": ["AI PDF extraction used. Review complex tables carefully."],
            "meta": {
                "source_type": "PDF_AI",
                "layout_pages": layout_pages,
                "workbook_plan": workbook_plan,
            },
        }

    # ------------------------------------------------------------------
    # PDF / IMAGE HELPERS
    # ------------------------------------------------------------------

    def _pdf_to_images(self, pdf_path: Path) -> list[bytes]:
        pdf = pdfium.PdfDocument(str(pdf_path))
        images: list[bytes] = []

        try:
            for page_index in range(len(pdf)):
                page = pdf[page_index]
                # Higher scale = clearer text/tables for the vision model
                bitmap = page.render(scale=2.8)
                pil_image = bitmap.to_pil()
                buf = io.BytesIO()
                pil_image.save(buf, format="PNG")
                images.append(buf.getvalue())

                bitmap.close()
                page.close()
        finally:
            pdf.close()

        return images

    def _load_image_bytes(self, image_path: Path) -> bytes:
        with image_path.open("rb") as f:
            return f.read()

    def _to_data_url(self, image_bytes: bytes, mime: str = "image/png") -> str:
        b64 = base64.b64encode(image_bytes).decode("utf-8")
        return f"data:{mime};base64,{b64}"

    # ------------------------------------------------------------------
    # AI PAGE EXTRACTION
    # ------------------------------------------------------------------

    def _extract_page_with_ai(self, image_bytes: bytes, page_number: int) -> dict[str, Any]:
        data_url = self._to_data_url(image_bytes, "image/png")

        developer_prompt = (
            "You are an expert business document extraction engine.\n"
            "Extract structured information from the page accurately and conservatively.\n\n"
            "Rules:\n"
            "1. Preserve numbers, dates, invoice numbers, balances, quantities, and totals exactly as seen.\n"
            "2. Preserve table row order exactly.\n"
            "3. Do not invent missing text.\n"
            "4. Extract visible key fields into key_values.\n"
            "5. Extract all visible tables into tables.\n"
            "6. If a table appears to continue from a previous page, still extract the visible rows on this page.\n"
            "7. If a repeated table header appears on continuation pages, include it only as table columns, not as data rows.\n"
            "8. raw_lines should contain important visible lines that are not safely represented elsewhere.\n"
            "9. document_type should be short, such as invoice, statement, report, summary, receipt, unknown.\n"
            "10. Output must strictly match the schema.\n"
            "11. If the page is hard to read, return partial but truthful extraction rather than guessing.\n"
            "12. Prefer clean, business-style table columns. Do not duplicate the same header repeatedly in rows."
        )

        user_text = (
            f"Extract page {page_number} into the required JSON schema. "
            "Focus on tables, totals, structured fields, and continuation rows."
        )

        last_error: Exception | None = None

        for _ in range(3):
            try:
                response = self.client.responses.create(
                    model=self.model,
                    input=[
                        {
                            "role": "developer",
                            "content": [{"type": "input_text", "text": developer_prompt}],
                        },
                        {
                            "role": "user",
                            "content": [
                                {"type": "input_text", "text": user_text},
                                {"type": "input_image", "image_url": data_url},
                            ],
                        },
                    ],
                    text={
                        "format": {
                            "type": "json_schema",
                            "name": "page_extract",
                            "strict": True,
                            "schema": PAGE_SCHEMA,
                        }
                    },
                )

                content = getattr(response, "output_text", None)
                if not content:
                    raise RuntimeError("Empty model output for page extraction.")

                page_json = json.loads(content)
                page_json["page_number"] = page_number

                # Cleanup repeated header rows inside the extracted tables
                for table in page_json.get("tables", []):
                    columns = [self._clean_cell_text(c) for c in table.get("columns", [])]
                    rows = [
                        [self._clean_cell_text(cell) for cell in row]
                        for row in table.get("rows", [])
                    ]
                    rows = self._remove_repeated_header_rows(columns, rows)
                    table["columns"] = columns
                    table["rows"] = rows

                return page_json

            except Exception as e:
                last_error = e

        raise RuntimeError(f"AI page extraction failed: {last_error}")

    # ------------------------------------------------------------------
    # SMART TABLE MERGING
    # ------------------------------------------------------------------

    def _merge_page_results(self, page_results: list[dict[str, Any]]) -> dict[str, Any]:
        merged_key_values: list[dict[str, str]] = []
        merged_tables: list[dict[str, Any]] = []
        raw_lines: list[str] = []
        notes: list[str] = []

        seen_kv: set[tuple[str, str]] = set()
        seen_lines: set[str] = set()
        doc_type_counts: dict[str, int] = {}

        for page in page_results:
            doc_type = str(page.get("document_type", "unknown")).strip().lower() or "unknown"
            doc_type_counts[doc_type] = doc_type_counts.get(doc_type, 0) + 1

            for kv in page.get("key_values", []):
                label = str(kv.get("label", "")).strip()
                value = str(kv.get("value", "")).strip()
                if not label and not value:
                    continue

                key = (label.lower(), value)
                if key not in seen_kv:
                    merged_key_values.append({"label": label, "value": value})
                    seen_kv.add(key)

            for line in page.get("raw_lines", []):
                line = str(line).strip()
                if line and line not in seen_lines:
                    raw_lines.append(line)
                    seen_lines.add(line)

            for note in page.get("notes", []):
                note = str(note).strip()
                if note:
                    notes.append(note)

            for table in page.get("tables", []):
                title = str(table.get("title", "")).strip() or "Table"
                columns = [self._clean_cell_text(c) for c in (table.get("columns", []) or [])]
                rows = [
                    [self._clean_cell_text(cell) for cell in row]
                    for row in (table.get("rows", []) or [])
                ]
                rows = self._remove_repeated_header_rows(columns, rows)

                if not columns and not rows:
                    continue

                target_index = self._find_merge_target(merged_tables, title, columns)

                if target_index is None:
                    merged_tables.append(
                        {
                            "title": title,
                            "columns": columns,
                            "rows": rows,
                            "source_pages": [int(page.get("page_number", 0) or 0)],
                        }
                    )
                else:
                    existing = merged_tables[target_index]
                    existing_rows = existing.get("rows", []) or []

                    for row in rows:
                        if not self._is_duplicate_row(row, existing_rows):
                            existing_rows.append(row)

                    existing["rows"] = existing_rows
                    existing["source_pages"] = sorted(
                        list(
                            set(existing.get("source_pages", []))
                            | {int(page.get("page_number", 0) or 0)}
                        )
                    )

        final_doc_type = (
            max(doc_type_counts.items(), key=lambda x: x[1])[0]
            if doc_type_counts
            else "unknown"
        )

        return {
            "document_type": final_doc_type,
            "key_values": merged_key_values,
            "tables": merged_tables,
            "raw_lines": raw_lines,
            "notes": notes,
        }

    def _find_merge_target(
        self,
        merged_tables: list[dict[str, Any]],
        title: str,
        columns: list[str],
    ) -> int | None:
        candidate_sig = self._columns_signature(columns)
        candidate_title = self._normalize_title(title)

        for idx, existing in enumerate(merged_tables):
            existing_sig = self._columns_signature(existing.get("columns", []) or [])
            existing_title = self._normalize_title(existing.get("title", "") or "")

            # Best case: identical headers
            if candidate_sig and existing_sig and candidate_sig == existing_sig:
                return idx

            # Strong overlap in headers
            if columns and (len(columns) == len(existing.get("columns", []) or [])):
                overlap = self._header_overlap_ratio(
                    columns,
                    existing.get("columns", []) or [],
                )
                if overlap >= 0.8:
                    return idx

            # Same title + same width
            if candidate_title and existing_title and candidate_title == existing_title:
                if len(columns) == len(existing.get("columns", []) or []):
                    return idx

            # Continuation table heuristic
            if self._is_continuation_title(candidate_title) and existing_sig and candidate_sig:
                if len(columns) == len(existing.get("columns", []) or []):
                    return idx

        return None

    def _is_continuation_title(self, title: str) -> bool:
        return any(
            key in title
            for key in [
                "continued",
                "contd",
                "continuation",
                "next page",
                "table continued",
            ]
        )

    def _header_overlap_ratio(self, a: list[str], b: list[str]) -> float:
        aa = [self._normalize_header(x) for x in a if self._normalize_header(x)]
        bb = [self._normalize_header(x) for x in b if self._normalize_header(x)]

        if not aa or not bb:
            return 0.0

        aset = set(aa)
        bset = set(bb)

        common = len(aset & bset)
        denom = max(len(aset), len(bset), 1)
        return common / denom

    def _columns_signature(self, columns: list[str]) -> str:
        normalized = [self._normalize_header(c) for c in columns]
        normalized = [c for c in normalized if c]
        return "|".join(normalized)

    def _normalize_header(self, text: str) -> str:
        text = self._clean_cell_text(text).lower()
        text = re.sub(r"[^a-z0-9]+", " ", text)
        text = " ".join(text.split()).strip()
        return text

    def _normalize_title(self, text: str) -> str:
        text = self._clean_cell_text(text).lower()
        text = re.sub(r"[^a-z0-9]+", " ", text)
        return " ".join(text.split()).strip()

    def _clean_cell_text(self, value: Any) -> str:
        return str(value or "").replace("\r", " ").replace("\n", " ").strip()

    def _is_duplicate_row(self, row: list[str], existing_rows: list[list[str]]) -> bool:
        row_sig = tuple(self._normalize_title(cell) for cell in row)
        if not any(row_sig):
            return True

        for existing in existing_rows:
            existing_sig = tuple(self._normalize_title(cell) for cell in existing)
            if row_sig == existing_sig:
                return True

        return False

    def _remove_repeated_header_rows(self, columns: list[str], rows: list[list[str]]) -> list[list[str]]:
        if not columns:
            return rows

        normalized_header = [self._normalize_header(col) for col in columns]
        cleaned_rows: list[list[str]] = []

        for row in rows:
            normalized_row = [self._normalize_header(cell) for cell in row]
            if normalized_row == normalized_header:
                continue
            cleaned_rows.append(row)

        return cleaned_rows

    # ------------------------------------------------------------------
    # WORKBOOK PLANNING
    # ------------------------------------------------------------------

    def _build_preliminary_workbook_plan(
        self,
        merged_model: dict[str, Any],
        source_name: str,
    ) -> dict[str, Any]:
        workbook_title = self._human_title(source_name, merged_model.get("document_type", "document"))
        sheets: list[dict[str, Any]] = []

        summary_rows: list[list[str]] = []
        for kv in merged_model.get("key_values", []):
            label = str(kv.get("label", "")).strip()
            value = str(kv.get("value", "")).strip()
            if label or value:
                summary_rows.append([label, value])

        if summary_rows:
            sheets.append(
                {
                    "name": "Summary",
                    "kind": "summary",
                    "columns": ["Field", "Value"],
                    "rows": summary_rows,
                }
            )

        for idx, table in enumerate(merged_model.get("tables", []), start=1):
            title = str(table.get("title", "")).strip() or f"Table {idx}"
            columns = [str(col).strip() for col in table.get("columns", [])]
            rows = [[str(cell).strip() for cell in row] for row in table.get("rows", [])]

            sheet_name = self._smart_sheet_name(title, columns, idx)

            sheets.append(
                {
                    "name": sheet_name,
                    "kind": "table",
                    "columns": columns,
                    "rows": rows,
                }
            )

        raw_lines = [str(line).strip() for line in merged_model.get("raw_lines", []) if str(line).strip()]
        if raw_lines and not sheets:
            sheets.append(
                {
                    "name": "Raw Extract",
                    "kind": "raw",
                    "columns": ["Text"],
                    "rows": [[line] for line in raw_lines],
                }
            )
        elif raw_lines:
            sheets.append(
                {
                    "name": "Raw Extract",
                    "kind": "raw",
                    "columns": ["Text"],
                    "rows": [[line] for line in raw_lines[:200]],
                }
            )

        if not sheets:
            sheets.append(
                {
                    "name": "Summary",
                    "kind": "summary",
                    "columns": ["Message"],
                    "rows": [["No extractable data found"]],
                }
            )

        return {
            "workbook_title": workbook_title,
            "sheets": sheets,
        }

    def _human_title(self, source_name: str, document_type: str) -> str:
        clean_source = source_name.replace("_", " ").replace("-", " ").strip()
        clean_source = " ".join(clean_source.split()) or "Extracted Document"
        clean_doc_type = document_type.replace("_", " ").strip().title() if document_type else "Document"
        return f"{clean_doc_type} - {clean_source}"

    def _smart_sheet_name(self, title: str, columns: list[str], idx: int) -> str:
        normalized_title = self._normalize_title(title)
        header_sig = self._columns_signature(columns)

        if "line item" in normalized_title or "item" in normalized_title:
            return "Line Items"
        if "transaction" in normalized_title:
            return "Transactions"
        if "statement" in normalized_title:
            return "Statement Rows"
        if "invoice" in normalized_title:
            return "Invoice Table"
        if "payment" in normalized_title:
            return "Payments"

        if "date|description|amount" in header_sig:
            return "Transactions"
        if "item|qty|price" in header_sig or "item|quantity|rate" in header_sig:
            return "Line Items"
        if "description|amount" in header_sig:
            return "Entries"
        if "date|debit|credit|balance" in header_sig:
            return "Ledger"

        safe = title.strip() or f"Table {idx}"
        safe = re.sub(r"[\\/*?:\[\]]+", " ", safe)
        safe = " ".join(safe.split()).strip()
        return (safe or f"Table {idx}")[:31]

    def _refine_workbook_plan_with_ai(
        self,
        page_results: list[dict[str, Any]],
        preliminary_workbook: dict[str, Any],
    ) -> dict[str, Any]:
        developer_prompt = (
            "You are a workbook planner for document extraction.\n"
            "You will receive:\n"
            "1. Raw page-wise extraction\n"
            "2. A preliminary workbook plan that already merged same-structure tables across pages\n\n"
            "Your job:\n"
            "1. Keep the merged table structure intact whenever it is already correct.\n"
            "2. Improve sheet names if needed.\n"
            "3. Preserve row order.\n"
            "4. Do not split a merged multi-page table into multiple sheets unless absolutely necessary.\n"
            "5. Keep columns clear, business-friendly, and consistent.\n"
            "6. Rows must remain arrays of strings only.\n"
            "7. Output must strictly match the schema.\n"
            "8. Prefer fewer, cleaner sheets rather than many duplicate sheets."
        )

        payload = {
            "page_results": page_results,
            "preliminary_workbook": preliminary_workbook,
        }

        last_error: Exception | None = None

        for _ in range(2):
            try:
                response = self.client.responses.create(
                    model=self.model,
                    input=[
                        {
                            "role": "developer",
                            "content": [{"type": "input_text", "text": developer_prompt}],
                        },
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "input_text",
                                    "text": json.dumps(payload, ensure_ascii=False),
                                }
                            ],
                        },
                    ],
                    text={
                        "format": {
                            "type": "json_schema",
                            "name": "workbook_plan",
                            "strict": True,
                            "schema": WORKBOOK_SCHEMA,
                        }
                    },
                )

                content = getattr(response, "output_text", None)
                if not content:
                    raise RuntimeError("Empty model output for workbook refinement.")

                refined = json.loads(content)

                if refined.get("sheets"):
                    return refined

            except Exception as e:
                last_error = e

        return preliminary_workbook

    # ------------------------------------------------------------------
    # LAYOUT HELPERS
    # ------------------------------------------------------------------

    def _page_json_to_layout_items(
        self,
        page_json: dict[str, Any],
        width: float,
    ) -> tuple[list[dict[str, Any]], str]:
        layout_items: list[dict[str, Any]] = []
        raw_text_parts: list[str] = []
        current_y = 20.0

        for kv in page_json.get("key_values", []):
            label = str(kv.get("label", "")).strip()
            value = str(kv.get("value", "")).strip()
            text = f"{label}: {value}" if label else value
            text = text.strip(": ").strip()

            if not text:
                continue

            layout_items.append(
                {
                    "type": "text",
                    "bbox": [20.0, current_y, max(300.0, width - 20.0), current_y + 24.0],
                    "text": text,
                }
            )
            raw_text_parts.append(text)
            current_y += 28.0

        for line in page_json.get("raw_lines", []):
            text = str(line).strip()
            if not text:
                continue

            layout_items.append(
                {
                    "type": "text",
                    "bbox": [20.0, current_y, max(300.0, width - 20.0), current_y + 24.0],
                    "text": text,
                }
            )
            raw_text_parts.append(text)
            current_y += 26.0

        for idx, table in enumerate(page_json.get("tables", []), start=1):
            columns = [str(col).strip() for col in table.get("columns", [])]
            rows = [[str(cell).strip() for cell in row] for row in table.get("rows", [])]
            title = str(table.get("title", f"TABLE_{idx}")).strip() or f"TABLE_{idx}"

            table_height = 28.0 * (1 + len(rows))
            table_width = max(320.0, min(width - 40.0, 140.0 * max(1, len(columns))))

            layout_items.append(
                {
                    "type": "table",
                    "name": title,
                    "columns": columns,
                    "rows": rows,
                    "bbox": [20.0, current_y, 20.0 + table_width, current_y + table_height],
                }
            )

            raw_text_parts.append(title)
            for row in rows:
                raw_text_parts.append(" | ".join(row))

            current_y += table_height + 36.0

        return layout_items, "\n".join(raw_text_parts).strip()


AIScanParser = AIScanParserService