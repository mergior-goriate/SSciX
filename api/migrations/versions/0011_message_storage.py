"""Record which direct messages are encrypted at rest."""

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"


def upgrade():
    op.add_column("direct_messages", sa.Column("body_encrypted", sa.Boolean(), server_default=sa.false(), nullable=False))


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT EXISTS (SELECT 1 FROM direct_messages WHERE body_encrypted)")):
        raise RuntimeError("Restore a compatible application version to retain encrypted messages.")
    op.drop_column("direct_messages", "body_encrypted")
