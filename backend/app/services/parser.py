from __future__ import annotations

import io
import re
import shutil
from pathlib import Path
from typing import Any

import pytesseract
from docx import Document as DocxDocument
from PIL import Image, ImageFilter, ImageOps
from pypdf import PdfReader
import pypdfium2 as pdfium

from app.core.config import get_settings
from app.schemas.extraction import TableData

settings = get_settings()

tesseract_cmd = getattr(settings, "TESSERACT_CMD", "") or getattr(settings, "tesseract_cmd", "")
if tesseract_cmd:
    pytesseract.pytesseract.tesseract_cmd = tesseract_cmd


class ParserService:
    def parse(self, file_path: str) -> dict[str, Any]:
        ext = Path(file_path).suffix.lower()

        if ext == ".pdf":
            return self._parse_pdf(file_path)
        if ext == ".docx":
            return self._parse_docx(file_path)
        if ext in {".png", ".jpg", ".jpeg", ".webp"}:
            return self._parse_image(file_path)

        raise ValueError(f"Unsupported file type: {ext}")

    def _parse_pdf(self, file_path: str) -> dict[str, Any]:
        current_settings = get_settings()
        enable_ai_scan = bool(getattr(current_settings, "ENABLE_AI_SCAN", False))
        ai_provider = str(getattr(current_settings, "AI_PROVIDER", "openai")).lower()

        if enable_ai_scan and ai_provider == "openai":
            try:
                from app.services.ai_scan_parser import AIScanParserService

                ai_parser = AIScanParserService()
                return ai_parser.parse_pdf_to_layout(file_path)
            except Exception as e:
                # continue to non-AI fallback
                fallback = self._parse_pdf_without_ai(file_path)
                fallback["warnings"].append(f"AI PDF extraction failed, fallback used: {str(e)}")
                return fallback

        return self._parse_pdf_without_ai(file_path)

    def _parse_pdf_without_ai(self, file_path: str) -> dict[str, Any]:
        reader = PdfReader(file_path)

        pages_text: list[str] = []
        layout_pages: list[dict[str, Any]] = []
        warnings: list[str] = []

        for page_index, page in enumerate(reader.pages, start=1):
            page_text = (page.extract_text() or "").strip()
            line_items: list[dict[str, Any]] = []

            if page_text:
                y = 40.0
                for line in [ln.strip() for ln in page_text.splitlines() if ln.strip()]:
                    line_items.append(
                        {
                            "type": "text",
                            "bbox": [40.0, y, 760.0, y + 22.0],
                            "text": line,
                        }
                    )
                    y += 26.0
            else:
                try:
                    self._ensure_tesseract_available()
                    image_bytes = self._render_pdf_page_to_png(file_path, page_index - 1)
                    ocr_result = self._ocr_image_bytes_with_boxes(image_bytes)

                    page_text = ocr_result["raw_text"]
                    line_items = ocr_result["layout_items"]
                    warnings.append(
                        f"OCR used on PDF page {page_index}. Extracted text is based on scanned content."
                    )
                except Exception as e:
                    warnings.append(f"PDF page {page_index} had weak extraction: {str(e)}")

            pages_text.append(page_text)

            layout_pages.append(
                {
                    "page_no": page_index,
                    "page_width": 800.0,
                    "page_height": 1000.0,
                    "items": line_items,
                }
            )

        return {
            "raw_text": "\n\n".join([t for t in pages_text if t.strip()]).strip(),
            "tables": [],
            "warnings": warnings,
            "meta": {
                "source_type": "PDF",
                "pages": len(layout_pages),
                "layout_pages": layout_pages,
            },
        }

    def _parse_docx(self, file_path: str) -> dict[str, Any]:
        doc = DocxDocument(file_path)
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        tables: list[TableData] = []

        layout_pages: list[dict[str, Any]] = [
            {
                "page_no": 1,
                "page_width": 800.0,
                "page_height": 1000.0,
                "items": [],
            }
        ]

        current_y = 40.0

        for paragraph in paragraphs:
            layout_pages[0]["items"].append(
                {
                    "type": "text",
                    "bbox": [60.0, current_y, 700.0, current_y + 24.0],
                    "text": paragraph,
                }
            )
            current_y += 32.0

        for idx, table in enumerate(doc.tables, start=1):
            rows: list[list[str]] = []
            for row in table.rows:
                rows.append([cell.text.strip() for cell in row.cells])

            columns = rows[0] if rows else []
            data_rows = rows[1:] if len(rows) > 1 else []

            table_obj = TableData(
                name=f"DOCX_TABLE_{idx}",
                columns=columns,
                rows=data_rows,
            )
            tables.append(table_obj)

            table_height = 28.0 * (1 + len(data_rows))
            table_width = max(250.0, 120.0 * max(1, len(columns)))

            layout_pages[0]["items"].append(
                {
                    "type": "table",
                    "name": table_obj.name,
                    "columns": table_obj.columns,
                    "rows": table_obj.rows,
                    "bbox": [60.0, current_y, 60.0 + table_width, current_y + table_height],
                }
            )
            current_y += table_height + 40.0

        return {
            "raw_text": "\n".join(paragraphs),
            "tables": tables,
            "warnings": [],
            "meta": {
                "source_type": "DOCX",
                "layout_pages": layout_pages,
            },
        }

    def _parse_image(self, file_path: str) -> dict[str, Any]:
        current_settings = get_settings()
        enable_ai_scan = bool(getattr(current_settings, "ENABLE_AI_SCAN", False))
        ai_provider = str(getattr(current_settings, "AI_PROVIDER", "openai")).lower()

        if enable_ai_scan and ai_provider == "openai":
            try:
                from app.services.ai_scan_parser import AIScanParserService

                ai_parser = AIScanParserService()
                return ai_parser.parse_image_to_layout(file_path)
            except Exception as e:
                self._ensure_tesseract_available()
                ocr_result = self._ocr_image_with_boxes(file_path)

                return {
                    "raw_text": ocr_result["raw_text"],
                    "tables": [],
                    "warnings": [
                        f"AI scan failed, OCR fallback used: {str(e)}",
                        "Image OCR used. Review extracted Excel layout carefully.",
                    ],
                    "meta": {
                        "source_type": "IMAGE_OCR_FALLBACK",
                        "layout_pages": [
                            {
                                "page_no": 1,
                                "page_width": float(ocr_result["image_width"]),
                                "page_height": float(ocr_result["image_height"]),
                                "items": ocr_result["layout_items"],
                            }
                        ],
                    },
                }

        self._ensure_tesseract_available()
        ocr_result = self._ocr_image_with_boxes(file_path)

        return {
            "raw_text": ocr_result["raw_text"],
            "tables": [],
            "warnings": ["Image OCR used. Review extracted Excel layout carefully."],
            "meta": {
                "source_type": "IMAGE",
                "layout_pages": [
                    {
                        "page_no": 1,
                        "page_width": float(ocr_result["image_width"]),
                        "page_height": float(ocr_result["image_height"]),
                        "items": ocr_result["layout_items"],
                    }
                ],
            },
        }

    def _render_pdf_page_to_png(self, file_path: str, page_index: int) -> bytes:
        pdf = pdfium.PdfDocument(file_path)
        try:
            page = pdf[page_index]
            bitmap = page.render(scale=2.0)
            pil_image = bitmap.to_pil()

            buf = io.BytesIO()
            pil_image.save(buf, format="PNG")

            bitmap.close()
            page.close()
            return buf.getvalue()
        finally:
            pdf.close()

    def _ocr_image_with_boxes(self, file_path: str) -> dict[str, Any]:
        original = Image.open(file_path).convert("L")
        return self._ocr_pil_image_with_boxes(original)

    def _ocr_image_bytes_with_boxes(self, image_bytes: bytes) -> dict[str, Any]:
        image = Image.open(io.BytesIO(image_bytes)).convert("L")
        return self._ocr_pil_image_with_boxes(image)

    def _ocr_pil_image_with_boxes(self, original: Image.Image) -> dict[str, Any]:
        orig_width, orig_height = original.size

        variants = self._build_ocr_variants(original)

        best_words: list[dict[str, Any]] = []
        best_score = -1.0

        for variant_image, scale_x, scale_y in variants:
            for psm in (6, 11):
                words = self._ocr_words_from_image(
                    image=variant_image,
                    psm=psm,
                    scale_x=scale_x,
                    scale_y=scale_y,
                )
                score = self._score_ocr_words(words)
                if score > best_score:
                    best_score = score
                    best_words = words

        line_items = self._group_ocr_words_into_lines(best_words)

        return {
            "raw_text": "\n".join([item["text"] for item in line_items]).strip(),
            "layout_items": line_items,
            "image_width": orig_width,
            "image_height": orig_height,
        }

    def _build_ocr_variants(self, image: Image.Image) -> list[tuple[Image.Image, float, float]]:
        variants: list[tuple[Image.Image, float, float]] = []

        variants.append((image.copy(), 1.0, 1.0))

        up2 = image.resize((image.width * 2, image.height * 2))
        variants.append((up2, 2.0, 2.0))

        sharp2 = up2.filter(ImageFilter.SHARPEN)
        variants.append((sharp2, 2.0, 2.0))

        auto2 = ImageOps.autocontrast(sharp2)
        variants.append((auto2, 2.0, 2.0))

        thresh2 = auto2.point(lambda p: 255 if p > 180 else 0)
        variants.append((thresh2, 2.0, 2.0))

        return variants

    def _ocr_words_from_image(
        self,
        image: Image.Image,
        psm: int,
        scale_x: float,
        scale_y: float,
    ) -> list[dict[str, Any]]:
        data = pytesseract.image_to_data(
            image,
            output_type=pytesseract.Output.DICT,
            config=f"--oem 3 --psm {psm}",
        )

        words: list[dict[str, Any]] = []
        n = len(data["text"])

        for i in range(n):
            text = (data["text"][i] or "").strip()
            if not text:
                continue

            conf_raw = data.get("conf", [""] * n)[i]
            try:
                conf = float(conf_raw)
            except Exception:
                conf = -1.0

            x = int(data["left"][i])
            y = int(data["top"][i])
            w = int(data["width"][i])
            h = int(data["height"][i])

            left = x / scale_x
            top = y / scale_y
            right = (x + w) / scale_x
            bottom = (y + h) / scale_y

            words.append(
                {
                    "text": text,
                    "left": left,
                    "top": top,
                    "right": right,
                    "bottom": bottom,
                    "conf": conf,
                }
            )

        return words

    def _score_ocr_words(self, words: list[dict[str, Any]]) -> float:
        if not words:
            return -1.0

        score = 0.0
        valid = 0

        for word in words:
            conf = float(word.get("conf", 0.0))
            if conf >= 0:
                score += conf
                valid += 1

        if valid:
            score = score / valid

        return score

    def _group_ocr_words_into_lines(self, words: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not words:
            return []

        for word in words:
            word["cy"] = (float(word["top"]) + float(word["bottom"])) / 2.0
            word["h"] = max(1.0, float(word["bottom"]) - float(word["top"]))

        words = sorted(words, key=lambda w: (w["cy"], w["left"]))

        avg_height = sum(w["h"] for w in words) / max(1, len(words))
        y_threshold = max(8.0, avg_height * 0.7)

        row_groups: list[list[dict[str, Any]]] = []
        row_centers: list[float] = []

        for word in words:
            placed = False
            for idx, center in enumerate(row_centers):
                if abs(word["cy"] - center) <= y_threshold:
                    row_groups[idx].append(word)
                    row_centers[idx] = sum(w["cy"] for w in row_groups[idx]) / len(row_groups[idx])
                    placed = True
                    break

            if not placed:
                row_groups.append([word])
                row_centers.append(word["cy"])

        line_items: list[dict[str, Any]] = []

        for group in row_groups:
            group.sort(key=lambda w: w["left"])

            parts: list[str] = []
            prev_right = None
            avg_char_width = sum(
                max(1.0, (w["right"] - w["left"]) / max(1, len(str(w["text"]))))

                for w in group
            ) / max(1, len(group))

            for w in group:
                word_text = str(w["text"]).strip()
                if not word_text:
                    continue

                if prev_right is not None:
                    gap = float(w["left"]) - float(prev_right)
                    if gap > avg_char_width * 1.5:
                        parts.append(" ")

                parts.append(word_text)
                prev_right = float(w["right"])

            text = self._clean_ocr_line("".join(parts))
            if not text:
                continue

            x0 = min(float(w["left"]) for w in group)
            y0 = min(float(w["top"]) for w in group)
            x1 = max(float(w["right"]) for w in group)
            y1 = max(float(w["bottom"]) for w in group)

            line_items.append(
                {
                    "type": "text",
                    "bbox": [x0, y0, x1, y1],
                    "text": text,
                }
            )

        line_items.sort(key=lambda item: (item["bbox"][1], item["bbox"][0]))
        return line_items

    def _clean_ocr_line(self, text: str) -> str:
        text = re.sub(r"\s+", " ", (text or "").strip())
        text = re.sub(r"^[\.\,\;\:\-]+(?=\S)", "", text).strip()
        return text

    def _ensure_tesseract_available(self) -> None:
        configured_cmd = getattr(settings, "TESSERACT_CMD", "") or getattr(settings, "tesseract_cmd", "")
        configured_cmd = configured_cmd.strip()

        if configured_cmd:
            if not Path(configured_cmd).exists():
                raise ValueError(
                    f"TESSERACT_CMD is set but file was not found: {configured_cmd}"
                )
            return

        if shutil.which("tesseract"):
            return

        raise ValueError(
            "Tesseract OCR is not installed or not available in PATH. "
            "Install Tesseract and set TESSERACT_CMD in .env for image/scanned extraction."
        )