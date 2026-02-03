from fastapi import APIRouter, HTTPException, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import json
import uuid
import re
import hmac
import hashlib
import logging

from app.schemas.booking import (
    BookingTypeCreate,
    BookingTypeUpdate,
    BookingTypeResponse,
    BookingTypeListResponse,
    AvailabilityBlock,
)
from app.models.database import get_db
from app.models.booking import BookingType
from app.services.calcom_service import get_calcom_service
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


def availability_to_json(availability: list[AvailabilityBlock]) -> str:
    """Convert availability blocks to JSON string."""
    return json.dumps([block.model_dump() for block in availability])


def json_to_availability(json_str: str | None) -> list[AvailabilityBlock]:
    """Convert JSON string to availability blocks."""
    if not json_str:
        return []
    try:
        data = json.loads(json_str)
        return [AvailabilityBlock(**block) for block in data]
    except (json.JSONDecodeError, ValueError):
        return []


def create_slug(name: str) -> str:
    """Create a URL-safe slug from a name."""
    # Convert to lowercase, replace spaces with hyphens, remove non-alphanumeric
    slug = name.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    slug = slug.strip('-')
    # Add unique suffix to avoid collisions
    return f"{slug}-{uuid.uuid4().hex[:6]}"


@router.get("", response_model=BookingTypeListResponse)
async def list_booking_types(
    db: AsyncSession = Depends(get_db),
):
    """Get all booking types."""
    result = await db.execute(select(BookingType).order_by(BookingType.created_at.desc()))
    booking_types = result.scalars().all()

    return BookingTypeListResponse(
        booking_types=[
            BookingTypeResponse(
                id=bt.id,
                name=bt.name,
                description=bt.description,
                duration_minutes=bt.duration_minutes,
                location_type=bt.location_type,
                calcom_event_type_id=bt.calcom_event_type_id,
                booking_url=bt.booking_url,
                availability=json_to_availability(bt.availability_json),
                active=bt.active,
                created_at=bt.created_at,
                updated_at=bt.updated_at,
            )
            for bt in booking_types
        ]
    )


@router.post("", response_model=BookingTypeResponse)
async def create_booking_type(
    booking_type: BookingTypeCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new booking type.

    This creates a local booking type record and optionally syncs with Cal.com
    to create an event type.
    """
    calcom_service = get_calcom_service()

    # Create local booking type
    bt_id = str(uuid.uuid4())
    calcom_event_type_id = None
    booking_url = None

    # Try to create on Cal.com if configured
    if calcom_service.is_configured:
        slug = create_slug(booking_type.name)

        # Create event type on Cal.com
        event_type_data = await calcom_service.create_event_type(
            title=booking_type.name,
            slug=slug,
            description=booking_type.description,
            duration_minutes=booking_type.duration_minutes,
            location_type=booking_type.location_type,
        )

        if event_type_data:
            calcom_event_type_id = event_type_data.get("id")
            # Construct booking URL
            user_info = await calcom_service.get_me()
            if user_info and user_info.get("user"):
                username = user_info["user"].get("username")
                if username:
                    booking_url = f"https://cal.com/{username}/{slug}"

            # Create schedule with availability
            if booking_type.availability:
                availability_data = [
                    {
                        "day_of_week": block.day_of_week,
                        "start_time": block.start_time,
                        "end_time": block.end_time,
                    }
                    for block in booking_type.availability
                ]
                await calcom_service.create_schedule(
                    name=f"{booking_type.name} Schedule",
                    availability=availability_data,
                )

    # Create local record
    db_booking_type = BookingType(
        id=bt_id,
        calcom_event_type_id=calcom_event_type_id,
        name=booking_type.name,
        description=booking_type.description,
        duration_minutes=booking_type.duration_minutes,
        location_type=booking_type.location_type,
        booking_url=booking_url,
        availability_json=availability_to_json(booking_type.availability),
        active=True,
    )

    db.add(db_booking_type)
    await db.commit()
    await db.refresh(db_booking_type)

    return BookingTypeResponse(
        id=db_booking_type.id,
        name=db_booking_type.name,
        description=db_booking_type.description,
        duration_minutes=db_booking_type.duration_minutes,
        location_type=db_booking_type.location_type,
        calcom_event_type_id=db_booking_type.calcom_event_type_id,
        booking_url=db_booking_type.booking_url,
        availability=json_to_availability(db_booking_type.availability_json),
        active=db_booking_type.active,
        created_at=db_booking_type.created_at,
        updated_at=db_booking_type.updated_at,
    )


@router.get("/{booking_type_id}", response_model=BookingTypeResponse)
async def get_booking_type(
    booking_type_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single booking type by ID."""
    result = await db.execute(
        select(BookingType).where(BookingType.id == booking_type_id)
    )
    bt = result.scalar_one_or_none()

    if not bt:
        raise HTTPException(status_code=404, detail="Booking type not found")

    return BookingTypeResponse(
        id=bt.id,
        name=bt.name,
        description=bt.description,
        duration_minutes=bt.duration_minutes,
        location_type=bt.location_type,
        calcom_event_type_id=bt.calcom_event_type_id,
        booking_url=bt.booking_url,
        availability=json_to_availability(bt.availability_json),
        active=bt.active,
        created_at=bt.created_at,
        updated_at=bt.updated_at,
    )


@router.put("/{booking_type_id}", response_model=BookingTypeResponse)
async def update_booking_type(
    booking_type_id: str,
    update: BookingTypeUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a booking type."""
    result = await db.execute(
        select(BookingType).where(BookingType.id == booking_type_id)
    )
    bt = result.scalar_one_or_none()

    if not bt:
        raise HTTPException(status_code=404, detail="Booking type not found")

    # Update local fields
    if update.name is not None:
        bt.name = update.name
    if update.description is not None:
        bt.description = update.description
    if update.duration_minutes is not None:
        bt.duration_minutes = update.duration_minutes
    if update.location_type is not None:
        bt.location_type = update.location_type
    if update.availability is not None:
        bt.availability_json = availability_to_json(update.availability)
    if update.active is not None:
        bt.active = update.active

    bt.updated_at = datetime.utcnow()

    # Update on Cal.com if configured and linked
    calcom_service = get_calcom_service()
    if calcom_service.is_configured and bt.calcom_event_type_id:
        update_data = {}
        if update.name is not None:
            update_data["title"] = update.name
        if update.description is not None:
            update_data["description"] = update.description
        if update.duration_minutes is not None:
            update_data["length"] = update.duration_minutes

        if update_data:
            await calcom_service.update_event_type(
                bt.calcom_event_type_id,
                **update_data,
            )

    await db.commit()
    await db.refresh(bt)

    return BookingTypeResponse(
        id=bt.id,
        name=bt.name,
        description=bt.description,
        duration_minutes=bt.duration_minutes,
        location_type=bt.location_type,
        calcom_event_type_id=bt.calcom_event_type_id,
        booking_url=bt.booking_url,
        availability=json_to_availability(bt.availability_json),
        active=bt.active,
        created_at=bt.created_at,
        updated_at=bt.updated_at,
    )


@router.delete("/{booking_type_id}")
async def delete_booking_type(
    booking_type_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a booking type."""
    result = await db.execute(
        select(BookingType).where(BookingType.id == booking_type_id)
    )
    bt = result.scalar_one_or_none()

    if not bt:
        raise HTTPException(status_code=404, detail="Booking type not found")

    # Delete from Cal.com if configured and linked
    calcom_service = get_calcom_service()
    if calcom_service.is_configured and bt.calcom_event_type_id:
        await calcom_service.delete_event_type(bt.calcom_event_type_id)

    await db.delete(bt)
    await db.commit()

    return {"success": True, "message": "Booking type deleted"}


@router.post("/webhook")
async def calcom_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Handle webhooks from Cal.com.

    When a booking is created, we create a corresponding event in the calendar.
    """
    # Verify webhook signature if secret is configured
    if settings.CALCOM_WEBHOOK_SECRET:
        signature = request.headers.get("x-cal-signature-256")
        if signature:
            body = await request.body()
            expected = hmac.new(
                settings.CALCOM_WEBHOOK_SECRET.encode(),
                body,
                hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(signature, expected):
                raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    trigger_event = payload.get("triggerEvent")
    logger.info(f"Received Cal.com webhook: {trigger_event}")

    if trigger_event == "BOOKING_CREATED":
        booking_data = payload.get("payload", {})

        # Extract booking details
        title = booking_data.get("title", "Cal.com Booking")
        start_time = booking_data.get("startTime")
        end_time = booking_data.get("endTime")
        attendee_name = None
        attendee_email = None

        attendees = booking_data.get("attendees", [])
        if attendees:
            attendee_name = attendees[0].get("name")
            attendee_email = attendees[0].get("email")

        # Log booking info (actual calendar event creation would require
        # selecting a target calendar and using the events API)
        logger.info(
            f"New booking: {title} from {start_time} to {end_time} "
            f"with {attendee_name} ({attendee_email})"
        )

        # TODO: Create event in calendar
        # This requires knowing which calendar to add the event to.
        # Could be configured per booking type or use a default calendar.

    elif trigger_event == "BOOKING_CANCELLED":
        booking_data = payload.get("payload", {})
        logger.info(f"Booking cancelled: {booking_data.get('uid')}")
        # TODO: Remove or mark event as cancelled

    return {"success": True, "message": f"Processed {trigger_event}"}
