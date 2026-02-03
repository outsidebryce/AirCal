"""
Background sync scheduler for automatic calendar synchronization.
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional

from app.config import settings
from app.models.database import AsyncSessionLocal
from app.services.caldav_service import (
    CalDAVService,
    get_caldav_service,
    set_caldav_service,
)
from app.services.credential_service import get_stored_credentials

logger = logging.getLogger(__name__)

# Global state for the sync scheduler
_sync_task: Optional[asyncio.Task] = None
_last_sync_time: Optional[datetime] = None
_sync_in_progress: bool = False


def get_sync_status() -> dict:
    """Get the current sync status."""
    return {
        "last_sync": _last_sync_time.isoformat() if _last_sync_time else None,
        "sync_in_progress": _sync_in_progress,
        "sync_interval_minutes": settings.DEFAULT_SYNC_INTERVAL_MINUTES,
    }


async def try_auto_connect() -> bool:
    """
    Try to auto-connect using stored credentials.
    Returns True if connection was successful, False otherwise.
    """
    async with AsyncSessionLocal() as db:
        credentials = await get_stored_credentials(db)

    if credentials is None:
        logger.info("No stored credentials found, skipping auto-connect")
        return False

    username, password = credentials
    logger.info(f"Found stored credentials for {username}, attempting auto-connect...")

    # Create CalDAV service
    service = CalDAVService(username, password)

    # Verify connection
    if not await service.async_verify_connection():
        logger.warning("Auto-connect failed: credentials may be invalid")
        return False

    # Store service globally
    set_caldav_service(service)
    logger.info(f"Auto-connected to Fastmail as {username}")
    return True


async def perform_sync() -> bool:
    """
    Perform a calendar sync.
    Returns True if sync was successful, False otherwise.
    """
    global _last_sync_time, _sync_in_progress

    service = get_caldav_service()
    if service is None:
        logger.debug("Skipping sync: not connected")
        return False

    if _sync_in_progress:
        logger.debug("Skipping sync: already in progress")
        return False

    _sync_in_progress = True
    try:
        logger.info("Starting calendar sync...")

        # Import here to avoid circular imports
        from app.api.sync import do_sync

        async with AsyncSessionLocal() as db:
            result = await do_sync(db)

        _last_sync_time = datetime.utcnow()
        logger.info(f"Sync completed: {result.events_updated} events updated")
        return True

    except Exception as e:
        logger.error(f"Sync failed: {e}")
        return False
    finally:
        _sync_in_progress = False


async def _sync_loop():
    """Background loop that performs periodic syncs."""
    interval_seconds = settings.DEFAULT_SYNC_INTERVAL_MINUTES * 60

    while True:
        try:
            # Wait for the sync interval
            await asyncio.sleep(interval_seconds)

            # Perform sync if connected
            await perform_sync()

        except asyncio.CancelledError:
            logger.info("Sync scheduler stopped")
            break
        except Exception as e:
            logger.error(f"Error in sync loop: {e}")
            # Continue running even if there's an error
            await asyncio.sleep(60)  # Wait a bit before retrying


async def start_sync_scheduler():
    """Start the background sync scheduler."""
    global _sync_task

    if _sync_task is not None:
        logger.warning("Sync scheduler already running")
        return

    logger.info(
        f"Starting sync scheduler (interval: {settings.DEFAULT_SYNC_INTERVAL_MINUTES} minutes)"
    )
    _sync_task = asyncio.create_task(_sync_loop())


async def stop_sync_scheduler():
    """Stop the background sync scheduler."""
    global _sync_task

    if _sync_task is not None:
        _sync_task.cancel()
        try:
            await _sync_task
        except asyncio.CancelledError:
            pass
        _sync_task = None
        logger.info("Sync scheduler stopped")
