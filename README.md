# AirCal

> Your calendar is a map, not a list.

Open-source calendar with spatial timeline. See where your time went, not just what you scheduled.

![Dashboard](docs/screenshot-dashboard.png)

## Why AirCal?

Traditional calendars show **what** you scheduled. AirCal shows **where** you lived.

**For Digital Nomads**
See exactly where you were productive vs burned out across 30 cities

**For Remote Workers**
Understand which locations optimize your work/life balance

**For Privacy-Conscious Users**
Self-host everything: calendar, sync, analytics. Zero cloud dependency.

**For Quantified Self**
Spatial memory > chronological lists. See patterns in WHERE you spend time.

## Screenshots

### Timeline View
![Timeline View](docs/screenshot-timeline.png)
*Browse events by location. Events inherit location until a new one appears—see your life as location spans, not scattered appointments.*

### Map View
![Map View](docs/screenshot-map.png)
*Geographic visualization of all events. Click locations for aggregated statistics and time breakdowns.*

### Availability Scheduler
![Availability Scheduler](docs/screenshot-availability.png)
*Paint available time slots directly on the calendar. Generate booking links via Cal.com integration.*

### Settings
![Settings](docs/screenshot-settings.png)
*Connect CalDAV providers, manage calendars, configure integrations.*

## Features

### Timeline View
The killer feature. Browse your calendar organized by location, not just time.

- **Location Spans** - Events inherit location from previous days until a new location appears
- **Dynamic Covers** - Background images based on event keywords and emojis
- **Time Aggregation** - See total hours spent at each location
- **Hover Preview** - Preview event covers on hover

### Map View
See your events on an interactive map.

- **Geographic Clustering** - Events grouped by location with counts
- **Rich Popups** - Cover images, time totals, activity breakdowns per location
- **Date Filtering** - Filter by day, month, or year
- **Location Inheritance** - Same smart location logic as Timeline

### Availability Scheduler
Share your availability with a single link.

- **Visual Selection** - Paint available slots directly on the calendar
- **Cal.com Integration** - Create booking types with custom durations
- **Buffer Time** - Set padding between meetings
- **Smart Detection** - Automatically identifies free time around existing events

### Analytics Dashboard
Understand your time patterns.

- **Time Utilization** - Scheduled vs available time
- **Events by Day/Hour** - See when you're busiest
- **Top Activities** - Track your most frequent event types
- **Calendar Breakdown** - Time distribution across calendars

### Core Calendar
Everything you expect from a modern calendar.

- **CalDAV Sync** - Fastmail, iCloud, Google (via CalDAV)
- **Multiple Views** - Month, week, day powered by FullCalendar
- **Multiple Calendars** - Toggle visibility, customize colors
- **Recurring Events** - Full RRULE support with expansion
- **Two-Way Sync** - Create, edit, delete with sync back to server
- **Offline Ready** - SQLite caching for fast local access
- **Dark Mode** - System-aware theme switching

## Comparison

| Feature | Google Cal | Calendly | Motion | AirCal |
|---------|-----------|----------|--------|--------|
| Timeline view | ❌ | ❌ | ❌ | ✅ |
| Location-based patterns | ❌ | ❌ | ❌ | ✅ |
| Self-hosted | ❌ | ❌ | ❌ | ✅ |
| Booking links | ❌ | ✅ | ✅ | ✅ |
| Open source | ❌ | ❌ | ❌ | ✅ |
| CalDAV support | ❌ | ❌ | ❌ | ✅ |

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- A CalDAV account (Fastmail, iCloud, etc.)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API available at `http://localhost:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App available at `http://localhost:5173`

### Connect CalDAV

1. **Fastmail**: Go to Settings → Privacy & Security → [App Passwords](https://www.fastmail.com/settings/security/devicekeys)
2. Create an app password for "AirCal"
3. In Settings, enter your email and app password
4. Click Connect—calendars sync automatically

## Configuration

### Backend (.env)

```env
DEBUG=true
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000
```

## Tech Stack

**Frontend**: React, TypeScript, Vite, FullCalendar, TanStack Query, Leaflet

**Backend**: Python, FastAPI, SQLAlchemy, SQLite, caldav, icalendar

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/connect` | Connect CalDAV |
| GET | `/api/auth/status` | Connection status |
| POST | `/api/auth/disconnect` | Disconnect |
| GET | `/api/calendars` | List calendars |
| PUT | `/api/calendars/{id}` | Update calendar |
| GET | `/api/events` | Get events (date range) |
| POST | `/api/events` | Create event |
| PUT | `/api/events/{uid}` | Update event |
| DELETE | `/api/events/{uid}` | Delete event |
| POST | `/api/sync` | Force sync |
| GET | `/api/booking-types` | List booking types |
| POST | `/api/booking-types` | Create booking type |

## Project Structure

```
aircal/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI routes
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   └── services/      # CalDAV, iCalendar, sync
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Calendar/  # FullCalendar views
│   │   │   ├── Timeline/  # Location-based timeline
│   │   │   ├── Map/       # Leaflet map view
│   │   │   ├── Dashboard/ # Analytics
│   │   │   ├── Booking/   # Availability scheduler
│   │   │   └── Settings/  # Configuration modal
│   │   ├── hooks/         # React Query hooks
│   │   ├── utils/         # Location spans, covers
│   │   └── contexts/      # Theme, calendar mode
│   └── package.json
└── docs/                  # Screenshots
```

## Roadmap

- [ ] AI-powered timeline analysis
- [ ] Mobile apps (iOS/Android)
- [ ] Multi-location pattern comparison
- [ ] Google Calendar OAuth
- [ ] Export/import formats
- [ ] Predictive scheduling suggestions

## Contributing

Contributions welcome! Please open an issue first to discuss changes.

## Community

⭐ **Star this repo** to follow development
🐛 **[Report issues](https://github.com/outsidebryce/AirCal/issues)** on GitHub
💬 **Discussions** welcome for roadmap input

## License

[AGPL-3.0](LICENSE) - Free to use, modify, and distribute. Derivatives must remain open source.

---

Built by [@outsidebryce](https://github.com/outsidebryce)
