import { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEvents } from '../../hooks/useEvents';
import { useCalendars } from '../../hooks/useCalendars';
import { fetchEventCover } from '../../utils/eventCovers';
import { computeLocationSpans, formatDuration } from '../../utils/locationSpans';
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

interface EventAggregate {
  summary: string;
  totalMinutes: number;
  count: number;
  calendarId: string;
}

function aggregateEvents(events: ExpandedEvent[]): EventAggregate[] {
  const aggregates = new Map<string, EventAggregate>();

  for (const event of events) {
    const key = event.summary.toLowerCase().trim();
    const start = new Date(event.start);
    const end = new Date(event.end);
    const durationMs = end.getTime() - start.getTime();
    const durationMinutes = Math.max(0, durationMs / 60000);

    if (aggregates.has(key)) {
      const agg = aggregates.get(key)!;
      agg.totalMinutes += durationMinutes;
      agg.count += 1;
    } else {
      aggregates.set(key, {
        summary: event.summary,
        totalMinutes: durationMinutes,
        count: 1,
        calendarId: event.calendar_id,
      });
    }
  }

  // Sort by total time descending
  return Array.from(aggregates.values())
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
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
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
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

  // Use location spans to group events (events inherit location from previous events)
  const locationGroups = useMemo(() => {
    const groups: Record<string, ExpandedEvent[]> = {};
    const spans = computeLocationSpans(events);

    // Group all events from all spans by their governing location
    for (const span of spans) {
      const loc = span.location;
      if (!groups[loc]) {
        groups[loc] = [];
      }
      groups[loc].push(...span.events);
    }

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

  // Fetch cover images for each location
  useEffect(() => {
    const fetchCovers = async () => {
      const newCoverUrls: Record<string, string> = {};

      for (const loc of geocodedLocations) {
        // Get the most attended event for cover
        const aggregates = aggregateEvents(loc.events);
        if (aggregates.length > 0) {
          const topEvent = loc.events.find(
            e => e.summary.toLowerCase().trim() === aggregates[0].summary.toLowerCase().trim()
          );
          if (topEvent) {
            const url = await fetchEventCover(topEvent.summary, topEvent.description, loc.location);
            if (url) {
              newCoverUrls[loc.location] = url;
            }
          }
        }
      }

      setCoverUrls(newCoverUrls);
    };

    if (geocodedLocations.length > 0) {
      fetchCovers();
    }
  }, [geocodedLocations]);

  // Get calendar color for an event
  const getEventColor = (event: ExpandedEvent): string => {
    const calendar = calendars.find((c: Calendar) => c.id === event.calendar_id);
    return calendar?.color || '#3788d8';
  };

  // Get calendar color by ID
  const getCalendarColor = (calendarId: string): string => {
    const calendar = calendars.find((c: Calendar) => c.id === calendarId);
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
        {geocodedLocations.map((loc) => {
          const aggregates = aggregateEvents(loc.events);
          const maxMinutes = aggregates.length > 0 ? aggregates[0].totalMinutes : 1;
          const totalMinutes = loc.events.reduce((sum, e) => {
            const start = new Date(e.start);
            const end = new Date(e.end);
            return sum + Math.max(0, (end.getTime() - start.getTime()) / 60000);
          }, 0);

          return (
            <Marker
              key={loc.location}
              position={[loc.lat, loc.lng]}
              icon={createMarkerIcon(getEventColor(loc.events[0]))}
            >
              <Popup>
                <div className="map-popup">
                  {coverUrls[loc.location] && (
                    <div
                      className="popup-cover"
                      style={{ backgroundImage: `url(${coverUrls[loc.location]})` }}
                    >
                      <div className="popup-cover-overlay">
                        <h4>{loc.location}</h4>
                      </div>
                    </div>
                  )}
                  {!coverUrls[loc.location] && <h4 className="popup-title">{loc.location}</h4>}

                  <div className="popup-stats">
                    <div className="popup-stat">
                      <span className="stat-value">{formatDuration(totalMinutes)}</span>
                      <span className="stat-label">Total</span>
                    </div>
                    <div className="popup-stat">
                      <span className="stat-value">{loc.events.length}</span>
                      <span className="stat-label">Events</span>
                    </div>
                  </div>

                  <div className="popup-aggregates">
                    {aggregates.slice(0, 5).map((agg, idx) => {
                      const percentage = (agg.totalMinutes / maxMinutes) * 100;
                      return (
                        <div key={`${agg.summary}-${idx}`} className="aggregate-item">
                          <div className="aggregate-header">
                            <span
                              className="aggregate-dot"
                              style={{ backgroundColor: getCalendarColor(agg.calendarId) }}
                            />
                            <span className="aggregate-label">{agg.summary}</span>
                            <span className="aggregate-value">{formatDuration(agg.totalMinutes)}</span>
                          </div>
                          <div className="aggregate-bar">
                            <div
                              className="aggregate-fill"
                              style={{
                                width: `${percentage}%`,
                                backgroundColor: getCalendarColor(agg.calendarId),
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {aggregates.length > 5 && (
                      <div className="popup-more">+{aggregates.length - 5} more activities</div>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
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
