"""Add academic trajectories, communities and discussions."""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"

TRAJECTORY_FIELDS = ("education", "experience", "publications")


def upgrade():
    for field in TRAJECTORY_FIELDS:
        op.add_column("profiles", sa.Column(field, sa.Text(), nullable=False, server_default=""))
    op.create_table(
        "communities",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
        sa.Column("description", sa.String(600), nullable=False),
        sa.Column("owner_id", sa.Uuid(), sa.ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False),
    )
    op.create_table(
        "discussions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("author_id", sa.Uuid(), sa.ForeignKey("profiles.user_id", ondelete="CASCADE"), nullable=False),
        sa.Column("community_id", sa.Uuid(), sa.ForeignKey("communities.id", ondelete="CASCADE")),
        sa.Column("parent_id", sa.Uuid(), sa.ForeignKey("discussions.id", ondelete="CASCADE")),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    for column in ("author_id", "community_id", "parent_id", "created_at"):
        op.create_index(f"ix_discussions_{column}", "discussions", [column])


def downgrade():
    op.drop_table("discussions")
    op.drop_table("communities")
    for field in reversed(TRAJECTORY_FIELDS):
        op.drop_column("profiles", field)
