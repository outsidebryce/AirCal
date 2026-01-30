from datetime import datetime, timedelta, timezone, date
from typing import List
from icalendar import Calendar as ICalendar
import recurring_ical_events

from app.models.event import Event
from app.schemas.event import ExpandedEventResponse


def make_naive(dt: datetime) -> datetime:
    """Convert timezone-aware datetime to naive (UTC)."""
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


def make_aware(dt: datetime) -> datetime:
    """Convert naive datetime to UTC-aware."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def expand_recurring_events(
    events: List[Event],
    start: datetime,
    end: datetime,
) -> List[ExpandedEventResponse]:
    """
    Expand recurring events into individual instances within a date range.

    Uses the recurring-ical-events library to properly handle RRULE,
    RDATE, and EXDATE.
    """
    expanded = []

    # Make start/end timezone-aware for comparison
    start_aware = make_aware(start)
    end_aware = make_aware(end)

    for event in events:
        if event.rrule:
            # This is a recurring event - expand it
            try:
                # Parse the iCalendar data
                cal = ICalendar.from_ical(event.icalendar_data)

                # Get all instances in the date range
                instances = recurring_ical_events.of(cal).between(start_aware, end_aware)

                for instance in instances:
                    # Get instance start/end times
                    instance_start = instance.get("dtstart").dt
                    instance_end = instance.get("dtend")
                    instance_end = instance_end.dt if instance_end else instance_start

                    # Convert date to datetime if needed
                    if isinstance(instance_start, date) and not isinstance(instance_start, datetime):
                        instance_start = datetime.combine(instance_start, datetime.min.time())
                    if isinstance(instance_end, date) and not isinstance(instance_end, datetime):
                        instance_end = datetime.combine(instance_end, datetime.min.time())

                    # Make naive for storage/response
                    instance_start = make_naive(instance_start)
                    instance_end = make_naive(instance_end)

                    expanded.append(
                        ExpandedEventResponse(
                            uid=event.uid,
                            calendar_id=event.calendar_id,
                            summary=event.summary,
                            description=event.description,
                            location=event.location,
                            start=instance_start,
                            end=instance_end,
                            all_day=event.all_day,
                            is_recurring=True,
                            master_uid=event.uid,
                            rrule=event.rrule,
                        )
                    )
            except Exception as e:
                # If expansion fails, include the original event
                print(f"Error expanding recurring event {event.uid}: {e}")
                expanded.append(
                    ExpandedEventResponse(
                        uid=event.uid,
                        calendar_id=event.calendar_id,
                        summary=event.summary,
                        description=event.description,
                        location=event.location,
                        start=event.start_dt,
                        end=event.end_dt,
                        all_day=event.all_day,
                        is_recurring=True,
                        master_uid=event.uid,
                        rrule=event.rrule,
                    )
                )
        else:
            # Non-recurring event
            expanded.append(
                ExpandedEventResponse(
                    uid=event.uid,
                    calendar_id=event.calendar_id,
                    summary=event.summary,
                    description=event.description,
                    location=event.location,
                    start=event.start_dt,
                    end=event.end_dt,
                    all_day=event.all_day,
                    is_recurring=False,
                    master_uid=None,
                    rrule=None,
                )
            )

    # Sort by start time
    expanded.sort(key=lambda e: e.start)

    return expanded
