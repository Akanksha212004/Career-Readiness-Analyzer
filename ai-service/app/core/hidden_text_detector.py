"""
Algorithm A4: Hidden/Invisible Text Detector

Distinct from the ATS-friendliness checks in ats_checker.py: those catch
*accidental* parsing problems (tables, images, multi-column layouts). This
module looks for *deliberate concealment* - text that's present in the file
and readable by a parser/ATS, but invisible to a human reviewer. That's a
known trick for stuffing extra keywords into a resume without anyone
noticing when they look at the rendered page.

Techniques detected:
  - white_on_white:       text color matches (or nearly matches) the page
                           background, so it renders invisibly.
  - near_zero_font_size:  font size so small (<= ~1pt) it's effectively
                           invisible even though the text is "there".
  - docx_vanish:          DOCX "hidden text" character formatting
                           (w:vanish) - explicitly marked not-to-render.
  - off_page_position:    text positioned outside the visible page
                           boundaries (negative coordinates or past the
                           page edge), so it never appears on screen/print.
"""
import io
from typing import List, Optional

import pdfplumber
from docx import Document
from docx.shared import Pt

from app.models.schemas import HiddenTextFinding, HiddenTextWarning

# A char is "near white" if every RGB channel is above this (0-1 scale for
# pdfplumber's non_stroking_color, which is what fill/text color uses).
_WHITE_THRESHOLD = 0.92

# Font size at/below which text is considered invisible regardless of color.
_MIN_VISIBLE_FONT_PT = 1.5

# How much of a page's chars we sample per page, for performance on long resumes.
_MAX_CHARS_PER_PAGE = 3000

# Small margin (in points) outside the page box before we call a char
# "off-page" - avoids false positives from tiny rounding/rendering slop.
_OFF_PAGE_MARGIN = 2.0


def _sample_text(chars: List[dict], max_len: int = 80) -> Optional[str]:
    text = "".join(c.get("text", "") for c in chars).strip()
    if not text:
        return None
    return text[:max_len] + ("..." if len(text) > max_len else "")


def _is_near_white(color) -> bool:
    if color is None:
        return False
    # pdfplumber gives a single gray value, an (r, g, b) tuple, or (c, m, y, k)
    if isinstance(color, (int, float)):
        return color >= _WHITE_THRESHOLD
    if isinstance(color, (list, tuple)):
        if len(color) == 3:
            return all(c >= _WHITE_THRESHOLD for c in color)
        if len(color) == 4:
            c, m, y, k = color
            return k <= (1 - _WHITE_THRESHOLD) and (c + m + y) <= (1 - _WHITE_THRESHOLD) * 3
    return False


def _check_pdf(file_bytes: bytes) -> List[HiddenTextFinding]:
    findings: List[HiddenTextFinding] = []

    white_chars: List[dict] = []
    tiny_chars: List[dict] = []
    offpage_chars: List[dict] = []

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            chars = page.chars[:_MAX_CHARS_PER_PAGE]

            for ch in chars:
                size = ch.get("size") or 0
                fill = ch.get("non_stroking_color")

                if _is_near_white(fill):
                    white_chars.append(ch)

                if 0 < size <= _MIN_VISIBLE_FONT_PT:
                    tiny_chars.append(ch)

                x0, x1 = ch.get("x0", 0), ch.get("x1", 0)
                top, bottom = ch.get("top", 0), ch.get("bottom", 0)
                if (
                    x0 < -_OFF_PAGE_MARGIN
                    or x1 > page.width + _OFF_PAGE_MARGIN
                    or top < -_OFF_PAGE_MARGIN
                    or bottom > page.height + _OFF_PAGE_MARGIN
                ):
                    offpage_chars.append(ch)

    if white_chars:
        findings.append(HiddenTextFinding(
            method="white_on_white",
            detail=(
                f"Found {len(white_chars)} character(s) rendered in a color that matches or "
                "nearly matches the page background, making them invisible to a human reader "
                "while still being extractable by a parser."
            ),
            sample_text=_sample_text(white_chars),
        ))

    if tiny_chars:
        findings.append(HiddenTextFinding(
            method="near_zero_font_size",
            detail=(
                f"Found {len(tiny_chars)} character(s) set at {_MIN_VISIBLE_FONT_PT}pt or smaller "
                "- effectively unreadable at any normal zoom level, but still machine-readable."
            ),
            sample_text=_sample_text(tiny_chars),
        ))

    if offpage_chars:
        findings.append(HiddenTextFinding(
            method="off_page_position",
            detail=(
                f"Found {len(offpage_chars)} character(s) positioned outside the visible page "
                "area, so they never render but remain extractable from the file."
            ),
            sample_text=_sample_text(offpage_chars),
        ))

    return findings


def _check_docx(file_bytes: bytes) -> List[HiddenTextFinding]:
    findings: List[HiddenTextFinding] = []

    doc = Document(io.BytesIO(file_bytes))

    vanish_runs = []
    white_runs = []
    tiny_runs = []

    for paragraph in doc.paragraphs:
        for run in paragraph.runs:
            if not run.text.strip():
                continue

            if run.font.hidden:
                vanish_runs.append(run)

            color = run.font.color
            if color is not None and color.rgb is not None:
                rgb = color.rgb
                if rgb == "FFFFFF" or str(rgb).upper() == "FFFFFF":
                    white_runs.append(run)

            if run.font.size is not None and run.font.size <= Pt(_MIN_VISIBLE_FONT_PT):
                tiny_runs.append(run)

    if vanish_runs:
        sample = " ".join(r.text for r in vanish_runs).strip()[:80]
        findings.append(HiddenTextFinding(
            method="docx_vanish",
            detail=(
                f"Found {len(vanish_runs)} run(s) marked with Word's 'hidden text' character "
                "formatting (vanish) - text that Word explicitly hides from view but that "
                "parsers can still read from the underlying XML."
            ),
            sample_text=sample or None,
        ))

    if white_runs:
        sample = " ".join(r.text for r in white_runs).strip()[:80]
        findings.append(HiddenTextFinding(
            method="white_on_white",
            detail=(
                f"Found {len(white_runs)} run(s) with white (#FFFFFF) font color, which is "
                "invisible against a standard white page background."
            ),
            sample_text=sample or None,
        ))

    if tiny_runs:
        sample = " ".join(r.text for r in tiny_runs).strip()[:80]
        findings.append(HiddenTextFinding(
            method="near_zero_font_size",
            detail=(
                f"Found {len(tiny_runs)} run(s) set at {_MIN_VISIBLE_FONT_PT}pt or smaller - "
                "effectively invisible at any normal zoom level."
            ),
            sample_text=sample or None,
        ))

    return findings


def detect_hidden_text(filename: str, file_bytes: bytes) -> HiddenTextWarning:
    """
    Scan the original resume file (not just extracted text) for evidence of
    concealed keyword-stuffing. Best-effort: a parsing failure here should
    never break the rest of the analysis, so this degrades to "not detected"
    with an explanatory message rather than raising.
    """
    lower = filename.lower()

    try:
        if lower.endswith(".docx"):
            findings = _check_docx(file_bytes)
        elif lower.endswith(".pdf"):
            findings = _check_pdf(file_bytes)
        else:
            return HiddenTextWarning(
                detected=False,
                findings=[],
                message="Hidden text scan is only supported for PDF and DOCX files.",
            )
    except Exception:
        # Never let a malformed/unusual file break the whole analysis over
        # this one secondary check.
        return HiddenTextWarning(
            detected=False,
            findings=[],
            message="Could not scan this file for hidden text (unsupported or corrupted structure).",
        )

    if findings:
        methods = ", ".join(sorted({f.method for f in findings}))
        return HiddenTextWarning(
            detected=True,
            findings=findings,
            message=(
                f"Possible concealed/invisible text detected ({methods}). This can look like "
                "keyword-stuffing meant to game ATS parsers, and some employers treat it as a "
                "red flag. Review and remove any hidden content before submitting."
            ),
        )

    return HiddenTextWarning(
        detected=False,
        findings=[],
        message="No hidden or invisible text detected.",
    )