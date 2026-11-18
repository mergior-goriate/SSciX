from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, StringConstraints
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import aliased

from .auth import DB, get_user
from .models import Community, Discussion, Follow, Profile
from .schemas import Input, Name
from .security import limit, require_origin

router = APIRouter(tags=["rede académica"])
same_origin = [Depends(require_origin)]


class CommunityInput(Input):
    name: Name
    description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=600)]


class CommunityView(CommunityInput):
    id: UUID


class PostInput(Input):
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2400)]
    community_id: UUID | None = None


class ReplyInput(Input):
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2400)]


class PostView(BaseModel):
    id: UUID
    body: str
    author_name: str
    author_slug: str
    created_at: str
    community_id: UUID | None
    community_name: str | None


def read_posts(db: DB, *conditions, newest: bool = True, page_size: int = 40):
    query = (
        select(Discussion, Profile, Community.name)
        .join(Profile, Profile.user_id == Discussion.author_id)
        .outerjoin(Community, Community.id == Discussion.community_id)
        .where(Profile.is_public.is_(True), *conditions)
        .order_by(Discussion.created_at.desc() if newest else Discussion.created_at, Discussion.id)
        .limit(page_size)
    )
    return [
        PostView(
            id=post.id, body=post.body, author_name=author.name, author_slug=author.slug,
            created_at=post.created_at.isoformat(), community_id=post.community_id, community_name=community,
        )
        for post, author, community in db.execute(query)
    ]


def public_author(db: DB, request: Request):
    user = get_user(db, request)
    profile = db.get(Profile, user.id, with_for_update={"key_share": True})
    if not profile.is_public:
        raise HTTPException(403, "Torne o seu perfil público para participar na rede académica.")
    limit(request, "network-write", 30, str(user.id))
    return profile


@router.get("/communities", response_model=list[CommunityView])
def communities(db: DB):
    return db.scalars(select(Community).order_by(Community.name).limit(100)).all()


@router.get("/communities/{community_id}", response_model=CommunityView)
def community(community_id: UUID, db: DB):
    value = db.get(Community, community_id)
    if value is None:
        raise HTTPException(404, "Comunidade indisponível.")
    return value


@router.post("/communities", response_model=CommunityView, status_code=201, dependencies=same_origin)
def create_community(data: CommunityInput, db: DB, request: Request):
    author = public_author(db, request)
    value = Community(**data.model_dump(), owner_id=author.user_id)
    db.add(value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Já existe uma comunidade com esse nome.") from None
    return value


@router.get("/feed", response_model=list[PostView])
def feed(db: DB, request: Request, following: bool = False, community_id: UUID | None = None):
    conditions = [Discussion.parent_id.is_(None)]
    if following:
        user = get_user(db, request)
        conditions.append(Discussion.author_id.in_(select(Follow.followed_id).where(Follow.follower_id == user.id)))
    if community_id is not None:
        community(community_id, db)
        conditions.append(Discussion.community_id == community_id)
    return read_posts(db, *conditions)


@router.post("/feed", status_code=201, response_model=PostView, dependencies=same_origin)
def publish(data: PostInput, db: DB, request: Request):
    author = public_author(db, request)
    if data.community_id is not None:
        community(data.community_id, db)
    post = Discussion(**data.model_dump(), author_id=author.user_id)
    db.add(post)
    db.flush()
    value = read_posts(db, Discussion.id == post.id)[0]
    db.commit()
    return value


def visible_topic(db: DB, post_id: UUID):
    posts = read_posts(db, Discussion.id == post_id, Discussion.parent_id.is_(None))
    if not posts:
        raise HTTPException(404, "Publicação indisponível.")
    return posts[0]


@router.get("/feed/{post_id}", response_model=PostView)
def topic(post_id: UUID, db: DB):
    return visible_topic(db, post_id)


@router.get("/feed/{post_id}/replies", response_model=list[PostView])
def replies(post_id: UUID, db: DB):
    visible_topic(db, post_id)
    parent, author = aliased(Discussion), aliased(Profile)
    visible_parent = select(parent.id).join(author, author.user_id == parent.author_id).where(author.is_public.is_(True))
    return read_posts(db, Discussion.parent_id == post_id, Discussion.parent_id.in_(visible_parent), newest=False)


@router.post("/feed/{post_id}/replies", status_code=201, response_model=PostView, dependencies=same_origin)
def reply(post_id: UUID, data: ReplyInput, db: DB, request: Request):
    author = public_author(db, request)
    topic = visible_topic(db, post_id)
    post = Discussion(body=data.body, author_id=author.user_id, parent_id=topic.id, community_id=topic.community_id)
    db.add(post)
    db.flush()
    value = read_posts(db, Discussion.id == post.id)[0]
    db.commit()
    return value
