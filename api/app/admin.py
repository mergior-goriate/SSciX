from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import StringConstraints
from sqlalchemy import case, delete, func, or_, select, text

from .admin_models import AdminAudit, AdminGrant, Report
from .auth import DB, Member
from .message_storage import read_message
from .models import Community, DirectMessage, Discussion, Profile, Session, User
from .schemas import Input, Slug
from .security import limit, now, require_origin

router = APIRouter(prefix="/admin", tags=["administração"])
report_router = APIRouter(tags=["denúncias"])
write = [Depends(require_origin)]
Reason = Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=1200)]
Target = Literal["profile", "community", "post", "attachment", "message"]
State = Literal["pending", "reviewing", "resolved", "dismissed"]
Priority = Literal["low", "normal", "high"]


def admin_access(db: DB, user: Member):
    grant = db.get(AdminGrant, user.id)
    if grant is None:
        raise HTTPException(403, "Sem acesso ao painel administrativo.")
    return grant


Access = Annotated[AdminGrant, Depends(admin_access)]


def scope(grant: AdminGrant, community_id: UUID | None, *, mutation=False, admin_only=False):
    if (admin_only and grant.role != "admin"
            or mutation and grant.role == "viewer"
            or grant.role == "moderator" and grant.community_id != community_id):
        raise HTTPException(403, "Sem permissão para esta operação.")


def audit(db: DB, actor_id: UUID | None, action: str, target_type: str, target_id: UUID,
          community_id: UUID | None, reason: str, previous="", result=""):
    db.add(AdminAudit(actor_id=actor_id, action=action, target_type=target_type, target_id=target_id,
                      community_id=community_id, reason=reason, previous=previous, result=result))


def paging(query, db: DB, offset: int):
    rows = db.execute(query.offset(offset).limit(26)).all()
    return {"items": [dict(row._mapping) for row in rows[:25]], "more": len(rows) == 26}


def filter_scope(query, grant: AdminGrant, column):
    return query.where(column == grant.community_id) if grant.role == "moderator" else query


def find_or_404(db: DB, model, value: UUID, *, lock=False):
    row = db.get(model, value, with_for_update=lock)
    if row is None:
        raise HTTPException(404, "Registo indisponível.")
    return row


@router.get("/access")
def access(grant: Access):
    return {"role": grant.role, "community_id": grant.community_id, "user_id": grant.user_id}


@router.get("/records/{kind}")
def records(kind: Literal["users", "communities", "posts", "comments", "attachments", "reports", "audit"],
            db: DB, grant: Access, q: str = Query("", max_length=100, pattern=r"^[^\x00]*$"),
            offset: int = Query(0, ge=0, le=1_000_000), account_state: Literal["active", "suspended", "deactivated", "unverified"] | None = None,
            start: date | None = None, end: date | None = None, state: Literal["pending", "reviewing", "resolved", "dismissed", "open"] | None = None, priority: Priority | None = None,
            community_id: UUID | None = None, target_id: UUID | None = None):
    q = q.strip()
    if community_id:
        scope(grant, community_id)
    if kind == "users":
        scope(grant, None, admin_only=grant.role == "moderator")
        query = select(User.id, User.email, User.suspended, User.deactivated_at, User.verified_at,
                       Profile.name, Profile.slug, Profile.is_public, Profile.moderation_hidden,
                       AdminGrant.role, AdminGrant.community_id).join(Profile).outerjoin(AdminGrant, AdminGrant.user_id == User.id)
        if q:
            query = query.where(or_(User.email.icontains(q, autoescape=True), Profile.name.icontains(q, autoescape=True)))
        if account_state == "active":
            query = query.where(User.verified_at.is_not(None), User.deactivated_at.is_(None), User.suspended.is_(False))
        elif account_state == "suspended":
            query = query.where(User.suspended.is_(True))
        elif account_state == "deactivated":
            query = query.where(User.deactivated_at.is_not(None), User.suspended.is_(False))
        elif account_state == "unverified":
            query = query.where(User.verified_at.is_(None), User.deactivated_at.is_(None), User.suspended.is_(False))
        query = query.order_by(Profile.name, User.id)
    elif kind == "communities":
        posts = select(func.count(Discussion.id)).where(Discussion.community_id == Community.id,
                                                       Discussion.parent_id.is_(None)).scalar_subquery()
        participation = select(func.count(func.distinct(Discussion.author_id))).where(
            Discussion.community_id == Community.id).scalar_subquery()
        query = select(Community.id, Community.name, Community.description, Community.owner_id, Community.moderation_hidden,
                       posts.label("posts"), participation.label("contributors")).order_by(Community.name, Community.id)
        query = filter_scope(query, grant, Community.id)
        if q:
            query = query.where(Community.name.icontains(q, autoescape=True))
        if community_id:
            query = query.where(Community.id == community_id)
    elif kind in ("posts", "comments", "attachments"):
        query = select(Discussion.id, Discussion.kind, Discussion.title, Discussion.body, Discussion.created_at,
                       Discussion.parent_id, Discussion.moderation_hidden, Discussion.attachment_hidden,
                       Discussion.community_id, Profile.name.label("author"), Discussion.article_url,
                       (Discussion.image != "").label("has_image")).join(Profile, Profile.user_id == Discussion.author_id)
        if kind == "attachments":
            query = query.where(or_(Discussion.image != "", Discussion.article_url != ""))
        elif kind == "comments":
            query = query.where(Discussion.parent_id.is_not(None))
        else:
            query = query.where(Discussion.parent_id.is_(None))
        query = filter_scope(query, grant, Discussion.community_id)
        if q:
            query = query.where(or_(Discussion.title.icontains(q, autoescape=True), Discussion.body.icontains(q, autoescape=True)))
        if community_id:
            query = query.where(Discussion.community_id == community_id)
        query = query.order_by(Discussion.created_at.desc(), Discussion.id)
    elif kind == "reports":
        query = select(Report.id, Report.target_type, Report.target_id, Report.community_id, Report.assignee_id,
                       Report.state, Report.priority, Report.created_at, Report.resolved_at)
        query = filter_scope(query, grant, Report.community_id)
        if state:
            query = query.where(Report.state.in_(("pending", "reviewing")) if state == "open" else Report.state == state)
        if start or end:
            from .analytics import bounds
            if (start and start < date(2000, 1, 1)) or (end and end >= date(9999, 12, 31)) or (start and end and start > end):
                raise HTTPException(422, "Escolha um período válido.")
            if start:
                query = query.where(Report.created_at >= bounds(start, start)[0])
            if end:
                query = query.where(Report.created_at < bounds(end, end)[1])
        if priority:
            query = query.where(Report.priority == priority)
        if q:
            query = query.where(Report.target_type.icontains(q, autoescape=True))
        if community_id:
            query = query.where(Report.community_id == community_id)
        order = case((Report.priority == "high", 0), (Report.priority == "normal", 1), else_=2)
        query = query.order_by(order, Report.created_at.desc(), Report.id)
    else:
        query = select(AdminAudit.id, AdminAudit.actor_id, AdminAudit.action, AdminAudit.reason, AdminAudit.target_type,
                       AdminAudit.target_id, AdminAudit.created_at, AdminAudit.previous, AdminAudit.result)
        query = filter_scope(query, grant, AdminAudit.community_id)
        if q:
            query = query.where(AdminAudit.action.icontains(q, autoescape=True))
        if community_id:
            query = query.where(AdminAudit.community_id == community_id)
        if target_id:
            query = query.where(AdminAudit.target_id == target_id)
        query = query.order_by(AdminAudit.created_at.desc(), AdminAudit.id)
    return paging(query, db, offset)


class Moderation(Input):
    enabled: bool
    reason: Reason


@router.put("/moderation/{kind}/{target_id}", status_code=204, dependencies=write)
def moderate(kind: Literal["account", "profile", "community", "post", "attachment"], target_id: UUID,
             data: Moderation, db: DB, grant: Access):
    model, attr = {
        "account": (User, "suspended"), "profile": (Profile, "moderation_hidden"),
        "community": (Community, "moderation_hidden"), "post": (Discussion, "moderation_hidden"),
        "attachment": (Discussion, "attachment_hidden"),
    }[kind]
    target = find_or_404(db, model, target_id, lock=True)
    community_id = target_id if kind == "community" else target.community_id if model is Discussion else None
    scope(grant, community_id, mutation=True, admin_only=kind in ("account", "profile", "community"))
    if kind == "account":
        target_grant = db.get(AdminGrant, target_id)
        if target_id == grant.user_id or (target_grant and target_grant.role == "admin"):
            raise HTTPException(409, "Esta conta administrativa não pode ser suspensa.")
        if data.enabled:
            db.execute(delete(Session).where(Session.user_id == target_id))
    previous = getattr(target, attr)
    setattr(target, attr, data.enabled)
    action = ("suspender" if data.enabled else "reactivar") if kind == "account" else ("ocultar" if data.enabled else "restaurar")
    audit(db, grant.user_id, action, kind, target_id, community_id,
          data.reason, str(previous), str(data.enabled))
    db.commit()


class RoleChange(Input):
    role: Literal["admin", "moderator", "viewer"] | None
    community_id: UUID | None = None
    reason: Reason


@router.put("/roles/{user_id}", status_code=204, dependencies=write)
def assign_role(user_id: UUID, data: RoleChange, db: DB, grant: Access):
    scope(grant, None, admin_only=True)
    db.execute(text("SELECT pg_advisory_xact_lock(82489901)"))
    current_actor = db.get(AdminGrant, grant.user_id, populate_existing=True)
    if current_actor is None:
        raise HTTPException(403, "Sem acesso ao painel administrativo.")
    scope(current_actor, None, admin_only=True)
    if user_id == grant.user_id:
        raise HTTPException(409, "Outra pessoa administradora deve alterar a sua função.")
    user = find_or_404(db, User, user_id, lock=True)
    if (data.role == "moderator") != (data.community_id is not None):
        raise HTTPException(422, "Seleccione uma comunidade apenas para o papel de moderação.")
    if data.community_id:
        find_or_404(db, Community, data.community_id)
    if data.role and (not user.verified_at or user.suspended or user.deactivated_at):
        raise HTTPException(422, "A conta deve estar confirmada e activa.")
    current = db.get(AdminGrant, user_id)
    previous = f"{current.role}:{current.community_id or ''}" if current else ""
    if data.role:
        db.merge(AdminGrant(user_id=user_id, role=data.role, community_id=data.community_id))
    elif current:
        db.delete(current)
    audit(db, grant.user_id, "alterar função", "user", user_id, data.community_id,
          data.reason, previous, f"{data.role or ''}:{data.community_id or ''}")
    db.commit()


class ReportInput(Input):
    target_type: Target
    target_id: UUID
    reason: Reason


@report_router.post("/reports", status_code=201, dependencies=write)
def submit_report(data: ReportInput, db: DB, user: Member, request: Request):
    from .network import get_community, visible_topic
    from .profiles import find_public_profile

    limit(request, "report", 12, str(user.id))
    community_id = None
    if data.target_type == "message":
        item = find_or_404(db, DirectMessage, data.target_id)
        if item.recipient_id != user.id:
            raise HTTPException(404, "Mensagem indisponível.")
    elif data.target_type == "profile":
        item = find_or_404(db, Profile, data.target_id)
        find_public_profile(db, item.slug)
    elif data.target_type == "community":
        community_id = get_community(data.target_id, db, user.id).id
    else:
        item = find_or_404(db, Discussion, data.target_id)
        visible_topic(db, item.parent_id or item.id, user.id)
        author = find_or_404(db, Profile, item.author_id)
        find_public_profile(db, author.slug)
        if item.moderation_hidden or (data.target_type == "attachment"
                                      and (item.attachment_hidden or not (item.image or item.article_url))):
            raise HTTPException(404, "Publicação ou anexo indisponível.")
        community_id = item.community_id
    report = Report(**data.model_dump(), community_id=community_id, reporter_id=user.id)
    db.add(report)
    db.flush()
    result = {"id": report.id}
    db.commit()
    return result


@router.get("/reports/{report_id}")
def report_detail(report_id: UUID, db: DB, grant: Access):
    report = find_or_404(db, Report, report_id)
    scope(grant, report.community_id, admin_only=report.target_type == "message")
    if report.target_type == "message":
        model, field = DirectMessage, "body"
        audit(db, grant.user_id, "consultar mensagem denunciada", "report", report.id, None,
              "Consulta no contexto da denúncia autorizada.")
    else:
        model, field = {"profile": (Profile, "name"), "community": (Community, "name"),
                        "post": (Discussion, "body"), "attachment": (Discussion, "article_url")}[report.target_type]
    target = db.get(model, report.target_id)
    link = None
    history_condition = (AdminAudit.target_type == "report") & (AdminAudit.target_id == report_id)
    if report.target_type != "message":
        history_condition |= (AdminAudit.target_type == report.target_type) & (AdminAudit.target_id == report.target_id)
    if target and report.target_type in ("post", "attachment"):
        link = f"/rede/{target.parent_id or target.id}" + ("#comentarios" if target.parent_id else "")
    elif target and report.target_type == "profile":
        link = f"/u/{target.slug}"
    elif target and report.target_type == "community":
        link = f"/comunidades/{target.id}"
    history = db.scalars(select(AdminAudit).where(history_condition)
                         .order_by(AdminAudit.created_at.desc(), AdminAudit.id).limit(100)).all()
    content = getattr(target, field, "") if target else None
    if report.target_type == "message" and target:
        content = read_message(target.body, target.body_encrypted)
    detail = {"id": report.id, "reason": report.reason, "state": report.state, "priority": report.priority,
              "target_type": report.target_type, "target_id": report.target_id, "community_id": report.community_id,
              "content": content, "link": link,
              "has_image": bool(target and report.target_type == "attachment" and target.image),
              "assignee_id": report.assignee_id, "history": [
                  {"action": h.action, "reason": h.reason, "previous": h.previous, "result": h.result,
                   "actor_id": h.actor_id, "created_at": h.created_at} for h in history]}
    if report.target_type == "message":
        db.commit()
    return detail


class ReportDecision(Input):
    state: State
    priority: Priority
    assignee_id: UUID | None = None
    reason: Reason


@router.put("/reports/{report_id}", status_code=204, dependencies=write)
def decide_report(report_id: UUID, data: ReportDecision, db: DB, grant: Access):
    report = find_or_404(db, Report, report_id, lock=True)
    scope(grant, report.community_id, mutation=True, admin_only=report.target_type == "message")
    if data.assignee_id:
        assignee = db.get(AdminGrant, data.assignee_id)
        if not assignee or assignee.role == "viewer":
            raise HTTPException(422, "O responsável deve ter permissão de moderação.")
        scope(assignee, report.community_id, admin_only=report.target_type == "message")
        account = db.get(User, data.assignee_id)
        if not account or account.suspended or account.deactivated_at or not account.verified_at:
            raise HTTPException(422, "O responsável deve ter uma conta activa.")
    previous = f"{report.state}/{report.priority}/{report.assignee_id or ''}"
    closed = ("resolved", "dismissed")
    if data.state in closed and report.state not in closed:
        report.resolved_at = now()
    elif data.state not in closed:
        report.resolved_at = None
    report.state, report.priority, report.assignee_id = data.state, data.priority, data.assignee_id
    audit(db, grant.user_id, "decidir denúncia", "report", report.id, report.community_id, data.reason,
          previous, f"{data.state}/{data.priority}/{data.assignee_id or ''}")
    db.commit()


class ReportReason(Input):
    reason: Reason


@report_router.post("/reports/profile/{slug}", status_code=201, dependencies=write)
def report_profile(slug: Slug, data: ReportReason, db: DB, user: Member, request: Request):
    from .profiles import find_public_profile

    profile = find_public_profile(db, slug)
    return submit_report(ReportInput(target_type="profile", target_id=profile.user_id, reason=data.reason),
                         db, user, request)


@router.get("/assignees")
def assignees(db: DB, grant: Access, community_id: UUID | None = None):
    scope(grant, community_id)
    condition = AdminGrant.role == "admin"
    if community_id:
        condition |= (AdminGrant.role == "moderator") & (AdminGrant.community_id == community_id)
    query = select(AdminGrant.user_id.label("id"), Profile.name).join(Profile, Profile.user_id == AdminGrant.user_id).join(
        User, User.id == AdminGrant.user_id,
    ).where(condition, User.suspended.is_(False), User.deactivated_at.is_(None)).order_by(Profile.name).limit(250)
    return [dict(row._mapping) for row in db.execute(query)]


@router.get("/attachment/{post_id}")
def attachment(post_id: UUID, db: DB, grant: Access):
    from .profiles import image_response

    post = find_or_404(db, Discussion, post_id)
    scope(grant, post.community_id)
    return image_response(post.image)


@router.get("/communities")
def community_options(db: DB, grant: Access):
    query = filter_scope(select(Community.id, Community.name).order_by(Community.name, Community.id), grant, Community.id)
    return [dict(row._mapping) for row in db.execute(query)]
