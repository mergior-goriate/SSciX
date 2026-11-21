from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select, text, update

ROOT = "/api/v1"


def test_private_search_history_stories_and_revisions(app_config, monkeypatch):
    app, origin = app_config
    from cryptography.fernet import Fernet, MultiFernet
    from app import message_storage
    from app.db import SessionFactory
    from app.models import DirectMessage, Profile, Story, User
    from app.security import PASSWORDS, now

    users = [uuid4(), uuid4()]
    slugs = [f"ensaio-{uid.hex[:15]}" for uid in users]
    password = "Palavra-passe de ensaio"
    monkeypatch.setattr(message_storage, "cipher", MultiFernet([Fernet(Fernet.generate_key())]))
    with SessionFactory.begin() as db:
        for uid, slug in zip(users, slugs):
            db.add(User(id=uid, email=f"{slug}@example.com", password_hash=PASSWORDS.hash(password),
                        verified_at=now(), terms_version="local-v1"))
            db.flush()
            db.add(Profile(user_id=uid, slug=slug, name=slug, is_public=True))
    try:
        with TestClient(app, base_url=origin, headers={"Origin": origin}) as owner, \
             TestClient(app, base_url=origin, headers={"Origin": origin}) as member:
            for client, slug in zip((owner, member), slugs):
                assert client.post(f"{ROOT}/auth/login", json={"email": f"{slug}@example.com",
                                                              "password": password}).status_code == 204
            response = owner.post(f"{ROOT}/communities", json={
                "name": f"Comunidade {users[0]}", "description": "Grupo de investigação", "is_private": True,
            })
            assert response.status_code == 201
            group = response.json()["id"]
            response = owner.post(f"{ROOT}/feed", json={
                "body": "Investigação sobre solos salinos na província.", "community_id": group,
            })
            assert response.status_code == 201
            post = response.json()["id"]
            get_topic = f"{ROOT}/feed/{post}"
            assert member.get(get_topic).status_code == 404
            assert member.get(f"{ROOT}/feed", params={"q": "solos salinos"}).json() == []
            access = f"{ROOT}/community-members/{group}/{slugs[1]}"
            assert owner.put(access).status_code == 204
            for term in ('"solos salinos"', "investigacao", "salinnos"):
                response = member.get(f"{ROOT}/feed", params={"q": term})
                assert response.status_code == 200, response.text
                assert post in {item["id"] for item in response.json()}, term
            assert member.post(f"{ROOT}/activity", json={"post_id": post}).status_code == 204
            assert member.get(f"{ROOT}/activity").json()["entries"] == []
            assert member.put(f"{ROOT}/activity/settings", json={"enabled": True}).status_code == 204
            assert member.post(f"{ROOT}/activity", json={"post_id": post}).status_code == 204
            assert member.get(f"{ROOT}/activity").json()["entries"][0]["post_id"] == post
            assert owner.put(f"{ROOT}/revisions/{post}", json={
                "body": "Investigação corrigida sobre solos salinos.", "note": "Revimos a descrição.",
            }).status_code == 204
            assert "província" in member.get(f"{ROOT}/revisions/{post}").json()[0]["previous_body"]
            assert owner.post(f"{ROOT}/stories", json={
                "body": "Debate do grupo", "audience": "community", "community_id": group, "archive": True,
            }).status_code == 201
            story = owner.get(f"{ROOT}/stories").json()[0]["id"]
            assert story in {item["id"] for item in member.get(f"{ROOT}/stories").json()}
            assert owner.delete(access).status_code == 204
            assert member.get(get_topic).status_code == 404
            assert member.get(f"{ROOT}/revisions/{post}").status_code == 404
            assert member.get(f"{ROOT}/activity").json()["entries"] == []
            assert story not in {item["id"] for item in member.get(f"{ROOT}/stories").json()}
            with SessionFactory.begin() as db:
                db.execute(update(Story).where(Story.id == UUID(story)).values(expires_at=func.now()))
                count = db.scalar(text("SELECT count(*) FROM search_events WHERE entity_id = :id"), {"id": UUID(post)})
                assert count == 2
            assert story in {item["id"] for item in owner.get(f"{ROOT}/stories?archived=true").json()}
            assert owner.post(f"{ROOT}/affiliations", json={"institution": "Centro de solos", "role": "Investigador"}).status_code == 201
            assert member.get(f"{ROOT}/affiliations/{slugs[0]}").json()[0]["institution"] == "Centro de solos"
            assert member.get(f"{ROOT}/profiles", params={"institution": "Centro de solos"}).json()[0]["slug"] == slugs[0]
            message = owner.post(f"{ROOT}/messages/{slugs[1]}", json={"body": "Mensagem para testar cifragem."})
            assert message.status_code == 201
            assert member.get(f"{ROOT}/messages/{slugs[0]}").json()["messages"][0]["body"] == message.json()["body"]
            with SessionFactory.begin() as db:
                stored = db.scalar(select(DirectMessage).where(DirectMessage.id == UUID(message.json()["id"])))
                assert stored.body_encrypted and stored.body != message.json()["body"]
    finally:
        with SessionFactory.begin() as db:
            db.execute(delete(User).where(User.id.in_(users)))


def test_affiliate_confirmation_and_refund(app_config, monkeypatch):
    app, origin = app_config
    from urllib.parse import parse_qs, urlsplit
    from app.db import SessionFactory
    from app.models import AffiliateEvent

    key = "partnership-test-only-secret-0123456789"
    monkeypatch.setenv("SSCIX_AFFILIATE_URL", "https://partner.example/training?lang=pt")
    monkeypatch.setenv("SSCIX_AFFILIATE_CALLBACK_TOKEN", key)
    with TestClient(app, base_url=origin, follow_redirects=False) as guest:
        click = guest.get(f"{ROOT}/commercial/click/formacao-academica")
        assert click.status_code == 302
        url = urlsplit(click.headers["location"])
        assert url.hostname == "partner.example"
        ref = parse_qs(url.query)["sscix_ref"][0]
        destination = f"{ROOT}/commercial/conversion/{ref}"
        assert guest.put(destination, json={"status": "confirmed"}).status_code == 403
        for decision in ("confirmed", "refunded", "confirmed"):
            assert guest.put(destination, headers={"Authorization": f"Bearer {key}"},
                             json={"status": decision}).status_code == 204
        with SessionFactory.begin() as db:
            row = db.get(AffiliateEvent, UUID(ref))
            assert row.conversion == "refunded"
            db.delete(row)


def test_private_member_preferences_order_the_feed(app_config):
    app, origin = app_config
    from app.db import SessionFactory
    from app.models import Profile, User
    from app.security import PASSWORDS, now

    uid = uuid4()
    slug = f"preferencias-{uid.hex[:12]}"
    email = f"{slug}@example.com"
    password = "Palavra-passe de ensaio"
    endpoint = f"{ROOT}/profiles/me/preferences"
    with SessionFactory.begin() as db:
        db.add(User(id=uid, email=email, password_hash=PASSWORDS.hash(password), verified_at=now(), terms_version="local-v1"))
        db.flush()
        db.add(Profile(user_id=uid, slug=slug, name="Ana de Ensaio", is_public=True, keywords=["Educação"]))

    try:
        with TestClient(app, base_url=origin, headers={"Origin": origin}) as client:
            assert client.get(endpoint).status_code == 401
            assert client.post(f"{ROOT}/auth/login", json={"email": email, "password": password}).status_code == 204
            blank = {"gender": None, "areas": [], "topics": []}
            assert client.get(endpoint).json() == blank
            choices = {"gender": "nonbinary", "areas": ["Ambiente"], "topics": ["Gestão sustentável"]}
            assert client.put(endpoint, json=choices).status_code == 204
            assert client.get(endpoint).json() == choices
            assert client.put(endpoint, json={**choices, "gender": "outro"}).status_code == 422
            assert client.get(endpoint).json() == choices
            for path in (f"{ROOT}/profiles/me", f"{ROOT}/profiles/{slug}"):
                profile = client.get(path).json()
                assert profile["keywords"] == ["Educação"]
                assert "preferences" not in profile and "gender" not in profile

            ids = []
            for body in ("GESTAO sustentavel da água", "Monitoria do ambiente", "Estudo de linguística"):
                post = client.post(f"{ROOT}/feed", json={"body": body})
                assert post.status_code == 201, post.text
                ids.append(post.json()["id"])

            def order_of_created_posts(order):
                response = client.get(f"{ROOT}/feed", params={"order": order})
                assert response.status_code == 200, response.text
                return [post["id"] for post in response.json() if post["id"] in ids]

            assert order_of_created_posts("interests") == ids
            assert order_of_created_posts("recent") == ids[::-1]
            assert client.put(endpoint, json=blank).status_code == 204
            assert order_of_created_posts("interests") == ids[::-1]
    finally:
        with SessionFactory.begin() as db:
            db.execute(delete(User).where(User.id == uid))
