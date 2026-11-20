from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class AdminGrant(Base):
    __tablename__ = "admin_grants"
    __table_args__ = (CheckConstraint(
        "(role = 'moderator' AND community_id IS NOT NULL) OR "
        "(role IN ('admin', 'viewer') AND community_id IS NULL)", name="admin_grant_scope",
    ),)

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str] = mapped_column(String(16))
    community_id: Mapped[UUID | None] = mapped_column(ForeignKey("communities.id", ondelete="CASCADE"))


class AdminAudit(Base):
    __tablename__ = "admin_audit"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    actor_id: Mapped[UUID | None]
    action: Mapped[str] = mapped_column(String(48))
    target_type: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[UUID]
    community_id: Mapped[UUID | None]
    reason: Mapped[str] = mapped_column(Text)
    previous: Mapped[str] = mapped_column(Text)
    result: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        CheckConstraint("state IN ('pending', 'reviewing', 'resolved', 'dismissed')", name="report_state"),
        CheckConstraint("priority IN ('low', 'normal', 'high')", name="report_priority"),
        CheckConstraint("target_type IN ('profile', 'community', 'post', 'attachment', 'message')", name="report_target"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    reporter_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    assignee_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    target_type: Mapped[str] = mapped_column(String(20))
    target_id: Mapped[UUID]
    community_id: Mapped[UUID | None]
    reason: Mapped[str] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(16), server_default="pending")
    priority: Mapped[str] = mapped_column(String(16), server_default="normal")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class UsageEvent(Base):
    __tablename__ = "usage_events"
    __table_args__ = (Index("ix_usage_kind_date", "kind", "created_at"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    session_key: Mapped[str | None] = mapped_column(String(64))
    community_id: Mapped[UUID | None]
    kind: Mapped[str] = mapped_column(String(20))
    page: Mapped[str | None] = mapped_column(String(24))
    target_id: Mapped[UUID | None]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
