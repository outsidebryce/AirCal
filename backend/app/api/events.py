from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from datetime import datetime, timedelta
from typing import Optional
import uuid
import logging

logger = logging.getLogger(__name__)

from app.schemas.event import (
    EventCreate,
    EventUpdate,
    EventResponse,
    ExpandedEventResponse,
    EventListResponse,
    EventDeleteRequest,
    UpdateMode,
    DeleteMode,
)
from app.models.database import get_db
from app.models.event import Event
from app.models.calendar import Calendar
from app.services.caldav_service import get_caldav_service
from app.services.icalendar_service import (
    parse_icalendar,
    create_icalendar,
    update_icalendar,
)
from app.services.recurrence_service import expand_recurring_events

router = APIRouter()


@router.get("", response_model=EventListResponse)
async def list_events(
    start: datetime = Query(..., description="Start of date range"),
    end: datetime = Query(..., description="End of date range"),
    calendar_ids: Optional[str] = Query(
        None, description="Comma-separated calendar IDs to filter"
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all events within a date range.
    Recurring events are expanded into individual instances.
    """
    # Parse calendar IDs if provided
    cal_ids = calendar_ids.split(",") if calendar_ids else None

    # Build query
    query = select(Event)

    if cal_ids:
        query = query.where(Event.calendar_id.in_(cal_ids))

    # Get events that might fall within the range
    # For recurring events: include if they start before end (could have instances in range)
    # For non-recurring: include if they overlap the range
    query = query.where(
        and_(
            Event.start_dt <= end,
            or_(
                Event.rrule.isnot(None),  # Recurring events - let expansion filter them
                Event.end_dt >= start,     # Non-recurring events must overlap
            ),
        )
    )

    result = await db.execute(query)
    events = result.scalars().all()

    # Expand recurring events
    expanded = expand_recurring_events(events, start, end)

    return EventListResponse(events=expanded)


@router.get("/{event_uid}", response_model=EventResponse)
async def get_event(
    event_uid: str,
    calendar_id: str = Query(..., description="Calendar ID"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single event by UID."""
    result = await db.execute(
        select(Event).where(
            and_(Event.uid == event_uid, Event.calendar_id == calendar_id)
        )
    )
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    return EventResponse(
        uid=event.uid,
        calendar_id=event.calendar_id,
        summary=event.summary,
        description=event.description,
        location=event.location,
        start=event.start_dt,
        end=event.end_dt,
        all_day=event.all_day,
        timezone=event.timezone,
        etag=event.etag,
        rrule=event.rrule,
        recurrence_id=event.recurrence_id,
        created=event.created,
        last_modified=event.last_modified,
    )


@router.post("", response_model=EventResponse)
async def create_event(
    event: EventCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new event."""
    # Verify calendar exists
    result = await db.execute(
        select(Calendar).where(Calendar.id == event.calendar_id)
    )
    calendar = result.scalar_one_or_none()

    if not calendar:
        raise HTTPException(status_code=404, detail="Calendar not found")

    # Generate UID and iCalendar data
    uid = str(uuid.uuid4())
    ical_data = create_icalendar(event, uid)

    # Try to create on CalDAV server first
    service = get_caldav_service()
    href = None

    if service:
        dav_calendar = service.get_calendar_by_url(calendar.caldav_url)
        if dav_calendar:
            href = await service.async_create_event(dav_calendar, ical_data)

    # Create local event
    db_event = Event(
        uid=uid,
        calendar_id=event.calendar_id,
        href=href,
        summary=event.summary,
        description=event.description,
        location=event.location,
        start_dt=event.start,
        end_dt=event.end,
        all_day=event.all_day,
        timezone=event.timezone,
        rrule=event.rrule,
        icalendar_data=ical_data,
        created=datetime.utcnow(),
        last_modified=datetime.utcnow(),
        sync_status="synced" if href else "pending_create",
    )

    db.add(db_event)
    await db.commit()
    await db.refresh(db_event)

    return EventResponse(
        uid=db_event.uid,
        calendar_id=db_event.calendar_id,
        summary=db_event.summary,
        description=db_event.description,
        location=db_event.location,
        start=db_event.start_dt,
        end=db_event.end_dt,
        all_day=db_event.all_day,
        timezone=db_event.timezone,
        etag=db_event.etag,
        rrule=db_event.rrule,
        recurrence_id=db_event.recurrence_id,
        created=db_event.created,
        last_modified=db_event.last_modified,
    )


@router.put("/{event_uid}", response_model=EventResponse)
async def update_event(
    event_uid: str,
    update: EventUpdate,
    calendar_id: str = Query(..., description="Calendar ID"),
    update_mode: UpdateMode = Query(
        UpdateMode.ALL, description="How to update recurring events"
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Update an event.

    For recurring events:
    - ALL: Update the master event (all instances)
    - SINGLE: Create an exception for this instance only
    - THIS_AND_FUTURE: Split the series at this point
    """
    logger.info(f"Updating event {event_uid} with data: {update}")

    result = await db.execute(
        select(Event).where(
            and_(Event.uid == event_uid, Event.calendar_id == calendar_id)
        )
    )
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    logger.info(f"Found event: {event.summary}, href={event.href}, current start={event.start_dt}, end={event.end_dt}")

    # Update iCalendar data
    new_ical = update_icalendar(event.icalendar_data, update)
    logger.debug(f"Updated iCalendar data: {new_ical[:500]}...")

    # Update local fields
    if update.summary is not None:
        event.summary = update.summary
    if update.description is not None:
        event.description = update.description
    if update.location is not None:
        event.location = update.location
    if update.start is not None:
        logger.info(f"Updating start from {event.start_dt} to {update.start}")
        event.start_dt = update.start
    if update.end is not None:
        logger.info(f"Updating end from {event.end_dt} to {update.end}")
        event.end_dt = update.end
    if update.all_day is not None:
        event.all_day = update.all_day
    if update.timezone is not None:
        event.timezone = update.timezone
    if update.rrule is not None:
        event.rrule = update.rrule

    event.icalendar_data = new_ical
    event.last_modified = datetime.utcnow()
    event.sync_status = "pending_update"

    # Try to update on CalDAV server
    service = get_caldav_service()
    logger.info(f"CalDAV service available: {service is not None}, event.href: {event.href}")

    if service and event.href:
        result_cal = await db.execute(
            select(Calendar).where(Calendar.id == calendar_id)
        )
        calendar = result_cal.scalar_one_or_none()

        if calendar:
            logger.info(f"Calendar found: {calendar.name}, caldav_url: {calendar.caldav_url}")
            dav_calendar = service.get_calendar_by_url(calendar.caldav_url)
            if dav_calendar:
                logger.info(f"DAV calendar obtained, attempting update...")
                success = await service.async_update_event(
                    dav_calendar, event.href, new_ical
                )
                logger.info(f"CalDAV update result: {success}")
                if success:
                    event.sync_status = "synced"
            else:
                logger.warning(f"Could not get DAV calendar for URL: {calendar.caldav_url}")
        else:
            logger.warning(f"Calendar not found for id: {calendar_id}")
    else:
        if not service:
            logger.warning("CalDAV service not available - event will be updated locally only")
        if not event.href:
            logger.warning(f"Event has no href - cannot update on CalDAV server")

    await db.commit()
    await db.refresh(event)
    logger.info(f"Event updated successfully. Final start={event.start_dt}, end={event.end_dt}, sync_status={event.sync_status}")

    return EventResponse(
        uid=event.uid,
        calendar_id=event.calendar_id,
        summary=event.summary,
        description=event.description,
        location=event.location,
        start=event.start_dt,
        end=event.end_dt,
        all_day=event.all_day,
        timezone=event.timezone,
        etag=event.etag,
        rrule=event.rrule,
        recurrence_id=event.recurrence_id,
        created=event.created,
        last_modified=event.last_modified,
    )


@router.delete("/{event_uid}")
async def delete_event(
    event_uid: str,
    calendar_id: str = Query(..., description="Calendar ID"),
    delete_mode: DeleteMode = Query(
        DeleteMode.ALL, description="How to delete recurring events"
    ),
    occurrence_date: Optional[datetime] = Query(
        None, description="For single instance deletion of recurring events"
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete an event.

    For recurring events:
    - ALL: Delete the entire series
    - SINGLE: Add EXDATE to exclude this instance
    - THIS_AND_FUTURE: Add UNTIL to end the series before this date
    """
    result = await db.execute(
        select(Event).where(
            and_(Event.uid == event_uid, Event.calendar_id == calendar_id)
        )
    )
    event = result.scalar_one_or_none()

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Try to delete on CalDAV server
    service = get_caldav_service()
    if service and event.href:
        result_cal = await db.execute(
            select(Calendar).where(Calendar.id == calendar_id)
        )
        calendar = result_cal.scalar_one_or_none()

        if calendar:
            dav_calendar = service.get_calendar_by_url(calendar.caldav_url)
            if dav_calendar:
                await service.async_delete_event(dav_calendar, event.href)

    # Delete locally
    await db.delete(event)
    await db.commit()

    return {"success": True, "message": "Event deleted"}
