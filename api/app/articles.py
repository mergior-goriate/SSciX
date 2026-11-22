import json
import os
import re
from typing import Annotated
from urllib.error import HTTPError, URLError
from urllib.parse import quote, unquote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import UUID

from fastapi import HTTPException
from pydantic import Field, StringConstraints, field_validator

from .schemas import Input


def normalize_doi(value: str) -> str:
    value = value.strip()
    prefix = re.match(r"(?:https?://(?:dx\.)?doi\.org/|doi:\s*)", value, re.IGNORECASE)
    if prefix:
        if prefix.group().lower().startswith("http"):
            try:
                value = unquote(urlsplit(value).path[1:], errors="strict")
            except (UnicodeError, ValueError):
                raise ValueError("DOI inválido.") from None
        else:
            value = value[prefix.end():]
    value = value.lower()
    if len(value) > 255 or not re.fullmatch(r"10\.[0-9]{4,}/[^\s\x00-\x1f\x7f]+", value):
        raise ValueError("DOI inválido.")
    return value


def doi_url(doi: str) -> str:
    return "https://doi.org/" + quote(doi, safe="/")


class ArticleLookup(Input):
    doi: str = Field(max_length=1024)

    _doi = field_validator("doi")(normalize_doi)


ArticleTitle = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000, pattern=r"^[^\x00]+$")]
ArticleSource = Annotated[str, StringConstraints(strip_whitespace=True, max_length=300, pattern=r"^[^\x00]*$")]
ArticleAuthor = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240, pattern=r"^[^\x00]+$")]


class Citation(Input):
    title: ArticleTitle
    authors: list[ArticleAuthor] = Field(max_length=100)
    year: int | None = Field(default=None, ge=1, le=9999)
    source: ArticleSource = ""


class ArticleReference(Citation):
    id: UUID
    doi: str


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch_citation(doi: str) -> Citation:
    url = "https://api.openalex.org/works/" + doi_url(doi)
    url += "?select=title,authorships,publication_year,primary_location"
    headers = {"Accept": "application/json"}
    if key := os.getenv("OPENALEX_API_KEY"):
        headers["Authorization"] = f"Bearer {key}"
    unavailable = "O OpenAlex está temporariamente indisponível. Tente novamente."
    try:
        with build_opener(NoRedirect()).open(Request(url, headers=headers), timeout=4) as response:
            work = json.loads(response.read(1_000_000))
    except HTTPError as error:
        status = error.code
        error.close()
        if status == 404:
            raise HTTPException(404, "O OpenAlex não encontrou um artigo com esse DOI.") from None
        raise HTTPException(503, unavailable) from None
    except (URLError, OSError, ValueError):
        raise HTTPException(503, unavailable) from None

    def clean(value, length):
        return value.replace("\x00", "").strip()[:length] if isinstance(value, str) else ""

    if not isinstance(work, dict) or not (title := clean(work.get("title"), 1000)):
        raise HTTPException(502, "O OpenAlex não devolveu um título para esse DOI.")
    authors = []
    for authorship in (work.get("authorships") or [])[:100]:
        name = clean(authorship.get("raw_author_name"), 240) or clean(
            (authorship.get("author") or {}).get("display_name"), 240)
        if name:
            authors.append(name)
    source = ((work.get("primary_location") or {}).get("source") or {}).get("display_name")
    year = work.get("publication_year")
    return Citation(title=title, authors=authors, year=year if isinstance(year, int) and 1 <= year <= 9999 else None,
                    source=clean(source, 300))
