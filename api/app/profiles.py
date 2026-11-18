from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import delete, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError

from .auth import DB, get_user
from .models import Follow, Profile
from .schemas import MyProfile, ProfileData, Slug
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
    for key, value in data.model_dump().items():
        setattr(profile, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Este endereço de perfil já está em uso.") from None
    return own_profile(profile, user.email)


class DirectoryProfile(BaseModel):
    slug: str
    name: str
    institution: str
    specialization: str


class FollowStatus(BaseModel):
    following: bool
    can_follow: bool


@router.get("", response_model=list[DirectoryProfile])
def directory(db: DB, q: str = Query(default="", max_length=100), offset: int = Query(default=0, ge=0, le=1_999_980)):
    query = select(Profile).where(Profile.is_public.is_(True))
    term = q.strip()
    if term:
        query = query.where(or_(
            Profile.name.icontains(term, autoescape=True),
            Profile.institution.icontains(term, autoescape=True),
            Profile.specialization.icontains(term, autoescape=True),
        ))
    return db.scalars(query.order_by(Profile.name, Profile.slug).offset(offset).limit(21)).all()


def find_public_profile(db: DB, slug: str, *, lock: bool = False) -> Profile:
    query = select(Profile).where(Profile.slug == slug, Profile.is_public.is_(True))
    profile = db.scalar(query.with_for_update(key_share=True) if lock else query)
    if profile is None:
        raise HTTPException(404, "Perfil indisponível.")
    return profile


@router.get("/{slug}", response_model=ProfileData)
def public_profile(slug: Slug, db: DB):
    return find_public_profile(db, slug)


@router.get("/{slug}/follow", response_model=FollowStatus)
def follow_status(slug: Slug, db: DB, request: Request):
    user = get_user(db, request)
    profile = find_public_profile(db, slug)
    return FollowStatus(
        following=db.get(Follow, (user.id, profile.user_id)) is not None,
        can_follow=user.id != profile.user_id,
    )


@router.put("/{slug}/follow", response_model=FollowStatus, dependencies=[Depends(require_origin)])
def follow(slug: Slug, db: DB, request: Request):
    user = get_user(db, request)
    profile = find_public_profile(db, slug, lock=True)
    if user.id == profile.user_id:
        raise HTTPException(400, "Não pode seguir o seu próprio perfil.")
    db.execute(insert(Follow).values(follower_id=user.id, followed_id=profile.user_id).on_conflict_do_nothing())
    db.commit()
    return FollowStatus(following=True, can_follow=True)


@router.delete("/{slug}/follow", response_model=FollowStatus, dependencies=[Depends(require_origin)])
def unfollow(slug: Slug, db: DB, request: Request):
    user = get_user(db, request)
    profile = find_public_profile(db, slug, lock=True)
    db.execute(delete(Follow).where(Follow.follower_id == user.id, Follow.followed_id == profile.user_id))
    db.commit()
    return FollowStatus(following=False, can_follow=user.id != profile.user_id)
