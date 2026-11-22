from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Query, Request, Response
from pydantic import Field, StringConstraints, field_validator
from sqlalchemy import JSON, DateTime, ForeignKey, select
from sqlalchemy.orm import Mapped, mapped_column

from .admin import Access, audit, find_or_404, scope, write
from .admin_models import AdminGrant
from .auth import DB, Member, get_user
from .db import Base
from .models import Profile, User
from .profiles import image_response
from .schemas import Input, image_data
from .security import limit, now

public = APIRouter(prefix="/blog", tags=["blogue"])
members = APIRouter(prefix="/blog", tags=["blogue"])
editorial = APIRouter(prefix="/admin/blog", tags=["blogue"])


class Entry(Base):
    __tablename__ = "blog_entries"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    author_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content: Mapped[dict] = mapped_column(JSON)
    official: Mapped[bool] = mapped_column(default=False)
    visibility: Mapped[str]
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    corrections: Mapped[list] = mapped_column(JSON, default=list)
    ads: Mapped[bool] = mapped_column(default=False)
    hidden: Mapped[bool] = mapped_column(default=False)
    moderation_reason: Mapped[str] = mapped_column(default="")


class EntryReport(Base):
    __tablename__ = "blog_reports"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    entry_id: Mapped[UUID] = mapped_column(ForeignKey("blog_entries.id", ondelete="CASCADE"), index=True)
    reporter_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    reason: Mapped[str]
    resolved: Mapped[bool] = mapped_column(default=False)


def text_field(minimum, maximum):
    return StringConstraints(strip_whitespace=True, min_length=minimum, max_length=maximum, pattern=r"^[^\x00]*$")


class EntryInput(Input):
    title: Annotated[str, text_field(1, 160)]
    body: Annotated[str, text_field(1, 12000)]
    cover: str = Field(default="", max_length=360000)
    category: Literal["novidades", "comunicados", "participacao", "investigacao"] = "investigacao"
    visibility: Literal["public", "members", "draft"] = "draft"
    correction: Annotated[str, text_field(0, 500)] = ""
    official: bool = False

    _cover = field_validator("cover")(image_data)


class Reason(Input):
    reason: Annotated[str, text_field(3, 1000)]


class Review(Reason):
    action: Literal["ads_on", "ads_off", "hide", "restore"]


def viewer(db, request):
    try:
        return get_user(db, request)
    except HTTPException as exc:
        if exc.status_code != 401:
            raise
        return None


def is_editor(db, user):
    grant = db.get(AdminGrant, user.id)
    return grant is not None and grant.role == "admin"


def readable(db, request, entry_id):
    entry = find_or_404(db, Entry, entry_id)
    user = viewer(db, request)
    if user and (user.id == entry.author_id or is_editor(db, user)):
        return entry
    owner = db.get(User, entry.author_id)
    if (not entry.official and (owner.suspended or owner.deactivated_at is not None)
            or entry.hidden or entry.visibility == "draft"
            or entry.visibility == "members" and user is None):
        raise HTTPException(404, "Artigo indisponível.")
    return entry


def view(entry, profile, *, manage=False, summary=False):
    content = {key: value for key, value in entry.content.items() if key != "cover"}
    if summary:
        content["body"] = content["body"][:240]
    return {**content, "id": entry.id, "official": entry.official, "visibility": entry.visibility,
            "author": "Equipa da SSciX" if entry.official else profile.name,
            "slug": profile.slug, "published_at": entry.published_at,
            "corrections": [] if summary else entry.corrections,
            "cover": (entry.content.get("cover", "") if manage else
                      f"/api/v1/blog/view/{entry.id}/cover" if entry.content.get("cover") else ""),
            "ads": entry.ads and entry.visibility == "public" and not entry.hidden,
            "hidden": entry.hidden, **({"moderation_reason": entry.moderation_reason} if manage else {})}


def listing(db, *conditions, offset=0):
    query = (select(Entry, Profile).join(Profile, Profile.user_id == Entry.author_id)
             .where(*conditions).order_by(Entry.published_at.desc().nulls_first(), Entry.id)
             .offset(offset).limit(26))
    rows = db.execute(query).all()
    return {"items": [view(entry, profile, summary=True, manage=False) for entry, profile in rows[:25]],
            "more": len(rows) > 25}


@public.get("/entries")
def entries(db: DB, request: Request, slug: str | None = Query(default=None, max_length=40),
            category: Literal["novidades", "comunicados", "participacao", "investigacao"] | None = None,
            offset: int = Query(default=0, ge=0, le=10000)):
    conditions = [Entry.hidden.is_(False), Entry.visibility == "public"]
    conditions.append(Entry.official.is_(True) | Entry.author_id.in_(select(User.id).where(
        User.suspended.is_(False), User.deactivated_at.is_(None))))
    if slug:
        if viewer(db, request):
            conditions[1] = Entry.visibility.in_(("public", "members"))
        conditions.extend((Entry.official.is_(False), Profile.slug == slug))
    else:
        conditions.append(Entry.official.is_(True))
    if category:
        conditions.append(Entry.content["category"].as_string() == category)
    return listing(db, *conditions, offset=offset)


@members.get("/mine")
def mine(db: DB, user: Member, official: bool = False, offset: int = Query(default=0, ge=0, le=10000)):
    if official:
        if not is_editor(db, user):
            raise HTTPException(403, "Sem acesso editorial.")
        return listing(db, Entry.official.is_(True), offset=offset)
    return listing(db, Entry.author_id == user.id, Entry.official.is_(False), offset=offset)


@members.get("/mine/{entry_id}")
def edit_data(entry_id: UUID, db: DB, user: Member):
    entry = find_or_404(db, Entry, entry_id)
    if entry.author_id != user.id and not (entry.official and is_editor(db, user)):
        raise HTTPException(404, "Artigo indisponível.")
    return view(entry, db.get(Profile, entry.author_id), manage=True)


@members.post("/entries", status_code=201, dependencies=write)
@members.put("/entries/{entry_id}", dependencies=write)
def save(data: EntryInput, db: DB, user: Member, request: Request, entry_id: UUID | None = None):
    limit(request, "blog-write", 30, str(user.id))
    if data.official and not is_editor(db, user):
        raise HTTPException(403, "Só a equipa editorial pode publicar no blogue oficial.")
    if data.official and data.visibility == "members":
        raise HTTPException(422, "As publicações oficiais são públicas.")
    content = data.model_dump(include={"title", "body", "cover", "category"})
    if entry_id:
        entry = find_or_404(db, Entry, entry_id, lock=True)
        if entry.author_id != user.id and not (entry.official and is_editor(db, user)):
            raise HTTPException(404, "Artigo indisponível.")
        if entry.official != data.official:
            raise HTTPException(422, "O tipo de blogue é definido ao criar o texto.")
        if entry.content != content:
            if entry.published_at:
                if not data.correction:
                    raise HTTPException(422, "Indica o que foi alterado neste texto publicado.")
                entry.corrections = [*entry.corrections, {"date": now().isoformat(), "note": data.correction}]
            entry.content = content
            entry.ads = False
    else:
        entry = Entry(content=content, official=data.official, author_id=user.id)
        db.add(entry)
    entry.visibility = data.visibility
    if data.visibility != "public":
        entry.ads = False
    if data.visibility != "draft" and entry.published_at is None:
        entry.published_at = now()
    db.commit()
    return view(entry, db.get(Profile, entry.author_id))


@members.post("/{entry_id}/reports", status_code=204, dependencies=write)
def report(entry_id: UUID, data: Reason, db: DB, user: Member, request: Request):
    entry = readable(db, request, entry_id)
    if entry.hidden or entry.visibility == "draft":
        raise HTTPException(404, "Artigo indisponível.")
    limit(request, "blog-report", 10, str(user.id))
    db.add(EntryReport(entry_id=entry.id, reporter_id=user.id, reason=data.reason))
    db.commit()
    return Response(status_code=204)


@editorial.get("/entries")
def queue(db: DB, grant: Access, offset: int = Query(default=0, ge=0, le=10000)):
    scope(grant, None, admin_only=True)
    return listing(db, Entry.visibility != "draft", offset=offset)


@editorial.get("/reports")
def reports(db: DB, grant: Access, offset: int = Query(default=0, ge=0, le=10000)):
    scope(grant, None, admin_only=True)
    rows = db.scalars(select(EntryReport).where(EntryReport.resolved.is_(False))
                      .order_by(EntryReport.id).offset(offset).limit(26)).all()
    return {"items": [{"id": row.id, "entry_id": row.entry_id, "reason": row.reason} for row in rows[:25]],
            "more": len(rows) > 25}


@editorial.put("/reports/{report_id}", status_code=204, dependencies=write)
def resolve_report(report_id: UUID, data: Reason, db: DB, grant: Access):
    scope(grant, None, admin_only=True)
    report = find_or_404(db, EntryReport, report_id, lock=True)
    report.resolved = True
    audit(db, grant.user_id, "resolve", "blog_report", report.id, None, data.reason)
    db.commit()
    return Response(status_code=204)


@editorial.put("/entries/{entry_id}", status_code=204, dependencies=write)
def review(entry_id: UUID, data: Review, db: DB, grant: Access):
    scope(grant, None, admin_only=True)
    entry = find_or_404(db, Entry, entry_id, lock=True)
    if data.action == "ads_on" and (entry.hidden or entry.visibility != "public"):
        raise HTTPException(422, "Só os artigos públicos e visíveis podem mostrar anúncios.")
    if data.action in ("hide", "restore"):
        entry.hidden = data.action == "hide"
        entry.moderation_reason = data.reason
        if entry.hidden:
            entry.ads = False
    else:
        entry.ads = data.action == "ads_on"
    audit(db, grant.user_id, data.action, "blog_entry", entry.id, None, data.reason)
    db.commit()
    return Response(status_code=204)


@public.get("/view/{entry_id}/cover")
def cover(entry_id: UUID, db: DB, request: Request):
    return image_response(readable(db, request, entry_id).content.get("cover", ""))


@public.get("/view/{entry_id}")
def article(entry_id: UUID, db: DB, request: Request):
    entry = readable(db, request, entry_id)
    return view(entry, db.get(Profile, entry.author_id))
