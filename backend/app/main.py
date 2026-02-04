from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models.database import init_db
from app.api.router import api_router
from app.services.sync_scheduler import (
    try_auto_connect,
    perform_sync,
    start_sync_scheduler,
    stop_sync_scheduler,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup: Initialize database
    await init_db()

    # Try to auto-connect using stored credentials
    connected = await try_auto_connect()

    # If connected, perform initial sync and start scheduler
    if connected:
        logger.info("Performing initial sync...")
        await perform_sync()
        await start_sync_scheduler()

    yield

    # Shutdown: Stop sync scheduler
    await stop_sync_scheduler()


app = FastAPI(
    title=settings.APP_NAME,
    description="Self-hosted calendar application with Fastmail CalDAV integration",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")


@app.api_route("/health", methods=["GET", "HEAD"])
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "app": settings.APP_NAME}


if __name__ == "__main__":
    import os
    import uvicorn

    port = int(os.environ.get("AIRCAL_PORT", settings.PORT))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
