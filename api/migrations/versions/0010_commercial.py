"""Institutional enquiries and affiliate attribution."""

from alembic import op

revision = "0010"
down_revision = "0009"


def upgrade():
    op.execute("""
        CREATE TABLE institutional_requests (
            id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            institution varchar(160) NOT NULL, use_case varchar(600) NOT NULL,
            status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'closed')),
            created_at timestamptz NOT NULL DEFAULT now())
    """)
    op.execute("CREATE INDEX institutional_requests_user ON institutional_requests (user_id, created_at DESC)")
    op.execute("""
        CREATE TABLE affiliate_events (
            id uuid PRIMARY KEY, campaign varchar(64) NOT NULL,
            conversion varchar(16) NOT NULL DEFAULT 'pending' CHECK (conversion IN ('pending', 'confirmed', 'refunded')),
            created_at timestamptz NOT NULL DEFAULT now())
    """)
    op.execute("CREATE INDEX affiliate_events_campaign ON affiliate_events (campaign, conversion)")
    op.execute("ALTER TABLE affiliations ADD COLUMN verified_at timestamptz")


def downgrade():
    op.drop_column("affiliations", "verified_at")
    op.drop_table("affiliate_events")
    op.drop_table("institutional_requests")
