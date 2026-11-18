"""Add profile follows."""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"


def upgrade():
    op.create_table(
        "follows",
        sa.Column("follower_id", sa.Uuid(), sa.ForeignKey("profiles.user_id", ondelete="CASCADE"), primary_key=True),
        sa.Column("followed_id", sa.Uuid(), sa.ForeignKey("profiles.user_id", ondelete="CASCADE"), primary_key=True),
        sa.CheckConstraint("follower_id <> followed_id", name="follow_distinct_users"),
    )
    op.create_index("ix_follows_followed_id", "follows", ["followed_id"])


def downgrade():
    op.drop_table("follows")
