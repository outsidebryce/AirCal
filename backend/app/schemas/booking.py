from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class AvailabilityBlock(BaseModel):
    """A single availability time block."""
    day_of_week: int  # 0=Sunday, 1=Monday, ..., 6=Saturday
    start_time: str  # HH:MM format
    end_time: str  # HH:MM format


class BookingTypeBase(BaseModel):
    name: str
    description: Optional[str] = None
    duration_minutes: int = 30
    location_type: str = "video"  # video, phone, in_person


class BookingTypeCreate(BookingTypeBase):
    availability: list[AvailabilityBlock]


class BookingTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    duration_minutes: Optional[int] = None
    location_type: Optional[str] = None
    availability: Optional[list[AvailabilityBlock]] = None
    active: Optional[bool] = None


class BookingTypeResponse(BookingTypeBase):
    id: str
    calcom_event_type_id: Optional[int] = None
    booking_url: Optional[str] = None
    availability: list[AvailabilityBlock] = []
    active: bool = True
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BookingTypeListResponse(BaseModel):
    booking_types: list[BookingTypeResponse]


class CalcomWebhookPayload(BaseModel):
    """Webhook payload from Cal.com for BOOKING_CREATED event."""
    triggerEvent: str
    createdAt: str
    payload: dict  # Contains booking details
