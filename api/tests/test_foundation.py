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
