import csv
import io
from datetime import date, datetime, time, timedelta, timezone
from statistics import median
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import Date, cast, func, select, tuple_

from .admin import Access, audit, scope
from .admin_models import AdminAudit, Report, UsageEvent
from .auth import DB, Member
from .models import Bookmark, DirectMessage, Discussion, Follow, Mention, Reaction, ReadingParticipant, User
from .schemas import Input
from .security import COOKIE, digest, limit, now, require_origin

router = APIRouter(prefix="/admin", tags=["indicadores"])
events = APIRouter(tags=["actividade"])
MAPUTO = ZoneInfo("Africa/Maputo")
DEFINITIONS = {
    "logins": "Inícios de sessão com palavra-passe bem-sucedidos.",
    "sessions": "Sessões de autenticação criadas, incluindo confirmação de conta e renovação.",
    "visits": "Sessões autenticadas distintas com pelo menos uma página vista no período.",
    "views": "Aberturas de páginas da rede após início de sessão, incluindo revisitas.",
    "post_views": "Aberturas da página individual de uma publicação.",
    "community_views": "Aberturas da página individual de uma comunidade.",
    "unique_post_views": "Pares distintos de conta e publicação nas visualizações de publicações.",
    "unique_community_views": "Pares distintos de conta e comunidade nas visualizações de comunidades.",
    "unique_viewers": "Contas identificáveis distintas que abriram uma página no período.",
    "active": "Contas com pelo menos uma abertura de página registada no período.",
    "days_per_user": "Média de dias activos por conta activa no período.",
    "return_rate": "Percentagem de contas activas com actividade em dois ou mais dias diferentes no período.",
    "registrations": "Contas ainda existentes registadas no período, incluindo as não confirmadas.",
    "posts": "Publicações existentes criadas no período, incluindo as moderadas.",
    "comments": "Comentários existentes criados no período, incluindo os moderados.",
    "collaborations": "Pedidos de colaboração existentes publicados no período.",
    "reading": "Sessões de leitura existentes publicadas no período.",
    "opportunities": "Anúncios académicos existentes publicados no período.",
    "reports_received": "Denúncias recebidas no período.",
    "reports_pending": "Denúncias recebidas no período que continuam pendentes ou em análise.",
    "reports_closed": "Denúncias com resolução ou arquivamento no período.",
    "median_hours": "Mediana de horas entre abertura e encerramento dos casos encerrados no período.",
    "admin_actions": "Entradas de auditoria criadas no período.",
    "messages": "Mensagens privadas existentes enviadas no período, contadas sem ler o texto.",
    "contributors": "Autores distintos de publicações ou comentários no período.",
    "reactions": "Total actual de reacções existentes. O modelo original não guarda a data.",
    "follows": "Total actual de relações de seguimento. O modelo original não guarda a data.",
    "bookmarks": "Total actual de publicações guardadas. O modelo original não guarda a data.",
    "mentions": "Total actual de menções existentes.",
    "reading_participants": "Total actual de inscrições em sessões de leitura.",
    "dau": "Contas distintas activas no último dia do período.",
    "wau": "Contas distintas activas nos sete dias até ao fim do período.",
    "mau": "Contas distintas activas nos 30 dias até ao fim do período.",
}
TRACKED = ("logins", "sessions", "visits", "views", "post_views", "community_views", "unique_viewers",
           "active", "days_per_user", "return_rate", "dau", "wau", "mau", "unique_post_views", "unique_community_views")


class PageEvent(Input):
    id: UUID
    page: Literal["feed", "post", "community", "communities", "profile", "directory",
                  "messages", "notifications", "saved", "opportunities", "settings", "onboarding"]
    target: UUID | None = None


@events.post("/events/page", status_code=204, dependencies=[Depends(require_origin)])
def page_event(data: PageEvent, db: DB, user: Member, request: Request):
    from sqlalchemy.dialects.postgresql import insert

    from .network import get_community, visible_topic

    limit(request, "usage-page", 240, str(user.id))
    community_id = None
    if data.page in ("post", "community"):
        if not data.target:
            raise HTTPException(422, "Indique o conteúdo visitado.")
        community_id = (get_community(data.target, db).id if data.page == "community"
                        else visible_topic(db, data.target, user.id).community_id)
    elif data.target:
        raise HTTPException(422, "A página não aceita um identificador.")
    secret = request.cookies.get(COOKIE, "")
    db.execute(insert(UsageEvent).values(
        id=data.id, user_id=user.id, page=data.page, kind="page", community_id=community_id, target_id=data.target,
        session_key=digest("usage:" + secret),
    ).on_conflict_do_nothing())
    db.commit()


def day(value):
    return cast(func.timezone("Africa/Maputo", value), Date)


def bounds(first: date, last: date):
    return (datetime.combine(first, time.min, MAPUTO).astimezone(timezone.utc),
            datetime.combine(last + timedelta(days=1), time.min, MAPUTO).astimezone(timezone.utc))


def report_period(db: DB, first: date, last: date, community_id: UUID | None,
                  content_type: str | None, installed, *, include_series=True):
    start, end = bounds(first, last)

    def timeline(model, field, *conditions, scoped=True):
        query = select(day(field).label("local_day"), func.count()).where(field >= start, field < end, *conditions)
        if community_id and scoped:
            query = query.where(model.community_id == community_id)
        return dict(db.execute(query.group_by("local_day")).all())

    post_filters = [Discussion.parent_id.is_(None)]
    if content_type:
        post_filters.append(Discussion.kind == content_type)
    post_counts = timeline(Discussion, Discussion.created_at, *post_filters)
    comment_filters = [Discussion.parent_id.is_not(None)]
    if content_type:
        comment_filters.append(Discussion.parent_id.in_(select(Discussion.id).where(
            Discussion.parent_id.is_(None), Discussion.kind == content_type)))
    comment_counts = timeline(Discussion, Discussion.created_at, *comment_filters)
    signup_counts = {} if community_id else timeline(User, User.terms_accepted_at, scoped=False)
    received = timeline(Report, Report.created_at)
    closed = timeline(Report, Report.resolved_at)
    event_filter = [UsageEvent.created_at >= start, UsageEvent.created_at < end]
    if community_id:
        event_filter.append(UsageEvent.community_id == community_id)
    event_count = dict(db.execute(select(UsageEvent.kind, func.count()).where(*event_filter)
                                  .group_by(UsageEvent.kind)).all())
    pages = [*event_filter, UsageEvent.kind == "page"]
    usage_window = [UsageEvent.kind == "page", UsageEvent.created_at < end]
    if community_id:
        usage_window.append(UsageEvent.community_id == community_id)
    user_days = dict(db.execute(select(UsageEvent.user_id, func.count(func.distinct(day(UsageEvent.created_at))))
                               .where(*pages, UsageEvent.user_id.is_not(None)).group_by(UsageEvent.user_id)).all())
    views = timeline(UsageEvent, UsageEvent.created_at, UsageEvent.kind == "page")
    dau_counts = dict(db.execute(select(day(UsageEvent.created_at).label("local_day"), func.count(func.distinct(UsageEvent.user_id)))
                                 .where(*pages).group_by("local_day")).all())
    report_scope = [Report.community_id == community_id] if community_id else []
    durations = db.scalars(select(func.extract("epoch", Report.resolved_at - Report.created_at))
                           .where(*report_scope, Report.resolved_at >= start, Report.resolved_at < end)).all()
    contributor_query = select(func.count(func.distinct(Discussion.author_id))).where(
        Discussion.created_at >= start, Discussion.created_at < end)
    if community_id:
        contributor_query = contributor_query.where(Discussion.community_id == community_id)
    if content_type:
        contributor_query = contributor_query.where(
            (Discussion.parent_id.is_(None) & (Discussion.kind == content_type)) |
            comment_filters[-1]
        )
    values = {
        "logins": None if community_id else event_count.get("login", 0),
        "sessions": None if community_id else event_count.get("session", 0),
        "visits": db.scalar(select(func.count(func.distinct(UsageEvent.session_key))).where(*pages)),
        "views": event_count.get("page", 0),
        "post_views": db.scalar(select(func.count()).select_from(UsageEvent).where(*pages, UsageEvent.page == "post")),
        "community_views": db.scalar(select(func.count()).select_from(UsageEvent).where(*pages, UsageEvent.page == "community")),
        "unique_post_views": "Pares distintos de conta e publicação nas visualizações de publicações.",
    "unique_community_views": "Pares distintos de conta e comunidade nas visualizações de comunidades.",
    "unique_viewers": len(user_days),
        "active": len(user_days),
        "days_per_user": round(sum(user_days.values()) / len(user_days), 2) if user_days else None,
        "return_rate": round(100 * sum(days > 1 for days in user_days.values()) / len(user_days), 2) if user_days else None,
        "registrations": None if community_id else sum(signup_counts.values()),
        "posts": sum(post_counts.values()),
        "comments": sum(comment_counts.values()),
        "reports_received": sum(received.values()),
        "reports_closed": sum(closed.values()),
        "reports_pending": db.scalar(select(func.count()).select_from(Report).where(
            *report_scope, Report.created_at >= start, Report.created_at < end, Report.state.in_(("pending", "reviewing")))),
        "median_hours": round(float(median(durations)) / 3600, 2) if durations else None,
        "admin_actions": sum(timeline(AdminAudit, AdminAudit.created_at).values()),
        "messages": None if community_id else sum(timeline(DirectMessage, DirectMessage.created_at, scoped=False).values()),
        "contributors": db.scalar(contributor_query),
    }
    for key, view_type in (("unique_post_views", "post"), ("unique_community_views", "community")):
        values[key] = db.scalar(select(func.count(func.distinct(tuple_(UsageEvent.user_id, UsageEvent.target_id))))
                                .where(*pages, UsageEvent.page == view_type,
                                       UsageEvent.user_id.is_not(None), UsageEvent.target_id.is_not(None)))
    for key, kinds in (("collaborations", ("collaboration",)), ("reading", ("reading",)),
                       ("opportunities", ("scholarship", "internship", "vacancy", "call"))):
        values[key] = sum(timeline(Discussion, Discussion.created_at, Discussion.parent_id.is_(None),
                                   Discussion.kind.in_(kinds), *post_filters[1:]).values())

    for name, days in (("dau", 1), ("wau", 7), ("mau", 30)):
        window, _ = bounds(last - timedelta(days=days - 1), last)
        values[name] = db.scalar(select(func.count(func.distinct(UsageEvent.user_id))).where(
            *usage_window, UsageEvent.created_at >= window))
    for key, model in (("reactions", Reaction), ("follows", Follow), ("bookmarks", Bookmark),
                       ("mentions", Mention), ("reading_participants", ReadingParticipant)):
        query = select(func.count()).select_from(model)
        if community_id and model is not Follow:
            query = query.join(Discussion, Discussion.id == model.post_id).where(Discussion.community_id == community_id)
        values[key] = None if community_id and model is Follow else db.scalar(query)
    if not installed or end <= installed:
        values.update(dict.fromkeys(TRACKED))
    series = []
    if include_series:
        for offset in range((last - first).days + 1):
            current = first + timedelta(days=offset)
            _, bin_end = bounds(current, current)
            observed = installed is not None and bin_end > installed
            series.append({
                "date": current.isoformat(), "views": views.get(current, 0) if observed else None,
                "active": dau_counts.get(current, 0) if observed else None,
                "posts": post_counts.get(current, 0), "comments": comment_counts.get(current, 0),
                "registrations": None if community_id else signup_counts.get(current, 0),
                "reports_received": received.get(current, 0), "reports_closed": closed.get(current, 0),
            })
    return values, series


@router.get("/metrics")
def metrics(db: DB, grant: Access, start: date | None = None, end: date | None = None,
            community_id: UUID | None = None, format: Literal["json", "csv"] = "json",
            content_type: Literal["post", "collaboration", "reading", "scholarship", "internship", "vacancy", "call"] | None = None):
    current = now()
    today = current.astimezone(MAPUTO).date()
    last = end or today
    first = start or last - timedelta(days=29)
    if first < date(2000, 1, 1) or first > last or last > today or (last - first).days > 365:
        raise HTTPException(422, "Escolha um período válido de até 366 dias.")
    if grant.role == "moderator" and not community_id:
        community_id = grant.community_id
    scope(grant, community_id)
    installed = db.scalar(select(func.min(UsageEvent.created_at)).where(UsageEvent.kind == "installed"))
    totals, series = report_period(db, first, last, community_id, content_type, installed)
    prior_last = first - timedelta(days=1)
    prior_first = prior_last - (last - first)
    prior, _ = report_period(db, prior_first, prior_last, community_id, content_type, installed, include_series=False)
    # Snapshot counts represent present-day records and cannot be compared historically.
    for key in ("reactions", "follows", "bookmarks", "mentions", "reading_participants"):
        prior[key] = None
    if format == "csv":
        stream = io.StringIO()
        writer = csv.writer(stream)
        writer.writerow(["secção", "data", "métrica", "valor", "período anterior"])
        writer.writerows(("resumo", "", key, value, prior[key]) for key, value in totals.items())
        writer.writerows(("diário", row["date"], key, value, "") for row in series
                         for key, value in row.items() if key != "date")
        audit(db, grant.user_id, "exportar indicadores", "metrics", grant.user_id, community_id,
              f"Exportação de {first} a {last} ({content_type or 'todos'}).")
        db.commit()
        return Response(stream.getvalue(), media_type="text/csv; charset=utf-8",
                        headers={"Content-Disposition": 'attachment; filename="sscix-indicadores.csv"'})
    return {"start": first, "end": last, "previous_start": prior_first, "previous_end": prior_last,
            "community_id": community_id, "totals": totals, "previous": prior, "series": series,
            "definitions": DEFINITIONS, "collection_started_at": installed, "updated_at": current}
