from typing import Any

from pydantic import BaseModel, Field


class TableData(BaseModel):
    name: str = "TABLE"
    columns: list[str] = Field(default_factory=list)
    rows: list[list[Any]] = Field(default_factory=list)


class ExtractionResult(BaseModel):
    document_type: str = "UNKNOWN"
    header_fields: dict[str, Any] = Field(default_factory=dict)
    tables: list[TableData] = Field(default_factory=list)
    raw_text: str = ""
    warnings: list[str] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)


class OrganizeRequest(BaseModel):
    use_ai: bool = True


class ExportResponse(BaseModel):
    message: str
    download_url: str
