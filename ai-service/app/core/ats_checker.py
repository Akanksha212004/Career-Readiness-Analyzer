"""
Algorithm A3: ATS-Friendliness Checker

Real ATS parsers choke on: tables used for layout, embedded images holding
text, multi-column layouts, non-standard/decorative fonts, and missing
standard section headings. This inspects the *original file structure*
(not just extracted text) to flag these.
"""
import io
from typing import List

import pdfplumber
from docx import Document
from docx.shared import Pt

from app.models.schemas import ATSIssue
from app.core.preprocessing import SECTION_HEADINGS

STANDARD_FONTS = {
    "arial", "calibri", "times new roman", "georgia", "cambria",
    "helvetica", "garamond", "verdana", "tahoma", "book antiqua",
}


def _check_docx(file_bytes: bytes) -> List[ATSIssue]:
    issues: List[ATSIssue] = []
    doc = Document(io.BytesIO(file_bytes))

    if doc.tables:
        issues.append(ATSIssue(
            issue="Tables detected",
            severity="high",
            detail=(
                f"Found {len(doc.tables)} table(s). Many ATS parsers read tables in the wrong "
                "order or skip them entirely, scrambling or dropping content. Use plain "
                "paragraphs/bullets for layout instead."
            ),
        ))

    image_count = 0
    for rel in doc.part.rels.values():
        if "image" in rel.reltype:
            image_count += 1
    if image_count > 0:
        issues.append(ATSIssue(
            issue="Embedded images detected",
            severity="high",
            detail=(
                f"Found {image_count} embedded image(s). Text inside images (logos, icon-based "
                "contact info, skill badges) is invisible to ATS parsers. Keep all content as "
                "selectable text."
            ),
        ))

    fonts_used = set()
    for paragraph in doc.paragraphs:
        for run in paragraph.runs:
            if run.font.name:
                fonts_used.add(run.font.name.strip().lower())
    nonstandard = fonts_used - STANDARD_FONTS
    if nonstandard:
        issues.append(ATSIssue(
            issue="Non-standard fonts detected",
            severity="medium",
            detail=(
                f"Fonts used: {', '.join(sorted(fonts_used)) if fonts_used else 'unknown'}. "
                "Decorative or uncommon fonts can render incorrectly or fail to parse in some "
                "ATS systems. Stick to widely supported fonts like Arial, Calibri, or Times New Roman."
            ),
        ))

    tiny_fonts = any(
        run.font.size is not None and run.font.size < Pt(9)
        for p in doc.paragraphs for run in p.runs
    )
    if tiny_fonts:
        issues.append(ATSIssue(
            issue="Very small font size detected",
            severity="low",
            detail="Some text is under 9pt. This is often used to cram content in, but hurts both ATS parsing reliability and human readability.",
        ))

    return issues


def _check_pdf(file_bytes: bytes) -> List[ATSIssue]:
    issues: List[ATSIssue] = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        table_count = 0
        image_count = 0
        font_names = set()
        multi_column_pages = 0

        for page in pdf.pages:
            tables = page.find_tables()
            table_count += len(tables)
            image_count += len(page.images)

            chars = page.chars
            for ch in chars[:2000]:  # sample for performance
                fname = ch.get("fontname", "")
                if fname:
                    font_names.add(fname.split("+")[-1].lower())

            # Rough multi-column heuristic: cluster word x0 positions
            words = page.extract_words()
            if len(words) > 20:
                x_positions = sorted(w["x0"] for w in words)
                mid = page.width / 2
                left = sum(1 for x in x_positions if x < mid - 20)
                right = sum(1 for x in x_positions if x > mid + 20)
                if left > 10 and right > 10 and min(left, right) / max(left, right) > 0.35:
                    multi_column_pages += 1

        if table_count > 0:
            issues.append(ATSIssue(
                issue="Tables detected",
                severity="high",
                detail=f"Found {table_count} table-like structure(s). ATS parsers frequently misread or drop tabular content.",
            ))
        if image_count > 0:
            issues.append(ATSIssue(
                issue="Embedded images detected",
                severity="high",
                detail=f"Found {image_count} image(s). If any contain text (logos, icons with labels), that text is invisible to ATS parsers.",
            ))
        if multi_column_pages > 0:
            issues.append(ATSIssue(
                issue="Multi-column layout detected",
                severity="medium",
                detail=(
                    "This resume appears to use a multi-column layout on at least one page. "
                    "Many ATS parsers read left-to-right across the whole page width, which "
                    "interleaves and scrambles text from side-by-side columns."
                ),
            ))
        nonstandard_fonts = {f for f in font_names if not any(std in f for std in STANDARD_FONTS)}
        if nonstandard_fonts and font_names:
            issues.append(ATSIssue(
                issue="Potentially non-standard fonts detected",
                severity="low",
                detail=f"Embedded font(s): {', '.join(sorted(nonstandard_fonts)[:5])}. Confirm these are widely supported, ATS-safe fonts.",
            ))

    return issues


def check_missing_sections(sections: dict) -> List[ATSIssue]:
    issues: List[ATSIssue] = []
    required = ["education", "experience", "skills"]
    missing = [s for s in required if not sections.get(s, "").strip()]
    if missing:
        issues.append(ATSIssue(
            issue="Missing standard section heading(s)",
            severity="medium",
            detail=(
                f"No clearly labeled section found for: {', '.join(missing)}. ATS systems and "
                "recruiters rely on standard headings (e.g. 'Experience', 'Education', 'Skills') "
                "to locate and parse content correctly."
            ),
        ))
    return issues


def run_ats_check(filename: str, file_bytes: bytes, sections: dict) -> List[ATSIssue]:
    lower = filename.lower()
    structural_issues = _check_docx(file_bytes) if lower.endswith(".docx") else _check_pdf(file_bytes)
    return structural_issues + check_missing_sections(sections)
