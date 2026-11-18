import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+psycopg://sscix:sscix@127.0.0.1:5432/sscix"
)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionFactory = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    with SessionFactory() as db:
        yield db
