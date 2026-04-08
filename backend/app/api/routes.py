from __future__ import annotations

import json
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.core.config import get_settings
from app.services.ai_scan_parser import AIScanParserService
from app.services.excel_exporter import export_workbook_plan_to_excel
from app.services.parser import ParserService
from app.services.validation_service import ValidationService

router = APIRouter(prefix="/api/documents", tags=["documents"])
settings = get_settings()

BASE_STORAGE = Path(settings.STORAGE_ROOT)
UPLOAD_DIR = BASE_STORAGE / "uploads"
EXPORT_DIR = BASE_STORAGE / "exports"
JSON_DIR = BASE_STORAGE / "json"
HISTORY_FILE = BASE_STORAGE / "history.json"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
EXPORT_DIR.mkdir(parents=True, exist_ok=True)
JSON_DIR.mkdir(parents=True, exist_ok=True)


def _validate_upload(file: UploadFile) -> str:
    filename = file.filename or ""
    suffix = Path(filename).suffix.lower()

    if suffix not in settings.allowed_extensions_set:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {sorted(settings.allowed_extensions_set)}",
        )

    return suffix


def _safe_sheet_name(name: str) -> str:
    bad = ['\\', '/', '*', '?', ':', '[', ']']
    out = str(name or "Sheet")
    for ch in bad:
        out = out.replace(ch, " ")
    out = " ".join(out.split()).strip() or "Sheet"
    return out[:31]


def _load_history() -> list[dict[str, Any]]:
    if not HISTORY_FILE.exists():
        return []

    try:
        with HISTORY_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception:
        return []


def _save_history(history: list[dict[str, Any]]) -> None:
    with HISTORY_FILE.open("w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)


def _append_history_entry(
    *,
    doc_id: str,
    original_name: str,
    mode: str,
    validation: dict[str, Any] | None,
) -> None:
    history = _load_history()

    entry = {
        "id": doc_id,
        "file_name": original_name,
        "mode": mode,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "excel_url": f"/api/documents/download/excel/{doc_id}",
        "json_url": f"/api/documents/download/json/{doc_id}",
        "status": (validation or {}).get("status", "unknown"),
        "confidence_score": (validation or {}).get("confidence_score", 0),
        "warning_count": len((validation or {}).get("warnings", []) or []),
    }

    history.append(entry)
    _save_history(history)


def _build_basic_workbook_from_parsed(parsed: dict[str, Any], original_name: str) -> dict[str, Any]:
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

    if warnings:
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


def _save_outputs(
    doc_id: str,
    original_name: str,
    extracted_payload: dict[str, Any],
    validated_workbook: dict[str, Any],
    mode: str,
) -> dict[str, Any]:
    saved_json = JSON_DIR / f"{doc_id}.json"
    saved_excel = EXPORT_DIR / f"{doc_id}.xlsx"

    workbook_plan = {
        "workbook_title": validated_workbook.get("workbook_title", "Extracted Data"),
        "sheets": validated_workbook.get("sheets", []),
    }
    validation = validated_workbook.get("validation", {})

    full_payload = {
        "original_name": original_name,
        "mode": mode,
        "workbook": workbook_plan,
        "validation": validation,
        "extracted": extracted_payload,
    }

    with saved_json.open("w", encoding="utf-8") as f:
        json.dump(full_payload, f, ensure_ascii=False, indent=2)

    export_workbook_plan_to_excel(workbook_plan, saved_excel)

    _append_history_entry(
        doc_id=doc_id,
        original_name=original_name,
        mode=mode,
        validation=validation,
    )

    return {
        "ok": True,
        "document_id": doc_id,
        "original_name": original_name,
        "mode": mode,
        "json_download_url": f"/api/documents/download/json/{doc_id}",
        "excel_download_url": f"/api/documents/download/excel/{doc_id}",
        "preview": workbook_plan,
        "validation": validation,
    }


@router.post("/upload-extract-export")
async def upload_extract_export(file: UploadFile = File(...)):
    """
    BASIC MODE
    """
    _validate_upload(file)

    doc_id = str(uuid.uuid4())
    original_name = file.filename or "document"
    input_suffix = Path(original_name).suffix.lower()
    saved_input = UPLOAD_DIR / f"{doc_id}{input_suffix}"

    try:
        with saved_input.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        parser = ParserService()
        parsed = parser.parse(str(saved_input))
        workbook_plan = _build_basic_workbook_from_parsed(parsed, original_name)

        validator = ValidationService()
        validated_workbook = validator.validate_workbook_plan(workbook_plan)

        response = _save_outputs(
            doc_id=doc_id,
            original_name=original_name,
            extracted_payload=parsed,
            validated_workbook=validated_workbook,
            mode="basic",
        )
        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/ai-upload-extract-export")
async def ai_upload_extract_export(file: UploadFile = File(...)):
    """
    AI MODE
    """
    _validate_upload(file)

    doc_id = str(uuid.uuid4())
    original_name = file.filename or "document"
    input_suffix = Path(original_name).suffix.lower()
    saved_input = UPLOAD_DIR / f"{doc_id}{input_suffix}"

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

        response = _save_outputs(
            doc_id=doc_id,
            original_name=original_name,
            extracted_payload=extracted,
            validated_workbook=validated_workbook,
            mode="ai",
        )
        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/history")
def get_history():
    history = _load_history()
    history_sorted = sorted(history, key=lambda x: x.get("created_at", ""), reverse=True)
    return history_sorted


@router.get("/download/excel/{doc_id}")
def download_excel(doc_id: str):
    path = EXPORT_DIR / f"{doc_id}.xlsx"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Excel file not found")

    return FileResponse(
        path=str(path),
        filename=path.name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.get("/download/json/{doc_id}")
def download_json(doc_id: str):
    path = JSON_DIR / f"{doc_id}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="JSON file not found")

    return FileResponse(
        path=str(path),
        filename=path.name,
        media_type="application/json",
    )