"""Store private feed preferences and optional gender identity."""

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"


def upgrade():
    op.add_column("profiles", sa.Column("preferences", sa.JSON(), server_default="{}", nullable=False))


def downgrade():
    op.drop_column("profiles", "preferences")
