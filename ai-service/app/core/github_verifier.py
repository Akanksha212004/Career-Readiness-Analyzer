"""
Algorithm A8: GitHub Project Link Verification

Resumes routinely list a GitHub link as evidence of a project, but a link
by itself proves nothing - it could point to an empty scaffold, something
abandoned years ago, or a repo that no longer exists. This module takes
"has a GitHub link" from a face-value claim to a checked one:

  1. Find GitHub repo URLs in the resume text (`find_github_repo_links`).
  2. Hit the public GitHub REST API for each one to pull basic health
     signals: is there recent commit activity, does it have a README, and
     roughly how substantial is it (size, stars) (`verify_repo`).
  3. Verify every distinct link found, concurrently but rate-limit-aware
     (`verify_github_links`), and fail soft: a missing/renamed repo, a
     network hiccup, or GitHub's rate limit must never take down the rest
     of the resume analysis - each of those becomes its own status instead
     of an exception.

This is intentionally a separate module/response field, the same pattern
used for `hidden_text_detector.py`: it's a distinct kind of signal (is this
claim backed by a real, live project?) rather than an ATS formatting issue
or a skill match, so it doesn't belong mixed into either of those.
"""
import asyncio
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List, Optional

import httpx

from app.config import settings
from app.models.schemas import GithubRepoVerification

GITHUB_API_BASE = "https://api.github.com"

# Bound total latency/API usage per analysis - a resume with a dozen GitHub
# links shouldn't turn one upload into a dozen sequential external calls.
MAX_REPOS_TO_VERIFY = 5
MAX_CONCURRENT_REQUESTS = 3
REQUEST_TIMEOUT_SECONDS = 5.0

# A repo with a commit within this window reads as "active"; anything older
# is "stale" (still real, just not maintained - worth flagging, not hiding).
ACTIVE_WINDOW_DAYS = 365

# Root-directory item names/suffixes that suggest test coverage exists.
# Root-only heuristic (no recursive tree walk, to keep this to one extra API
# call per repo) - a `False` result means "not visible at the root", not
# "definitely no tests".
_TEST_DIR_NAMES = {"test", "tests", "__tests__", "spec", "specs"}
_TEST_FILE_SUFFIXES = (".test.js", ".test.ts", ".spec.js", ".spec.ts", "_test.py", "_test.go")
_TEST_FILE_PREFIXES = ("test_",)

# Commit-count buckets used only to translate an approximate count into the
# authenticity composite below - not meant to be a precise metric.
_COMMIT_COUNT_FOR_FULL_SIGNAL = 10

# github.com/<owner>/<repo>[/...], tolerant of no scheme, www., trailing
# path/query/fragment, and surrounding prose punctuation.
_GITHUB_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com/"
    r"(?P<owner>[A-Za-z0-9](?:[A-Za-z0-9-]){0,38})/"
    r"(?P<repo>[A-Za-z0-9_.-]+)",
    re.IGNORECASE,
)

# Path segments that look like a repo slug but are actually GitHub product
# pages, not a real owner/repo project - skip these rather than "verifying"
# github.com/marketplace/some-app as if it were somebody's project.
_NON_OWNER_SEGMENTS = {
    "marketplace", "sponsors", "orgs", "settings", "notifications", "search",
    "topics", "collections", "trending", "explore", "issues", "pulls",
    "features", "about", "pricing", "apps", "codespaces", "security",
}

_TRAILING_PUNCT = ".,;:)]}>\"'"


@dataclass(frozen=True)
class _RepoRef:
    owner: str
    repo: str
    url: str


def find_github_repo_links(text: str) -> List[_RepoRef]:
    """Extract distinct owner/repo GitHub links from free-form resume text.

    Profile-only links (`github.com/username`, no repo segment) are not
    matched by design - there's nothing project-shaped to verify there.
    """
    seen = set()
    refs: List[_RepoRef] = []
    for match in _GITHUB_URL_RE.finditer(text):
        owner = match.group("owner")
        repo = match.group("repo").rstrip(_TRAILING_PUNCT)
        repo = re.sub(r"\.git$", "", repo, flags=re.IGNORECASE)

        if not repo or owner.lower() in _NON_OWNER_SEGMENTS:
            continue

        key = (owner.lower(), repo.lower())
        if key in seen:
            continue
        seen.add(key)
        refs.append(_RepoRef(owner=owner, repo=repo, url=f"https://github.com/{owner}/{repo}"))

    return refs


def _relative_time(past: datetime, now: datetime) -> str:
    days = max((now - past).days, 0)
    if days < 1:
        return "today"
    if days < 14:
        return f"{days} day{'s' if days != 1 else ''} ago"
    if days < 60:
        weeks = days // 7
        return f"{weeks} week{'s' if weeks != 1 else ''} ago"
    if days < 365:
        months = max(days // 30, 1)
        return f"{months} month{'s' if months != 1 else ''} ago"
    years = days // 365
    return "over a year ago" if years == 1 else f"over {years} years ago"


def _auth_headers() -> dict:
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if settings.github_token:
        headers["Authorization"] = f"Bearer {settings.github_token}"
    return headers


def _is_rate_limited(resp: httpx.Response) -> bool:
    if resp.status_code == 429:
        return True
    if resp.status_code == 403 and resp.headers.get("x-ratelimit-remaining") == "0":
        return True
    return False


async def _estimate_commit_count(client: httpx.AsyncClient, ref: "_RepoRef") -> Optional[int]:
    """Approximate total commit count on the default branch via the classic
    GitHub API pagination trick: request 1 commit per page and read the
    last page number off the `Link` response header, rather than paging
    through the full commit history (one extra request either way)."""
    try:
        resp = await client.get(
            f"{GITHUB_API_BASE}/repos/{ref.owner}/{ref.repo}/commits",
            params={"per_page": 1},
        )
    except httpx.RequestError:
        return None

    if resp.status_code != 200:
        return None

    link_header = resp.headers.get("link")
    if link_header:
        match = re.search(r'[?&]page=(\d+)>;\s*rel="last"', link_header)
        if match:
            return int(match.group(1))

    # No Link header at all means everything fit on page 1 - i.e. 0 or 1 commits.
    try:
        commits = resp.json()
        return len(commits) if isinstance(commits, list) else None
    except ValueError:
        return None


async def _detect_has_tests(client: httpx.AsyncClient, ref: "_RepoRef") -> Optional[bool]:
    """Root-directory heuristic for test coverage (see _TEST_DIR_NAMES /
    _TEST_FILE_SUFFIXES above). Returns None (unknown) rather than False on
    any error, so a transient failure never reads as "no tests"."""
    try:
        resp = await client.get(f"{GITHUB_API_BASE}/repos/{ref.owner}/{ref.repo}/contents")
    except httpx.RequestError:
        return None

    if resp.status_code != 200:
        return None

    try:
        entries = resp.json()
    except ValueError:
        return None
    if not isinstance(entries, list):
        return None

    for entry in entries:
        name = str(entry.get("name", "")).lower()
        if name in _TEST_DIR_NAMES:
            return True
        if name.startswith(_TEST_FILE_PREFIXES) or name.endswith(_TEST_FILE_SUFFIXES):
            return True

    return False


def _compute_authenticity_score(
    *, is_active: bool, has_readme: Optional[bool], has_tests: Optional[bool], commit_count: Optional[int]
) -> float:
    """Composite 0-1 signal factored into scorer.py's small score bonus/malus
    (see compute_github_authenticity_adjustment). Weighted toward recent
    activity, since a stale-but-otherwise-complete repo is still a weaker
    signal of ongoing, genuine work than an active one.
    """
    score = 0.0
    score += 0.4 if is_active else 0.0
    score += 0.2 if has_readme else 0.0
    score += 0.2 if has_tests else 0.0
    if commit_count is not None:
        score += 0.2 * min(commit_count / _COMMIT_COUNT_FOR_FULL_SIGNAL, 1.0)
    return round(min(score, 1.0), 2)


async def verify_repo(client: httpx.AsyncClient, ref: _RepoRef) -> GithubRepoVerification:
    """Fail-soft single-repo check: every branch returns a normal
    GithubRepoVerification, never raises, so one bad link can't take down
    the rest of the resume analysis."""
    try:
        repo_resp = await client.get(f"{GITHUB_API_BASE}/repos/{ref.owner}/{ref.repo}")
    except httpx.RequestError:
        return GithubRepoVerification(
            url=ref.url, owner=ref.owner, repo=ref.repo,
            status="unreachable", verified=False,
            note="Couldn't reach GitHub to verify this repo — network error.",
        )

    if _is_rate_limited(repo_resp):
        return GithubRepoVerification(
            url=ref.url, owner=ref.owner, repo=ref.repo,
            status="rate_limited", verified=False,
            note="GitHub API rate limit reached — couldn't verify this repo right now.",
        )

    if repo_resp.status_code == 404:
        return GithubRepoVerification(
            url=ref.url, owner=ref.owner, repo=ref.repo,
            status="not_found", verified=False,
            note="⚠ Repo not found — it may have been renamed, deleted, or made private.",
        )

    if repo_resp.status_code != 200:
        return GithubRepoVerification(
            url=ref.url, owner=ref.owner, repo=ref.repo,
            status="unreachable", verified=False,
            note=f"Couldn't verify this repo (GitHub returned HTTP {repo_resp.status_code}).",
        )

    data = repo_resp.json()

    has_readme: Optional[bool] = None
    try:
        readme_resp = await client.get(f"{GITHUB_API_BASE}/repos/{ref.owner}/{ref.repo}/readme")
        if readme_resp.status_code == 200:
            has_readme = True
        elif readme_resp.status_code == 404:
            has_readme = False
        # any other status (e.g. rate limited mid-flight): leave unknown
        # rather than guessing, and don't fail the whole verification for it.
    except httpx.RequestError:
        pass

    # Two more signals for the authenticity composite below - same fail-soft
    # treatment (None on any error/rate-limit, never raises).
    commit_count = await _estimate_commit_count(client, ref)
    has_tests = await _detect_has_tests(client, ref)

    pushed_at_raw = data.get("pushed_at")
    last_pushed_at = pushed_at_raw
    now = datetime.now(timezone.utc)
    active = None
    if pushed_at_raw:
        pushed_at = datetime.fromisoformat(pushed_at_raw.replace("Z", "+00:00"))
        active = (now - pushed_at).days <= ACTIVE_WINDOW_DAYS

    size_kb = data.get("size")
    stars = data.get("stargazers_count")
    is_fork = data.get("fork")
    is_archived = data.get("archived")

    status = "active" if active else "stale"
    if active:
        note = f"✓ Active repo, last updated {_relative_time(pushed_at, now)}"
    elif pushed_at_raw:
        note = f"⚠ No commits in over a year — last updated {_relative_time(pushed_at, now)}"
    else:
        note = "⚠ Repo has no commit history yet"

    extras = []
    if is_archived:
        extras.append("archived by owner")
    if has_readme is False:
        extras.append("no README found")
    if has_tests is False:
        extras.append("no tests found")
    if commit_count is not None:
        extras.append(f"{commit_count} commit{'s' if commit_count != 1 else ''}")
    if size_kb is not None and size_kb < 5 and not is_fork:
        extras.append("looks like an empty/near-empty repo")
    if extras:
        note += " · " + ", ".join(extras)

    is_active = status == "active" and not is_archived
    authenticity_score = _compute_authenticity_score(
        is_active=is_active, has_readme=has_readme, has_tests=has_tests, commit_count=commit_count
    )

    return GithubRepoVerification(
        url=ref.url, owner=ref.owner, repo=ref.repo,
        status="stale" if is_archived else status,
        verified=True,
        last_pushed_at=last_pushed_at,
        has_readme=has_readme,
        size_kb=size_kb,
        stargazers_count=stars,
        is_fork=is_fork,
        is_archived=is_archived,
        commit_count=commit_count,
        has_tests=has_tests,
        authenticity_score=authenticity_score,
        note=note,
    )


async def verify_github_links(resume_text: str) -> List[GithubRepoVerification]:
    """Find and verify every distinct GitHub repo link in the resume.

    Bounded and fail-soft end to end: caps how many repos get checked, caps
    concurrency, and any failure (network, 404, rate limit) degrades to a
    per-link status rather than raising - a GitHub outage should never
    break the rest of the resume analysis.
    """
    refs = find_github_repo_links(resume_text)[:MAX_REPOS_TO_VERIFY]
    if not refs:
        return []

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

    async def _bounded(client: httpx.AsyncClient, ref: _RepoRef) -> GithubRepoVerification:
        async with semaphore:
            return await verify_repo(client, ref)

    try:
        async with httpx.AsyncClient(
            headers=_auth_headers(), timeout=REQUEST_TIMEOUT_SECONDS
        ) as client:
            return await asyncio.gather(*(_bounded(client, ref) for ref in refs))
    except Exception:
        # Last-resort safety net (e.g. client construction itself failing) -
        # verification is a bonus signal, never a reason to 500 the analysis.
        return [
            GithubRepoVerification(
                url=ref.url, owner=ref.owner, repo=ref.repo,
                status="unreachable", verified=False,
                note="Couldn't reach GitHub to verify this repo.",
            )
            for ref in refs
        ]

