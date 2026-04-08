# backend/app/services/extractor.py

from __future__ import annotations

from typing import Any, Dict, List


class ExtractionService:
    """
    This service is now a CLEAN NORMALIZER for AI output.

    IMPORTANT:
    - No regex parsing
    - No OCR-style logic
    - No guessing fields
    - Just clean, validate, and standardize AI output
    """

    def normalize(self, parsed: Dict[str, Any], file_name: str) -> Dict[str, Any]:
        """
        Accepts output from AIScanParser and returns a cleaned structure.
        """

        return {
            "file_name": file_name,
            "document_type": self._safe(parsed.get("document_type")),
            "key_values": self._normalize_key_values(parsed.get("key_values")),
            "tables": self._normalize_tables(parsed.get("tables")),
            "raw_lines": self._normalize_list(parsed.get("raw_lines")),
            "notes": self._normalize_list(parsed.get("notes")),
        }

    # -------------------------
    # NORMALIZATION HELPERS
    # -------------------------

    def _safe(self, value: Any) -> str:
        if not value:
            return "UNKNOWN"
        return str(value)

    def _normalize_list(self, value: Any) -> List[str]:
        if not value:
            return []
        return [str(v) for v in value if v is not None]

    def _normalize_key_values(self, kvs: Any) -> List[Dict[str, str]]:
        if not kvs:
            return []

        cleaned = []

        for item in kvs:
            if not isinstance(item, dict):
                continue

            label = str(item.get("label", "")).strip()
            value = str(item.get("value", "")).strip()

            if label and value:
                cleaned.append({
                    "label": label,
                    "value": value,
                })

        return cleaned

    def _normalize_tables(self, tables: Any) -> List[Dict[str, Any]]:
        if not tables:
            return []

        cleaned_tables = []

        for table in tables:
            if not isinstance(table, dict):
                continue

            title = str(table.get("title", "Table")).strip()
            columns = table.get("columns") or []
            rows = table.get("rows") or []

            # Normalize columns
            columns = [str(c).strip() for c in columns if c]

            # Normalize rows
            normalized_rows = []
            for row in rows:
                if isinstance(row, list):
                    normalized_rows.append([str(cell) for cell in row])

            cleaned_tables.append({
                "title": title if title else "Table",
                "columns": columns,
                "rows": normalized_rows,
            })

        return cleaned_tables