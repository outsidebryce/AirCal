from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.database import Base


class Calendar(Base):
    __tablename__ = "calendars"

    id = Column(String, primary_key=True)  # CalDAV URL or unique identifier
    caldav_url = Column(String, nullable=False)
    name = Column(String, nullable=False)
    color = Column(String, default="#3788d8")
    visible = Column(Boolean, default=True)
    can_write = Column(Boolean, default=True)
    sync_token = Column(String, nullable=True)
    ctag = Column(String, nullable=True)
    last_synced = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to events
    events = relationship("Event", back_populates="calendar", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Calendar(id={self.id}, name={self.name})>"
