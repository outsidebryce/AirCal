import caldav
from caldav import DAVClient, Calendar as DAVCalendar
from datetime import datetime
from typing import Optional
import asyncio
from functools import partial
import logging

from app.config import settings

logger = logging.getLogger(__name__)


class CalDAVService:
    """Service for interacting with Fastmail CalDAV server."""

    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
        # Fastmail requires the full principal URL with the username
        self.base_url = f"https://caldav.fastmail.com/dav/principals/user/{username}/"
        self._client: Optional[DAVClient] = None

    def _get_client(self) -> DAVClient:
        """Create a new CalDAV client."""
        return DAVClient(
            url=self.base_url,
            username=self.username,
            password=self.password,
        )

    def verify_connection(self) -> bool:
        """Verify credentials by attempting to get principal."""
        try:
            client = self._get_client()
            principal = client.principal()
            return principal is not None
        except caldav.error.AuthorizationError:
            logger.warning(f"Authorization failed for user {self.username}")
            return False
        except Exception as e:
            logger.error(f"Connection error: {e}")
            return False

    def get_calendars(self) -> list[DAVCalendar]:
        """Get all calendars for the authenticated user."""
        client = self._get_client()
        principal = client.principal()
        return principal.calendars()

    def get_calendar_by_url(self, url: str) -> Optional[DAVCalendar]:
        """Get a specific calendar by its URL."""
        client = self._get_client()
        try:
            return client.calendar(url=url)
        except Exception as e:
            logger.error(f"Error getting calendar {url}: {e}")
            return None

    def get_events(
        self,
        calendar: DAVCalendar,
        start: datetime,
        end: datetime,
    ) -> list:
        """Get events from a calendar within a date range."""
        try:
            return calendar.search(
                start=start,
                end=end,
                event=True,
                expand=False,  # Don't expand recurring events on server side
            )
        except Exception as e:
            logger.error(f"Error fetching events: {e}")
            return []

    def get_all_events(self, calendar: DAVCalendar) -> list:
        """Get all events from a calendar."""
        try:
            return calendar.events()
        except Exception as e:
            logger.error(f"Error fetching all events: {e}")
            return []

    def create_event(self, calendar: DAVCalendar, ical_data: str) -> Optional[str]:
        """Create a new event in the calendar."""
        try:
            event = calendar.save_event(ical_data)
            return event.url
        except Exception as e:
            logger.error(f"Error creating event: {e}")
            return None

    def update_event(self, calendar: DAVCalendar, href: str, ical_data: str) -> bool:
        """Update an existing event."""
        try:
            event = calendar.event_by_url(href)
            event.data = ical_data
            event.save()
            return True
        except Exception as e:
            logger.error(f"Error updating event: {e}")
            return False

    def delete_event(self, calendar: DAVCalendar, href: str) -> bool:
        """Delete an event from the calendar."""
        try:
            event = calendar.event_by_url(href)
            event.delete()
            return True
        except Exception as e:
            logger.error(f"Error deleting event: {e}")
            return False

    # Async wrappers for FastAPI
    async def async_verify_connection(self) -> bool:
        """Async wrapper for verify_connection."""
        return await asyncio.to_thread(self.verify_connection)

    async def async_get_calendars(self) -> list[DAVCalendar]:
        """Async wrapper for get_calendars."""
        return await asyncio.to_thread(self.get_calendars)

    async def async_get_events(
        self,
        calendar: DAVCalendar,
        start: datetime,
        end: datetime,
    ) -> list:
        """Async wrapper for get_events."""
        return await asyncio.to_thread(
            partial(self.get_events, calendar, start, end)
        )

    async def async_get_all_events(self, calendar: DAVCalendar) -> list:
        """Async wrapper for get_all_events."""
        return await asyncio.to_thread(partial(self.get_all_events, calendar))

    async def async_create_event(
        self, calendar: DAVCalendar, ical_data: str
    ) -> Optional[str]:
        """Async wrapper for create_event."""
        return await asyncio.to_thread(
            partial(self.create_event, calendar, ical_data)
        )

    async def async_update_event(
        self, calendar: DAVCalendar, href: str, ical_data: str
    ) -> bool:
        """Async wrapper for update_event."""
        return await asyncio.to_thread(
            partial(self.update_event, calendar, href, ical_data)
        )

    async def async_delete_event(self, calendar: DAVCalendar, href: str) -> bool:
        """Async wrapper for delete_event."""
        return await asyncio.to_thread(partial(self.delete_event, calendar, href))


# Global service instance (set after authentication)
_caldav_service: Optional[CalDAVService] = None


def get_caldav_service() -> Optional[CalDAVService]:
    """Get the current CalDAV service instance."""
    return _caldav_service


def set_caldav_service(service: Optional[CalDAVService]):
    """Set the CalDAV service instance."""
    global _caldav_service
    _caldav_service = service
