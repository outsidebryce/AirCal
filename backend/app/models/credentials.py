"""Credential storage model for persisting Fastmail authentication."""

from sqlalchemy import Column, String, DateTime
from datetime import datetime

from app.models.database import Base


class StoredCredentials(Base):
    """
    Stores encrypted Fastmail credentials for persistent authentication.
    Only one row should exist at a time (singleton pattern).
    """
    __tablename__ = "stored_credentials"

    id = Column(String, primary_key=True, default="fastmail")
    username = Column(String, nullable=False)
    # Password is base64-encoded encrypted value
    encrypted_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
