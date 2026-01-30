from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from app.schemas.calendar import SyncResponse
from app.models.database import get_db
from app.models.calendar import Calendar
from app.models.event import Event
from app.services.caldav_service import get_caldav_service
from app.services.icalendar_service import parse_icalendar

router = APIRouter()


@router.post("", response_model=SyncResponse)
async def sync_all_calendars(db: AsyncSession = Depends(get_db)):
    """
    Synchronize all calendars with Fastmail.
    Fetches latest events and updates local cache.
    """
    service = get_caldav_service()

    if not service:
        raise HTTPException(
            status_code=400,
            detail="Not connected to Fastmail. Please connect first.",
        )

    # Get all calendars from database
    result = await db.execute(select(Calendar))
    calendars = result.scalars().all()

    if not calendars:
        raise HTTPException(
            status_code=400,
            detail="No calendars found. Please connect to Fastmail first.",
        )

    calendars_synced = 0
    events_updated = 0

    for calendar in calendars:
        try:
            # Get CalDAV calendar
            dav_calendar = service.get_calendar_by_url(calendar.caldav_url)
            if not dav_calendar:
                continue

            # Fetch all events from server
            dav_events = await service.async_get_all_events(dav_calendar)

            # Track which UIDs we've seen (for deletion detection)
            seen_uids = set()

            for dav_event in dav_events:
                try:
                    # Parse iCalendar data
                    ical_data = dav_event.data
                    if isinstance(ical_data, bytes):
                        ical_data = ical_data.decode("utf-8")

                    parsed = parse_icalendar(ical_data)
                    if not parsed or not parsed.get("uid"):
                        continue

                    uid = parsed["uid"]
                    seen_uids.add(uid)

                    # Check if event exists locally
                    event_result = await db.execute(
                        select(Event).where(
                            Event.uid == uid,
                            Event.calendar_id == calendar.id,
                        )
                    )
                    existing = event_result.scalar_one_or_none()

                    if existing:
                        # Update existing event
                        existing.summary = parsed.get("summary", "")
                        existing.description = parsed.get("description")
                        existing.location = parsed.get("location")
                        existing.start_dt = parsed.get("start_dt")
                        existing.end_dt = parsed.get("end_dt")
                        existing.all_day = parsed.get("all_day", False)
                        existing.rrule = parsed.get("rrule")
                        existing.exdate = parsed.get("exdate")
                        existing.recurrence_id = parsed.get("recurrence_id")
                        existing.icalendar_data = ical_data
                        existing.etag = getattr(dav_event, "etag", None)
                        existing.href = str(dav_event.url) if dav_event.url else None
                        existing.last_modified = parsed.get("last_modified")
                        existing.sync_status = "synced"
                    else:
                        # Create new event
                        new_event = Event(
                            uid=uid,
                            calendar_id=calendar.id,
                            etag=getattr(dav_event, "etag", None),
                            href=str(dav_event.url) if dav_event.url else None,
                            summary=parsed.get("summary", ""),
                            description=parsed.get("description"),
                            location=parsed.get("location"),
                            start_dt=parsed.get("start_dt"),
                            end_dt=parsed.get("end_dt"),
                            all_day=parsed.get("all_day", False),
                            rrule=parsed.get("rrule"),
                            exdate=parsed.get("exdate"),
                            recurrence_id=parsed.get("recurrence_id"),
                            icalendar_data=ical_data,
                            created=parsed.get("created"),
                            last_modified=parsed.get("last_modified"),
                            sequence=parsed.get("sequence", 0),
                            sync_status="synced",
                        )
                        db.add(new_event)

                    events_updated += 1

                except Exception as e:
                    print(f"Error processing event: {e}")
                    continue

            # Delete local events that no longer exist on server
            local_events_result = await db.execute(
                select(Event).where(Event.calendar_id == calendar.id)
            )
            local_events = local_events_result.scalars().all()

            for local_event in local_events:
                if local_event.uid not in seen_uids and local_event.sync_status == "synced":
                    await db.delete(local_event)

            # Update calendar sync timestamp
            calendar.last_synced = datetime.utcnow()
            calendars_synced += 1

        except Exception as e:
            print(f"Error syncing calendar {calendar.id}: {e}")
            continue

    await db.commit()

    return SyncResponse(
        success=True,
        calendars_synced=calendars_synced,
        events_updated=events_updated,
        last_sync=datetime.utcnow(),
    )


@router.get("/status")
async def get_sync_status(db: AsyncSession = Depends(get_db)):
    """Get the status of the last sync."""
    result = await db.execute(
        select(Calendar).order_by(Calendar.last_synced.desc()).limit(1)
    )
    calendar = result.scalar_one_or_none()

    return {
        "last_sync": calendar.last_synced if calendar else None,
        "sync_in_progress": False,
    }
