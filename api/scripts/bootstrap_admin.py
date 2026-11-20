"""Grant the first SSciX administrator role to an existing verified account."""

import argparse

from sqlalchemy import select, text

from app.admin import audit
from app.admin_models import AdminGrant
from app.db import SessionFactory
from app.models import User


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("email")
    args = parser.parse_args()
    with SessionFactory.begin() as db:
        db.execute(text("SELECT pg_advisory_xact_lock(82489901)"))
        if db.scalar(select(AdminGrant.user_id).where(AdminGrant.role == "admin").limit(1)):
            parser.exit(1, "Já existe uma conta administradora. Faça a atribuição pelo painel.\n")
        user = db.scalar(select(User).where(User.email == args.email.strip().lower()).with_for_update())
        if not user or not user.verified_at or user.suspended or user.deactivated_at:
            parser.exit(1, "Indique uma conta existente, confirmada e activa.\n")
        db.merge(AdminGrant(user_id=user.id, role="admin"))
        audit(db, None, "atribuir primeiro administrador", "user", user.id, None,
              "Inicialização pela consola de operação.", result="admin")
    print("Primeiro acesso administrativo atribuído.")


if __name__ == "__main__":
    main()
