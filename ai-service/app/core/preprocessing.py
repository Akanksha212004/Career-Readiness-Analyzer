"""
Algorithm A2: NLP Preprocessing Pipeline
tokens = lemmatize(remove_stopwords(tokenize(lowercase(T))))

Uses NLTK for tokenization/stopwords/lemmatization. Also extracts simple
section-level signal (projects / experience / education blocks) via
heading detection, since the scorer needs those independently of the
flat token stream.
"""
import re
from functools import lru_cache
from typing import List

import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize

_NLTK_RESOURCES = [
    ("tokenizers/punkt", "punkt"),
    ("tokenizers/punkt_tab", "punkt_tab"),
    ("corpora/stopwords", "stopwords"),
    ("corpora/wordnet", "wordnet"),
    ("corpora/omw-1.4", "omw-1.4"),
]


def ensure_nltk_data():
    for path, pkg in _NLTK_RESOURCES:
        try:
            nltk.data.find(path)
        except LookupError:
            nltk.download(pkg, quiet=True)


ensure_nltk_data()

_STOPWORDS = set(stopwords.words("english"))
_LEMMATIZER = WordNetLemmatizer()

# Section headings commonly found in resumes (used to segment text so the
# scorer can look at "projects" / "experience" / "education" independently)
SECTION_HEADINGS = {
    "projects": ["projects", "academic projects", "personal projects", "project experience"],
    "experience": ["experience", "work experience", "internship", "internships", "professional experience", "employment"],
    "education": ["education", "academic background", "qualifications"],
    "skills": ["skills", "technical skills", "core competencies", "key skills"],
}


def tokenize_and_lemmatize(text: str) -> List[str]:
    lowered = text.lower()
    # Keep alphanumerics, +, #, ., - so tokens like "c++", "c#", "node.js" survive
    lowered = re.sub(r"[^a-z0-9\+\#\.\-\s]", " ", lowered)
    raw_tokens = word_tokenize(lowered)
    tokens = []
    for tok in raw_tokens:
        tok = tok.strip(".")
        if not tok or tok in _STOPWORDS or len(tok) < 2:
            continue
        tokens.append(_LEMMATIZER.lemmatize(tok))
    return tokens


def segment_sections(text: str) -> dict:
    """
    Very lightweight section segmentation: splits resume text into blocks
    keyed by the canonical section name whenever a line matches a known
    heading (case-insensitive, allowing minor formatting like ':' or ALL CAPS).
    """
    lines = text.split("\n")
    sections: dict = {key: [] for key in SECTION_HEADINGS}
    sections["other"] = []
    current = "other"

    heading_lookup = {}
    for canonical, variants in SECTION_HEADINGS.items():
        for v in variants:
            heading_lookup[v] = canonical

    for line in lines:
        stripped = line.strip().strip(":").lower()
        if stripped in heading_lookup and len(stripped) < 40:
            current = heading_lookup[stripped]
            continue
        sections[current].append(line)

    return {k: "\n".join(v).strip() for k, v in sections.items()}


@lru_cache(maxsize=1)
def _month_pattern():
    months = (
        "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec"
        "|january|february|march|april|june|july|august|september|october|november|december"
    )
    return re.compile(
        rf"({months})[a-z]*\.?\s+\d{{4}}\s*(?:-|to|–|—)\s*(present|current|({months})[a-z]*\.?\s+\d{{4}}|\d{{4}})",
        re.IGNORECASE,
    )


def estimate_experience_months(experience_text: str) -> int:
    """
    Rough heuristic: scans the experience section for date ranges
    ("Jun 2024 - Aug 2024", "Jan 2023 – Present") and sums approximate
    durations. This is intentionally conservative (real HR-grade date
    parsing is out of scope) but gives a usable non-zero signal.
    """
    import datetime

    now = datetime.date.today()
    month_map = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
    }

    total_months = 0
    for match in _month_pattern().finditer(experience_text):
        full = match.group(0)
        parts = re.split(r"-|to|–|—", full, maxsplit=1, flags=re.IGNORECASE)
        if len(parts) != 2:
            continue
        start_raw, end_raw = parts[0].strip(), parts[1].strip()

        start_m = re.match(r"([a-z]+)[a-z]*\.?\s+(\d{4})", start_raw, re.IGNORECASE)
        if not start_m:
            continue
        start_month = month_map.get(start_m.group(1)[:3].lower())
        start_year = int(start_m.group(2))
        if start_month is None:
            continue

        if re.search(r"present|current", end_raw, re.IGNORECASE):
            end_month, end_year = now.month, now.year
        else:
            end_m = re.match(r"([a-z]+)[a-z]*\.?\s+(\d{4})", end_raw, re.IGNORECASE)
            if end_m:
                end_month = month_map.get(end_m.group(1)[:3].lower())
                end_year = int(end_m.group(2))
                if end_month is None:
                    continue
            else:
                year_m = re.match(r"(\d{4})", end_raw)
                if not year_m:
                    continue
                end_month, end_year = 12, int(year_m.group(1))

        months = (end_year - start_year) * 12 + (end_month - start_month)
        if 0 < months < 60:  # sanity bound, drop obvious parse errors
            total_months += months

    return total_months


def count_projects(projects_text: str) -> int:
    """
    Counts distinct project entries by looking for bullet/heading-style line
    starts (bullet chars, or a short title-case line followed by detail lines)
    within the projects section.
    """
    if not projects_text.strip():
        return 0

    lines = [l.strip() for l in projects_text.split("\n") if l.strip()]
    bullet_pattern = re.compile(r"^([•\-\*▪◦]|\d+[\.\)])\s+")

    bullet_starts = sum(1 for l in lines if bullet_pattern.match(l))
    if bullet_starts >= 1:
        # Heuristic: top-level project titles are usually the bullets that
        # aren't heavily indented sub-detail; approximate by counting bullets
        # at the shallowest indentation level.
        indents = [len(l) - len(l.lstrip()) for l in projects_text.split("\n") if bullet_pattern.match(l.strip())]
        if indents:
            min_indent = min(indents)
            top_level = sum(
                1 for l in projects_text.split("\n")
                if bullet_pattern.match(l.strip()) and (len(l) - len(l.lstrip())) <= min_indent + 1
            )
            return max(top_level, 1)
        return bullet_starts

    # Fallback: count lines that look like short title-case headings (project names)
    title_like = [l for l in lines if len(l.split()) <= 8 and l[0:1].isupper()]
    return max(len(title_like), 1) if lines else 0
