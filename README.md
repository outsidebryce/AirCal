# AirCal

A self-hosted calendar application with Fastmail CalDAV integration. View and manage your calendars with a clean, modern interface featuring month, week, and day views.

![Month View](docs/screenshot-month.png)

## Features

- **Fastmail CalDAV Sync** - Connect to your Fastmail account and sync all your calendars
- **Multiple Views** - Month, week, and day views powered by FullCalendar
- **Multiple Calendars** - View and toggle visibility of multiple calendars
- **Recurring Events** - Full support for recurring events with RRULE expansion
- **Event Management** - Create, edit, and delete events with two-way sync
- **Local Caching** - SQLite database for fast offline access
- **Collapsible Sidebar** - Clean UI with show/hide sidebar toggle

## Screenshots

### Week View
![Week View](docs/screenshot-week.png)

### Day View
![Day View](docs/screenshot-day.png)

## Tech Stack

**Frontend:**
- React + TypeScript
- Vite
- FullCalendar
- TanStack Query
- React Hook Form + Zod

**Backend:**
- Python + FastAPI
- CalDAV library for Fastmail integration
- SQLite with SQLAlchemy
- iCalendar parsing with recurring-ical-events

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- A Fastmail account with an app-specific password

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Run the dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Connecting to Fastmail

1. Go to [Fastmail Settings > Privacy & Security > App Passwords](https://www.fastmail.com/settings/security/devicekeys)
2. Create a new app password for "AirCal"
3. In the AirCal app, enter your Fastmail email and the app password
4. Click Connect - your calendars will sync automatically

## Configuration

### Backend Environment Variables

Create a `.env` file in the `backend` directory:

```env
DEBUG=true
CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]
```

### Frontend Environment Variables

Create a `.env` file in the `frontend` directory:

```env
VITE_API_URL=http://localhost:8000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/connect` | Connect to Fastmail |
| GET | `/api/auth/status` | Check connection status |
| POST | `/api/auth/disconnect` | Disconnect from Fastmail |
| GET | `/api/calendars` | List all calendars |
| PUT | `/api/calendars/{id}` | Update calendar settings |
| GET | `/api/events` | Get events in date range |
| POST | `/api/events` | Create new event |
| PUT | `/api/events/{uid}` | Update event |
| DELETE | `/api/events/{uid}` | Delete event |
| POST | `/api/sync` | Force sync with Fastmail |

## Project Structure

```
aircal/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI routes
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   └── services/      # Business logic
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── components/    # React components
│   │   ├── hooks/         # React Query hooks
│   │   └── types/         # TypeScript types
│   └── package.json
└── docs/                  # Screenshots
```

## License

MIT
