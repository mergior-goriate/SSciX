"""foundation"""

from alembic import op
import sqlalchemy as sa


revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('rate_limits',
        sa.Column('key', sa.String(length=64), nullable=False),
        sa.Column('window', sa.Integer(), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('key', 'window')
    )
    op.create_table('users',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('email', sa.String(length=254), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=16), server_default='user', nullable=False),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('terms_version', sa.String(length=24), nullable=False),
        sa.Column('terms_accepted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("role IN ('user', 'moderator', 'admin')", name='valid_role'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )
    op.create_table('email_tokens',
        sa.Column('digest', sa.String(length=64), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('purpose', sa.String(length=12), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("purpose IN ('verify', 'reset')", name='valid_token_purpose'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('digest')
    )
    op.create_index(op.f('ix_email_tokens_expires_at'), 'email_tokens', ['expires_at'], unique=False)
    op.create_index(op.f('ix_email_tokens_user_id'), 'email_tokens', ['user_id'], unique=False)
    op.create_table('profiles',
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('slug', sa.String(length=40), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('academic_role', sa.String(length=16), nullable=False),
        sa.Column('institution', sa.String(length=160), nullable=False),
        sa.Column('country', sa.String(length=80), nullable=False),
        sa.Column('city', sa.String(length=80), nullable=False),
        sa.Column('specialization', sa.String(length=160), nullable=False),
        sa.Column('interests', sa.String(length=400), nullable=False),
        sa.Column('biography', sa.Text(), nullable=False),
        sa.Column('orcid', sa.String(length=19), nullable=False),
        sa.Column('is_public', sa.Boolean(), server_default='false', nullable=False),
        sa.CheckConstraint("academic_role IN ('other', 'researcher', 'teacher', 'student')", name='valid_academic_role'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id'),
        sa.UniqueConstraint('slug')
    )
    op.create_table('sessions',
        sa.Column('digest', sa.String(length=64), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('digest')
    )
    op.create_index(op.f('ix_sessions_expires_at'), 'sessions', ['expires_at'], unique=False)
    op.create_index(op.f('ix_sessions_user_id'), 'sessions', ['user_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_sessions_user_id'), table_name='sessions')
    op.drop_index(op.f('ix_sessions_expires_at'), table_name='sessions')
    op.drop_table('sessions')
    op.drop_table('profiles')
    op.drop_index(op.f('ix_email_tokens_user_id'), table_name='email_tokens')
    op.drop_index(op.f('ix_email_tokens_expires_at'), table_name='email_tokens')
    op.drop_table('email_tokens')
    op.drop_table('users')
    op.drop_table('rate_limits')
