from base64 import b64decode

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel
from sqlalchemy import case, cast, delete, func, or_, select
from sqlalchemy.dialects.postgresql import JSONB, insert
from sqlalchemy.exc import IntegrityError

from .auth import DB, Member, get_user
from .models import Affiliation, Follow, Profile, User
from .schemas import KeywordsInput, MyProfile, ProfileCoverInput, ProfileData, Slug
from .security import require_origin

router = APIRouter(prefix="/profiles", tags=["perfis"])


def own_profile(profile: Profile, email: str) -> MyProfile:
    data = ProfileData.model_validate(profile, from_attributes=True)
    return MyProfile(**data.model_dump(), email=email)


@router.get("/me", response_model=MyProfile)
def get_profile(db: DB, request: Request):
    user = get_user(db, request)
    return own_profile(db.get(Profile, user.id), user.email)


@router.put("/me", response_model=MyProfile, dependencies=[Depends(require_origin)])
def update_profile(data: ProfileData, db: DB, request: Request):
    user = get_user(db, request, for_update=True)
    profile = db.get(Profile, user.id, with_for_update={"key_share": True})
    if profile.is_public and not data.is_public:
        db.execute(delete(Follow).where(Follow.followed_id == user.id))
    for key, value in data.model_dump(exclude={"has_cover"}).items():
        if key in {"education", "experience", "publications", "photo", "keywords", "social_links"} and key not in data.model_fields_set:
            continue
        setattr(profile, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Este endereço de perfil já está em uso.") from None
    return own_profile(profile, user.email)


@router.get("/me/cover")
def own_cover(db: DB, user: Member):
    return image_response(db.get(Profile, user.id).cover)


@router.put("/me/cover", status_code=204, dependencies=[Depends(require_origin)])
def update_cover(data: ProfileCoverInput, db: DB, request: Request):
    user = get_user(db, request, for_update=True)
    db.get(Profile, user.id).cover = data.image
    db.commit()


@router.put("/me/keywords", status_code=204, dependencies=[Depends(require_origin)])
def update_keywords(data: KeywordsInput, db: DB, request: Request):
    user = get_user(db, request, for_update=True)
    db.get(Profile, user.id).keywords = data.keywords
    db.commit()


class DirectoryProfile(BaseModel):
    slug: str
    name: str
    institution: str
    specialization: str


class FollowStatus(BaseModel):
    following: bool
    can_follow: bool
    followers: int
    following_count: int


@router.get("", response_model=list[DirectoryProfile])
def directory(db: DB, q: str = Query(default="", max_length=100), offset: int = Query(default=0, ge=0, le=1_999_980),
              institution: str = Query(default="", max_length=160), area: str = Query(default="", max_length=160)):
    query = select(Profile).join(User).where(Profile.is_public.is_(True), Profile.moderation_hidden.is_(False), User.deactivated_at.is_(None), User.suspended.is_(False))
    term = q.strip()
    def institution_match(value):
        return or_(Profile.institution.icontains(value, autoescape=True), select(Affiliation.id).where(
            Affiliation.user_id == Profile.user_id, Affiliation.institution.icontains(value, autoescape=True),
            Affiliation.ended_on.is_(None) | (Affiliation.ended_on >= func.current_date()),
        ).exists())

    if institution.strip():
        query = query.where(institution_match(institution.strip()))
    if area.strip():
        query = query.where(Profile.specialization.icontains(area.strip(), autoescape=True))
    if term:
        query = query.where(or_(
            Profile.name.icontains(term, autoescape=True),
            institution_match(term),
            Profile.specialization.icontains(term, autoescape=True),
        ))
    return db.scalars(query.order_by(Profile.name, Profile.slug).offset(offset).limit(21)).all()


def find_public_profile(db: DB, slug: str, *, lock: bool = False) -> Profile:
    query = select(Profile).join(User).where(Profile.slug == slug, Profile.is_public.is_(True), Profile.moderation_hidden.is_(False), User.deactivated_at.is_(None), User.suspended.is_(False))
    profile = db.scalar(query.with_for_update(of=Profile, key_share=True) if lock else query)
    if profile is None:
        raise HTTPException(404, "Perfil indisponível.")
    return profile


class SuggestedProfile(DirectoryProfile):
    photo: str
    common_keywords: list[str]


@router.get("/discover/suggestions", response_model=list[SuggestedProfile])
def suggestions(db: DB, user: Member, similar_to: Slug | None = None):
    reference = find_public_profile(db, similar_to) if similar_to else db.get(Profile, user.id)
    keywords = reference.keywords
    query = select(Profile).join(User).where(
        Profile.is_public.is_(True), Profile.moderation_hidden.is_(False), User.deactivated_at.is_(None), User.suspended.is_(False), Profile.user_id != reference.user_id,
    )
    query = query.where(Profile.user_id != user.id, Profile.user_id.not_in(
        select(Follow.followed_id).where(Follow.follower_id == user.id)
    ))
    if keywords:
        profile_keywords = cast(Profile.keywords, JSONB)
        overlap = sum(case((profile_keywords.has_key(word), 1), else_=0) for word in keywords)
        query = query.order_by(overlap.desc())
        if similar_to:
            query = query.where(overlap > 0)
    elif similar_to:
        return []
    profiles = db.scalars(query.order_by(Profile.name, Profile.slug).limit(6)).all()
    return [
        SuggestedProfile(**DirectoryProfile.model_validate(profile, from_attributes=True).model_dump(),
                         photo=photo_url(profile), common_keywords=[word for word in keywords if word in profile.keywords])
        for profile in profiles
    ]


@router.get("/{slug}", response_model=ProfileData)
def public_profile(slug: Slug, db: DB):
    record = find_public_profile(db, slug)
    profile = ProfileData.model_validate(record, from_attributes=True)
    return profile.model_copy(update={
        "photo": photo_url(record), "social_links": [link for link in profile.social_links if link.public],
    })


def photo_url(profile: Profile):
    return f"/api/v1/profiles/{profile.slug}/photo" if profile.photo else ""


def image_response(value: str):
    if not value:
        raise HTTPException(404, "Imagem indisponível.")
    header, encoded = value.split(",", 1)
    return Response(b64decode(encoded), media_type=header.removeprefix("data:").removesuffix(";base64"))


@router.get("/{slug}/photo")
def photo(slug: Slug, db: DB):
    return image_response(find_public_profile(db, slug).photo)


@router.get("/{slug}/cover")
def public_cover(slug: Slug, db: DB):
    return image_response(find_public_profile(db, slug).cover)


@router.get("/me/counts")
def own_counts(db: DB, request: Request):
    user = get_user(db, request)
    return counts(db, db.get(Profile, user.id))


def counts(db: DB, profile: Profile) -> dict:
    followers = db.scalar(select(func.count()).select_from(Follow).join(User, User.id == Follow.follower_id)
                          .where(Follow.followed_id == profile.user_id, User.deactivated_at.is_(None), User.suspended.is_(False)))
    following = db.scalar(select(func.count()).select_from(Follow).join(User, User.id == Follow.followed_id)
                          .where(Follow.follower_id == profile.user_id, User.deactivated_at.is_(None), User.suspended.is_(False)))
    return {"followers": followers, "following_count": following}


@router.get("/{slug}/counts")
def public_counts(slug: Slug, db: DB):
    return counts(db, find_public_profile(db, slug))


@router.get("/{slug}/follow", response_model=FollowStatus)
def follow_status(slug: Slug, db: DB, request: Request):
    user = get_user(db, request)
    profile = find_public_profile(db, slug)
    return FollowStatus(
        following=db.get(Follow, (user.id, profile.user_id)) is not None,
        can_follow=user.id != profile.user_id, **counts(db, profile),
    )


@router.put("/{slug}/follow", response_model=FollowStatus, dependencies=[Depends(require_origin)])
def follow(slug: Slug, db: DB, request: Request):
    user = get_user(db, request)
    profile = find_public_profile(db, slug, lock=True)
    if user.id == profile.user_id:
        raise HTTPException(400, "Não pode seguir o seu próprio perfil.")
    db.execute(insert(Follow).values(follower_id=user.id, followed_id=profile.user_id).on_conflict_do_nothing())
    status = FollowStatus(following=True, can_follow=True, **counts(db, profile))
    db.commit()
    return status


@router.delete("/{slug}/follow", response_model=FollowStatus, dependencies=[Depends(require_origin)])
def unfollow(slug: Slug, db: DB, request: Request):
    user = get_user(db, request)
    profile = find_public_profile(db, slug, lock=True)
    db.execute(delete(Follow).where(Follow.follower_id == user.id, Follow.followed_id == profile.user_id))
    status = FollowStatus(following=False, can_follow=user.id != profile.user_id, **counts(db, profile))
    db.commit()
    return status
