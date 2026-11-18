from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DatabaseSession

from . import schemas
from .db import get_db
from .mail import send_link
from .models import EmailToken, Profile, Session, User
from .security import (
    COOKIE, DUMMY_HASH, PASSWORDS, SESSION_SECONDS, clear_session, digest,
    expires, limit, now, password_matches, require_origin, set_session, token,
)

router = APIRouter(prefix="/auth", tags=["conta"], dependencies=[Depends(require_origin)])
DB = Annotated[DatabaseSession, Depends(get_db)]
TERMS_VERSION = "local-v1"


def get_user(db: DB, request: Request, *, for_update: bool = False) -> User:
    secret = request.cookies.get(COOKIE, "")
    if len(secret) != 43:
        raise HTTPException(401, "Inicie sessão para continuar.")
    query = select(User).join(Session).where(
        Session.digest == digest(secret), Session.expires_at > now(), User.verified_at.is_not(None),
        User.deactivated_at.is_(None),
    )
    user = db.scalar(query.with_for_update(of=User) if for_update else query)
    if user is None or (for_update and db.scalar(query) is None):
        raise HTTPException(401, "Inicie sessão para continuar.")
    return user


def require_member(db: DB, request: Request) -> User:
    return get_user(db, request)


Member = Annotated[User, Depends(require_member)]


def issue_email_token(db: DatabaseSession, user: User, purpose: str, pending_email: str | None = None) -> str:
    db.execute(delete(EmailToken).where(
        EmailToken.user_id == user.id, EmailToken.expires_at <= now()
    ))
    secret = token()
    age = 86400 if purpose == "verify" else 1800
    db.add(EmailToken(digest=digest(secret), user_id=user.id, purpose=purpose, pending_email=pending_email, expires_at=expires(age)))
    return secret


def consume_email_token(db: DatabaseSession, secret: str, purpose: str) -> User:
    criteria = (EmailToken.digest == digest(secret), EmailToken.purpose == purpose, EmailToken.expires_at > now())
    user = db.scalar(select(User).join(EmailToken).where(*criteria).with_for_update(of=User))
    if user is None or db.scalar(select(EmailToken.digest).where(*criteria)) is None:
        raise HTTPException(400, "O link é inválido ou expirou. Solicite um novo.")
    db.execute(delete(EmailToken).where(EmailToken.user_id == user.id, EmailToken.purpose == purpose))
    return user


@router.post("/register", status_code=202)
def register(data: schemas.Register, request: Request, db: DB):
    limit(request, "register", 30)
    email = str(data.email).lower()
    limit(request, "register-email", 4, email)
    existing = db.scalar(select(User).where(User.email == email))
    if existing is None:
        user = User(email=email, password_hash=PASSWORDS.hash(data.password), terms_version=TERMS_VERSION)
        db.add(user)
        try:
            db.flush()
            db.add(Profile(user_id=user.id, name=data.name, slug=data.slug))
            secret = issue_email_token(db, user, "verify")
            db.commit()
        except IntegrityError:
            db.rollback()
            if db.scalar(select(User.id).where(User.email == email)) is not None:
                return {"message": "Consulte a sua caixa de email para continuar."}
            raise HTTPException(409, "Este endereço de perfil já está em uso.") from None
        send_link(email, "verify", secret)
    return {"message": "Consulte a sua caixa de email para continuar."}


@router.post("/resend", status_code=202)
@router.post("/forgot-password", status_code=202)
def request_email(data: schemas.EmailInput, request: Request, db: DB):
    purpose = "verify" if request.url.path.endswith("/resend") else "reset"
    email = str(data.email).lower()
    limit(request, purpose + "-request", 40)
    limit(request, purpose + "-email", 4, email)
    user = db.scalar(select(User).where(User.email == email).with_for_update())
    if user is not None and (user.verified_at is None) == (purpose == "verify"):
        secret = issue_email_token(db, user, purpose)
        db.commit()
        send_link(email, purpose, secret)
    return {"message": "Se a conta estiver elegível, receberá um link por email."}


@router.post("/verify", status_code=204)
def verify(data: schemas.ConfirmEmail, request: Request, response: Response, db: DB):
    limit(request, "verify", 80)
    user = consume_email_token(db, data.token, "verify")
    if not password_matches(data.password, user.password_hash):
        raise HTTPException(403, "Introduza a palavra-passe usada no registo.")
    user.verified_at = now()
    start_session(user, request, response, db)


@router.post("/reset-password", status_code=204)
def reset_password(data: schemas.Reset, request: Request, db: DB):
    limit(request, "reset-password", 80)
    user = consume_email_token(db, data.token, "reset")
    user.password_hash = PASSWORDS.hash(data.password)
    db.execute(delete(Session).where(Session.user_id == user.id))
    db.commit()


@router.post("/login", status_code=204)
def login(data: schemas.Login, request: Request, response: Response, db: DB):
    email = str(data.email).lower()
    limit(request, "login", 180)
    limit(request, "login-email", 12, email)
    user = db.scalar(select(User).where(User.email == email).with_for_update())
    if not password_matches(data.password, user.password_hash if user else DUMMY_HASH) or user is None:
        raise HTTPException(401, "Email ou palavra-passe incorretos.")
    if user.verified_at is None:
        raise HTTPException(403, "Confirme o endereço de email antes de entrar.")
    user.deactivated_at = None
    start_session(user, request, response, db)


def start_session(user: User, request: Request, response: Response, db: DB):
    previous = request.cookies.get(COOKIE, "")
    if len(previous) == 43:
        db.execute(delete(Session).where(Session.digest == digest(previous)))
    db.execute(delete(Session).where(Session.user_id == user.id, Session.expires_at <= now()))
    secret = token()
    db.add(Session(digest=digest(secret), user_id=user.id, expires_at=expires(SESSION_SECONDS)))
    db.commit()
    set_session(response, secret)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: DB):
    secret = request.cookies.get(COOKIE, "")
    if len(secret) == 43:
        db.execute(delete(Session).where(Session.digest == digest(secret)))
        db.commit()
    clear_session(response)


@router.delete("/account", status_code=204)
def delete_account(data: schemas.DeleteAccount, request: Request, response: Response, db: DB):
    user = get_user(db, request, for_update=True)
    limit(request, "delete-user", 8, str(user.id))
    if not password_matches(data.password, user.password_hash):
        raise HTTPException(403, "Palavra-passe incorreta.")
    db.delete(user)
    db.commit()
    clear_session(response)


@router.put("/password", status_code=204)
def change_password(data: schemas.ChangePassword, request: Request, response: Response, db: DB):
    user = get_user(db, request, for_update=True)
    limit(request, "settings-password", 8, str(user.id))
    check_password(data.password, user)
    user.password_hash = PASSWORDS.hash(data.new_password)
    db.execute(delete(Session).where(Session.user_id == user.id))
    db.execute(delete(EmailToken).where(EmailToken.user_id == user.id))
    start_session(user, request, response, db)


def check_password(password: str, user: User):
    if not password_matches(password, user.password_hash):
        raise HTTPException(403, "Palavra-passe incorrecta.")


@router.post("/email", status_code=202)
def change_email(data: schemas.ChangeEmail, request: Request, db: DB):
    user = get_user(db, request, for_update=True)
    email = str(data.email).lower()
    limit(request, "settings-email", 5, str(user.id))
    check_password(data.password, user)
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise HTTPException(409, "Escolha outro endereço de email.")
    db.execute(delete(EmailToken).where(EmailToken.user_id == user.id, EmailToken.purpose == "change-email"))
    secret = issue_email_token(db, user, "change-email", email)
    db.commit()
    send_link(email, "change-email", secret)
    return {"message": "Abra a ligação enviada ao novo endereço para confirmar a alteração."}


@router.post("/confirm-email-change", status_code=204)
def confirm_email_change(data: schemas.ConfirmEmail, request: Request, response: Response, db: DB):
    limit(request, "settings-confirm-email", 30)
    email = db.scalar(select(EmailToken.pending_email).where(EmailToken.digest == digest(data.token)))
    user = consume_email_token(db, data.token, "change-email")
    check_password(data.password, user)
    if not email or user.deactivated_at is not None:
        raise HTTPException(400, "O link é inválido ou expirou.")
    user.email = email
    db.execute(delete(Session).where(Session.user_id == user.id))
    db.execute(delete(EmailToken).where(EmailToken.user_id == user.id))
    try:
        start_session(user, request, response, db)
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Escolha outro endereço de email.") from None


@router.post("/deactivate", status_code=204)
def deactivate(data: schemas.DeleteAccount, request: Request, response: Response, db: DB):
    user = get_user(db, request, for_update=True)
    limit(request, "settings-deactivate", 8, str(user.id))
    check_password(data.password, user)
    user.deactivated_at = now()
    db.execute(delete(Session).where(Session.user_id == user.id))
    db.execute(delete(EmailToken).where(EmailToken.user_id == user.id))
    db.commit()
    clear_session(response)
