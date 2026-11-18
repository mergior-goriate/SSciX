import hashlib
import os
import secrets
import time
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import HTTPException, Request, Response
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert

from .db import SessionFactory
from .models import RateLimit

APP_ORIGIN = os.getenv("APP_ORIGIN", "http://localhost:3000").rstrip("/")
SECURE_COOKIES = APP_ORIGIN.startswith("https://")
COOKIE = "__Host-sscix" if SECURE_COOKIES else "sscix_local"
SESSION_SECONDS = 7 * 24 * 3600
PASSWORDS = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
DUMMY_HASH = PASSWORDS.hash(secrets.token_urlsafe(32))


def now():
    return datetime.now(timezone.utc)


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def token():
    return secrets.token_urlsafe(32)


def expires(seconds: int):
    return now() + timedelta(seconds=seconds)


def password_matches(password: str, hashed: str) -> bool:
    try:
        return PASSWORDS.verify(hashed, password)
    except VerifyMismatchError:
        return False


def set_session(response: Response, secret: str):
    response.set_cookie(COOKIE, secret, max_age=SESSION_SECONDS, httponly=True,
                        secure=SECURE_COOKIES, samesite="lax", path="/")


def clear_session(response: Response):
    response.delete_cookie(COOKIE, httponly=True, secure=SECURE_COOKIES, samesite="lax", path="/")


def require_origin(request: Request):
    if request.headers.get("origin") != APP_ORIGIN:
        raise HTTPException(403, "Origem do pedido inválida.")


def limit(request: Request, action: str, maximum: int, subject: str = ""):
    window = int(time.time()) // 600
    key = digest(f"{action}:{subject or (request.client.host if request.client else 'unknown')}")
    statement = insert(RateLimit).values(key=key, window=window, attempts=1)
    statement = statement.on_conflict_do_update(
        index_elements=[RateLimit.key, RateLimit.window],
        set_={"attempts": RateLimit.attempts + 1},
        where=RateLimit.attempts < maximum,
    ).returning(RateLimit.attempts)
    with SessionFactory.begin() as db:
        allowed = db.scalar(statement)
        # Clear old counters occasionally without requiring a separate worker.
        if secrets.randbelow(128) == 0:
            db.execute(delete(RateLimit).where(RateLimit.window < window - 2))
    if allowed is None:
        raise HTTPException(429, "Demasiados pedidos. Tente novamente mais tarde.",
                            headers={"Retry-After": str(600 - int(time.time()) % 600)})
