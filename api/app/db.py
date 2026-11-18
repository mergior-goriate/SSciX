import os

from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+psycopg://sscix:sscix@127.0.0.1:5432/sscix"
)
database_url = make_url(DATABASE_URL)
if database_url.drivername == "postgresql":
    database_url = database_url.set(drivername="postgresql+psycopg")
engine = create_engine(database_url, pool_pre_ping=True)
SessionFactory = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    with SessionFactory() as db:
        yield db
