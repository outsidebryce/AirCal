"""
Credential service for storing and retrieving encrypted credentials.

Uses simple obfuscation for local storage. This is NOT meant for
high-security scenarios - it's just to prevent casual reading of
credentials from the SQLite database.
"""

import base64
import hashlib
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.credentials import StoredCredentials


# Simple key derived from a fixed salt - provides basic obfuscation
# For a self-hosted app, this is acceptable as the DB is local
_OBFUSCATION_KEY = hashlib.sha256(b"aircal-local-storage-key").digest()


def _xor_encrypt(data: str) -> str:
    """Simple XOR encryption with the obfuscation key."""
    data_bytes = data.encode('utf-8')
    key_bytes = _OBFUSCATION_KEY
    encrypted = bytes(
        data_bytes[i] ^ key_bytes[i % len(key_bytes)]
        for i in range(len(data_bytes))
    )
    return base64.b64encode(encrypted).decode('utf-8')


def _xor_decrypt(encrypted_data: str) -> str:
    """Simple XOR decryption with the obfuscation key."""
    encrypted_bytes = base64.b64decode(encrypted_data.encode('utf-8'))
    key_bytes = _OBFUSCATION_KEY
    decrypted = bytes(
        encrypted_bytes[i] ^ key_bytes[i % len(key_bytes)]
        for i in range(len(encrypted_bytes))
    )
    return decrypted.decode('utf-8')


async def save_credentials(
    db: AsyncSession,
    username: str,
    password: str,
) -> None:
    """Save credentials to database (encrypted)."""
    # Delete any existing credentials first
    await db.execute(delete(StoredCredentials))

    # Create new credentials
    encrypted_password = _xor_encrypt(password)
    credentials = StoredCredentials(
        id="fastmail",
        username=username,
        encrypted_password=encrypted_password,
    )
    db.add(credentials)
    await db.commit()


async def get_stored_credentials(
    db: AsyncSession,
) -> tuple[str, str] | None:
    """
    Get stored credentials from database.
    Returns (username, password) tuple or None if not found.
    """
    result = await db.execute(
        select(StoredCredentials).where(StoredCredentials.id == "fastmail")
    )
    credentials = result.scalar_one_or_none()

    if credentials is None:
        return None

    try:
        password = _xor_decrypt(credentials.encrypted_password)
        return (credentials.username, password)
    except Exception:
        # If decryption fails, credentials are corrupted
        return None


async def clear_credentials(db: AsyncSession) -> None:
    """Clear stored credentials from database."""
    await db.execute(delete(StoredCredentials))
    await db.commit()
