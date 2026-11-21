from datetime import date, timedelta
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import Field, field_validator, model_validator
from sqlalchemy import delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert

from .auth import DB, Member
from .models import Activity, Affiliation, Community, CommunityMember, Discussion, DiscussionRevision, Follow, Profile, Story, User
from .network import accessible_communities, get_community, public_author, read_posts, same_origin, visible_topic
from .profiles import find_public_profile, image_response
from .schemas import Input, Slug, image_data, web_url
from .security import limit, now

router = APIRouter(tags=["actividade académica"])


class HistorySettings(Input):
    enabled: bool


class ActivityInput(Input):
    query: str = Field(default="", max_length=100, pattern=r"^[^\x00]*$")
    post_id: UUID | None = None

    @model_validator(mode="after")
    def validate_target(self):
        self.query = self.query.strip()
        if bool(self.query) == bool(self.post_id):
            raise ValueError("Indique uma pesquisa ou uma publicação.")
        return self


@router.get("/activity")
def history(db: DB, user: Member):
    profile = db.get(Profile, user.id)
    entries = db.scalars(select(Activity).where(
        Activity.user_id == user.id, Activity.created_at >= now() - timedelta(days=90),
    ).order_by(Activity.created_at.desc(), Activity.id.desc()).limit(40)).all()
    ids = [entry.post_id for entry in entries if entry.post_id]
    posts = {post.id: post for post in read_posts(db, Discussion.id.in_(ids), viewer=user.id)} if ids else {}
    return {"enabled": profile.history_enabled, "entries": [
        {"id": entry.id, "kind": entry.kind, "query": entry.query, "date": entry.created_at,
         "post_id": entry.post_id, "label": posts[entry.post_id].title or posts[entry.post_id].body[:140]
         if entry.post_id else entry.query}
        for entry in entries if not entry.post_id or entry.post_id in posts
    ]}


@router.put("/activity/settings", status_code=204, dependencies=same_origin)
def set_history(data: HistorySettings, db: DB, user: Member):
    profile = db.get(Profile, user.id, with_for_update=True)
    profile.history_enabled = data.enabled
    db.commit()


@router.post("/activity", status_code=204, dependencies=same_origin)
def record(data: ActivityInput, db: DB, user: Member, request: Request):
    profile = db.get(Profile, user.id, with_for_update=True)
    if not profile.history_enabled:
        return
    limit(request, "record-activity", 180, str(user.id))
    if data.post_id:
        visible_topic(db, data.post_id, user.id)
    db.execute(delete(Activity).where(Activity.user_id == user.id, or_(
        Activity.created_at < now() - timedelta(days=90),
        (Activity.post_id == data.post_id) if data.post_id else
        ((Activity.kind == "search") & (Activity.query == data.query)),
    )))
    db.add(Activity(user_id=user.id, kind="read" if data.post_id else "search", query=data.query, post_id=data.post_id))
    db.flush()
    recent = select(Activity.id).where(Activity.user_id == user.id).order_by(
        Activity.created_at.desc(), Activity.id.desc(),
    ).limit(200)
    db.execute(delete(Activity).where(Activity.user_id == user.id, Activity.id.not_in(recent)))
    db.commit()


@router.delete("/activity", status_code=204, dependencies=same_origin)
@router.delete("/activity/{entry_id}", status_code=204, dependencies=same_origin)
def clear_history(db: DB, user: Member, entry_id: UUID | None = None):
    db.get(Profile, user.id, with_for_update=True)
    statement = delete(Activity).where(Activity.user_id == user.id)
    db.execute(statement if entry_id is None else statement.where(Activity.id == entry_id))
    db.commit()


class RevisionInput(Input):
    body: str = Field(min_length=1, max_length=2400, pattern=r"^[^\x00]*$")
    note: str = Field(min_length=1, max_length=300, pattern=r"^[^\x00]*$")


@router.get("/revisions/{post_id}")
def revisions(post_id: UUID, db: DB, user: Member):
    visible_topic(db, post_id, user.id)
    return db.scalars(select(DiscussionRevision).where(DiscussionRevision.post_id == post_id)
                      .order_by(DiscussionRevision.created_at.desc(), DiscussionRevision.id).limit(40)).all()


@router.put("/revisions/{post_id}", status_code=204, dependencies=same_origin)
def revise(post_id: UUID, data: RevisionInput, db: DB, request: Request):
    author = public_author(db, request)
    visible_topic(db, post_id, author.user_id)
    post = db.get(Discussion, post_id, with_for_update=True)
    if post.author_id != author.user_id:
        raise HTTPException(403, "Só o autor pode corrigir esta publicação.")
    if not data.body.strip() or not data.note.strip():
        raise HTTPException(422, "Indique o texto e a nota de correcção.")
    if post.body != data.body.strip():
        db.add(DiscussionRevision(post_id=post_id, previous_body=post.body, note=data.note.strip()))
        post.body = data.body.strip()
    db.commit()


@router.put("/community-members/{community_id}/{slug}", status_code=204, dependencies=same_origin)
@router.delete("/community-members/{community_id}/{slug}", status_code=204, dependencies=same_origin)
def manage_member(community_id: UUID, slug: Slug, request: Request, db: DB, user: Member):
    community = get_community(community_id, db, user.id)
    own_slug = db.get(Profile, user.id).slug
    if not community.is_private or not (community.owner_id == user.id or
                                        (request.method == "DELETE" and own_slug == slug)):
        raise HTTPException(403, "Esta acção requer autorização da comunidade.")
    limit(request, "community-members", 60, str(user.id))
    if request.method == "PUT":
        profile = find_public_profile(db, slug)
        db.execute(insert(CommunityMember).values(community_id=community_id, user_id=profile.user_id)
                   .on_conflict_do_nothing())
    else:
        target = select(Profile.user_id).where(Profile.slug == slug).scalar_subquery()
        db.execute(delete(CommunityMember).where(CommunityMember.community_id == community_id,
                                                CommunityMember.user_id == target))
    db.commit()


class StoryInput(Input):
    body: str = Field(default="", max_length=500, pattern=r"^[^\x00]*$")
    image: str = Field(default="", max_length=360_000)
    link: str = Field(default="", max_length=1000)
    audience: Literal["public", "followers", "community"] = "followers"
    community_id: UUID | None = None
    archive: bool = False

    _image = field_validator("image")(image_data)
    _link = field_validator("link")(web_url)

    @model_validator(mode="after")
    def validate_story(self):
        self.body = self.body.strip()
        if not (self.body or self.image) or (self.audience == "community") != bool(self.community_id):
            raise ValueError("Adicione texto ou fotografia e confirme o público do story.")
        return self


def story_query(viewer: UUID):
    return select(Story, Profile.slug, Profile.name, (Story.image != "").label("has_image")).join(
        Profile, Profile.user_id == Story.author_id,
    ).join(User, User.id == Profile.user_id).where(
        User.deactivated_at.is_(None), User.suspended.is_(False), Profile.moderation_hidden.is_(False),
        Profile.is_public.is_(True),
        or_(
            (Story.expires_at <= func.now()) & Story.archive.is_(True) & (Story.author_id == viewer),
            (Story.expires_at > func.now()) & or_(
                Story.audience == "public",
                (Story.audience == "followers") & or_(Story.author_id == viewer, select(Follow.follower_id)
                    .where(Follow.followed_id == Story.author_id, Follow.follower_id == viewer).exists()),
                (Story.audience == "community") & Story.community_id.in_(
                    select(Community.id).where(*accessible_communities(viewer),
                    or_(Community.owner_id == viewer, select(CommunityMember.user_id).where(
                        CommunityMember.community_id == Community.id, CommunityMember.user_id == viewer,
                    ).exists()))),
            ),
        ),
    )


def story_view(story, slug, name, has_image):
    return {"id": story.id, "body": story.body, "link": story.link, "author": name, "slug": slug,
            "expires_at": story.expires_at, "audience": story.audience,
            "image": f"/api/v1/stories/{story.id}/image" if has_image else ""}


@router.get("/stories")
def stories(db: DB, user: Member, archived: bool = False):
    expiry = Story.expires_at <= func.now() if archived else Story.expires_at > func.now()
    result = db.execute(story_query(user.id).where(expiry).order_by(Story.expires_at.desc(), Story.id).limit(40))
    return [{**story_view(*row), "can_delete": row[0].author_id == user.id} for row in result]


@router.get("/stories/{story_id}/image")
def story_image(story_id: UUID, db: DB, user: Member):
    row = db.execute(story_query(user.id).where(Story.id == story_id)).one_or_none()
    return image_response(row[0].image if row else "")


@router.post("/stories", status_code=201, dependencies=same_origin)
def create_story(data: StoryInput, request: Request, db: DB):
    author = public_author(db, request)
    if data.community_id:
        community = get_community(data.community_id, db, author.user_id)
        if not community.is_private:
            raise HTTPException(422, "Escolha uma comunidade privada com membros definidos.")
    db.add(Story(**data.model_dump(), author_id=author.user_id, expires_at=now() + timedelta(hours=24)))
    db.commit()


@router.delete("/stories/{story_id}", status_code=204, dependencies=same_origin)
def delete_story(story_id: UUID, db: DB, user: Member):
    db.execute(delete(Story).where(Story.id == story_id, Story.author_id == user.id))
    db.commit()


class AffiliationInput(Input):
    institution: str = Field(min_length=1, max_length=160, pattern=r"^[^\x00]*$")
    role: str = Field(min_length=1, max_length=120, pattern=r"^[^\x00]*$")
    started_on: date | None = None
    ended_on: date | None = None

    @model_validator(mode="after")
    def validate_affiliation(self):
        self.institution, self.role = self.institution.strip(), self.role.strip()
        if not self.institution or not self.role or (
            self.ended_on and self.started_on and self.ended_on < self.started_on
        ):
            raise ValueError("Confirme a instituição, função e datas.")
        return self


def list_affiliations(db: DB, user_id: UUID):
    return db.scalars(select(Affiliation).where(Affiliation.user_id == user_id)
                      .order_by(Affiliation.ended_on.desc().nulls_first(), Affiliation.started_on.desc(), Affiliation.id)
                      .limit(30)).all()


@router.get("/affiliations")
def my_affiliations(db: DB, user: Member):
    return list_affiliations(db, user.id)


@router.get("/affiliations/{slug}")
def profile_affiliations(slug: Slug, db: DB):
    return list_affiliations(db, find_public_profile(db, slug).user_id)


@router.post("/affiliations", status_code=201, dependencies=same_origin)
def create_affiliation(data: AffiliationInput, db: DB, user: Member):
    db.get(Profile, user.id, with_for_update=True)
    if len(list_affiliations(db, user.id)) >= 30:
        raise HTTPException(422, "Já atingiu o limite de afiliações.")
    db.add(Affiliation(**data.model_dump(), user_id=user.id))
    db.commit()


@router.delete("/affiliations/{affiliation_id}", status_code=204, dependencies=same_origin)
def delete_affiliation(affiliation_id: UUID, db: DB, user: Member):
    db.execute(delete(Affiliation).where(Affiliation.id == affiliation_id, Affiliation.user_id == user.id))
    db.commit()
