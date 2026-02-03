from fastapi import APIRouter

from app.api import auth, calendars, events, sync, bookings

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(calendars.router, prefix="/calendars", tags=["Calendars"])
api_router.include_router(events.router, prefix="/events", tags=["Events"])
api_router.include_router(sync.router, prefix="/sync", tags=["Sync"])
api_router.include_router(bookings.router, prefix="/bookings", tags=["Bookings"])
