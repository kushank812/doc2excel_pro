from datetime import datetime

from pydantic import BaseModel

from app.schemas.extraction import ExtractionResult


class DocumentOut(BaseModel):
    id: int
    original_name: str
    content_type: str
    extension: str
    size_bytes: int
    status: str
    document_type: str
    export_path: str | None = None
    ai_used: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentDetailOut(DocumentOut):
    raw_text: str | None = None
    warnings: str | None = None
    extraction: ExtractionResult | None = None
    organized: dict | None = None
