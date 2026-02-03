"""
Cal.com API Service

Handles communication with the Cal.com API for creating and managing
event types and schedules.
"""

import httpx
from typing import Optional
import logging

from app.config import settings

logger = logging.getLogger(__name__)


class CalcomService:
    """Service for interacting with the Cal.com API."""

    def __init__(self):
        self.api_key = settings.CALCOM_API_KEY
        self.base_url = settings.CALCOM_API_URL
        self.headers = {
            "Content-Type": "application/json",
        }

    @property
    def is_configured(self) -> bool:
        """Check if Cal.com API is configured."""
        return bool(self.api_key)

    def _get_params(self) -> dict:
        """Get query params with API key."""
        return {"apiKey": self.api_key}

    async def get_me(self) -> Optional[dict]:
        """Get current user info to verify API key."""
        if not self.is_configured:
            return None

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/me",
                    params=self._get_params(),
                    headers=self.headers,
                )
                response.raise_for_status()
                return response.json()
            except Exception as e:
                logger.error(f"Failed to get Cal.com user info: {e}")
                return None

    async def create_event_type(
        self,
        title: str,
        slug: str,
        description: Optional[str],
        duration_minutes: int,
        location_type: str,
    ) -> Optional[dict]:
        """
        Create an event type on Cal.com.

        Returns the created event type data including ID and booking URL.
        """
        if not self.is_configured:
            logger.warning("Cal.com API key not configured")
            return None

        # Map location type to Cal.com locations format
        locations = []
        if location_type == "video":
            locations = [{"type": "integrations:daily"}]  # Cal.com's default video
        elif location_type == "phone":
            locations = [{"type": "phone", "phone": ""}]
        elif location_type == "in_person":
            locations = [{"type": "inPerson", "address": ""}]

        payload = {
            "title": title,
            "slug": slug,
            "description": description or "",
            "length": duration_minutes,
            "locations": locations,
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/event-types",
                    params=self._get_params(),
                    headers=self.headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                logger.info(f"Created Cal.com event type: {data.get('event_type', {}).get('id')}")
                return data.get("event_type")
            except httpx.HTTPStatusError as e:
                logger.error(f"Cal.com API error: {e.response.status_code} - {e.response.text}")
                return None
            except Exception as e:
                logger.error(f"Failed to create Cal.com event type: {e}")
                return None

    async def create_schedule(
        self,
        name: str,
        availability: list[dict],
    ) -> Optional[dict]:
        """
        Create an availability schedule on Cal.com.

        availability: list of {dayOfWeek: int, startTime: str, endTime: str}
        """
        if not self.is_configured:
            return None

        # Convert to Cal.com schedule format
        # Cal.com expects: {name, timeZone, availability: [{days: [int], startTime, endTime}]}

        # Group by time slot
        time_slots: dict[str, list[int]] = {}
        for block in availability:
            key = f"{block['start_time']}-{block['end_time']}"
            if key not in time_slots:
                time_slots[key] = []
            time_slots[key].append(block['day_of_week'])

        schedule_availability = [
            {
                "days": days,
                "startTime": slot.split("-")[0],
                "endTime": slot.split("-")[1],
            }
            for slot, days in time_slots.items()
        ]

        payload = {
            "name": name,
            "timeZone": "America/New_York",  # TODO: Make configurable
            "availability": schedule_availability,
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{self.base_url}/schedules",
                    params=self._get_params(),
                    headers=self.headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                logger.info(f"Created Cal.com schedule: {data.get('schedule', {}).get('id')}")
                return data.get("schedule")
            except httpx.HTTPStatusError as e:
                logger.error(f"Cal.com API error: {e.response.status_code} - {e.response.text}")
                return None
            except Exception as e:
                logger.error(f"Failed to create Cal.com schedule: {e}")
                return None

    async def update_event_type(
        self,
        event_type_id: int,
        **kwargs,
    ) -> Optional[dict]:
        """Update an existing event type."""
        if not self.is_configured:
            return None

        async with httpx.AsyncClient() as client:
            try:
                response = await client.patch(
                    f"{self.base_url}/event-types/{event_type_id}",
                    params=self._get_params(),
                    headers=self.headers,
                    json=kwargs,
                )
                response.raise_for_status()
                return response.json().get("event_type")
            except Exception as e:
                logger.error(f"Failed to update Cal.com event type: {e}")
                return None

    async def delete_event_type(self, event_type_id: int) -> bool:
        """Delete an event type from Cal.com."""
        if not self.is_configured:
            return False

        async with httpx.AsyncClient() as client:
            try:
                response = await client.delete(
                    f"{self.base_url}/event-types/{event_type_id}",
                    params=self._get_params(),
                    headers=self.headers,
                )
                response.raise_for_status()
                logger.info(f"Deleted Cal.com event type: {event_type_id}")
                return True
            except Exception as e:
                logger.error(f"Failed to delete Cal.com event type: {e}")
                return False

    async def get_event_types(self) -> list[dict]:
        """Get all event types for the user."""
        if not self.is_configured:
            return []

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{self.base_url}/event-types",
                    params=self._get_params(),
                    headers=self.headers,
                )
                response.raise_for_status()
                return response.json().get("event_types", [])
            except Exception as e:
                logger.error(f"Failed to get Cal.com event types: {e}")
                return []


# Singleton instance
_calcom_service: Optional[CalcomService] = None


def get_calcom_service() -> CalcomService:
    """Get the Cal.com service instance."""
    global _calcom_service
    if _calcom_service is None:
        _calcom_service = CalcomService()
    return _calcom_service
