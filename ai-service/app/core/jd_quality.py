"""
Algorithm A9: Job Description Quality Check

HR users write postings by hand, and a poorly-written JD hurts both sides:
vague postings attract mismatched applicants (and give the skill-matcher
nothing concrete to score against), unrealistic experience bars silently
filter out exactly the junior candidates an internship/entry posting is
meant to attract, and gendered language measurably suppresses application
rates from under-represented groups (well-documented in HR/DEI research,
e.g. the "gender decoder" style tools this check is loosely modeled on).

This is a lightweight, explainable heuristic checker (regex + keyword
lists), the same style as ats_checker.py and hidden_text_detector.py - it
flags patterns for a human to review, it does not silently rewrite the JD
or block posting creation.
"""
import re
from typing import List, Optional

from app.core.jd_comparator import _global_skill_vocab
from app.models.schemas import JdQualityFlag, JdQualityReport

# --- Unrealistic experience requirement -------------------------------
# "X+ years" / "X-Y years" / "minimum of X years" style patterns.
_EXPERIENCE_YEARS_RE = re.compile(
    r"(\d+)\+?\s*(?:-|to)?\s*(?:\d+\s*)?\+?\s*years?\b",
    re.IGNORECASE,
)

# What "too many years" means depends on the posting's own level - an
# internship shouldn't ask for any professional years; entry-level roles
# asking for 5+ is a common, easy-to-miss red flag when a JD is copy-pasted
# from a more senior template.
_MAX_REASONABLE_YEARS = {
    "internship": 0,
    "entry": 2,
    "mid": 5,
    "senior": None,  # no reasonable ceiling for senior roles
}

# --- Vague / missing skill requirements --------------------------------
_MIN_WORD_COUNT = 40
_MIN_CONCRETE_SKILL_MENTIONS = 2

_VAGUE_PHRASES = [
    "fast learner", "team player", "hard working", "hardwororking", "self starter",
    "self-starter", "detail oriented", "detail-oriented", "go getter", "go-getter",
    "wear many hats", "hit the ground running", "think outside the box",
    "passionate about technology", "excellent communication skills",
]

# --- Gendered / biased language -----------------------------------------
# Loosely modeled on the word lists popularized by academic "gender decoder"
# research (Gaucher, Friesen & Kay, 2011) - masculine-coded words correlate
# with lower application rates from women, and vice versa. Not exhaustive;
# a lightweight signal for a human to sanity-check, not a hard rule.
_MASCULINE_CODED_WORDS = {
    "ninja", "rockstar", "rock star", "guru", "superhero", "dominant", "dominate",
    "competitive", "aggressive", "assertive", "fearless", "driven", "decisive",
    "independent", "self-reliant", "outspoken", "headstrong", "adventurous",
}
_FEMININE_CODED_WORDS = {
    "collaborative", "supportive", "nurturing", "compassionate", "empathetic",
    "interpersonal", "considerate", "dependable", "loyal", "honest", "trustworthy",
    "warm", "friendly", "cooperative",
}
_GENDER_LEAN_THRESHOLD = 3  # net word-count difference before flagging

# Age/nationality-coded phrasing that's a compliance red flag regardless of
# any gender balance in the rest of the JD.
_EXCLUSIONARY_PHRASES = [
    "recent graduate only", "digital native", "young and energetic",
    "native english speaker", "no visa sponsorship", "must be a native speaker",
]


def _extract_years_mentions(jd_text: str) -> List[int]:
    return [int(m.group(1)) for m in _EXPERIENCE_YEARS_RE.finditer(jd_text)]


def _check_experience_realism(jd_text: str, seniority: Optional[str]) -> List[JdQualityFlag]:
    years_mentioned = _extract_years_mentions(jd_text)
    if not years_mentioned:
        return []

    ceiling = _MAX_REASONABLE_YEARS.get((seniority or "").lower())
    if ceiling is None:
        return []

    max_years = max(years_mentioned)
    if max_years <= ceiling:
        return []

    level_label = (seniority or "this").lower()
    if ceiling == 0:
        detail = (
            f"This posting asks for {max_years}+ years of experience but is marked "
            f"'{level_label}' - internships typically shouldn't require prior professional "
            "experience. Candidates who'd otherwise be a great fit may self-select out."
        )
    else:
        detail = (
            f"This posting asks for {max_years}+ years of experience but is marked "
            f"'{level_label}' (typically expects up to ~{ceiling} years). Consider whether "
            "that bar matches the seniority you're actually hiring for."
        )

    return [JdQualityFlag(
        flag="unrealistic_experience_requirement",
        severity="high",
        detail=detail,
    )]


def _check_vague_or_missing_skills(jd_text: str) -> List[JdQualityFlag]:
    flags: List[JdQualityFlag] = []
    word_count = len(jd_text.split())
    lower = jd_text.lower()

    vocab = _global_skill_vocab()
    concrete_hits = {term for term in vocab if term in lower}

    if word_count < _MIN_WORD_COUNT:
        flags.append(JdQualityFlag(
            flag="jd_too_short",
            severity="medium",
            detail=(
                f"This job description is only {word_count} words. Short postings give "
                "candidates (and our skill matcher) little to go on - consider adding "
                "specifics about the role's day-to-day work and required tools."
            ),
        ))

    if len(concrete_hits) < _MIN_CONCRETE_SKILL_MENTIONS:
        flags.append(JdQualityFlag(
            flag="vague_skill_requirements",
            severity="high",
            detail=(
                "Couldn't find concrete, nameable skills/technologies in this description "
                "(found " + str(len(concrete_hits)) + "). Vague requirements like 'strong "
                "technical skills' make it hard for candidates to self-assess fit and for "
                "the matcher to score resumes against this posting accurately. List specific "
                "languages, frameworks, or tools."
            ),
        ))

    vague_phrase_hits = [p for p in _VAGUE_PHRASES if p in lower]
    if len(vague_phrase_hits) >= 3:
        flags.append(JdQualityFlag(
            flag="buzzword_heavy",
            severity="low",
            detail=(
                "This description leans heavily on generic phrases ("
                + ", ".join(f'"{p}"' for p in vague_phrase_hits[:4])
                + ") rather than concrete requirements. These are hard to screen for and "
                "rarely help candidates decide whether to apply."
            ),
        ))

    return flags


def _check_biased_language(jd_text: str) -> List[JdQualityFlag]:
    flags: List[JdQualityFlag] = []
    lower = jd_text.lower()

    masculine_hits = [w for w in _MASCULINE_CODED_WORDS if w in lower]
    feminine_hits = [w for w in _FEMININE_CODED_WORDS if w in lower]
    net = len(masculine_hits) - len(feminine_hits)

    if net >= _GENDER_LEAN_THRESHOLD:
        flags.append(JdQualityFlag(
            flag="gendered_language_masculine",
            severity="medium",
            detail=(
                "This description leans on masculine-coded language ("
                + ", ".join(masculine_hits[:5])
                + "), which research links to lower application rates from women. Consider "
                "swapping in more neutral or collaborative phrasing."
            ),
        ))
    elif -net >= _GENDER_LEAN_THRESHOLD:
        flags.append(JdQualityFlag(
            flag="gendered_language_feminine",
            severity="low",
            detail=(
                "This description leans heavily on feminine-coded language ("
                + ", ".join(feminine_hits[:5])
                + "). Usually a minor effect, but worth a glance if you want broadly neutral "
                "phrasing."
            ),
        ))

    exclusionary_hits = [p for p in _EXCLUSIONARY_PHRASES if p in lower]
    for phrase in exclusionary_hits:
        flags.append(JdQualityFlag(
            flag="exclusionary_phrasing",
            severity="high",
            detail=(
                f"The phrase \"{phrase}\" can be read as age- or nationality-exclusionary and "
                "may raise compliance concerns in many jurisdictions. Consider removing or "
                "rephrasing it."
            ),
        ))

    return flags


def analyze_jd_quality(jd_text: str, seniority: Optional[str] = None) -> JdQualityReport:
    """Runs all JD quality checks and returns a flat, severity-ranked list of
    flags plus a simple 0-100 quality score (100 = no flags found).

    Best-effort and advisory only: HR can still create/save the posting
    regardless of what this returns (see postingController.js on the Node
    side, which calls this endpoint but never blocks on its result).
    """
    jd_text = (jd_text or "").strip()

    flags: List[JdQualityFlag] = []
    if jd_text:
        flags += _check_experience_realism(jd_text, seniority)
        flags += _check_vague_or_missing_skills(jd_text)
        flags += _check_biased_language(jd_text)
    else:
        flags.append(JdQualityFlag(
            flag="jd_missing",
            severity="low",
            detail="No custom job description text was provided - candidates will be matched "
            "against the title and required-skills list only.",
        ))

    severity_penalty = {"high": 20, "medium": 10, "low": 5}
    deduction = sum(severity_penalty.get(f.severity, 5) for f in flags)
    quality_score = max(0, 100 - deduction)

    return JdQualityReport(quality_score=quality_score, flags=flags)
