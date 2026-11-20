"""Add collaboration requests and reading sessions to community discussions."""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"


def upgrade():
    op.add_column("discussions", sa.Column("kind", sa.String(16), server_default="post", nullable=False))
    op.add_column("discussions", sa.Column("title", sa.String(120), server_default="", nullable=False))
    op.add_column("discussions", sa.Column("scheduled_date", sa.Date()))
    op.add_column("discussions", sa.Column("resolved", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.create_table(
        "reading_participants",
        sa.Column("post_id", sa.Uuid(), sa.ForeignKey("discussions.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("whatsapp", sa.String(15), server_default="", nullable=False),
    )


def downgrade():
    op.drop_table("reading_participants")
    for column in ("resolved", "scheduled_date", "title", "kind"):
        op.drop_column("discussions", column)
