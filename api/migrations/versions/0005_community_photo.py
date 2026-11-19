"""Add optional profile photos to communities."""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"


def upgrade():
    op.add_column("communities", sa.Column("photo", sa.Text(), server_default="", nullable=False))


def downgrade():
    op.drop_column("communities", "photo")
