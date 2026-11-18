"""Add account settings and social workflows."""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"


def reference(name, table, **kwargs):
    return sa.Column(name, sa.Uuid(), sa.ForeignKey(f"{table}.id", ondelete="CASCADE"), **kwargs)


def upgrade():
    op.add_column("users", sa.Column("deactivated_at", sa.DateTime(timezone=True)))
    op.add_column("email_tokens", sa.Column("pending_email", sa.String(254)))
    op.drop_constraint("valid_token_purpose", "email_tokens", type_="check")
    op.create_check_constraint("valid_token_purpose", "email_tokens", "purpose IN ('verify', 'reset', 'change-email')")
    op.add_column("profiles", sa.Column("photo", sa.Text(), nullable=False, server_default=""))
    for field in ("keywords", "social_links"):
        op.add_column("profiles", sa.Column(field, sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("discussions", sa.Column("image", sa.Text(), nullable=False, server_default=""))
    op.add_column("discussions", sa.Column("article_url", sa.String(1000), nullable=False, server_default=""))
    for table in ("reactions", "bookmarks"):
        op.create_table(table, reference("user_id", "users", primary_key=True),
                        reference("post_id", "discussions", primary_key=True))
    op.create_index("ix_reactions_post_id", "reactions", ["post_id"])
    op.create_table("mentions", reference("recipient_id", "users", primary_key=True),
                    reference("post_id", "discussions", primary_key=True),
                    sa.Column("read_at", sa.DateTime(timezone=True)))
    op.create_table("direct_messages", sa.Column("id", sa.Uuid(), primary_key=True),
                    reference("sender_id", "users", nullable=False),
                    reference("recipient_id", "users", nullable=False),
                    sa.Column("body", sa.Text(), nullable=False),
                    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    for column in ("sender_id", "recipient_id"):
        op.create_index(f"ix_direct_messages_{column}", "direct_messages", [column])


def downgrade():
    for table in ("direct_messages", "mentions", "bookmarks", "reactions"):
        op.drop_table(table)
    op.drop_column("discussions", "article_url")
    op.drop_column("discussions", "image")
    for column in ("social_links", "keywords", "photo"):
        op.drop_column("profiles", column)
    op.execute("DELETE FROM email_tokens WHERE purpose = 'change-email'")
    op.drop_constraint("valid_token_purpose", "email_tokens", type_="check")
    op.create_check_constraint("valid_token_purpose", "email_tokens", "purpose IN ('verify', 'reset')")
    op.drop_column("email_tokens", "pending_email")
    op.drop_column("users", "deactivated_at")
