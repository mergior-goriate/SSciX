import csv
import io
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select



def test_admin_login_permissions_moderation_and_metrics(app_config):
    app, origin = app_config
    from app.db import SessionFactory
    from app.admin_models import AdminAudit, AdminGrant, UsageEvent
    from app.models import Community, DirectMessage, Profile, User
    from app.security import PASSWORDS, now
    from app.analytics import MAPUTO
    root = "/api/v1"
    password = "Palavra-passe de teste"
    ids = {role: uuid4() for role in ("admin", "member", "viewer", "moderator")}
    communities = [uuid4(), uuid4()]
    private_id = uuid4()
    emails = {}
    with SessionFactory.begin() as db:
        for role, uid in ids.items():
            slug = f"{role}-{uid.hex[:10]}"
            emails[role] = f"{slug}@example.com"
            db.add(User(id=uid, email=emails[role], password_hash=PASSWORDS.hash(password),
                        verified_at=now(), terms_version="local-v1"))
            db.flush()
            db.add(Profile(user_id=uid, slug=slug, name=role, is_public=True))
        db.flush()
        db.add_all(Community(id=cid, name=f"Ensaio {cid}", description="Ensaio de âmbito",
                             owner_id=ids["member"]) for cid in communities)
        db.flush()
        db.add(DirectMessage(id=private_id, sender_id=ids["admin"], recipient_id=ids["member"], body="Texto reservado"))
        db.add_all((
            AdminGrant(user_id=ids["admin"], role="admin"),
            AdminGrant(user_id=ids["viewer"], role="viewer"),
            AdminGrant(user_id=ids["moderator"], role="moderator", community_id=communities[0]),
        ))

    clients = {role: TestClient(app, base_url=origin, headers={"Origin": origin}) for role in ids}
    admin, member, viewer, moderator = (clients[role] for role in ids)
    try:
        assert admin.get(f"{root}/admin/access").status_code == 401
        for role, client in clients.items():
            assert client.post(f"{root}/auth/login", json={"email": emails[role], "password": password}).status_code == 204
        assert admin.get(f"{root}/admin/access").json()["role"] == "admin"
        assert member.get(f"{root}/admin/metrics").status_code == 403
        assert moderator.get(f"{root}/admin/records/users").status_code == 403
        role_url = f"{root}/admin/roles/{ids['member']}"
        role_change = {"role": "viewer", "reason": "Atribuição de teste"}
        assert viewer.put(role_url, json=role_change).status_code == 403
        assert admin.put(role_url, json=role_change).status_code == 204
        assert member.get(f"{root}/admin/access").json()["role"] == "viewer"
        assert admin.put(role_url, json={**role_change, "role": None}).status_code == 204
        assert member.get(f"{root}/admin/access").status_code == 403

        private_report = {"target_type": "message", "target_id": str(private_id), "reason": "Denúncia de teste"}
        assert viewer.post(f"{root}/reports", json=private_report).status_code == 404
        reported = member.post(f"{root}/reports", json=private_report)
        assert reported.status_code == 201
        case_url = f"{root}/admin/reports/{reported.json()['id']}"
        assert viewer.get(case_url).status_code == 403
        case = admin.get(case_url).json()
        assert case["content"] == "Texto reservado"
        assert case["history"][0]["action"] == "consultar mensagem denunciada"
        assert moderator.get(f"{root}/admin/metrics", params={"community_id": str(communities[1])}).status_code == 403

        reports = []
        posts = []
        for cid in communities:
            created = member.post(f"{root}/feed", json={"body": "Assunto para teste", "community_id": str(cid)})
            assert created.status_code == 201
            target_id = created.json()["id"]
            posts.append(target_id)
            reported = viewer.post(f"{root}/reports", json={
                "target_type": "post", "target_id": target_id, "reason": "Motivo de ensaio",
            })
            assert reported.status_code == 201
            reports.append(reported.json()["id"])

        target = f"{root}/admin/reports/{reports[0]}"
        decision = {"state": "resolved", "priority": "high", "reason": "Decisão de ensaio",
                    "assignee_id": str(ids["moderator"])}
        assert viewer.put(target, json=decision).status_code == 403
        assert moderator.get(f"{root}/admin/reports/{reports[1]}").status_code == 403
        assert [r["id"] for r in moderator.get(f"{root}/admin/records/reports").json()["items"]] == reports[:1]
        assert moderator.put(target, json=decision).status_code == 204
        assert admin.get(target).json()["history"][0]["result"].startswith("resolved/high")
        hidden = f"{root}/admin/moderation/post/{posts[0]}"
        assert moderator.put(hidden, json={"enabled": True, "reason": "Ocultação de ensaio"}).status_code == 204
        assert member.get(f"{root}/feed/{posts[0]}").status_code == 404
        assert admin.put(hidden, json={"enabled": False, "reason": "Restauro de ensaio"}).status_code == 204
        assert member.get(f"{root}/feed/{posts[0]}").status_code == 200

        view = {"id": str(uuid4()), "page": "post", "target": posts[0]}
        assert member.post(f"{root}/events/page", json=view).status_code == 204
        assert member.post(f"{root}/events/page", json=view).status_code == 204
        assert member.get(f"{root}/feed/{posts[0]}").json()["views"] == 1
        assert member.get(f"{root}/feed/{posts[1]}").json()["views"] == 0
        today = now().astimezone(MAPUTO).date()
        params = {"start": str(today), "end": str(today)}
        result = admin.get(f"{root}/admin/metrics", params=params)
        assert result.status_code == 200
        detail = result.json()
        totals = detail["totals"]
        assert totals["views"] == totals["visits"] == totals["unique_viewers"] == totals["unique_post_views"] == 1
        assert totals["logins"] > 0 and totals["sessions"] >= totals["logins"]
        assert detail["series"][0]["views"] == totals["views"]
        with SessionFactory() as db:
            for key, kind in (("views", "page"), ("logins", "login"), ("sessions", "session")):
                assert totals[key] == db.scalar(select(func.count()).select_from(UsageEvent).where(UsageEvent.kind == kind))
            assert db.scalar(select(func.count()).select_from(AdminAudit).where(
                AdminAudit.target_id == UUID(reports[0]), AdminAudit.action == "decidir denúncia")) == 1
        export = admin.get(f"{root}/admin/metrics", params={**params, "format": "csv"})
        assert export.status_code == 200
        records = list(csv.reader(io.StringIO(export.text)))
        assert ["resumo", "", "views", "1", ""] in records
        assert ["diário", str(today), "views", "1", ""] in records

        suspend = f"{root}/admin/moderation/account/{ids['member']}"
        assert admin.put(suspend, json={"enabled": True, "reason": "Suspensão de ensaio"}).status_code == 204
        assert member.get(f"{root}/session").status_code == 401
        assert member.post(f"{root}/auth/login", json={"email": emails["member"], "password": password}).status_code == 403
        assert admin.put(suspend, json={"enabled": False, "reason": "Reactivação de ensaio"}).status_code == 204
        assert member.post(f"{root}/auth/login", json={"email": emails["member"], "password": password}).status_code == 204
    finally:
        for client in clients.values():
            client.close()
        with SessionFactory.begin() as db:
            db.execute(delete(User).where(User.id.in_(ids.values())))
