from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.schemas.calendar import (
    CalendarResponse,
    CalendarListResponse,
    CalendarUpdate,
)
from app.models.database import get_db
from app.models.calendar import Calendar
from app.services.caldav_service import get_caldav_service

router = APIRouter()


@router.get("", response_model=CalendarListResponse)
async def list_calendars(db: AsyncSession = Depends(get_db)):
    """List all calendars from the local cache."""
    result = await db.execute(select(Calendar).order_by(Calendar.name))
    calendars = result.scalars().all()

    return CalendarListResponse(
        calendars=[CalendarResponse.model_validate(cal) for cal in calendars]
    )


@router.get("/{calendar_id}", response_model=CalendarResponse)
async def get_calendar(
    calendar_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific calendar by ID."""
    result = await db.execute(select(Calendar).where(Calendar.id == calendar_id))
    calendar = result.scalar_one_or_none()

    if not calendar:
        raise HTTPException(status_code=404, detail="Calendar not found")

    return CalendarResponse.model_validate(calendar)


@router.put("/{calendar_id}", response_model=CalendarResponse)
async def update_calendar(
    calendar_id: str,
    update: CalendarUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update calendar local preferences (name, color, visibility)."""
    result = await db.execute(select(Calendar).where(Calendar.id == calendar_id))
    calendar = result.scalar_one_or_none()

    if not calendar:
        raise HTTPException(status_code=404, detail="Calendar not found")

    # Update only provided fields
    if update.name is not None:
        calendar.name = update.name
    if update.color is not None:
        calendar.color = update.color
    if update.visible is not None:
        calendar.visible = update.visible

    await db.commit()
    await db.refresh(calendar)

    return CalendarResponse.model_validate(calendar)
