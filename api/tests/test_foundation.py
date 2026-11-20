from uuid import uuid4

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import delete


@pytest.fixture
def account(app_config, monkeypatch):
    from app import auth
    from app.db import SessionFactory
    from app.models import User

    app, origin = app_config
    mailbox = {}
    monkeypatch.setattr(auth, "send_link", lambda address, purpose, secret: mailbox.update({purpose: secret}))
    slug = f"pesquisador-{uuid4().hex[:12]}"
    data = {"name": "Ana Mateus", "slug": slug, "email": f"{slug}@example.com",
            "password": "Uma-palavra-passe longa", "accept_terms": True}
    with TestClient(app, base_url=origin, headers={"Origin": origin}) as client:
        yield client, data, mailbox
    with SessionFactory.begin() as db:
        db.execute(delete(User).where(User.email == data["email"]))


def test_account_and_profile_lifecycle(account):
    client, data, mailbox = account
    root = "/api/v1"
    credentials = {key: data[key] for key in ("email", "password")}
    public = f"{root}/profiles/{data['slug']}"
    own = f"{root}/profiles/me"

    assert client.get(own).status_code == 401
    assert client.post(f"{root}/auth/register", json=data).status_code == 202
    assert client.post(f"{root}/auth/login", json=credentials).status_code == 403
    confirmation = {"token": mailbox["verify"], "password": data["password"]}
    assert client.post(f"{root}/auth/verify", json={**confirmation, "password": "errada"}).status_code == 403
    assert client.post(f"{root}/auth/verify", json=confirmation).status_code == 204
    assert client.post(f"{root}/auth/verify", json=confirmation).status_code == 400
    login = client.post(f"{root}/auth/login", json=credentials)
    assert login.status_code == 204
    assert "HttpOnly" in login.headers["set-cookie"]
    assert "SameSite=lax" in login.headers["set-cookie"]
    assert client.get(public).status_code == 404
    private_profile = client.get(own).json()
    assert private_profile.pop("email") == data["email"]
    update = {**private_profile, "institution": "Universidade de teste", "is_public": True}
    response = client.put(own, json=update)
    assert response.status_code == 200
    visible = client.get(public)
    assert visible.status_code == 200 and visible.headers["cache-control"] == "no-store"
    assert visible.json() == update
    assert client.put(own, json={**update, "is_public": False}).status_code == 200
    assert client.get(public).status_code == 404
    assert client.put(own, json={**update, "orcid": "0000-0002-1825-0098"}).status_code == 422
    assert client.post(f"{root}/auth/logout").status_code == 204
    assert client.get(own).status_code == 401


def test_reset_and_account_deletion(account):
    client, data, mailbox = account
    root = "/api/v1"
    assert client.post(f"{root}/auth/register", json=data).status_code == 202
    assert client.post(f"{root}/auth/resend", json={"email": data["email"]}).status_code == 202
    assert client.post(f"{root}/auth/verify", json={
        "token": mailbox["verify"], "password": data["password"],
    }).status_code == 204
    credentials = {key: data[key] for key in ("email", "password")}
    assert client.post(f"{root}/auth/login", json=credentials).status_code == 204
    assert client.post(f"{root}/auth/forgot-password", json={"email": data["email"]}).status_code == 202
    password = "Uma nova palavra-passe"
    reset = {"token": mailbox["reset"], "password": password}
    assert client.post(f"{root}/auth/reset-password", json=reset).status_code == 204
    assert client.post(f"{root}/auth/reset-password", json=reset).status_code == 400
    assert client.get(f"{root}/profiles/me").status_code == 401
    assert client.post(f"{root}/auth/login", json=credentials).status_code == 401
    assert client.post(f"{root}/auth/login", json={**credentials, "password": password}).status_code == 204
    assert client.request("DELETE", f"{root}/auth/account", json={"password": "incorreta"}).status_code == 403
    assert client.request("DELETE", f"{root}/auth/account", json={"password": password}).status_code == 204
    assert client.get(f"{root}/profiles/me").status_code == 401
    assert client.post(f"{root}/auth/login", json={**credentials, "password": password}).status_code == 401


def test_origin_and_validation(account):
    client, data, mailbox = account
    endpoint = "/api/v1/auth/register"
    assert client.post(endpoint, json=data, headers={"Origin": "http://other.example"}).status_code == 403
    response = client.post(endpoint, json={**data, "password": "curta"})
    assert response.status_code == 422
    assert "curta" not in response.text
    assert response.json()["fields"] == ["password"]
    assert mailbox == {}


def test_public_directory_and_follow_privacy(account, app_config):
    owner, data, mailbox = account
    app, origin = app_config
    root = "/api/v1"
    own = f"{root}/profiles/me"
    directory = f"{root}/profiles"
    follow = f"{directory}/{data['slug']}/follow"
    follower_slug = f"leitor-{uuid4().hex[:12]}"
    follower_data = {**data, "slug": follower_slug, "email": f"{follower_slug}@example.com"}

    def sign_in(client, registration):
        credentials = {key: registration[key] for key in ("email", "password")}
        assert client.post(f"{root}/auth/register", json=registration).status_code == 202
        assert client.post(f"{root}/auth/verify", json={
            "token": mailbox["verify"], "password": registration["password"],
        }).status_code == 204
        assert client.post(f"{root}/auth/login", json=credentials).status_code == 204

    sign_in(owner, data)
    profile = owner.get(own).json()
    profile.pop("email")
    public_profile = {**profile, "is_public": True, "institution": data["slug"]}
    search = {"q": data["slug"]}

    from app.db import SessionFactory
    from app.models import User

    try:
        with TestClient(app, base_url=origin, headers={"Origin": origin}) as follower:
            assert follower.get(follow).status_code == 401
            sign_in(follower, follower_data)
            assert follower.put(follow).status_code == 404
            assert follower.get(directory, params=search).json() == []

            assert owner.put(own, json=public_profile).status_code == 200
            assert owner.put(follow).status_code == 400
            assert follower.get(directory, params=search).json() == [{
                "slug": data["slug"], "name": data["name"],
                "institution": data["slug"], "specialization": "",
            }]
            assert follower.put(follow, headers={"Origin": "http://other.example"}).status_code == 403
            assert follower.put(follow).json() == {"following": True, "can_follow": True, "followers": 1, "following_count": 0}
            assert follower.put(follow).json()["following"] is True
            assert follower.delete(follow).json()["following"] is False
            assert follower.delete(follow).json()["following"] is False
            assert follower.put(follow).json()["following"] is True

            assert owner.put(own, json={**public_profile, "is_public": False}).status_code == 200
            assert follower.get(directory, params=search).json() == []
            assert follower.get(follow).status_code == 404
            assert owner.put(own, json=public_profile).status_code == 200
            assert follower.get(follow).json()["following"] is False
    finally:
        with SessionFactory.begin() as db:
            db.execute(delete(User).where(User.email == follower_data["email"]))


def test_academic_network_and_trajectory(account):
    client, data, mailbox = account
    root = "/api/v1"
    own = f"{root}/profiles/me"
    feed = f"{root}/feed"
    communities = f"{root}/communities"
    assert client.post(feed, json={"body": "Convite de investigação"}).status_code == 401
    assert client.post(f"{root}/auth/register", json=data).status_code == 202
    assert client.post(f"{root}/auth/verify", json={
        "token": mailbox["verify"], "password": data["password"],
    }).status_code == 204
    assert client.post(f"{root}/auth/login", json={
        "email": data["email"], "password": data["password"],
    }).status_code == 204
    assert client.post(feed, json={"body": "Convite de investigação"}).status_code == 403
    profile = client.get(own).json()
    profile.pop("email")
    profile.update(is_public=True, education="Mestrado em Educação", publications="Comunicação em conferência")
    assert client.put(own, json=profile).status_code == 200
    public = f"{root}/profiles/{data['slug']}"
    assert client.get(public).json()["education"] == profile["education"]
    old_client = {key: value for key, value in profile.items() if key not in {"education", "experience", "publications"}}
    assert client.put(own, json=old_client).json()["education"] == profile["education"]

    group = client.post(communities, json={"name": data["slug"], "description": "Colaboração em educação"})
    assert group.status_code == 201
    group_id = group.json()["id"]
    assert client.get(f"{communities}/{group_id}").status_code == 200
    post = client.post(feed, json={"body": "Convite de investigação", "community_id": group_id})
    assert post.status_code == 201
    post_id = post.json()["id"]
    assert [entry["id"] for entry in client.get(feed, params={"community_id": group_id}).json()] == [post_id]
    assert client.get(feed, params={"following": True}).json() == []
    replies = f"{feed}/{post_id}/replies"
    assert client.post(replies, json={"body": "Quero colaborar."}).status_code == 201
    assert [entry["body"] for entry in client.get(replies).json()] == ["Quero colaborar."]

    assert client.put(own, json={**profile, "is_public": False}).status_code == 200
    assert client.get(public).status_code == 404
    assert client.get(feed, params={"community_id": group_id}).json() == []
    assert client.get(replies).status_code == 404


def test_social_workflow_permissions(account, app_config):
    author, author_data, mailbox = account
    app, origin = app_config
    root = "/api/v1"

    def sign_up(client, data, public=True):
        assert client.post(f"{root}/auth/register", json=data).status_code == 202
        assert client.post(f"{root}/auth/verify", json={
            "token": mailbox["verify"], "password": data["password"],
        }).status_code == 204
        assert client.put(f"{root}/profiles/me/keywords", json={"keywords": ["Educação"]}).status_code == 204
        profile = client.get(f"{root}/profiles/me").json()
        profile.pop("email")
        payload = {**profile, "is_public": public, "social_links": [
            {"platform": "Outra", "url": "https://example.com/private", "public": False},
        ]}
        assert client.put(f"{root}/profiles/me", json=payload).status_code == 200
        return payload

    from app.db import SessionFactory
    from app.models import User

    reader_slug = "leitor-" + uuid4().hex[:12]
    reader_email = f"{reader_slug}@example.com"
    reader_data = {**author_data, "slug": reader_slug, "email": reader_email}
    author_slug = author_data["slug"]
    png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+kv9sAAAAASUVORK5CYII="
    try:
        with TestClient(app, base_url=origin, headers={"Origin": origin}) as reader, \
             TestClient(app, base_url=origin, headers={"Origin": origin}) as guest:
            author_profile = sign_up(author, author_data)
            sign_up(reader, reader_data, public=False)
            profile_url = f"{root}/profiles/{author_slug}"
            author_profile["photo"] = png
            assert author.put(f"{root}/profiles/me", json=author_profile).status_code == 200
            assert guest.get(profile_url).status_code == 401
            public = reader.get(profile_url).json()
            assert public["social_links"] == []
            assert reader.get(public["photo"]).headers["content-type"] == "image/png"
            suggestions = reader.get(f"{root}/profiles/discover/suggestions").json()
            suggestion = next(item for item in suggestions if item["slug"] == author_slug)
            assert suggestion["common_keywords"] == ["Educação"]
            assert reader.put(f"{root}/profiles/me/keywords", json={"keywords": ["Astronomia"]}).status_code == 204
            fallback = reader.get(f"{root}/profiles/discover/suggestions").json()
            assert next(item for item in fallback if item["slug"] == author_slug)["common_keywords"] == []
            assert all(item["slug"] != reader_slug for item in fallback)
            assert reader.put(profile_url + "/follow").json()["followers"] == 1
            assert all(item["slug"] != author_slug for item in reader.get(f"{root}/profiles/discover/suggestions").json())
            publish = author.post(f"{root}/feed", json={
                "body": f"Investigação em educação @{reader_slug}",
                "article_url": "https://example.com/paper",
                "image": png,
            })
            assert publish.status_code == 201
            post = publish.json()
            post_url = f"{root}/feed/{post['id']}"
            assert reader.get(post["image"]).headers["content-type"] == "image/png"
            assert reader.get(f"{root}/feed", params={"following": True}).json()[0]["id"] == post["id"]
            assert reader.put(post_url + "/actions/like").json()["likes"] == 1
            assert reader.put(post_url + "/actions/like").json()["likes"] == 1
            assert reader.put(post_url + "/actions/save").json()["saved"]
            assert reader.get(f"{root}/saved").json()[0]["id"] == post["id"]
            assert author.get(f"{root}/saved").json() == []
            for route in ("/session", "/feed", "/communities", "/profiles", "/profiles/discover/suggestions",
                          "/saved", "/notifications", "/messages", post_url.removeprefix(root),
                          post["image"].removeprefix(root), public["photo"].removeprefix(root)):
                assert guest.get(f"{root}{route}").status_code == 401
            assert reader.get(f"{root}/session").status_code == 204
            assert reader.get(f"{root}/notifications").json()[0]["topic_id"] == post["id"]
            assert reader.put(f"{root}/notifications/{post['id']}/read").status_code == 204
            assert reader.get(f"{root}/notifications").json()[0]["read"] is True

            assert author.post(f"{root}/messages/{reader_slug}", json={"body": "Olá"}).status_code == 404
            assert reader.post(f"{root}/messages/{author_slug}", json={"body": "Mensagem privada"}).status_code == 201
            assert author.get(f"{root}/messages/{reader_slug}").json()["messages"][0]["body"] == "Mensagem privada"
            assert reader.get(f"{root}/messages").json()[0]["slug"] == author_slug
            assert guest.get(f"{root}/messages/{author_slug}").status_code == 401

            assert author.put(f"{root}/profiles/me", json={**author_profile, "is_public": False}).status_code == 200
            assert reader.get(post_url).status_code == 404
            assert reader.get(post["image"]).status_code == 404
            assert reader.get(public["photo"]).status_code == 404
            assert reader.get(f"{root}/saved").json() == []
            assert reader.get(f"{root}/notifications").json() == []
            assert reader.get(f"{root}/messages/{author_slug}").json()["messages"][0]["body"] == "Mensagem privada"
    finally:
        with SessionFactory.begin() as db:
            db.execute(delete(User).where(User.email == reader_email))


def test_community_collaboration_and_reading_contacts(account, app_config):
    from app.db import SessionFactory
    from app.models import User

    author, author_data, mailbox = account
    app, origin = app_config
    root = "/api/v1"
    reader_slug = "leitor-" + uuid4().hex[:12]
    reader_email = f"{reader_slug}@example.com"

    def sign_up(client, registration):
        assert client.post(f"{root}/auth/register", json=registration).status_code == 202
        assert client.post(f"{root}/auth/verify", json={
            "token": mailbox["verify"], "password": registration["password"],
        }).status_code == 204
        profile = client.get(f"{root}/profiles/me").json()
        profile.pop("email")
        assert client.put(f"{root}/profiles/me", json={**profile, "is_public": True}).status_code == 200

    try:
        with TestClient(app, base_url=origin, headers={"Origin": origin}) as reader, \
             TestClient(app, base_url=origin, headers={"Origin": origin}) as guest:
            sign_up(author, author_data)
            sign_up(reader, {**author_data, "slug": reader_slug, "email": reader_email})
            community = author.post(f"{root}/communities", json={
                "name": "Leitura " + uuid4().hex[:12], "description": "Clube de leitura e colaboração",
            }).json()
            payload = {"community_id": community["id"], "title": "Análise de dados", "body": "Procuro apoio."}
            collaboration = author.post(f"{root}/feed", json={**payload, "kind": "collaboration"})
            assert collaboration.status_code == 201
            request_id = collaboration.json()["id"]
            request_path = f"{root}/feed/{request_id}"
            assert reader.post(request_path + "/replies", json={"body": "Posso ajudar."}).status_code == 201
            notice = author.get(f"{root}/notifications").json()[0]
            assert notice["topic_id"] == request_id and notice["collaboration_reply"]
            assert reader.put(request_path + "/resolved").status_code == 403
            assert author.put(request_path + "/resolved").json()["resolved"] is True
            assert reader.get(request_path).json()["resolved"] is True

            invalid_session = author.post(f"{root}/feed", json={**payload, "kind": "reading"})
            assert invalid_session.status_code == 422
            session = author.post(f"{root}/feed", json={
                **payload, "kind": "reading", "title": "Leitura de sexta-feira", "scheduled_date": "2026-12-04",
            })
            assert session.status_code == 201
            session_id = session.json()["id"]
            params = {"content": "reading", "community_id": community["id"]}
            assert [post["id"] for post in reader.get(f"{root}/feed", params=params).json()] == [session_id]
            participants = f"{root}/feed/{session_id}/participants"
            assert guest.get(participants).status_code == 401
            assert author.put(participants + "/me", json={"whatsapp": "258840000000"}).status_code == 204
            assert reader.get(participants).json() == {"joined": False, "whatsapp": "", "participants": []}
            assert reader.put(participants + "/me", json={"whatsapp": "invalid"}).status_code == 422
            assert reader.put(participants + "/me", json={}).status_code == 204
            response = reader.get(participants)
            assert "no-store" in response.headers["cache-control"]
            assert response.json()["participants"][0]["whatsapp"] == "258840000000"
            assert author.put(participants + "/me", json={}).status_code == 204
            assert reader.get(participants).json()["participants"][0]["whatsapp"] == ""
            assert reader.delete(participants + "/me").status_code == 204
            assert reader.get(participants).json()["participants"] == []
            assert author.get(participants).json()["participants"] == []
    finally:
        with SessionFactory.begin() as db:
            db.execute(delete(User).where(User.email == reader_email))


def test_account_settings_keep_email_until_confirmation(account):
    client, data, mailbox = account
    root = "/api/v1"
    previous_email = data["email"]
    new_email = f"nova-{uuid4().hex[:12]}@example.com"
    password = data["password"]
    new_password = "Outra palavra-passe segura"
    from app.db import SessionFactory
    from app.models import User

    try:
        assert client.post(f"{root}/auth/register", json=data).status_code == 202
        assert client.post(f"{root}/auth/verify", json={"token": mailbox["verify"], "password": password}).status_code == 204
        assert client.post(f"{root}/auth/email", json={"email": new_email, "password": password}).status_code == 202
        assert client.get(f"{root}/profiles/me").json()["email"] == previous_email
        confirmation = {"token": mailbox["change-email"], "password": password}
        assert client.post(f"{root}/auth/confirm-email-change", json=confirmation).status_code == 204
        assert client.post(f"{root}/auth/confirm-email-change", json=confirmation).status_code == 400
        assert client.get(f"{root}/profiles/me").json()["email"] == new_email
        assert client.put(f"{root}/auth/password", json={"password": password, "new_password": new_password}).status_code == 204
        assert client.post(f"{root}/auth/deactivate", json={"password": new_password}).status_code == 204
        assert client.get(f"{root}/profiles/me").status_code == 401
        assert client.post(f"{root}/auth/login", json={"email": new_email, "password": new_password}).status_code == 204
        assert client.get(f"{root}/profiles/me").status_code == 200
    finally:
        with SessionFactory.begin() as db:
            db.execute(delete(User).where(User.email == new_email))
