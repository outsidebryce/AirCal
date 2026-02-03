# Import all models so they are registered with SQLAlchemy
from app.models.database import Base
from app.models.calendar import Calendar
from app.models.event import Event, Settings
from app.models.booking import BookingType

__all__ = ['Base', 'Calendar', 'Event', 'Settings', 'BookingType']
