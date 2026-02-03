from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "AirCal"
    DEBUG: bool = True

    # Database
    DATABASE_PATH: Path = Path(__file__).parent.parent / "data" / "aircal.db"

    # Fastmail CalDAV
    CALDAV_BASE_URL: str = "https://caldav.fastmail.com/"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # Sync settings
    DEFAULT_SYNC_INTERVAL_MINUTES: int = 15
    DEFAULT_EVENT_DURATION_MINUTES: int = 60

    # Cal.com integration
    CALCOM_API_KEY: str | None = None
    CALCOM_API_URL: str = "https://api.cal.com/v1"
    CALCOM_WEBHOOK_SECRET: str | None = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
