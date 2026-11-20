from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import JSON, Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class User(Base):
    __tablename__ = "users"
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
    __tablename__ = "profiles"
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
    keywords: Mapped[list[str]] = mapped_column(JSON, server_default="[]")
    social_links: Mapped[list[dict]] = mapped_column(JSON, server_default="[]")
    is_public: Mapped[bool] = mapped_column(Boolean, server_default="false")


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
    __tablename__ = "communities"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    description: Mapped[str] = mapped_column(String(600))
    photo: Mapped[str] = mapped_column(Text, server_default="")
    owner_id: Mapped[UUID] = mapped_column(ForeignKey("profiles.user_id", ondelete="CASCADE"))


class Discussion(Base):
    __tablename__ = "discussions"

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
    __tablename__ = "direct_messages"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    sender_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recipient_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
