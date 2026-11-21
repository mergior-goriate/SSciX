from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import and_, case, or_, select
from sqlalchemy.dialects.postgresql import distinct_on

from .auth import DB, get_user
from .message_storage import read_message, store_message
from .models import DirectMessage, Profile, User
from .network import ReplyInput
from .profiles import photo_url
from .schemas import Slug
from .security import limit, require_origin

router = APIRouter(prefix="/messages", tags=["mensagens"])


def participants(user_id, peer_id):
    return or_(
        and_(DirectMessage.sender_id == user_id, DirectMessage.recipient_id == peer_id),
        and_(DirectMessage.sender_id == peer_id, DirectMessage.recipient_id == user_id),
    )


@router.get("")
def inbox(db: DB, request: Request):
    user = get_user(db, request)
    other = case((DirectMessage.sender_id == user.id, DirectMessage.recipient_id), else_=DirectMessage.sender_id)
    latest = (
        select(other.label("peer_id"), DirectMessage.created_at.label("activity"), DirectMessage.id, DirectMessage.body, DirectMessage.body_encrypted)
        .where(or_(DirectMessage.sender_id == user.id, DirectMessage.recipient_id == user.id))
        .ext(distinct_on(other)).order_by(other, DirectMessage.created_at.desc(), DirectMessage.id.desc()).subquery()
    )
    query = (
        select(Profile, latest.c.activity, latest.c.body, latest.c.body_encrypted, User.deactivated_at, User.suspended)
        .join(latest, latest.c.peer_id == Profile.user_id).join(User)
        .order_by(latest.c.activity.desc(), latest.c.id.desc()).limit(50)
    )
    return [
        {"slug": profile.slug, "name": profile.name, "activity": activity, "preview": read_message(body, encrypted),
         "photo": photo_url(profile) if profile.is_public and not profile.moderation_hidden and deactivated is None and not suspended else ""}
        for profile, activity, body, encrypted, deactivated, suspended in db.execute(query)
    ]


def peer_profile(slug: str, user_id: UUID, db: DB):
    result = db.execute(select(Profile, User.deactivated_at, User.suspended).join(User).where(Profile.slug == slug)).one_or_none()
    if result is None or result[0].user_id == user_id:
        raise HTTPException(404, "Conversa indisponível.")
    profile, deactivated, suspended = result
    existing = select(DirectMessage.id).where(participants(user_id, profile.user_id)).limit(1)
    if (not profile.is_public or profile.moderation_hidden or suspended or deactivated is not None) and db.scalar(existing) is None:
        raise HTTPException(404, "Conversa indisponível.")
    return profile, deactivated is None and not suspended


@router.get("/{slug}")
def conversation(slug: Slug, db: DB, request: Request, offset: int = Query(0, ge=0, le=1_000_000)):
    user = get_user(db, request)
    peer, can_send = peer_profile(slug, user.id, db)
    query = (select(DirectMessage).where(participants(user.id, peer.user_id))
             .order_by(DirectMessage.created_at.desc(), DirectMessage.id.desc()).offset(offset).limit(51))
    entries = db.scalars(query).all()
    return {
        "name": peer.name, "can_send": can_send, "has_more": len(entries) > 50,
        "public_profile": peer.is_public and can_send,
        "photo": photo_url(peer) if peer.is_public and can_send else "",
        "messages": [
            {"id": entry.id, "mine": entry.sender_id == user.id, "body": read_message(entry.body, entry.body_encrypted), "created_at": entry.created_at}
            for entry in reversed(entries[:50])
        ],
    }


@router.post("/{slug}", status_code=201, dependencies=[Depends(require_origin)])
def send(slug: Slug, data: ReplyInput, db: DB, request: Request):
    user = get_user(db, request)
    peer, can_send = peer_profile(slug, user.id, db)
    if not can_send:
        raise HTTPException(403, "Este utilizador está indisponível.")
    limit(request, "send-message", 30, str(user.id))
    stored, encrypted = store_message(data.body)
    entry = DirectMessage(sender_id=user.id, recipient_id=peer.user_id, body=stored, body_encrypted=encrypted)
    db.add(entry)
    db.commit()
    return {"id": entry.id, "mine": True, "body": data.body, "created_at": entry.created_at}
