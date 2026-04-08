import shutil
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import get_settings

settings = get_settings()


class StorageService:
    def __init__(self) -> None:
        self.root = Path(settings.storage_root)
        self.uploads = self.root / "uploads"
        self.exports = self.root / "exports"
        self.uploads.mkdir(parents=True, exist_ok=True)
        self.exports.mkdir(parents=True, exist_ok=True)

    def save_upload(self, file: UploadFile) -> tuple[str, str, int]:
        extension = Path(file.filename or "").suffix.lower()
        stored_name = f"{uuid.uuid4().hex}{extension}"
        target = self.uploads / stored_name

        with target.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        size = target.stat().st_size
        return stored_name, str(target), size

    def export_path_for(self, document_id: int, base_name: str) -> str:
        safe_name = Path(base_name).stem.replace(" ", "_")
        return str(self.exports / f"document_{document_id}_{safe_name}.xlsx")
