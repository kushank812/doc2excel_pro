from __future__ import annotations

from copy import deepcopy
from typing import Any

from app.core.config import get_settings

settings = get_settings()


class AIOrganizerService:
    def organize(self, extraction: dict[str, Any]) -> dict[str, Any]:
        # This method is intentionally built as a production-safe placeholder.
        # It already improves organization deterministically.
        # Later, connect a real LLM provider here if ENABLE_AI_ORGANIZER is true.
        data = deepcopy(extraction)

        tables = data.get("tables", [])
        for table in tables:
            columns = table.get("columns", [])
            normalized = [self._normalize_column_name(col) for col in columns]
            table["normalized_columns"] = normalized

        data["organization_suggestions"] = {
            "sheet_order": self._suggest_sheet_order(data),
            "document_bucket": self._bucket_document(data.get("document_type", "UNKNOWN")),
            "notes": [
                "Review normalized columns before export.",
                "Keep summary data separate from line-item data.",
            ],
        }
        return data

    def _normalize_column_name(self, value: str) -> str:
        cleaned = (value or "").strip().upper().replace(" ", "_")
        cleaned = cleaned.replace("%", "_PERCENT")
        cleaned = "".join(ch for ch in cleaned if ch.isalnum() or ch == "_")
        return cleaned or "COLUMN"

    def _suggest_sheet_order(self, data: dict[str, Any]) -> list[str]:
        if data.get("document_type") == "INVOICE":
            return ["SUMMARY", "LINE_ITEMS", "RAW_TEXT"]
        if data.get("tables"):
            return ["SUMMARY", "TABLES", "RAW_TEXT"]
        return ["SUMMARY", "RAW_TEXT"]

    def _bucket_document(self, document_type: str) -> str:
        buckets = {
            "INVOICE": "FINANCIAL",
            "RECEIPT": "FINANCIAL",
            "STATEMENT": "FINANCIAL",
            "TABULAR_DOCUMENT": "STRUCTURED",
            "GENERIC_DOCUMENT": "UNSTRUCTURED",
        }
        return buckets.get(document_type, "UNCLASSIFIED")
