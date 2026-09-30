"""
Algorithm A1: Resume Text Extraction
T = eps(F)  where F in {PDF, DOCX}

Detects file type from filename, applies the matching parser, strips
unwanted characters, and normalizes to clean UTF-8 text.
"""
import io
import re
import unicodedata

import pdfplumber
from docx import Document

SUPPORTED_EXTENSIONS = (".pdf", ".docx")


class UnsupportedFileTypeError(ValueError):
    pass


class EmptyResumeError(ValueError):
    pass


def detect_file_type(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return "pdf"
    if lower.endswith(".docx"):
        return "docx"
    raise UnsupportedFileTypeError(
        f"Unsupported file type for '{filename}'. Only PDF and DOCX are supported."
    )


def _extract_pdf_text(file_bytes: bytes) -> str:
    text_chunks = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            text_chunks.append(page_text)
    return "\n".join(text_chunks)


def _extract_docx_text(file_bytes: bytes) -> str:
    doc = Document(io.BytesIO(file_bytes))
    parts = [p.text for p in doc.paragraphs]
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                parts.append(cell.text)
    return "\n".join(parts)


def clean_and_normalize(raw_text: str) -> str:
    """Remove unwanted characters/symbols and normalize to UTF-8/NFKC."""
    text = unicodedata.normalize("NFKC", raw_text)
    # Drop control characters except newlines/tabs
    text = "".join(ch for ch in text if ch == "\n" or ch == "\t" or not unicodedata.category(ch).startswith("C"))
    # Collapse excessive whitespace but keep line breaks (section structure matters downstream)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_text(filename: str, file_bytes: bytes) -> str:
    file_type = detect_file_type(filename)
    if file_type == "pdf":
        raw = _extract_pdf_text(file_bytes)
    else:
        raw = _extract_docx_text(file_bytes)

    cleaned = clean_and_normalize(raw)
    if len(cleaned) < 40:
        raise EmptyResumeError(
            "Could not extract meaningful text from this file. It may be a scanned "
            "image-only PDF or an empty/corrupted document."
        )
    return cleaned
