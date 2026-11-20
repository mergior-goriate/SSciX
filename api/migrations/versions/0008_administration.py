"""Administration, reports, moderation and usage events."""

from uuid import UUID

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"

FLAGS = {
    "users": ("suspended",),
    "profiles": ("moderation_hidden",),
    "communities": ("moderation_hidden",),
    "discussions": ("moderation_hidden", "attachment_hidden"),
}


def upgrade():
    for table, names in FLAGS.items():
        for name in names:
            op.add_column(table, sa.Column(name, sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table(
        "admin_grants",
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("community_id", sa.Uuid(), sa.ForeignKey("communities.id", ondelete="CASCADE")),
        sa.CheckConstraint("(role = 'moderator' AND community_id IS NOT NULL) OR "
                           "(role IN ('admin', 'viewer') AND community_id IS NULL)", name="admin_grant_scope"),
    )
    op.create_table(
        "admin_audit",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("actor_id", sa.Uuid()),
        sa.Column("action", sa.String(48), nullable=False),
        sa.Column("target_type", sa.String(20), nullable=False),
        sa.Column("target_id", sa.Uuid(), nullable=False),
        sa.Column("community_id", sa.Uuid()),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("previous", sa.Text(), nullable=False),
        sa.Column("result", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_admin_audit_target", "admin_audit", ["target_type", "target_id", "created_at"])
    op.create_table(
        "reports",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("reporter_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("assignee_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("target_type", sa.String(20), nullable=False),
        sa.Column("target_id", sa.Uuid(), nullable=False),
        sa.Column("community_id", sa.Uuid()),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("state", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("priority", sa.String(16), nullable=False, server_default="normal"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("state IN ('pending', 'reviewing', 'resolved', 'dismissed')", name="report_state"),
        sa.CheckConstraint("priority IN ('low', 'normal', 'high')", name="report_priority"),
        sa.CheckConstraint("target_type IN ('profile', 'community', 'post', 'attachment', 'message')", name="report_target"),
    )
    op.create_index("ix_reports_queue", "reports", ["community_id", "state", "created_at"])
    events = op.create_table(
        "usage_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("session_key", sa.String(64)),
        sa.Column("community_id", sa.Uuid()),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("page", sa.String(24)),
        sa.Column("target_id", sa.Uuid()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_usage_kind_date", "usage_events", ["kind", "created_at"])
    op.get_bind().execute(events.insert().values(id=UUID("00000000-0000-0000-0000-000000000008"), kind="installed"))


def downgrade():
    for table in ("usage_events", "reports", "admin_audit", "admin_grants"):
        op.drop_table(table)
    for table, names in FLAGS.items():
        for name in names:
            op.drop_column(table, name)
