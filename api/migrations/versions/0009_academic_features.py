"""Academic features and indexed search."""

from alembic import op

revision = "0009"
down_revision = "0008"

TABLES = (
    """CREATE TABLE community_members (
        community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
        user_id uuid REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY (community_id, user_id))""",
    """CREATE TABLE personal_activity (
        id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind varchar(12) NOT NULL CHECK (kind IN ('search', 'read')),
        query varchar(100) NOT NULL DEFAULT '', post_id uuid REFERENCES discussions(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now())""",
    """CREATE TABLE stories (
        id uuid PRIMARY KEY, author_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
        community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
        audience varchar(12) NOT NULL CHECK (audience IN ('public', 'followers', 'community')),
        body varchar(500) NOT NULL, image text NOT NULL, link varchar(1000) NOT NULL, archive boolean NOT NULL,
        expires_at timestamptz NOT NULL)""",
    """CREATE TABLE affiliations (
        id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
        institution varchar(160) NOT NULL, role varchar(120) NOT NULL, started_on date, ended_on date)""",
    """CREATE TABLE discussion_revisions (
        id uuid PRIMARY KEY, post_id uuid NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
        note varchar(300) NOT NULL, previous_body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())""",
    """CREATE TABLE search_events (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, entity_type text NOT NULL, entity_id uuid NOT NULL,
        action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())""",
)

INDEXES = (
    "CREATE INDEX personal_activity_recent ON personal_activity (user_id, created_at DESC, id DESC)",
    "CREATE INDEX stories_expiry ON stories (expires_at)",
    "CREATE INDEX stories_author ON stories (author_id)",
    "CREATE INDEX affiliations_user ON affiliations (user_id)",
    "CREATE INDEX discussion_revisions_post ON discussion_revisions (post_id, created_at DESC)",
    "CREATE INDEX discussions_search_text ON discussions USING gin (sscix_document(title, body)) WHERE parent_id IS NULL",
    "CREATE INDEX discussions_search_trgm ON discussions USING gin (sscix_normalize(title || ' ' || body) gin_trgm_ops) WHERE parent_id IS NULL",
)


def upgrade():
    op.execute("ALTER TABLE profiles ADD COLUMN history_enabled boolean NOT NULL DEFAULT false")
    op.execute("ALTER TABLE communities ADD COLUMN is_private boolean NOT NULL DEFAULT false")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    for statement in TABLES:
        op.execute(statement)
    op.execute("""
        CREATE FUNCTION sscix_normalize(value text) RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
          SELECT translate(lower(value), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
        $$
    """)
    op.execute("""
        CREATE FUNCTION sscix_document(title text, body text) RETURNS tsvector
        LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
          SELECT setweight(to_tsvector('portuguese', public.sscix_normalize(title)), 'A') ||
                 setweight(to_tsvector('portuguese', public.sscix_normalize(body)), 'B')
        $$
    """)
    for statement in INDEXES:
        op.execute(statement)
    op.execute("""
        CREATE FUNCTION sscix_record_search_event() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_TABLE_NAME = 'discussions' THEN
                IF TG_OP = 'DELETE' THEN
                    IF OLD.parent_id IS NOT NULL THEN
                        RETURN OLD;
                    END IF;
                ELSIF NEW.parent_id IS NOT NULL THEN
                    RETURN NEW;
                END IF;
            END IF;
            IF TG_OP = 'DELETE' THEN
                INSERT INTO search_events(entity_type, entity_id, action) VALUES (TG_TABLE_NAME, OLD.id, TG_OP);
                RETURN OLD;
            END IF;
            INSERT INTO search_events(entity_type, entity_id, action) VALUES (TG_TABLE_NAME, NEW.id, TG_OP);
            RETURN NEW;
        END;
        $$
    """)
    for table in ("discussions", "communities"):
        op.execute(f"CREATE TRIGGER search_event AFTER INSERT OR UPDATE OR DELETE ON {table} "
                   "FOR EACH ROW EXECUTE FUNCTION sscix_record_search_event()")


def downgrade():
    for table in ("discussions", "communities"):
        op.execute(f"DROP TRIGGER search_event ON {table}")
    op.execute("DROP FUNCTION sscix_record_search_event()")
    op.execute("DROP INDEX discussions_search_trgm")
    op.execute("DROP INDEX discussions_search_text")
    op.execute("DROP FUNCTION sscix_document(text, text)")
    op.execute("DROP FUNCTION sscix_normalize(text)")
    for table in ("search_events", "discussion_revisions", "affiliations", "stories", "personal_activity", "community_members"):
        op.drop_table(table)
    op.drop_column("communities", "is_private")
    op.drop_column("profiles", "history_enabled")
