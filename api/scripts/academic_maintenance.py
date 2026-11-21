"""Expire transient activity and optionally deliver search events to a trusted indexer."""

import json
import os
from urllib.request import Request, urlopen

from sqlalchemy import text

from app.db import SessionFactory


def deliver_search_events():
    endpoint = os.getenv("SSCIX_SEARCH_EVENT_ENDPOINT", "")
    if not endpoint:
        with SessionFactory.begin() as db:
            db.execute(text("DELETE FROM search_events WHERE created_at < now() - interval '7 days'"))
        return
    token = os.environ["SSCIX_SEARCH_EVENT_TOKEN"]
    if not endpoint.startswith("https://") or len(token) < 32:
        raise RuntimeError("Configure um destino HTTPS e uma credencial para os eventos de pesquisa.")
    with SessionFactory.begin() as db:
        events = db.execute(text("""
            SELECT id, entity_type, entity_id, action, created_at FROM search_events
            ORDER BY id LIMIT 100 FOR UPDATE SKIP LOCKED
        """)).mappings().all()
        if not events:
            return
        payload = json.dumps([dict(event) for event in events], default=str).encode()
        request = Request(endpoint, data=payload, headers={
            "Content-Type": "application/json", "Authorization": f"Bearer {token}",
        })
        with urlopen(request, timeout=10) as response:
            if not 200 <= response.status < 300:
                raise RuntimeError("O serviço de indexação não confirmou os eventos.")
        db.execute(text("DELETE FROM search_events WHERE id = ANY(:ids)"), {"ids": [event["id"] for event in events]})


def main():
    with SessionFactory.begin() as db:
        db.execute(text("DELETE FROM stories WHERE expires_at <= now() AND NOT archive"))
        db.execute(text("DELETE FROM personal_activity WHERE created_at < now() - interval '90 days'"))
    deliver_search_events()


if __name__ == "__main__":
    main()
