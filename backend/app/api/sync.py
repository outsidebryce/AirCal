from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import logging

from app.schemas.calendar import SyncResponse
from app.models.database import get_db
from app.models.calendar import Calendar
from app.models.event import Event
from app.services.caldav_service import get_caldav_service
from app.services.icalendar_service import parse_icalendar
from app.services.sync_scheduler import get_sync_status as get_scheduler_status

router = APIRouter()
logger = logging.getLogger(__name__)


async def do_sync(db: AsyncSession) -> SyncResponse:
    """
    Core sync logic - can be called from API or background scheduler.
    Returns SyncResponse with results.
    Raises ValueError if not connected or no calendars.
    """
    service = get_caldav_service()

    if not service:
        raise ValueError("Not connected to Fastmail")

    # Get all calendars from database
    result = await db.execute(select(Calendar))
    calendars = result.scalars().all()

    if not calendars:
        raise ValueError("No calendars found")

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
                        # Check if there are pending local changes
                        if existing.sync_status in ("pending_update", "pending_create"):
                            logger.info(
                                f"Skipping server update for event {uid} - has pending local changes "
                                f"(sync_status={existing.sync_status})"
                            )
                            # Try to push local changes to server
                            if existing.sync_status == "pending_update" and existing.href:
                                try:
                                    success = await service.async_update_event(
                                        dav_calendar, existing.href, existing.icalendar_data
                                    )
                                    if success:
                                        existing.sync_status = "synced"
                                        logger.info(f"Successfully pushed pending changes for event {uid}")
                                    else:
                                        logger.warning(f"Failed to push pending changes for event {uid}")
                                except Exception as e:
                                    logger.warning(f"Error pushing pending changes for event {uid}: {e}")
                        else:
                            # Update existing event from server
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
                    logger.warning(f"Error processing event: {e}")
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
            logger.warning(f"Error syncing calendar {calendar.id}: {e}")
            continue

    await db.commit()

    return SyncResponse(
        success=True,
        calendars_synced=calendars_synced,
        events_updated=events_updated,
        last_sync=datetime.utcnow(),
    )


@router.post("", response_model=SyncResponse)
async def sync_all_calendars(db: AsyncSession = Depends(get_db)):
    """
    Synchronize all calendars with Fastmail.
    Fetches latest events and updates local cache.
    """
    try:
        return await do_sync(db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/status")
async def get_sync_status():
    """Get the status of the last sync."""
    return get_scheduler_status()
