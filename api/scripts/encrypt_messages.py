"""Encrypt stored messages in bounded batches after configuring message keys."""

from sqlalchemy import select

from app.db import SessionFactory
from app.message_storage import cipher, store_message
from app.models import DirectMessage


def main():
    if cipher is None:
        raise SystemExit("Configure SSCIX_MESSAGE_KEYS antes de iniciar a cifragem.")
    processed = 0
    while True:
        with SessionFactory.begin() as db:
            batch = db.scalars(select(DirectMessage).where(DirectMessage.body_encrypted.is_(False))
                               .order_by(DirectMessage.id).limit(200).with_for_update()).all()
            if not batch:
                break
            for row in batch:
                row.body, row.body_encrypted = store_message(row.body)
            processed += len(batch)
    print(f"Mensagens cifradas: {processed}")


if __name__ == "__main__":
    main()
