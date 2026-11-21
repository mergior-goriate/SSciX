import os

from cryptography.fernet import Fernet, MultiFernet

# The first key writes new messages. Subsequent keys can still decrypt older messages.
configured_keys = os.getenv("SSCIX_MESSAGE_KEYS", "")
cipher = MultiFernet([Fernet(key.strip().encode()) for key in configured_keys.split(",")]) if configured_keys else None
if os.getenv("SSCIX_REQUIRE_MESSAGE_ENCRYPTION") == "1" and cipher is None:
    raise RuntimeError("Configure SSCIX_MESSAGE_KEYS before enabling mandatory message encryption.")


def store_message(body: str) -> tuple[str, bool]:
    if cipher is None:
        return body, False
    return cipher.encrypt(body.encode()).decode(), True


def read_message(body: str, encrypted: bool) -> str:
    if not encrypted:
        return body
    if cipher is None:
        raise RuntimeError("Message encryption keys are unavailable.")
    return cipher.decrypt(body.encode()).decode()
