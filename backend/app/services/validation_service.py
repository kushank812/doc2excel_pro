from __future__ import annotations

import re
from typing import Any


class ValidationService:
    def validate_workbook_plan(self, workbook_plan: dict[str, Any]) -> dict[str, Any]:
        workbook_title = str(workbook_plan.get("workbook_title") or "Extracted Data").strip()
        sheets = workbook_plan.get("sheets", []) or []

        normalized_sheets: list[dict[str, Any]] = []
        all_warnings: list[dict[str, Any]] = []

        score = 100

        if not sheets:
            all_warnings.append(
                {
                    "level": "error",
                    "sheet": None,
                    "message": "Workbook contains no sheets.",
                    "code": "EMPTY_WORKBOOK",
                }
            )
            score -= 50

        for sheet in sheets:
            validated_sheet, sheet_warnings, sheet_penalty = self._validate_sheet(sheet)
            normalized_sheets.append(validated_sheet)
            all_warnings.extend(sheet_warnings)
            score -= sheet_penalty

        score = max(0, min(100, score))

        if any(w["level"] == "error" for w in all_warnings):
            status = "review_required"
        elif any(w["level"] == "warning" for w in all_warnings):
            status = "review_recommended"
        else:
            status = "passed"

        return {
            "workbook_title": workbook_title,
            "sheets": normalized_sheets,
            "validation": {
                "status": status,
                "confidence_score": score,
                "warnings": all_warnings,
                "summary": self._build_summary(score, all_warnings),
            },
        }

    # ------------------------------------------------------------------
    # SHEET VALIDATION
    # ------------------------------------------------------------------

    def _validate_sheet(self, sheet: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]], int]:
        name = str(sheet.get("name") or "Sheet").strip()
        kind = str(sheet.get("kind") or "table").strip()
        columns = [self._clean_text(c) for c in (sheet.get("columns", []) or [])]
        rows = [[self._clean_text(cell) for cell in row] for row in (sheet.get("rows", []) or [])]

        warnings: list[dict[str, Any]] = []
        penalty = 0

        if not columns:
            warnings.append(
                self._warning("warning", name, "Sheet has no columns.", "NO_COLUMNS")
            )
            penalty += 8

        total_cols = max(len(columns), max((len(r) for r in rows), default=0), 1)

        if len(columns) < total_cols:
            for i in range(len(columns), total_cols):
                columns.append(f"Column {i + 1}")

            warnings.append(
                self._warning(
                    "warning",
                    name,
                    "Missing columns were auto-filled to match row width.",
                    "AUTO_FILLED_COLUMNS",
                )
            )
            penalty += 5

        normalized_rows = self._pad_rows(rows, total_cols)

        duplicate_header_indices = self._find_duplicate_header_rows(columns, normalized_rows)
        if duplicate_header_indices:
            normalized_rows = [
                row for idx, row in enumerate(normalized_rows) if idx not in duplicate_header_indices
            ]
            warnings.append(
                self._warning(
                    "warning",
                    name,
                    f"Removed {len(duplicate_header_indices)} repeated header row(s) from data.",
                    "DUPLICATE_HEADERS_REMOVED",
                )
            )
            penalty += min(10, len(duplicate_header_indices) * 2)

        row_shape_issues = self._count_row_shape_issues(rows, total_cols)
        if row_shape_issues > 0:
            warnings.append(
                self._warning(
                    "warning",
                    name,
                    f"{row_shape_issues} row(s) had inconsistent column count and were normalized.",
                    "ROW_WIDTH_NORMALIZED",
                )
            )
            penalty += min(12, row_shape_issues * 2)

        blank_ratio = self._blank_cell_ratio(normalized_rows)
        if blank_ratio >= 0.5 and normalized_rows:
            warnings.append(
                self._warning(
                    "warning",
                    name,
                    f"High blank-cell ratio detected ({blank_ratio:.0%}).",
                    "HIGH_BLANK_RATIO",
                )
            )
            penalty += 10
        elif blank_ratio >= 0.3 and normalized_rows:
            warnings.append(
                self._warning(
                    "info",
                    name,
                    f"Moderate blank-cell ratio detected ({blank_ratio:.0%}).",
                    "MODERATE_BLANK_RATIO",
                )
            )
            penalty += 4

        if kind.lower() == "table" and normalized_rows:
            numeric_warnings, numeric_penalty = self._check_numeric_suspicion(name, columns, normalized_rows)
            warnings.extend(numeric_warnings)
            penalty += numeric_penalty

            total_warnings, total_penalty = self._check_total_rows(name, columns, normalized_rows)
            warnings.extend(total_warnings)
            penalty += total_penalty

        if not normalized_rows:
            warnings.append(
                self._warning(
                    "info",
                    name,
                    "Sheet contains no rows.",
                    "EMPTY_SHEET",
                )
            )
            penalty += 2

        validated_sheet = {
            "name": name,
            "kind": kind,
            "columns": columns,
            "rows": normalized_rows,
        }

        return validated_sheet, warnings, penalty

    # ------------------------------------------------------------------
    # CHECKS
    # ------------------------------------------------------------------

    def _count_row_shape_issues(self, original_rows: list[list[str]], total_cols: int) -> int:
        issues = 0
        for row in original_rows:
            if len(row) != total_cols:
                issues += 1
        return issues

    def _find_duplicate_header_rows(self, columns: list[str], rows: list[list[str]]) -> set[int]:
        normalized_header = [self._normalize_token(c) for c in columns]
        result: set[int] = set()

        for idx, row in enumerate(rows):
            normalized_row = [self._normalize_token(cell) for cell in row]
            if normalized_row == normalized_header:
                result.add(idx)

        return result

    def _blank_cell_ratio(self, rows: list[list[str]]) -> float:
        total = 0
        blank = 0

        for row in rows:
            for cell in row:
                total += 1
                if not self._clean_text(cell):
                    blank += 1

        if total == 0:
            return 0.0

        return blank / total

    def _check_numeric_suspicion(
        self,
        sheet_name: str,
        columns: list[str],
        rows: list[list[str]],
    ) -> tuple[list[dict[str, Any]], int]:
        warnings: list[dict[str, Any]] = []
        penalty = 0

        numeric_like_indices = []
        for idx, col in enumerate(columns):
            col_norm = self._normalize_token(col)
            if any(
                key in col_norm
                for key in [
                    "amount",
                    "total",
                    "rate",
                    "price",
                    "qty",
                    "quantity",
                    "balance",
                    "debit",
                    "credit",
                    "tax",
                    "value",
                ]
            ):
                numeric_like_indices.append(idx)

        for col_idx in numeric_like_indices:
            non_empty = 0
            numeric = 0

            for row in rows:
                if col_idx >= len(row):
                    continue

                cell = self._clean_text(row[col_idx])
                if not cell:
                    continue

                non_empty += 1
                if self._looks_numeric(cell):
                    numeric += 1

            if non_empty >= 3:
                ratio = numeric / max(non_empty, 1)
                if ratio < 0.5:
                    warnings.append(
                        self._warning(
                            "warning",
                            sheet_name,
                            f'Column "{columns[col_idx]}" looks numeric by name but contains many non-numeric values.',
                            "NUMERIC_COLUMN_SUSPECT",
                        )
                    )
                    penalty += 8

        return warnings, penalty

    def _check_total_rows(
        self,
        sheet_name: str,
        columns: list[str],
        rows: list[list[str]],
    ) -> tuple[list[dict[str, Any]], int]:
        warnings: list[dict[str, Any]] = []
        penalty = 0

        first_col_has_total = any(
            self._looks_like_total_label(row[0]) for row in rows if row
        )

        amount_like_columns = [
            idx
            for idx, col in enumerate(columns)
            if any(
                key in self._normalize_token(col)
                for key in ["amount", "total", "balance", "debit", "credit", "tax", "value"]
            )
        ]

        if amount_like_columns and len(rows) >= 3 and not first_col_has_total:
            warnings.append(
                self._warning(
                    "info",
                    sheet_name,
                    "No obvious total row detected in a table that has amount-like columns.",
                    "TOTAL_ROW_NOT_FOUND",
                )
            )
            penalty += 3

        return warnings, penalty

    # ------------------------------------------------------------------
    # HELPERS
    # ------------------------------------------------------------------

    def _pad_rows(self, rows: list[list[str]], total_cols: int) -> list[list[str]]:
        padded: list[list[str]] = []

        for row in rows:
            clean_row = [self._clean_text(v) for v in row]
            if len(clean_row) < total_cols:
                clean_row.extend([""] * (total_cols - len(clean_row)))
            elif len(clean_row) > total_cols:
                clean_row = clean_row[:total_cols]
            padded.append(clean_row)

        return padded

    def _clean_text(self, value: Any) -> str:
        if value is None:
            return ""
        return str(value).replace("\r", " ").replace("\n", " ").strip()

    def _normalize_token(self, text: str) -> str:
        text = self._clean_text(text).lower()
        text = re.sub(r"[^a-z0-9]+", " ", text)
        return " ".join(text.split()).strip()

    def _looks_numeric(self, value: str) -> bool:
        text = self._clean_text(value)
        if not text:
            return False

        cleaned = (
            text.replace(",", "")
            .replace("₹", "")
            .replace("$", "")
            .replace("€", "")
            .replace("£", "")
            .replace("%", "")
            .replace("(", "-")
            .replace(")", "")
            .strip()
        )

        if cleaned.count(".") > 1:
            return False

        try:
            float(cleaned)
            return True
        except Exception:
            return False

    def _looks_like_total_label(self, text: str) -> bool:
        text = self._normalize_token(text)
        return any(
            key in text
            for key in [
                "total",
                "grand total",
                "subtotal",
                "balance",
                "closing balance",
                "opening balance",
                "amount due",
                "net amount",
                "tax total",
            ]
        )

    def _warning(
        self,
        level: str,
        sheet: str | None,
        message: str,
        code: str,
    ) -> dict[str, Any]:
        return {
            "level": level,
            "sheet": sheet,
            "message": message,
            "code": code,
        }

    def _build_summary(self, score: int, warnings: list[dict[str, Any]]) -> str:
        if not warnings:
            return "Workbook passed validation without warnings."

        error_count = sum(1 for w in warnings if w["level"] == "error")
        warning_count = sum(1 for w in warnings if w["level"] == "warning")
        info_count = sum(1 for w in warnings if w["level"] == "info")

        return (
            f"Validation finished with confidence score {score}/100. "
            f"Errors: {error_count}, warnings: {warning_count}, info messages: {info_count}."
        )