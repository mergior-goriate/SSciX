from sqlalchemy import case, func, literal_column, or_

from .models import Discussion


def publication_search(term: str):
    query = func.sscix_normalize(term)
    vector = func.sscix_document(Discussion.title, Discussion.body)
    document = func.sscix_normalize(Discussion.title + literal_column("' '") + Discussion.body)
    phrase = func.phraseto_tsquery("portuguese", query)
    words = func.plainto_tsquery("portuguese", query)
    exact = vector.bool_op("@@")(phrase)
    matches = vector.bool_op("@@")(words)
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    normalized_literal = func.sscix_normalize(escaped)
    literal = or_(func.sscix_normalize(Discussion.title).contains(normalized_literal, escape="\\"),
                  func.sscix_normalize(Discussion.body).contains(normalized_literal, escape="\\"))
    if term.startswith('"') and term.endswith('"') and len(term) > 2:
        return exact, func.ts_rank_cd(vector, phrase).desc()

    typo = document.bool_op("%>>")(query) if len(term) >= 4 and any(character.isalnum() for character in term) else None
    eligible = or_(matches, typo) if typo is not None else or_(matches, literal)
    relevance = case((exact, 2), (matches, 1), else_=0)
    return eligible, relevance.desc(), func.ts_rank_cd(vector, words).desc()
