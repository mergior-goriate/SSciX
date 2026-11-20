import re
from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import AfterValidator, BaseModel, Field, StringConstraints, field_validator
from sqlalchemy import delete, false, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import aliased

from .auth import DB, Member, get_user
from .models import Bookmark, Community, Discussion, Follow, Mention, Profile, Reaction, ReadingParticipant, User
from .profiles import image_response, photo_url
from .schemas import Input, Name, Slug, image_data, web_url
from .security import limit, now, require_origin

router = APIRouter(tags=["rede académica"])
same_origin = [Depends(require_origin)]


class CommunityInput(Input):
    name: Name
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=600)]


CommunityPhotoData = Annotated[str, Field(max_length=360_000), AfterValidator(image_data)]


class CommunityPhoto(Input):
    photo: CommunityPhotoData


class CommunityView(CommunityInput):
    id: UUID
    photo: str = ""
    can_edit_photo: bool = False


class CommunityCreate(CommunityInput):
    photo: CommunityPhotoData = ""


class ReplyInput(Input):
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2400)]


OpportunityKind = Literal["scholarship", "internship", "vacancy", "call"]
PostKind = Literal["post", "collaboration", "reading", OpportunityKind]
OPPORTUNITY_KINDS = ("scholarship", "internship", "vacancy", "call")
CLOSABLE_KINDS = ("collaboration", *OPPORTUNITY_KINDS)


class PostInput(ReplyInput):
    community_id: UUID | None = None
    image: str = Field(default="", max_length=700_000)
    article_url: str = Field(default="", max_length=1000)
    kind: PostKind = "post"
    title: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] = ""
    scheduled_date: date | None = None

    _image = field_validator("image")(image_data)
    _url = field_validator("article_url")(web_url)


class PostView(BaseModel):
    id: UUID
    body: str
    author_name: str
    author_slug: str
    created_at: str
    community_id: UUID | None
    community_name: str | None
    author_photo: str
    image: str
    article_url: str
    likes: int
    liked: bool = False
    saved: bool = False
    kind: PostKind
    title: str
    scheduled_date: date | None
    resolved: bool
    can_resolve: bool = False


def read_posts(db: DB, *conditions, newest: bool = True, page_size: int = 40,
               viewer: UUID | None = None, offset: int = 0, popular: bool = False):
    date_order = Discussion.created_at.desc() if newest else Discussion.created_at
    likes = select(func.count()).select_from(Reaction).join(User).where(
        Reaction.post_id == Discussion.id, User.deactivated_at.is_(None),
    ).correlate(Discussion).scalar_subquery()
    liked, saved = false(), false()
    if viewer:
        liked = select(Reaction.post_id).where(Reaction.post_id == Discussion.id, Reaction.user_id == viewer).exists()
        saved = select(Bookmark.post_id).where(Bookmark.post_id == Discussion.id, Bookmark.user_id == viewer).exists()
    query = (
        select(Discussion, Profile, Community.name, likes, liked, saved)
        .join(Profile, Profile.user_id == Discussion.author_id)
        .join(User, User.id == Profile.user_id)
        .outerjoin(Community, Community.id == Discussion.community_id)
        .where(Profile.is_public.is_(True), User.deactivated_at.is_(None), *conditions)
        .order_by(*([likes.desc()] if popular else []), date_order, Discussion.id)
        .offset(offset)
        .limit(page_size)
    )
    return [
        PostView(
            id=post.id, body=post.body, author_name=author.name, author_slug=author.slug,
            created_at=post.created_at.isoformat(), community_id=post.community_id, community_name=community,
            author_photo=photo_url(author), image=f"/api/v1/feed/{post.id}/image" if post.image else "",
            article_url=post.article_url, likes=likes, liked=liked, saved=saved,
            kind=post.kind, title=post.title, scheduled_date=post.scheduled_date, resolved=post.resolved,
            can_resolve=post.kind in CLOSABLE_KINDS and post.author_id == viewer,
        )
        for post, author, community, likes, liked, saved in db.execute(query)
    ]


def public_author(db: DB, request: Request):
    user = get_user(db, request, for_update=True)
    profile = db.get(Profile, user.id, with_for_update={"key_share": True})
    if not profile.is_public:
        raise HTTPException(403, "Torne o seu perfil público para participar na rede académica.")
    limit(request, "network-write", 30, str(user.id))
    return profile


def community_photo_url(community_id: UUID, has_photo: bool):
    return f"/api/v1/communities/{community_id}/photo" if has_photo else ""


def get_community(community_id: UUID, db: DB):
    value = db.get(Community, community_id)
    if value is None:
        raise HTTPException(404, "Comunidade indisponível.")
    return value


def community_view(value: Community, user_id: UUID):
    return CommunityView(id=value.id, name=value.name, description=value.description,
                         photo=community_photo_url(value.id, bool(value.photo)),
                         can_edit_photo=value.owner_id == user_id)


@router.get("/communities", response_model=list[CommunityView])
def communities(db: DB):
    rows = db.execute(select(Community.id, Community.name, Community.description, Community.photo != "")
                      .order_by(Community.name).limit(100))
    return [CommunityView(id=cid, name=name, description=description, photo=community_photo_url(cid, has_photo))
            for cid, name, description, has_photo in rows]


@router.get("/communities/{community_id}", response_model=CommunityView)
def community(community_id: UUID, db: DB, user: Member):
    return community_view(get_community(community_id, db), user.id)


@router.get("/communities/{community_id}/photo")
def community_photo(community_id: UUID, db: DB):
    return image_response(get_community(community_id, db).photo)


@router.put("/communities/{community_id}/photo", response_model=CommunityView, dependencies=same_origin)
def update_community_photo(community_id: UUID, data: CommunityPhoto, db: DB, user: Member, request: Request):
    value = get_community(community_id, db)
    if value.owner_id != user.id:
        raise HTTPException(403, "Só o criador pode alterar a fotografia da comunidade.")
    limit(request, "community-photo", 12, str(user.id))
    value.photo = data.photo
    db.commit()
    return community_view(value, user.id)


@router.post("/communities", response_model=CommunityView, status_code=201, dependencies=same_origin)
def create_community(data: CommunityCreate, db: DB, request: Request):
    author = public_author(db, request)
    value = Community(**data.model_dump(), owner_id=author.user_id)
    db.add(value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Já existe uma comunidade com esse nome.") from None
    return community_view(value, author.user_id)


@router.get("/feed", response_model=list[PostView])
def feed(db: DB, user: Member, following: bool = False, community_id: UUID | None = None, author: Slug | None = None,
         content: Literal["articles", "images", "collaboration", "reading", "opportunities"] | None = None,
         opportunity_kind: OpportunityKind | None = None, open_only: bool = False,
         q: str = Query(default="", max_length=100, pattern=r"^[^\x00]*$"),
         order: Literal["recent", "popular"] = "recent",
         offset: int = Query(default=0, ge=0, le=100_000),
         page_size: int = Query(default=40, ge=1, le=40)):
    conditions = [Discussion.parent_id.is_(None)]
    viewer = user.id
    if following:
        conditions.append(Discussion.author_id.in_(select(Follow.followed_id).where(Follow.follower_id == viewer)))
    if author is not None:
        conditions.append(Profile.slug == author)
    if community_id is not None:
        get_community(community_id, db)
        conditions.append(Discussion.community_id == community_id)
    if content == "articles":
        conditions.extend((Discussion.article_url != "", Discussion.kind.not_in(OPPORTUNITY_KINDS)))
    elif content == "images":
        conditions.append(Discussion.image != "")
    elif content == "opportunities":
        conditions.append(Discussion.kind.in_(OPPORTUNITY_KINDS))
        if opportunity_kind:
            conditions.append(Discussion.kind == opportunity_kind)
        if open_only:
            conditions.extend((
                Discussion.resolved.is_(False),
                or_(Discussion.scheduled_date.is_(None), Discussion.scheduled_date >= now().date()),
            ))
    elif content:
        conditions.append(Discussion.kind == content)
    term = q.strip()
    if term:
        conditions.append(or_(
            Discussion.title.icontains(term, autoescape=True),
            Discussion.body.icontains(term, autoescape=True),
        ))
    return read_posts(db, *conditions, viewer=viewer, offset=offset, page_size=page_size,
                      popular=order == "popular")


@router.post("/feed", status_code=201, response_model=PostView, dependencies=same_origin)
def publish(data: PostInput, db: DB, request: Request):
    author = public_author(db, request)
    if data.kind in ("collaboration", "reading") and (data.community_id is None or not data.title):
        raise HTTPException(422, "Indique um título e publique a actividade numa comunidade.")
    if data.kind == "reading" and data.scheduled_date is None:
        raise HTTPException(422, "Indique a data da sessão de leitura.")
    if data.kind in OPPORTUNITY_KINDS:
        if not data.title or not data.article_url:
            raise HTTPException(422, "Indique o título e a ligação para a candidatura ou submissão.")
        if data.scheduled_date is not None and data.scheduled_date < now().date():
            raise HTTPException(422, "O prazo da oportunidade já terminou.")
    if data.kind == "post" and (data.title or data.scheduled_date):
        raise HTTPException(422, "O título e a data destinam-se às actividades da comunidade.")
    if data.community_id is not None:
        get_community(data.community_id, db)
    post = Discussion(**data.model_dump(), author_id=author.user_id)
    db.add(post)
    db.flush()
    record_mentions(db, post)
    value = read_posts(db, Discussion.id == post.id, viewer=author.user_id)[0]
    db.commit()
    return value


def visible_topic(db: DB, post_id: UUID, viewer: UUID | None = None):
    posts = read_posts(db, Discussion.id == post_id, Discussion.parent_id.is_(None), viewer=viewer)
    if not posts:
        raise HTTPException(404, "Publicação indisponível.")
    return posts[0]


@router.get("/feed/{post_id}", response_model=PostView)
def topic(post_id: UUID, db: DB, user: Member):
    return visible_topic(db, post_id, user.id)


@router.put("/feed/{post_id}/resolved", response_model=PostView, dependencies=same_origin)
def resolve_topic(post_id: UUID, db: DB, user: Member):
    topic = visible_topic(db, post_id, user.id)
    if topic.kind not in CLOSABLE_KINDS:
        raise HTTPException(404, "Publicação indisponível para encerrar.")
    if not topic.can_resolve:
        raise HTTPException(403, "Só o autor pode encerrar esta publicação.")
    db.execute(update(Discussion).where(Discussion.id == post_id).values(resolved=True))
    db.commit()
    return visible_topic(db, post_id, user.id)


class ReadingContact(Input):
    whatsapp: Annotated[str, StringConstraints(pattern=r"^(?:[1-9][0-9]{6,14})?$")] = ""


def require_reading(db: DB, post_id: UUID):
    if visible_topic(db, post_id).kind != "reading":
        raise HTTPException(404, "Sessão de leitura indisponível.")


@router.get("/feed/{post_id}/participants")
def reading_participants(post_id: UUID, db: DB, user: Member, response: Response):
    require_reading(db, post_id)
    response.headers["Cache-Control"] = "private, no-store"
    own = db.get(ReadingParticipant, (post_id, user.id))
    if own is None:
        return {"joined": False, "whatsapp": "", "participants": []}
    rows = db.execute(
        select(ReadingParticipant, Profile).join(Profile, Profile.user_id == ReadingParticipant.user_id)
        .join(User, User.id == ReadingParticipant.user_id)
        .where(ReadingParticipant.post_id == post_id, ReadingParticipant.user_id != user.id,
               User.deactivated_at.is_(None))
        .order_by(Profile.name, Profile.slug)
    )
    return {"joined": True, "whatsapp": own.whatsapp, "participants": [
        {"slug": profile.slug, "name": profile.name, "whatsapp": participant.whatsapp}
        for participant, profile in rows
    ]}


@router.put("/feed/{post_id}/participants/me", status_code=204, dependencies=same_origin)
def join_reading(post_id: UUID, data: ReadingContact, db: DB, user: Member, request: Request):
    require_reading(db, post_id)
    limit(request, "reading-participation", 30, str(user.id))
    db.execute(insert(ReadingParticipant).values(post_id=post_id, user_id=user.id, whatsapp=data.whatsapp)
               .on_conflict_do_update(index_elements=["post_id", "user_id"], set_={"whatsapp": data.whatsapp}))
    db.commit()


@router.delete("/feed/{post_id}/participants/me", status_code=204, dependencies=same_origin)
def leave_reading(post_id: UUID, db: DB, user: Member, request: Request):
    limit(request, "reading-participation", 30, str(user.id))
    db.execute(delete(ReadingParticipant).where(ReadingParticipant.post_id == post_id,
                                               ReadingParticipant.user_id == user.id))
    db.commit()


@router.get("/feed/{post_id}/image")
def post_image(post_id: UUID, db: DB):
    post = db.scalar(select(Discussion).join(Profile, Profile.user_id == Discussion.author_id).join(
        User, User.id == Profile.user_id,
    ).where(Discussion.id == post_id, Discussion.parent_id.is_(None), Profile.is_public.is_(True),
            User.deactivated_at.is_(None)))
    return image_response(post.image if post else "")


@router.get("/feed/{post_id}/replies", response_model=list[PostView])
def replies(post_id: UUID, db: DB):
    visible_topic(db, post_id)
    parent, author = aliased(Discussion), aliased(Profile)
    visible_parent = select(parent.id).join(author, author.user_id == parent.author_id).join(
        User, User.id == author.user_id,
    ).where(author.is_public.is_(True), User.deactivated_at.is_(None))
    return read_posts(db, Discussion.parent_id == post_id, Discussion.parent_id.in_(visible_parent), newest=False)


@router.post("/feed/{post_id}/replies", status_code=201, response_model=PostView, dependencies=same_origin)
def reply(post_id: UUID, data: ReplyInput, db: DB, request: Request):
    author = public_author(db, request)
    topic = visible_topic(db, post_id)
    post = Discussion(body=data.body, author_id=author.user_id, parent_id=topic.id, community_id=topic.community_id)
    db.add(post)
    db.flush()
    recipient = db.scalar(select(Discussion.author_id).where(Discussion.id == topic.id)) if topic.kind == "collaboration" else None
    record_mentions(db, post, recipient)
    value = read_posts(db, Discussion.id == post.id)[0]
    db.commit()
    return value


def record_mentions(db: DB, post: Discussion, reply_recipient: UUID | None = None):
    slugs = set(re.findall(r"(?<![\w@])@([a-z0-9]+(?:-[a-z0-9]+)*)(?![\w-])", post.body))
    recipients = set()
    if slugs:
        recipients.update(db.scalars(select(Profile.user_id).join(User).where(
            Profile.slug.in_(slugs), Profile.user_id != post.author_id, User.deactivated_at.is_(None),
        )))
    if reply_recipient is not None and reply_recipient != post.author_id:
        recipients.add(reply_recipient)
    db.add_all(Mention(recipient_id=recipient, post_id=post.id) for recipient in recipients)


@router.get("/saved", response_model=list[PostView])
def saved(db: DB, request: Request):
    user = get_user(db, request)
    return read_posts(db, Discussion.parent_id.is_(None), Discussion.id.in_(
        select(Bookmark.post_id).where(Bookmark.user_id == user.id)
    ), viewer=user.id)


@router.get("/feed/{post_id}/actions")
def actions(post_id: UUID, db: DB, request: Request):
    user = get_user(db, request)
    topic = visible_topic(db, post_id, user.id)
    return {"liked": topic.liked, "saved": topic.saved, "likes": topic.likes}


@router.put("/feed/{post_id}/actions/{action}", dependencies=same_origin)
def add_action(post_id: UUID, action: str, db: DB, request: Request):
    return write_action(post_id, action, True, db, request)


@router.delete("/feed/{post_id}/actions/{action}", dependencies=same_origin)
def remove_action(post_id: UUID, action: str, db: DB, request: Request):
    return write_action(post_id, action, False, db, request)


def write_action(post_id: UUID, action: str, enabled: bool, db: DB, request: Request):
    user = get_user(db, request, for_update=True)
    model = {"like": Reaction, "save": Bookmark}.get(action)
    if model is None:
        raise HTTPException(404, "Acção indisponível.")
    visible_topic(db, post_id)
    if enabled:
        db.execute(insert(model).values(user_id=user.id, post_id=post_id).on_conflict_do_nothing())
    else:
        db.execute(delete(model).where(model.user_id == user.id, model.post_id == post_id))
    db.commit()
    return actions(post_id, db, request)


@router.get("/notifications")
def notifications(db: DB, request: Request):
    user = get_user(db, request)
    parent, parent_profile, parent_user = aliased(Discussion), aliased(Profile), aliased(User)
    visible_parents = select(parent.id).join(parent_profile, parent_profile.user_id == parent.author_id).join(
        parent_user, parent_user.id == parent_profile.user_id,
    ).where(parent_profile.is_public.is_(True), parent_user.deactivated_at.is_(None))
    collaboration_reply = select(parent.id).where(
        parent.id == Discussion.parent_id, parent.kind == "collaboration", parent.author_id == user.id,
    ).exists()
    query = (
        select(Mention, Discussion, Profile, collaboration_reply).join(Discussion, Discussion.id == Mention.post_id)
        .join(Profile, Profile.user_id == Discussion.author_id).join(User, User.id == Profile.user_id)
        .where(Mention.recipient_id == user.id, Profile.is_public.is_(True), User.deactivated_at.is_(None),
               Discussion.parent_id.is_(None) | Discussion.parent_id.in_(visible_parents))
        .order_by(Discussion.created_at.desc(), Discussion.id).limit(40)
    )
    return [
        {"id": post.id, "topic_id": post.parent_id or post.id, "author_name": author.name, "author_photo": photo_url(author),
         "created_at": post.created_at, "read": mention.read_at is not None, "collaboration_reply": is_reply}
        for mention, post, author, is_reply in db.execute(query)
    ]


@router.put("/notifications/{post_id}/read", status_code=204, dependencies=same_origin)
def mark_read(post_id: UUID, db: DB, request: Request):
    user = get_user(db, request)
    db.execute(update(Mention).where(Mention.recipient_id == user.id, Mention.post_id == post_id).values(read_at=now()))
    db.commit()
