from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text
from datetime import datetime
import uuid

from app.models.database import Base


class BookingType(Base):
    """Booking type linked to Cal.com event type."""
    __tablename__ = "booking_types"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    calcom_event_type_id = Column(Integer, nullable=True)  # Cal.com's ID
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    duration_minutes = Column(Integer, default=30)
    location_type = Column(String, default="video")  # video, phone, in_person
    booking_url = Column(String, nullable=True)  # Cal.com public link
    availability_json = Column(Text, nullable=True)  # JSON: [{dayOfWeek, startTime, endTime}]
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<BookingType(id={self.id}, name={self.name})>"
