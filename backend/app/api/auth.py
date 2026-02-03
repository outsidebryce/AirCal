from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
import hashlib

from app.schemas.auth import (
    ConnectRequest,
    ConnectResponse,
    AuthStatusResponse,
    DisconnectResponse,
)
from app.schemas.calendar import CalendarResponse
from app.services.caldav_service import (
    CalDAVService,
    get_caldav_service,
    set_caldav_service,
)
from app.services.credential_service import (
    save_credentials,
    clear_credentials,
)
from app.services.sync_scheduler import start_sync_scheduler, stop_sync_scheduler
from app.models.database import get_db
from app.models.calendar import Calendar

router = APIRouter()


@router.post("/connect", response_model=ConnectResponse)
async def connect_to_fastmail(
    request: ConnectRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Connect to Fastmail CalDAV server and discover calendars.

    Requires a Fastmail app-specific password (not your main password).
    Create one at: Fastmail Settings -> Privacy & Security -> App Passwords
    """
    # Create CalDAV service
    service = CalDAVService(request.username, request.app_password)

    # Verify connection
    if not await service.async_verify_connection():
        raise HTTPException(
            status_code=401,
            detail="Failed to connect to Fastmail. Check your username and app password.",
        )

    # Get calendars
    try:
        dav_calendars = await service.async_get_calendars()
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Connected but failed to fetch calendars: {str(e)}",
        )

    # Store service globally
    set_caldav_service(service)

    # Save credentials for persistent authentication
    await save_credentials(db, request.username, request.app_password)

    # Save calendars to database
    for dav_cal in dav_calendars:
        # Generate a unique ID from the URL
        cal_id = hashlib.md5(str(dav_cal.url).encode()).hexdigest()[:16]

        # Check if calendar already exists
        from sqlalchemy import select
        result = await db.execute(select(Calendar).where(Calendar.id == cal_id))
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing calendar
            existing.caldav_url = str(dav_cal.url)
            existing.name = dav_cal.name or "Unnamed Calendar"
        else:
            # Create new calendar
            calendar = Calendar(
                id=cal_id,
                caldav_url=str(dav_cal.url),
                name=dav_cal.name or "Unnamed Calendar",
                color="#3788d8",
                visible=True,
                can_write=True,
            )
            db.add(calendar)

    await db.commit()

    # Start background sync scheduler
    await start_sync_scheduler()

    return ConnectResponse(
        success=True,
        message=f"Connected to Fastmail. Found {len(dav_calendars)} calendar(s).",
        calendars_count=len(dav_calendars),
    )


@router.get("/status", response_model=AuthStatusResponse)
async def get_auth_status():
    """Check if connected to Fastmail."""
    service = get_caldav_service()

    if service is None:
        return AuthStatusResponse(connected=False)

    return AuthStatusResponse(
        connected=True,
        username=service.username,
    )


@router.post("/disconnect", response_model=DisconnectResponse)
async def disconnect_from_fastmail(
    db: AsyncSession = Depends(get_db),
):
    """Disconnect from Fastmail (clear credentials)."""
    # Stop the sync scheduler
    await stop_sync_scheduler()

    # Clear the CalDAV service
    set_caldav_service(None)

    # Clear stored credentials
    await clear_credentials(db)

    return DisconnectResponse(
        success=True,
        message="Disconnected from Fastmail.",
    )
