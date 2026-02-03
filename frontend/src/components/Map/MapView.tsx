import { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEvents } from '../../hooks/useEvents';
import { useCalendars } from '../../hooks/useCalendars';
import type { ExpandedEvent } from '../../types/event';
import type { Calendar } from '../../types/calendar';
import 'leaflet/dist/leaflet.css';
import './MapView.css';

// Fix for default marker icons in Leaflet with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface GeocodedLocation {
  location: string;
  lat: number;
  lng: number;
  events: ExpandedEvent[];
}

// Cache for geocoded locations - persisted to localStorage
const CACHE_KEY = 'aircal-geocode-cache';

function loadCache(): Record<string, { lat: number; lng: number } | null> {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, { lat: number; lng: number } | null>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
}

const geocodeCache: Record<string, { lat: number; lng: number } | null> = loadCache();

async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  // Check cache first
  if (location in geocodeCache) {
    return geocodeCache[location];
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`,
      {
        headers: {
          'User-Agent': 'AirCal/1.0',
        },
      }
    );
    const data = await response.json();

    if (data && data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocodeCache[location] = result;
      saveCache(geocodeCache);
      return result;
    }

    geocodeCache[location] = null;
    saveCache(geocodeCache);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    geocodeCache[location] = null;
    return null;
  }
}

// Component to fit map bounds to markers
function FitBounds({ locations }: { locations: GeocodedLocation[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 0) return;

    if (locations.length === 1) {
      map.setView([locations[0].lat, locations[0].lng], 13);
    } else {
      const bounds = L.latLngBounds(locations.map((loc) => [loc.lat, loc.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations, map]);

  return null;
}

// Create colored marker icon
function createMarkerIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
}

type DateRangeType = 'day' | 'month' | 'year';

export function MapView() {
  const [geocodedLocations, setGeocodedLocations] = useState<GeocodedLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalLocations, setTotalLocations] = useState(0);
  const [rangeType, setRangeType] = useState<DateRangeType>('month');
  const [baseDate, setBaseDate] = useState(() => new Date());
  const lastLocationsKey = useRef<string | null>(null);

  // Calculate date range based on type and base date
  const dateRange = useMemo(() => {
    const date = baseDate;
    switch (rangeType) {
      case 'day':
        return {
          start: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
          end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59),
        };
      case 'month':
        return {
          start: new Date(date.getFullYear(), date.getMonth(), 1),
          end: new Date(date.getFullYear(), date.getMonth() + 1, 0),
        };
      case 'year':
        return {
          start: new Date(date.getFullYear(), 0, 1),
          end: new Date(date.getFullYear(), 11, 31),
        };
    }
  }, [rangeType, baseDate]);

  const navigatePrev = () => {
    setBaseDate((prev) => {
      const d = new Date(prev);
      switch (rangeType) {
        case 'day':
          d.setDate(d.getDate() - 1);
          break;
        case 'month':
          d.setMonth(d.getMonth() - 1);
          break;
        case 'year':
          d.setFullYear(d.getFullYear() - 1);
          break;
      }
      return d;
    });
  };

  const navigateNext = () => {
    setBaseDate((prev) => {
      const d = new Date(prev);
      switch (rangeType) {
        case 'day':
          d.setDate(d.getDate() + 1);
          break;
        case 'month':
          d.setMonth(d.getMonth() + 1);
          break;
        case 'year':
          d.setFullYear(d.getFullYear() + 1);
          break;
      }
      return d;
    });
  };

  const navigateToday = () => {
    setBaseDate(new Date());
  };

  const getTitle = () => {
    const opts: Intl.DateTimeFormatOptions = {};
    switch (rangeType) {
      case 'day':
        opts.weekday = 'long';
        opts.month = 'long';
        opts.day = 'numeric';
        opts.year = 'numeric';
        break;
      case 'month':
        opts.month = 'long';
        opts.year = 'numeric';
        break;
      case 'year':
        opts.year = 'numeric';
        break;
    }
    return baseDate.toLocaleDateString(undefined, opts);
  };

  const { data: calendars = [] } = useCalendars();
  const visibleCalendarIds = useMemo(
    () =>
      calendars
        .filter((cal: Calendar) => cal.visible)
        .map((cal: Calendar) => cal.id),
    [calendars]
  );

  const { data: events = [] } = useEvents(
    dateRange.start,
    dateRange.end,
    visibleCalendarIds.length > 0 ? visibleCalendarIds : undefined
  );

  // Create stable key from location data
  const locationGroups = useMemo(() => {
    const groups: Record<string, ExpandedEvent[]> = {};
    events.forEach((event: ExpandedEvent) => {
      if (event.location && event.location.trim() !== '') {
        const loc = event.location.trim();
        if (!groups[loc]) {
          groups[loc] = [];
        }
        groups[loc].push(event);
      }
    });
    return groups;
  }, [events]);

  const locationsKey = useMemo(
    () => Object.keys(locationGroups).sort().join('|'),
    [locationGroups]
  );

  // Geocode locations when they change
  useEffect(() => {
    // Skip if locations haven't changed (but always run on first render)
    if (lastLocationsKey.current !== null && locationsKey === lastLocationsKey.current) {
      return;
    }
    lastLocationsKey.current = locationsKey;

    const locations = Object.keys(locationGroups);

    if (locations.length === 0) {
      setGeocodedLocations([]);
      setTotalLocations(0);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setTotalLocations(locations.length);

    const geocodeAll = async () => {
      setIsLoading(true);
      const results: GeocodedLocation[] = [];

      // First pass: instantly load all cached locations
      const uncachedLocations: string[] = [];
      for (const location of locations) {
        if (location in geocodeCache && geocodeCache[location]) {
          const coords = geocodeCache[location]!;
          results.push({
            location,
            lat: coords.lat,
            lng: coords.lng,
            events: locationGroups[location],
          });
        } else {
          uncachedLocations.push(location);
        }
      }

      // Show cached results immediately
      if (results.length > 0 && !cancelled) {
        setGeocodedLocations([...results]);
        setIsLoading(false);
      }

      // Second pass: fetch uncached locations with rate limiting
      for (const location of uncachedLocations) {
        if (cancelled) return;

        const coords = await geocodeLocation(location);
        if (coords) {
          results.push({
            location,
            lat: coords.lat,
            lng: coords.lng,
            events: locationGroups[location],
          });
          if (!cancelled) {
            setGeocodedLocations([...results]);
            setIsLoading(false);
          }
        }
        // Only delay between network requests
        if (uncachedLocations.indexOf(location) < uncachedLocations.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      if (!cancelled) {
        setGeocodedLocations(results);
        setIsLoading(false);
      }
    };

    geocodeAll();

    return () => {
      cancelled = true;
    };
  }, [locationsKey, locationGroups]);

  // Get calendar color for an event
  const getEventColor = (event: ExpandedEvent): string => {
    const calendar = calendars.find((c: Calendar) => c.id === event.calendar_id);
    return calendar?.color || '#3788d8';
  };

  const toolbar = (
    <div className="map-toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn" onClick={navigatePrev} title="Previous">
          &lt;
        </button>
        <button className="toolbar-btn" onClick={navigateNext} title="Next">
          &gt;
        </button>
        <button className="toolbar-btn today-btn" onClick={navigateToday}>
          today
        </button>
      </div>
      <h2 className="toolbar-title">{getTitle()}</h2>
      <div className="toolbar-right">
        <div className="btn-group">
          <button
            className={`toolbar-btn ${rangeType === 'day' ? 'active' : ''}`}
            onClick={() => setRangeType('day')}
          >
            day
          </button>
          <button
            className={`toolbar-btn ${rangeType === 'month' ? 'active' : ''}`}
            onClick={() => setRangeType('month')}
          >
            month
          </button>
          <button
            className={`toolbar-btn ${rangeType === 'year' ? 'active' : ''}`}
            onClick={() => setRangeType('year')}
          >
            year
          </button>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="map-view">
        {toolbar}
        <div className="map-loading">
          <div className="loading-spinner"></div>
          <p>Loading map locations...</p>
        </div>
      </div>
    );
  }

  if (geocodedLocations.length === 0) {
    return (
      <div className="map-view">
        {toolbar}
        <div className="map-empty">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <h3>No locations found</h3>
          <p>Add location data to your events to see them on the map.</p>
        </div>
      </div>
    );
  }

  // Default center (will be overridden by FitBounds)
  const defaultCenter: [number, number] = [39.8283, -98.5795]; // Center of USA

  return (
    <div className="map-view">
      {toolbar}
      <MapContainer center={defaultCenter} zoom={4} className="map-container">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds locations={geocodedLocations} />
        {geocodedLocations.map((loc) => (
          <Marker
            key={loc.location}
            position={[loc.lat, loc.lng]}
            icon={createMarkerIcon(getEventColor(loc.events[0]))}
          >
            <Popup>
              <div className="map-popup">
                <h4>{loc.location}</h4>
                <ul>
                  {loc.events.slice(0, 5).map((event) => (
                    <li key={`${event.uid}-${event.start}`}>
                      <span
                        className="event-dot"
                        style={{ backgroundColor: getEventColor(event) }}
                      ></span>
                      <span className="event-title">{event.summary}</span>
                      <span className="event-date">
                        {new Date(event.start).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                  {loc.events.length > 5 && (
                    <li className="more">+{loc.events.length - 5} more events</li>
                  )}
                </ul>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="map-stats">
        {geocodedLocations.length} location{geocodedLocations.length !== 1 ? 's' : ''}
        {totalLocations > geocodedLocations.length && ` (loading ${totalLocations - geocodedLocations.length} more...)`}
        {' · '}
        {geocodedLocations.reduce((sum, loc) => sum + loc.events.length, 0)} events
      </div>
    </div>
  );
}
