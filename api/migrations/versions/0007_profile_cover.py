"""Allow members to add an image to their profile cover."""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"


def upgrade():
    op.add_column("profiles", sa.Column("cover", sa.Text(), nullable=False, server_default=""))


def downgrade():
    op.drop_column("profiles", "cover")
