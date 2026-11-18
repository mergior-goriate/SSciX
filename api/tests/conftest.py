import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config


@pytest.fixture(scope="session")
def app_config():
    database = os.getenv("SSCIX_TEST_DATABASE_URL")
    if not database:
        pytest.fail("Defina SSCIX_TEST_DATABASE_URL para uma base de dados de testes PostgreSQL.")
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = database
    try:
        command.upgrade(Config(str(Path(__file__).parents[1] / "alembic.ini")), "head")
        from app.main import app
        from app.security import APP_ORIGIN

        yield app, APP_ORIGIN
    finally:
        if previous is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous
