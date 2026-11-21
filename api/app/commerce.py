import os
import secrets
from typing import Literal
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import Field, field_validator
from sqlalchemy import func, select

from .admin import Access, audit, find_or_404, scope
from .auth import DB, Member
from .models import AffiliateEvent, Affiliation, InstitutionalRequest, User
from .network import same_origin
from .schemas import Input
from .security import limit, now

public = APIRouter(tags=["parcerias"])
members = APIRouter(tags=["planos institucionais"])


class Enquiry(Input):
    institution: str = Field(min_length=1, max_length=160, pattern=r"^[^\x00]*$")
    use_case: str = Field(min_length=1, max_length=600, pattern=r"^[^\x00]*$")

    @field_validator("institution", "use_case")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Preencha este campo.")
        return value.strip()


@members.get("/institutional")
def enquiries(db: DB, user: Member):
    return db.scalars(select(InstitutionalRequest).where(InstitutionalRequest.user_id == user.id)
                      .order_by(InstitutionalRequest.created_at.desc()).limit(20)).all()


@members.post("/institutional", status_code=201, dependencies=same_origin)
def enquire(data: Enquiry, db: DB, user: Member, request: Request):
    limit(request, "institutional-request", 5, str(user.id))
    db.add(InstitutionalRequest(**data.model_dump(), user_id=user.id))
    db.commit()


@members.get("/admin/commercial")
def commercial(db: DB, grant: Access, offset: int = Query(0, ge=0, le=100_000)):
    scope(grant, None, admin_only=True)
    requests = db.execute(select(InstitutionalRequest, User.email).join(User, User.id == InstitutionalRequest.user_id)
                          .order_by(InstitutionalRequest.created_at.desc(), InstitutionalRequest.id)
                          .offset(offset).limit(26)).all()
    totals = db.execute(select(AffiliateEvent.campaign, AffiliateEvent.conversion, func.count())
                        .group_by(AffiliateEvent.campaign, AffiliateEvent.conversion))
    return {"requests": [{"id": row.id, "institution": row.institution, "use_case": row.use_case,
                           "status": row.status, "email": email} for row, email in requests[:25]],
            "more": len(requests) > 25,
            "affiliates": [{"campaign": campaign, "status": state, "count": count}
                           for campaign, state, count in totals]}


class EnquiryState(Input):
    status: Literal["pending", "contacted", "closed"]


@members.put("/admin/commercial/{request_id}", status_code=204, dependencies=same_origin)
def set_enquiry(request_id: UUID, data: EnquiryState, db: DB, grant: Access):
    scope(grant, None, admin_only=True)
    row = find_or_404(db, InstitutionalRequest, request_id, lock=True)
    audit(db, grant.user_id, "institutional_status", "institutional", row.id, None, "",
          previous=row.status, result=data.status)
    row.status = data.status
    db.commit()


class AffiliationVerification(Input):
    confirmed: bool
    reason: str = Field(min_length=3, max_length=300, pattern=r"^[^\x00]*$")


@members.put("/admin/affiliations/{affiliation_id}", status_code=204, dependencies=same_origin)
def verify_affiliation(affiliation_id: UUID, data: AffiliationVerification, db: DB, grant: Access):
    scope(grant, None, admin_only=True)
    item = find_or_404(db, Affiliation, affiliation_id, lock=True)
    previous = bool(item.verified_at)
    item.verified_at = now() if data.confirmed else None
    audit(db, grant.user_id, "affiliation_verification", "affiliation", item.id, None, data.reason.strip(),
          previous=str(previous), result=str(data.confirmed))
    db.commit()


CAMPAIGN = "formacao-academica"


def partner():
    raw = os.getenv("SSCIX_AFFILIATE_URL", "")
    try:
        target = urlsplit(raw)
    except ValueError:
        return None
    if target.scheme != "https" or not target.hostname or target.username or target.password:
        return None
    return target


@public.get("/commercial/affiliate")
def affiliate_availability():
    return {"available": partner() is not None}


@public.get("/commercial/click/{campaign}")
def affiliate_click(campaign: str, db: DB):
    target = partner()
    if campaign != CAMPAIGN or target is None:
        raise HTTPException(404, "Parceria indisponível.")
    tracking = AffiliateEvent(campaign=campaign)
    db.add(tracking)
    db.flush()
    query = [(key, value) for key, value in parse_qsl(target.query, keep_blank_values=True) if key != "sscix_ref"]
    query.append(("sscix_ref", str(tracking.id)))
    db.commit()
    return RedirectResponse(urlunsplit(target._replace(query=urlencode(query))), status_code=302)


class Conversion(Input):
    status: Literal["confirmed", "refunded"]


@public.put("/commercial/conversion/{click_id}", status_code=204)
def conversion(click_id: UUID, data: Conversion, db: DB, authorization: str = Header(default="")):
    key = os.getenv("SSCIX_AFFILIATE_CALLBACK_TOKEN", "")
    if len(key) < 32 or not secrets.compare_digest(authorization.encode(), f"Bearer {key}".encode()):
        raise HTTPException(403, "Credencial de parceria inválida.")
    row = find_or_404(db, AffiliateEvent, click_id, lock=True)
    if row.conversion != "refunded":
        row.conversion = data.status
    db.commit()
