from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .auth import DB, get_user
from .models import Profile
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
    profile = db.get(Profile, user.id)
    for key, value in data.model_dump().items():
        setattr(profile, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Este endereço de perfil já está em uso.") from None
    return own_profile(profile, user.email)


@router.get("/{slug}", response_model=ProfileData)
def public_profile(slug: Slug, db: DB):
    profile = db.scalar(select(Profile).where(Profile.slug == slug, Profile.is_public.is_(True)))
    if profile is None:
        raise HTTPException(404, "Perfil indisponível.")
    return ProfileData.model_validate(profile, from_attributes=True)
