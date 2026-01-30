from icalendar import Calendar as ICalendar, Event as IEvent, vDatetime, vRecur
from datetime import datetime, date
from typing import Optional
import uuid
from zoneinfo import ZoneInfo

from app.schemas.event import EventCreate, EventUpdate


def parse_icalendar(ical_data: str) -> dict:
    """Parse iCalendar data and extract event properties."""
    from datetime import timedelta
    cal = ICalendar.from_ical(ical_data)

    for component in cal.walk():
        if component.name == "VEVENT":
            # Extract start/end times
            dtstart = component.get("dtstart")
            dtend = component.get("dtend")
            duration = component.get("duration")

            start_dt = dtstart.dt if dtstart else None
            end_dt = dtend.dt if dtend else None

            # Check if all-day event
            all_day = isinstance(start_dt, date) and not isinstance(start_dt, datetime)

            # Handle missing end time
            if end_dt is None and start_dt is not None:
                if duration:
                    # Use duration if provided
                    end_dt = start_dt + duration.dt
                elif all_day:
                    # All-day events default to 1 day duration
                    end_dt = start_dt + timedelta(days=1)
                else:
                    # Timed events without end default to same as start
                    end_dt = start_dt

            # Convert date to datetime if needed
            if all_day and isinstance(start_dt, date) and not isinstance(start_dt, datetime):
                start_dt = datetime.combine(start_dt, datetime.min.time())
            if all_day and isinstance(end_dt, date) and not isinstance(end_dt, datetime):
                end_dt = datetime.combine(end_dt, datetime.min.time())

            # Get recurrence rule
            rrule = component.get("rrule")
            rrule_str = rrule.to_ical().decode() if rrule else None

            # Get EXDATE (excluded dates)
            exdate = component.get("exdate")
            exdate_str = None
            if exdate:
                if isinstance(exdate, list):
                    dates = []
                    for ex in exdate:
                        dates.extend([d.dt.isoformat() for d in ex.dts])
                    exdate_str = ",".join(dates)
                else:
                    exdate_str = ",".join([d.dt.isoformat() for d in exdate.dts])

            return {
                "uid": str(component.get("uid", "")),
                "summary": str(component.get("summary", "")),
                "description": str(component.get("description", "")) or None,
                "location": str(component.get("location", "")) or None,
                "start_dt": start_dt,
                "end_dt": end_dt,
                "all_day": all_day,
                "rrule": rrule_str,
                "exdate": exdate_str,
                "recurrence_id": str(component.get("recurrence-id", "")) or None,
                "created": component.get("created").dt if component.get("created") else None,
                "last_modified": component.get("last-modified").dt if component.get("last-modified") else None,
                "sequence": int(component.get("sequence", 0)),
            }

    return {}


def create_icalendar(event: EventCreate, uid: Optional[str] = None) -> str:
    """Create iCalendar data from an EventCreate schema."""
    cal = ICalendar()
    cal.add("prodid", "-//AirCal//EN")
    cal.add("version", "2.0")

    vevent = IEvent()
    vevent.add("uid", uid or str(uuid.uuid4()))
    vevent.add("summary", event.summary)

    if event.description:
        vevent.add("description", event.description)
    if event.location:
        vevent.add("location", event.location)

    # Handle all-day vs timed events
    if event.all_day:
        vevent.add("dtstart", event.start.date())
        vevent.add("dtend", event.end.date())
    else:
        vevent.add("dtstart", event.start)
        vevent.add("dtend", event.end)

    # Add recurrence rule if provided
    if event.rrule:
        vevent.add("rrule", vRecur.from_ical(event.rrule))

    # Add timestamps
    now = datetime.utcnow()
    vevent.add("created", now)
    vevent.add("last-modified", now)
    vevent.add("dtstamp", now)
    vevent.add("sequence", 0)

    cal.add_component(vevent)
    return cal.to_ical().decode()


def update_icalendar(
    existing_ical: str,
    update: EventUpdate,
) -> str:
    """Update existing iCalendar data with new values."""
    cal = ICalendar.from_ical(existing_ical)

    for component in cal.walk():
        if component.name == "VEVENT":
            if update.summary is not None:
                component["summary"] = update.summary
            if update.description is not None:
                if "description" in component:
                    del component["description"]
                if update.description:
                    component.add("description", update.description)
            if update.location is not None:
                if "location" in component:
                    del component["location"]
                if update.location:
                    component.add("location", update.location)

            if update.start is not None:
                del component["dtstart"]
                if update.all_day:
                    component.add("dtstart", update.start.date())
                else:
                    component.add("dtstart", update.start)

            if update.end is not None:
                del component["dtend"]
                if update.all_day:
                    component.add("dtend", update.end.date())
                else:
                    component.add("dtend", update.end)

            if update.rrule is not None:
                if "rrule" in component:
                    del component["rrule"]
                if update.rrule:
                    component.add("rrule", vRecur.from_ical(update.rrule))

            # Update modification timestamp and sequence
            if "last-modified" in component:
                del component["last-modified"]
            component.add("last-modified", datetime.utcnow())

            sequence = int(component.get("sequence", 0))
            if "sequence" in component:
                del component["sequence"]
            component.add("sequence", sequence + 1)

            break

    return cal.to_ical().decode()
