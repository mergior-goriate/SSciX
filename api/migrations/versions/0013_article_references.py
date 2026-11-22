"""Store imported DOI references and link them to discussions."""

import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"


def upgrade():
    op.create_table(
        "article_references",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("doi", sa.String(255), nullable=False, unique=True),
        sa.Column("citation", sa.JSON(), nullable=False),
    )
    op.add_column("discussions", sa.Column("article_id", sa.Uuid(), nullable=True))
    op.add_column("discussions", sa.Column("article_citation", sa.JSON(), nullable=True))
    op.create_foreign_key("fk_discussions_article", "discussions", "article_references", ["article_id"], ["id"])
    op.create_index("ix_discussions_article_id", "discussions", ["article_id"])


def downgrade():
    op.drop_index("ix_discussions_article_id", table_name="discussions")
    op.drop_constraint("fk_discussions_article", "discussions", type_="foreignkey")
    op.drop_column("discussions", "article_citation")
    op.drop_column("discussions", "article_id")
    op.drop_table("article_references")
