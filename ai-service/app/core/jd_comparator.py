"""
Algorithm A5: Resume-vs-JD Comparison Mode

When a user pastes a real job description instead of picking a generic role,
we can't rely on our curated skill dataset (the JD might use different
terms/priorities). Instead:
  1. Build a TF-IDF vector space over [resume_text, jd_text].
  2. Extract the JD's high-TF-IDF terms as an ad-hoc "required skill list".
  3. Score overall resume-vs-JD similarity via cosine similarity.
  4. Run those extracted terms through the same hybrid skill matcher used
     for curated roles, so downstream scoring/suggestions logic is unified.
"""
import re
from typing import List, Tuple

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.data.role_dataset import SkillRequirement, ROLE_DATASET

# Additional well-known technical terms not already covered by ROLE_DATASET's
# curated skill lists, so JD term extraction can recognize them too.
_SUPPLEMENTARY_TECH_TERMS = {
    "postgresql", "postgres", "mysql", "redis", "celery", "graphql", "grpc",
    "kafka", "rabbitmq", "elasticsearch", "spring boot", "flask", "fastapi",
    "vue", "angular", "svelte", "webpack", "vite", "gitlab", "jenkins",
    "github actions", "circleci", "azure", "gcp", "firebase", "supabase",
    "sass", "webrtc", "websocket", "oauth", "jwt", "swagger", "openapi",
    "numpy", "pandas", "spark", "hadoop", "airflow", "dbt", "snowflake",
    "react native", "flutter", "swift", "kotlin", "go", "golang", "rust",
    "php", "laravel", "ruby", "rails", "c#", ".net", "unity",
}


def _global_skill_vocab() -> set[str]:
    vocab = {s.name for role in ROLE_DATASET for s in role.skills}
    return vocab | _SUPPLEMENTARY_TECH_TERMS


_GLOBAL_VOCAB = None


def _vocab() -> set[str]:
    global _GLOBAL_VOCAB
    if _GLOBAL_VOCAB is None:
        _GLOBAL_VOCAB = _global_skill_vocab()
    return _GLOBAL_VOCAB


def extract_jd_terms(jd_text: str, top_n: int = 25) -> List[Tuple[str, float]]:
    """
    Extract the JD's required skills by matching against a broad, curated
    technical-term vocabulary (built from the role dataset + common tools/
    frameworks), ranked by frequency of mention in the JD.

    Grounding extraction in a real vocabulary avoids the degenerate case of
    plain single-document TF-IDF, which - with nothing to compare against -
    collapses to noisy, overlapping raw term frequency (e.g. "api", "apis",
    "api contracts" all scoring identically) rather than genuine skills.
    """
    lower = jd_text.lower()
    vocab = _vocab()

    counts: dict[str, int] = {}
    for term in vocab:
        # word-boundary match so "go" doesn't match inside "google", etc.
        pattern = r"(?<![a-z0-9])" + re.escape(term) + r"(?![a-z0-9])"
        occurrences = len(re.findall(pattern, lower))
        if occurrences > 0:
            counts[term] = occurrences

    if not counts:
        return []

    max_count = max(counts.values())
    ranked = sorted(counts.items(), key=lambda x: x[1], reverse=True)
    scored = [(term, round(count / max_count, 4)) for term, count in ranked]
    return scored[:top_n]


def jd_terms_to_skill_requirements(terms: List[Tuple[str, float]]) -> List[SkillRequirement]:
    if not terms:
        return []
    max_score = max(s for _, s in terms) or 1.0
    reqs = []
    for i, (term, score) in enumerate(terms):
        # Top third of extracted terms treated as "core", rest "preferred"
        category = "core" if i < max(1, len(terms) // 3) else "preferred"
        reqs.append(SkillRequirement(name=term, weight=round(score / max_score, 3), category=category))
    # renormalize weights to sum to 1 across the bucket
    total = sum(r.weight for r in reqs) or 1.0
    for r in reqs:
        r.weight = r.weight / total
    return reqs


def compute_resume_jd_similarity(resume_text: str, jd_text: str) -> float:
    vectorizer = TfidfVectorizer(stop_words="english")
    try:
        matrix = vectorizer.fit_transform([resume_text, jd_text])
    except ValueError:
        return 0.0
    sim = cosine_similarity(matrix[0:1], matrix[1:2])[0][0]
    return round(float(sim), 4)
