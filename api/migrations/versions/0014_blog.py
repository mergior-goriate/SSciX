"""Add official and member blogues, corrections, ads and reports."""
import sqlalchemy as sa
from alembic import op

revision = "0014"
down_revision = "0013"


def upgrade():
    op.create_table(
        "blog_entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("author_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("official", sa.Boolean(), nullable=False),
        sa.Column("visibility", sa.String(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        sa.Column("corrections", sa.JSON(), nullable=False),
        sa.Column("ads", sa.Boolean(), nullable=False),
        sa.Column("hidden", sa.Boolean(), nullable=False),
        sa.Column("moderation_reason", sa.String(), nullable=False),
    )
    op.create_index("ix_blog_entries_author_id", "blog_entries", ["author_id"])
    op.create_index("ix_blog_entries_published_at", "blog_entries", ["published_at"])
    op.create_table(
        "blog_reports",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("entry_id", sa.Uuid(), sa.ForeignKey("blog_entries.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reporter_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("resolved", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_blog_reports_entry_id", "blog_reports", ["entry_id"])


def downgrade():
    op.drop_table("blog_reports")
    op.drop_table("blog_entries")
