"""
Algorithm A4: Hybrid Skill Matching
match_score(skill, resume) = w_f * fuzzy(skill, resume_tokens) + w_s * semantic(skill, resume_text)

Combines rapidfuzz fuzzy string matching (catches typos, abbreviations,
ordering differences like "React.js" vs "ReactJS") with sentence-transformer
semantic similarity (catches conceptually-equivalent phrasing that fuzzy
matching alone misses, e.g. "building REST endpoints" -> "REST API").
TF-IDF/cosine alone was deliberately not used as the sole signal per spec.
"""
import logging
from functools import lru_cache
from typing import List, Optional, Tuple

import numpy as np
from rapidfuzz import fuzz, process
from sentence_transformers import SentenceTransformer, util

from app.config import settings
from app.data.role_dataset import SkillRequirement
from app.models.schemas import SkillMatch

logger = logging.getLogger(__name__)
_semantic_model_load_failed = False


@lru_cache(maxsize=1)
def _get_semantic_model() -> Optional[SentenceTransformer]:
    """
    Loads (and caches) the sentence-transformers model. Returns None if it
    can't be loaded (e.g. no internet on first run to fetch model weights),
    so the API degrades to fuzzy/exact matching only instead of hard-crashing
    every analyze request.
    """
    global _semantic_model_load_failed
    try:
        return SentenceTransformer(settings.semantic_model_name)
    except Exception as exc:  # noqa: BLE001 - deliberately broad: any load failure should degrade gracefully
        _semantic_model_load_failed = True
        logger.warning(
            "Semantic model '%s' failed to load (%s). Falling back to fuzzy/exact "
            "matching only. This is normal offline; the model downloads from "
            "huggingface.co on first run when internet is available.",
            settings.semantic_model_name, exc,
        )
        return None


def _fuzzy_match(skill: str, resume_text_lower: str, tokens: List[str]) -> Tuple[bool, float, str]:
    """Returns (matched, score_0_1, matched_phrase)."""
    if skill in resume_text_lower:
        return True, 1.0, skill

    # Fuzzy match against sliding n-grams built from resume tokens, to catch
    # multi-word skills (e.g. "object oriented programming") too.
    n_words = len(skill.split())
    candidates = set()
    for i in range(len(tokens) - n_words + 1):
        candidates.add(" ".join(tokens[i:i + n_words]))
    if not candidates:
        return False, 0.0, ""

    best = process.extractOne(skill, list(candidates), scorer=fuzz.token_sort_ratio)
    if best is None:
        return False, 0.0, ""
    phrase, score, _ = best
    normalized = score / 100.0
    if score >= settings.fuzzy_match_threshold:
        return True, normalized, phrase
    return False, normalized, phrase


def _semantic_match_batch(skills: List[str], resume_sentences: List[str], model: Optional[SentenceTransformer]) -> List[Tuple[float, str]]:
    """For each skill, returns (best_cosine_similarity, best_matching_resume_sentence)."""
    if not skills:
        # Nothing to compare against (e.g. a pasted JD with no terms our vocab
        # recognized) - encoding an empty batch breaks torch.mm downstream, so
        # short-circuit instead of calling the model at all.
        return []
    if model is None or not resume_sentences:
        return [(0.0, "") for _ in skills]

    skill_embeddings = model.encode(skills, convert_to_tensor=True, normalize_embeddings=True)
    sentence_embeddings = model.encode(resume_sentences, convert_to_tensor=True, normalize_embeddings=True)
    sims = util.cos_sim(skill_embeddings, sentence_embeddings).cpu().numpy()  # [n_skills, n_sentences]

    results = []
    for i in range(len(skills)):
        best_idx = int(np.argmax(sims[i]))
        best_score = float(sims[i][best_idx])
        results.append((best_score, resume_sentences[best_idx]))
    return results


def _split_sentences(text: str) -> List[str]:
    import re
    # Split on newlines, bullets, and sentence punctuation - resumes are terse,
    # not prose, so this is more reliable than a full sentence tokenizer.
    raw = re.split(r"[\n•\-\*▪◦]|(?<=[.;])\s+", text)
    return [s.strip() for s in raw if len(s.strip()) > 2]


def match_skills(
    required_skills: List[SkillRequirement],
    resume_text: str,
    resume_tokens: List[str],
) -> List[SkillMatch]:
    resume_lower = resume_text.lower()
    sentences = _split_sentences(resume_text)
    model = _get_semantic_model()

    skill_names = [s.name for s in required_skills]
    semantic_results = _semantic_match_batch(skill_names, sentences, model)

    semantic_threshold = 0.55  # cosine similarity floor for a semantic "hit"

    matches: List[SkillMatch] = []
    for req, (sem_score, sem_phrase) in zip(required_skills, semantic_results):
        fuzzy_matched, fuzzy_score, fuzzy_phrase = _fuzzy_match(req.name, resume_lower, resume_tokens)
        semantic_hit = sem_score >= semantic_threshold
        is_matched = fuzzy_matched or semantic_hit

        # Confidence: an exact/fuzzy string hit is decisive evidence on its own
        # and should not be diluted just because the independent semantic signal
        # happens to be weak (or vice versa) - so take the stronger signal as the
        # floor, then let the other signal nudge confidence up when it agrees.
        strongest = max(fuzzy_score, sem_score)
        agreement_bonus = settings.fuzzy_weight * fuzzy_score + (1 - settings.fuzzy_weight) * sem_score
        combined = max(strongest, agreement_bonus) if is_matched else agreement_bonus

        if fuzzy_matched:
            match_type = "exact" if fuzzy_score == 1.0 else "fuzzy"
            phrase = fuzzy_phrase
        elif semantic_hit:
            match_type = "semantic"
            phrase = sem_phrase
        else:
            match_type = None
            phrase = None

        matches.append(SkillMatch(
            skill=req.name,
            category=req.category,
            matched=is_matched,
            match_type=match_type,
            match_score=round(min(combined, 1.0), 3),
            matched_resume_phrase=phrase,
        ))

    return matches


