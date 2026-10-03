"""An MCP server over the built piighost documentation.

It reads what the site serves, not its sources: the Markdown export of every
page (`<page>/index.md`, includes expanded) and the data of every identifier
card (`ids/<ID>/__data.json`). The index is rebuilt when the site is, so a
rebuild of the preview is seen on the next call.
"""

import json
import math
import os
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

SITE_DIR = Path(os.environ.get("PIIGHOST_SITE", "/site"))
"""The built site, as the preview serves it."""

BASE_URL = os.environ.get("PIIGHOST_BASE_URL", "https://docs.piighost.dev").rstrip("/")
"""Where the pages are read, for the links an answer cites."""

LANGUAGES = ("fr", "en")
SPACES = ("guide", "wiki")

TOKEN = re.compile(r"[a-z0-9]+(?:[-_.][a-z0-9]+)*")
"""A search term: a word, or an identifier such as br-msg-05 or load_pipeline."""

HEADING = re.compile(r"^(#{1,4})\s+(.+?)\s*$", re.MULTILINE)


def _fold(text: str) -> str:
    """Lowercase, accents removed, so "dé-identifier" matches "de-identifier"."""
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(char for char in decomposed if not unicodedata.combining(char))


def _terms(text: str) -> list[str]:
    """The terms of a text, an identifier also counted by its parts."""
    terms: list[str] = []
    for token in TOKEN.findall(_fold(text)):
        terms.append(token)
        parts = re.split(r"[-_.]", token)
        if len(parts) > 1:
            terms.extend(part for part in parts if len(part) > 1)
    return terms


@dataclass
class Section:
    page: Page
    heading: str
    text: str
    terms: Counter[str] = field(default_factory=Counter)


@dataclass
class Page:
    path: str
    lang: str
    space: str
    title: str
    description: str
    body: str

    @property
    def url(self) -> str:
        return f"{BASE_URL}/{self.path}/"


def _frontmatter(text: str) -> tuple[dict[str, str], str]:
    """The `key: value` lines of a leading YAML block, and the text after it."""
    if not text.startswith("---\n"):
        return {}, text
    end = text.find("\n---", 4)
    if end < 0:
        return {}, text
    meta = {}
    for line in text[4:end].splitlines():
        key, sep, value = line.partition(":")
        if sep and not line.startswith((" ", "-")):
            meta[key.strip()] = value.strip().strip("\"'")
    return meta, text[end + 4 :].lstrip("\n")


def _page(path: Path) -> Page | None:
    relative = path.parent.relative_to(SITE_DIR).as_posix()
    parts = relative.split("/")
    if len(parts) < 2 or parts[0] not in LANGUAGES or parts[1] not in SPACES:
        return None
    meta, body = _frontmatter(path.read_text(encoding="utf-8"))
    heading = HEADING.search(body)
    title = meta.get("title") or (heading.group(2) if heading else relative)
    return Page(relative, parts[0], parts[1], title, meta.get("description", ""), body)


def _sections(page: Page) -> list[Section]:
    """A page cut at its headings, each piece searched on its own."""
    marks = [(match.start(), match.group(2)) for match in HEADING.finditer(page.body)]
    starts = [(0, page.title), *marks] if not marks or marks[0][0] > 0 else marks
    sections = []
    for (start, heading), (end, _) in zip(starts, [*starts[1:], (len(page.body), "")]):
        text = page.body[start:end].strip()
        if not text:
            continue
        section = Section(page, heading, text)
        # A title and a heading say more about a section than a word of its text.
        section.terms = Counter(
            _terms(text) + 3 * _terms(heading) + 2 * _terms(page.title)
        )
        sections.append(section)
    return sections


class Index:
    """The pages and their sections, scored with BM25."""

    def __init__(self) -> None:
        self.stamp = -1.0
        self.pages: dict[str, Page] = {}
        self.sections: list[Section] = []
        self.frequency: Counter[str] = Counter()
        self.average = 1.0

    def fresh(self) -> Index:
        """Rebuild when the site was rebuilt since the last call."""
        marker = SITE_DIR / "llms.txt"
        stamp = marker.stat().st_mtime if marker.exists() else 0.0
        if stamp != self.stamp:
            self._build()
            self.stamp = stamp
        return self

    def _build(self) -> None:
        pages = [
            page for path in sorted(SITE_DIR.rglob("index.md")) if (page := _page(path))
        ]
        self.pages = {page.path: page for page in pages}
        self.sections = [section for page in pages for section in _sections(page)]
        self.frequency = Counter(
            term for section in self.sections for term in set(section.terms)
        )
        lengths = [sum(section.terms.values()) for section in self.sections]
        self.average = sum(lengths) / max(len(lengths), 1)

    def search(
        self, query: str, lang: str | None, space: str | None, limit: int
    ) -> list[tuple[float, Section]]:
        terms = set(_terms(query))
        count = len(self.sections)
        scored = []
        for section in self.sections:
            if (lang and section.page.lang != lang) or (
                space and section.page.space != space
            ):
                continue
            length = sum(section.terms.values())
            score = 0.0
            for term in terms & section.terms.keys():
                idf = math.log(
                    1
                    + (count - self.frequency[term] + 0.5)
                    / (self.frequency[term] + 0.5)
                )
                tf = section.terms[term]
                score += (
                    idf * tf * 2.5 / (tf + 1.5 * (0.25 + 0.75 * length / self.average))
                )
            if score:
                scored.append((score, section))
        scored.sort(key=lambda item: -item[0])
        return scored[:limit]


INDEX = Index()

mcp = FastMCP(
    "piighost-docs",
    instructions=(
        "The piighost documentation: a technical guide (how to use the library, its "
        "reference) and a business wiki (the rules each process follows, as BR-, DPO-, "
        "DEV-, OPS-, USER- identifiers, and where they live in the code), in French and "
        "English. Search first, then read the pages you cite, and give their URLs."
    ),
    host=os.environ.get("HOST", "0.0.0.0"),
    port=int(os.environ.get("PORT", "8000")),
    stateless_http=True,
    # Reached by name on a private network, behind no browser.
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


def _excerpt(section: Section, query: str, width: int = 420) -> str:
    text = re.sub(r"\s+", " ", section.text)
    folded = _fold(text)
    positions = [folded.find(term) for term in _terms(query) if term in folded]
    start = max(min(positions, default=0) - width // 4, 0)
    return (
        ("…" if start else "")
        + text[start : start + width]
        + ("…" if start + width < len(text) else "")
    )


@mcp.tool()
def search_docs(
    query: str, lang: str | None = None, space: str | None = None, limit: int = 8
) -> list[dict[str, Any]]:
    """Search the piighost documentation, ranked by relevance.

    query: words or an identifier (BR-MSG-05, DPO-9, load_thread_pipeline).
    lang: "fr" or "en", both when omitted. The wiki is written in French.
    space: "guide" for the technical guide, "wiki" for the business wiki, both when omitted.
    Returns, per matching section, the page title, the section heading, the page path
    (for read_page), its URL and an excerpt.
    """
    found = INDEX.fresh().search(query, lang, space, max(1, min(limit, 20)))
    return [
        {
            "title": section.page.title,
            "section": section.heading,
            "path": section.page.path,
            "url": section.page.url,
            "excerpt": _excerpt(section, query),
            "score": round(score, 2),
        }
        for score, section in found
    ]


@mcp.tool()
def read_page(path: str) -> str:
    """Read one page of the documentation in full, as Markdown.

    path: a path search_docs or list_pages gave ("fr/wiki/processus/proteger-un-message"),
    or the page's URL.
    """
    key = path.removeprefix(BASE_URL).strip("/").removesuffix("/index.md")
    page = INDEX.fresh().pages.get(key)
    if page is None:
        raise ValueError(f"no page {key!r}; use search_docs or list_pages for a path")
    heading = "" if page.body.lstrip().startswith("# ") else f"# {page.title}\n\n"
    return f"{heading}URL: {page.url}\n\n{page.body}"


@mcp.tool()
def list_pages(
    lang: str | None = None, space: str | None = None
) -> list[dict[str, str]]:
    """List the pages of the documentation, with their path, title and description.

    lang: "fr" or "en". space: "guide" or "wiki". Both are optional filters.
    """
    return [
        {
            "path": page.path,
            "title": page.title,
            "description": page.description,
            "url": page.url,
        }
        for page in INDEX.fresh().pages.values()
        if (not lang or page.lang == lang) and (not space or page.space == space)
    ]


def _unflatten(data: list[Any]) -> Any:
    """Decode SvelteKit's devalue encoding: every value refers to others by index."""
    cache: dict[int, Any] = {}

    def value(index: int) -> Any:
        if index < 0:
            return None
        if index in cache:
            return cache[index]
        raw = data[index]
        if isinstance(raw, dict):
            cache[index] = result = {}
            result.update({key: value(item) for key, item in raw.items()})
        elif isinstance(raw, list):
            cache[index] = result = []
            result.extend(value(item) for item in raw)
        else:
            cache[index] = result = raw
        return result

    return value(0)


@mcp.tool()
def get_id(identifier: str) -> dict[str, Any]:
    """Look up an identifier of the wiki: a rule (BR-MSG-05), a need (DPO-9, DEV-10,
    OPS-8, USER-6), an acceptance test (AT-DEV-10-1) or a gap (ECART-09).

    Returns what it says, the page that defines it and, for a rule, where it lives
    in the code, which tests call it and which code uses it.
    """
    name = identifier.strip().upper()
    card = SITE_DIR / "ids" / name / "__data.json"
    if not card.is_file():
        raise ValueError(
            f"no identifier {name!r}; search_docs finds the ones a page names"
        )
    nodes = json.loads(card.read_text(encoding="utf-8"))["nodes"]
    entry = next(
        _unflatten(node["data"]) for node in nodes if node and node.get("data")
    )["entry"]
    entry["url"] = BASE_URL + entry.pop("href")
    entry["page"] = BASE_URL + entry["page"]
    return entry


def main() -> None:
    mcp.run(transport="streamable-http")


if __name__ == "__main__":
    main()
