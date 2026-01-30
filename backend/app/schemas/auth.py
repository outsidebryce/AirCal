from pydantic import BaseModel, EmailStr


class ConnectRequest(BaseModel):
    username: str  # Full email address (user@domain.com)
    app_password: str  # Fastmail app-specific password


class ConnectResponse(BaseModel):
    success: bool
    message: str
    calendars_count: int = 0


class AuthStatusResponse(BaseModel):
    connected: bool
    username: str | None = None


class DisconnectResponse(BaseModel):
    success: bool
    message: str
