from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class User(Base):
    __tablename__ = "users"
    suspended: Mapped[bool] = mapped_column(Boolean, server_default="false")
    __table_args__ = (CheckConstraint("role IN ('user', 'moderator', 'admin')", name="valid_role"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16), server_default="user")
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    terms_version: Mapped[str] = mapped_column(String(24))
    terms_accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Profile(Base):
    history_enabled: Mapped[bool] = mapped_column(Boolean, server_default="false")
    __tablename__ = "profiles"
    moderation_hidden: Mapped[bool] = mapped_column(Boolean, server_default="false")
    __table_args__ = (
        CheckConstraint("academic_role IN ('other', 'researcher', 'teacher', 'student')", name="valid_academic_role"),
    )

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    slug: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    academic_role: Mapped[str] = mapped_column(String(16), default="other")
    institution: Mapped[str] = mapped_column(String(160), default="")
    country: Mapped[str] = mapped_column(String(80), default="")
    city: Mapped[str] = mapped_column(String(80), default="")
    specialization: Mapped[str] = mapped_column(String(160), default="")
    interests: Mapped[str] = mapped_column(String(400), default="")
    biography: Mapped[str] = mapped_column(Text, default="")
    education: Mapped[str] = mapped_column(Text, server_default="")
    experience: Mapped[str] = mapped_column(Text, server_default="")
    publications: Mapped[str] = mapped_column(Text, server_default="")
    orcid: Mapped[str] = mapped_column(String(19), default="")
    photo: Mapped[str] = mapped_column(Text, server_default="")
    cover: Mapped[str] = mapped_column(Text, server_default="", deferred=True)
    keywords: Mapped[list[str]] = mapped_column(JSON, server_default="[]")
    preferences: Mapped[dict] = mapped_column(JSON, server_default="{}", deferred=True)
    social_links: Mapped[list[dict]] = mapped_column(JSON, server_default="[]")
    is_public: Mapped[bool] = mapped_column(Boolean, server_default="false")

    @property
    def has_cover(self) -> bool:
        return bool(self.cover)


class Session(Base):
    __tablename__ = "sessions"

    digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class EmailToken(Base):
    __tablename__ = "email_tokens"
    __table_args__ = (CheckConstraint("purpose IN ('verify', 'reset', 'change-email')", name="valid_token_purpose"),)

    digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    pending_email: Mapped[str | None] = mapped_column(String(254))
    purpose: Mapped[str] = mapped_column(String(12))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class RateLimit(Base):
    __tablename__ = "rate_limits"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    window: Mapped[int] = mapped_column(Integer, primary_key=True)
    attempts: Mapped[int] = mapped_column(Integer, default=1)


class Follow(Base):
    __tablename__ = "follows"
    __table_args__ = (CheckConstraint("follower_id <> followed_id", name="follow_distinct_users"),)

    follower_id: Mapped[UUID] = mapped_column(ForeignKey("profiles.user_id", ondelete="CASCADE"), primary_key=True)
    followed_id: Mapped[UUID] = mapped_column(
        ForeignKey("profiles.user_id", ondelete="CASCADE"), primary_key=True, index=True
    )


class Community(Base):
    is_private: Mapped[bool] = mapped_column(Boolean, server_default="false")
    __tablename__ = "communities"
    moderation_hidden: Mapped[bool] = mapped_column(Boolean, server_default="false")

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    description: Mapped[str] = mapped_column(String(600))
    photo: Mapped[str] = mapped_column(Text, server_default="")
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("profiles.user_id", ondelete="CASCADE"))


class Discussion(Base):
    __tablename__ = "discussions"
    moderation_hidden: Mapped[bool] = mapped_column(Boolean, server_default="false")
    attachment_hidden: Mapped[bool] = mapped_column(Boolean, server_default="false")

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    author_id: Mapped[UUID] = mapped_column(ForeignKey("profiles.user_id", ondelete="CASCADE"), index=True)
    community_id: Mapped[UUID | None] = mapped_column(ForeignKey("communities.id", ondelete="CASCADE"), index=True)
    image: Mapped[str] = mapped_column(Text, server_default="")
    article_url: Mapped[str] = mapped_column(String(1000), server_default="")
    parent_id: Mapped[UUID | None] = mapped_column(ForeignKey("discussions.id", ondelete="CASCADE"), index=True)
    body: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(16), server_default="post")
    title: Mapped[str] = mapped_column(String(120), server_default="")
    scheduled_date: Mapped[date | None] = mapped_column(Date)
    resolved: Mapped[bool] = mapped_column(Boolean, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class ReadingParticipant(Base):
    __tablename__ = "reading_participants"

    post_id: Mapped[UUID] = mapped_column(ForeignKey("discussions.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    whatsapp: Mapped[str] = mapped_column(String(15), server_default="")


class Reaction(Base):
    __tablename__ = "reactions"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    post_id: Mapped[UUID] = mapped_column(ForeignKey("discussions.id", ondelete="CASCADE"), primary_key=True, index=True)


class Bookmark(Base):
    __tablename__ = "bookmarks"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    post_id: Mapped[UUID] = mapped_column(ForeignKey("discussions.id", ondelete="CASCADE"), primary_key=True)


class Mention(Base):
    __tablename__ = "mentions"

    recipient_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    post_id: Mapped[UUID] = mapped_column(ForeignKey("discussions.id", ondelete="CASCADE"), primary_key=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DirectMessage(Base):
    body_encrypted: Mapped[bool] = mapped_column(Boolean, server_default="false")
    __tablename__ = "direct_messages"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    sender_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recipient_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CommunityMember(Base):
    __tablename__ = "community_members"

    community_id: Mapped[UUID] = mapped_column(ForeignKey("communities.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)


class Activity(Base):
    __tablename__ = "personal_activity"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(12))
    query: Mapped[str] = mapped_column(String(100), server_default="")
    post_id: Mapped[UUID | None] = mapped_column(ForeignKey("discussions.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Story(Base):
    __tablename__ = "stories"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    author_id: Mapped[UUID] = mapped_column(ForeignKey("profiles.user_id", ondelete="CASCADE"), index=True)
    community_id: Mapped[UUID | None] = mapped_column(ForeignKey("communities.id", ondelete="CASCADE"))
    audience: Mapped[str] = mapped_column(String(12))
    body: Mapped[str] = mapped_column(String(500))
    image: Mapped[str] = mapped_column(Text, deferred=True)
    link: Mapped[str] = mapped_column(String(1000))
    archive: Mapped[bool] = mapped_column(Boolean)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class Affiliation(Base):
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __tablename__ = "affiliations"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("profiles.user_id", ondelete="CASCADE"), index=True)
    institution: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(120))
    started_on: Mapped[date | None] = mapped_column(Date)
    ended_on: Mapped[date | None] = mapped_column(Date)


class DiscussionRevision(Base):
    __tablename__ = "discussion_revisions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    post_id: Mapped[UUID] = mapped_column(ForeignKey("discussions.id", ondelete="CASCADE"), index=True)
    note: Mapped[str] = mapped_column(String(300))
    previous_body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InstitutionalRequest(Base):
    __tablename__ = "institutional_requests"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    institution: Mapped[str] = mapped_column(String(160))
    use_case: Mapped[str] = mapped_column(String(600))
    status: Mapped[str] = mapped_column(String(16), server_default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AffiliateEvent(Base):
    __tablename__ = "affiliate_events"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    campaign: Mapped[str] = mapped_column(String(64))
    conversion: Mapped[str] = mapped_column(String(16), server_default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
