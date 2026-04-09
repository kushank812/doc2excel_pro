from __future__ import annotations

import shutil
import tempfile
from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.core.config import get_settings
from app.services.ai_scan_parser import AIScanParserService
from app.services.excel_exporter import export_workbook_plan_to_excel
from app.services.parser import ParserService
from app.services.validation_service import ValidationService

router = APIRouter(prefix="/api/documents", tags=["documents"])
settings = get_settings()


def _validate_upload(file: UploadFile) -> str:
    filename = file.filename or ""
    suffix = Path(filename).suffix.lower()

    allowed = set(settings.allowed_extensions_set) | {".docx"}

    if suffix not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {sorted(allowed)}",
        )

    return suffix


def _safe_sheet_name(name: str) -> str:
    bad = ['\\', '/', '*', '?', ':', '[', ']']
    out = str(name or "Sheet")
    for ch in bad:
        out = out.replace(ch, " ")
    out = " ".join(out.split()).strip() or "Sheet"
    return out[:31]


def _build_basic_workbook_from_parsed(
    parsed: dict[str, Any],
    original_name: str,
) -> dict[str, Any]:
    workbook_title = f"Extracted - {original_name}"
    sheets: list[dict[str, Any]] = []

    raw_text = str(parsed.get("raw_text", "") or "").strip()
    tables = parsed.get("tables", []) or []
    warnings = parsed.get("warnings", []) or []

    summary_rows: list[list[str]] = []

    for line in raw_text.splitlines():
        line = line.strip()
        if not line or ":" not in line:
            continue

        left, right = line.split(":", 1)
        left = left.strip()
        right = right.strip()

        if left and right and len(left) <= 60:
            summary_rows.append([left, right])

    for w in warnings:
        summary_rows.append(["Warning", str(w)])

    if summary_rows:
        sheets.append(
            {
                "name": "Summary",
                "kind": "summary",
                "columns": ["Field", "Value"],
                "rows": summary_rows,
            }
        )

    for idx, table in enumerate(tables, start=1):
        name = getattr(table, "name", None) or f"Table {idx}"
        columns = getattr(table, "columns", None) or []
        rows = getattr(table, "rows", None) or []

        normalized_columns = [str(c) for c in columns] if columns else []
        normalized_rows = [[str(cell) for cell in row] for row in rows]

        sheets.append(
            {
                "name": _safe_sheet_name(name),
                "kind": "table",
                "columns": normalized_columns,
                "rows": normalized_rows,
            }
        )

    raw_lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    if raw_lines:
        sheets.append(
            {
                "name": "Raw Extract",
                "kind": "raw",
                "columns": ["Text"],
                "rows": [[line] for line in raw_lines],
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


def _build_excel_bytes(workbook_plan: dict[str, Any]) -> bytes:
    with tempfile.TemporaryDirectory() as tmpdir:
        output_path = Path(tmpdir) / "result.xlsx"
        export_workbook_plan_to_excel(workbook_plan, output_path)
        if not output_path.exists():
            raise HTTPException(status_code=500, detail="Excel file was not generated")
        return output_path.read_bytes()


def _excel_download_response(excel_bytes: bytes, original_name: str) -> StreamingResponse:
    stem = Path(original_name).stem or "document"
    download_name = f"{stem}_extracted.xlsx"

    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{download_name}"'
        },
    )


@router.post("/upload-extract-export")
async def upload_extract_export(file: UploadFile = File(...)):
    """
    BASIC MODE
    Keeps old endpoint name so frontend does not break.
    """
    _validate_upload(file)

    original_name = file.filename or "document"
    input_suffix = Path(original_name).suffix.lower()

    with tempfile.TemporaryDirectory() as tmpdir:
        saved_input = Path(tmpdir) / f"input{input_suffix}"

        try:
            with saved_input.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            parser = ParserService()
            parsed = parser.parse(str(saved_input))

            workbook_plan = _build_basic_workbook_from_parsed(parsed, original_name)

            validator = ValidationService()
            validated_workbook = validator.validate_workbook_plan(workbook_plan)

            validated_plan = validated_workbook.get("workbook", workbook_plan)
            excel_bytes = _build_excel_bytes(validated_plan)

            return _excel_download_response(excel_bytes, original_name)

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e
        finally:
            await file.close()


@router.post("/ai-upload-extract-export")
async def ai_upload_extract_export(file: UploadFile = File(...)):
    """
    AI MODE
    Keeps old endpoint name so frontend does not break.
    """
    _validate_upload(file)

    original_name = file.filename or "document"
    input_suffix = Path(original_name).suffix.lower()

    with tempfile.TemporaryDirectory() as tmpdir:
        saved_input = Path(tmpdir) / f"input{input_suffix}"

        try:
            with saved_input.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            parser = AIScanParserService()
            extracted = parser.extract_document(saved_input)

            workbook_plan = extracted.get("workbook") or {
                "workbook_title": f"Extracted - {original_name}",
                "sheets": [],
            }

            validator = ValidationService()
            validated_workbook = validator.validate_workbook_plan(workbook_plan)

            validated_plan = validated_workbook.get("workbook", workbook_plan)
            excel_bytes = _build_excel_bytes(validated_plan)

            return _excel_download_response(excel_bytes, original_name)

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e)) from e
        finally:
            await file.close()


@router.get("/history")
def get_history():
    """
    History disabled in stateless deployment-safe version.
    Returning empty list keeps frontend from breaking.
    """
    return []


@router.get("/download/excel/{doc_id}")
def download_excel(doc_id: str):
    raise HTTPException(
        status_code=410,
        detail="Saved Excel downloads are disabled in the stateless deployment version.",
    )


@router.get("/download/json/{doc_id}")
def download_json(doc_id: str):
    raise HTTPException(
        status_code=410,
        detail="Saved JSON downloads are disabled in the stateless deployment version.",
    )