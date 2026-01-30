from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.database import Base


class Event(Base):
    __tablename__ = "events"

    # Composite primary key: uid + calendar_id
    uid = Column(String, primary_key=True)
    calendar_id = Column(String, ForeignKey("calendars.id", ondelete="CASCADE"), primary_key=True)

    # CalDAV metadata
    etag = Column(String, nullable=True)
    href = Column(String, nullable=True)

    # Core event properties
    summary = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    start_dt = Column(DateTime, nullable=False)
    end_dt = Column(DateTime, nullable=False)
    all_day = Column(Boolean, default=False)
    timezone = Column(String, nullable=True)

    # Recurrence
    rrule = Column(String, nullable=True)  # RRULE string
    rdate = Column(Text, nullable=True)  # Comma-separated ISO8601 dates
    exdate = Column(Text, nullable=True)  # Comma-separated ISO8601 dates
    recurrence_id = Column(String, nullable=True)  # For modified instances

    # Raw iCalendar data for round-tripping
    icalendar_data = Column(Text, nullable=False)

    # iCalendar metadata
    created = Column(DateTime, nullable=True)
    last_modified = Column(DateTime, nullable=True)
    sequence = Column(Integer, default=0)

    # Local sync state
    sync_status = Column(String, default="synced")  # synced, pending_create, pending_update, pending_delete
    local_modified = Column(DateTime, nullable=True)

    # Relationship
    calendar = relationship("Calendar", back_populates="events")

    __table_args__ = (
        Index("idx_events_date_range", "calendar_id", "start_dt", "end_dt"),
        Index("idx_events_sync_status", "sync_status"),
    )

    def __repr__(self):
        return f"<Event(uid={self.uid}, summary={self.summary})>"


class Settings(Base):
    """Application settings stored in database."""
    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
