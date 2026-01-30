from pydantic import BaseModel
from datetime import datetime


class CalendarBase(BaseModel):
    name: str
    color: str = "#3788d8"
    visible: bool = True


class CalendarResponse(CalendarBase):
    id: str
    caldav_url: str
    can_write: bool
    sync_token: str | None = None
    last_synced: datetime | None = None

    class Config:
        from_attributes = True


class CalendarUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    visible: bool | None = None


class CalendarListResponse(BaseModel):
    calendars: list[CalendarResponse]


class SyncResponse(BaseModel):
    success: bool
    calendars_synced: int = 0
    events_updated: int = 0
    last_sync: datetime | None = None
