from pydantic import BaseModel
from datetime import datetime
from enum import Enum


class UpdateMode(str, Enum):
    SINGLE = "single"
    THIS_AND_FUTURE = "this_and_future"
    ALL = "all"


class DeleteMode(str, Enum):
    SINGLE = "single"
    THIS_AND_FUTURE = "this_and_future"
    ALL = "all"


class EventBase(BaseModel):
    summary: str
    description: str | None = None
    location: str | None = None
    start: datetime
    end: datetime
    all_day: bool = False
    timezone: str | None = None


class EventCreate(EventBase):
    calendar_id: str
    rrule: str | None = None  # RRULE string for recurring events


class EventUpdate(BaseModel):
    summary: str | None = None
    description: str | None = None
    location: str | None = None
    start: datetime | None = None
    end: datetime | None = None
    all_day: bool | None = None
    timezone: str | None = None
    rrule: str | None = None


class EventResponse(EventBase):
    uid: str
    calendar_id: str
    etag: str | None = None
    rrule: str | None = None
    recurrence_id: str | None = None
    created: datetime | None = None
    last_modified: datetime | None = None

    class Config:
        from_attributes = True


class ExpandedEventResponse(BaseModel):
    """Single instance of an event (recurring events expanded)."""
    uid: str
    calendar_id: str
    summary: str
    description: str | None = None
    location: str | None = None
    start: datetime  # Actual start of this instance
    end: datetime  # Actual end of this instance
    all_day: bool = False
    is_recurring: bool = False
    master_uid: str | None = None  # For recurring event instances
    rrule: str | None = None  # Original RRULE for reference


class EventListResponse(BaseModel):
    events: list[ExpandedEventResponse]


class EventDeleteRequest(BaseModel):
    delete_mode: DeleteMode = DeleteMode.ALL
    occurrence_date: datetime | None = None  # For single instance deletion
