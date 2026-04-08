from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ExtractionTemplate(Base):
    __tablename__ = "extraction_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    template_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    document_type: Mapped[str] = mapped_column(String(100), nullable=False)
    vendor_hint: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mapping_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
