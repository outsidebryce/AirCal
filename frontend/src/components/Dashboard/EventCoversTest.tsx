import { useState, useEffect, useMemo } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { useCalendars } from '../../hooks/useCalendars';
import {
  extractKeywords,
  getEventTypeKey,
  getUnsplashUrl,
  getCachedCover,
  clearCoverCache,
} from '../../utils/eventCovers';
import type { ExpandedEvent } from '../../types/event';
import type { Calendar } from '../../types/calendar';
import './EventCoversTest.css';

interface UniqueEvent {
  key: string;
  summary: string;
  description: string | null;
  location: string | null;
  count: number;
  keywords: string[];
  imageUrl: string;
  cached: boolean;
}

export function EventCoversTest() {
  const [uniqueEvents, setUniqueEvents] = useState<UniqueEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [showOnlyWithLocation, setShowOnlyWithLocation] = useState(false);

  // Get 1 year of events
  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return { start, end };
  }, []);

  const { data: calendars = [] } = useCalendars();
  const visibleCalendarIds = useMemo(
    () => calendars.filter((cal: Calendar) => cal.visible).map((cal: Calendar) => cal.id),
    [calendars]
  );

  const { data: events = [], isLoading: eventsLoading } = useEvents(
    dateRange.start,
    dateRange.end,
    visibleCalendarIds.length > 0 ? visibleCalendarIds : undefined
  );

  // Aggregate unique events
  useEffect(() => {
    if (eventsLoading) return;

    const eventMap: Record<string, {
      summary: string;
      description: string | null;
      location: string | null;
      count: number;
    }> = {};

    events.forEach((event: ExpandedEvent) => {
      const key = getEventTypeKey(event.summary);
      if (!key) return;

      if (!eventMap[key]) {
        eventMap[key] = {
          summary: event.summary,
          description: event.description,
          location: event.location,
          count: 0,
        };
      }
      eventMap[key].count++;

      // Update description/location if current event has them and stored doesn't
      if (event.description && !eventMap[key].description) {
        eventMap[key].description = event.description;
      }
      if (event.location && !eventMap[key].location) {
        eventMap[key].location = event.location;
      }
    });

    // Convert to array and add keywords/images
    const uniqueList: UniqueEvent[] = Object.entries(eventMap)
      .map(([key, data]) => {
        const keywords = extractKeywords(data.summary, data.description, data.location);
        const cached = getCachedCover(data.summary);

        return {
          key,
          summary: data.summary,
          description: data.description,
          location: data.location,
          count: data.count,
          keywords: cached?.keywords || keywords,
          imageUrl: cached?.imageUrl || getUnsplashUrl(keywords.length > 0 ? keywords : ['abstract', 'minimal']),
          cached: !!cached,
        };
      })
      .sort((a, b) => b.count - a.count);

    setUniqueEvents(uniqueList);
    setIsLoading(false);
  }, [events, eventsLoading]);

  const handleImageLoad = (key: string) => {
    setLoadedImages(prev => new Set(prev).add(key));
  };

  // Filter and limit displayed events
  const displayedEvents = useMemo(() => {
    let filtered = uniqueEvents;
    if (showOnlyWithLocation) {
      filtered = uniqueEvents.filter(e => e.location);
    }
    return filtered.slice(0, 20);
  }, [uniqueEvents, showOnlyWithLocation]);

  const eventsWithLocation = uniqueEvents.filter(e => e.location).length;

  const handleClearCache = () => {
    clearCoverCache();
    setLoadedImages(new Set());
    // Force re-render
    setUniqueEvents(prev =>
      prev.map(e => ({
        ...e,
        cached: false,
        imageUrl: getUnsplashUrl(e.keywords.length > 0 ? e.keywords : ['abstract', 'minimal']),
      }))
    );
  };

  if (isLoading || eventsLoading) {
    return (
      <div className="covers-test loading">
        <div className="loading-spinner"></div>
        <p>Analyzing events...</p>
      </div>
    );
  }

  return (
    <div className="covers-test">
      <div className="covers-header">
        <div>
          <h2>Event Cover Images Test</h2>
          <p>
            Found {uniqueEvents.length} unique event types from {events.length} total events
            {eventsWithLocation > 0 && ` (${eventsWithLocation} with locations)`}
          </p>
        </div>
        <div className="covers-actions">
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={showOnlyWithLocation}
              onChange={(e) => setShowOnlyWithLocation(e.target.checked)}
            />
            <span>Only with location ({eventsWithLocation})</span>
          </label>
          <button className="clear-cache-btn" onClick={handleClearCache}>
            Clear Cache
          </button>
        </div>
      </div>

      <div className="covers-grid">
        {displayedEvents.map(event => (
          <div key={event.key} className="cover-card">
            <div className="cover-image-wrapper">
              {!loadedImages.has(event.key) && (
                <div className="cover-placeholder">
                  <div className="loading-spinner small"></div>
                </div>
              )}
              <img
                src={event.imageUrl}
                alt={event.summary}
                className={`cover-image ${loadedImages.has(event.key) ? 'loaded' : ''}`}
                onLoad={() => handleImageLoad(event.key)}
                onError={() => handleImageLoad(event.key)}
              />
              {event.cached && <span className="cached-badge">Cached</span>}
            </div>
            <div className="cover-info">
              <h3>{event.summary}</h3>
              <div className="cover-meta">
                <span className="event-count">{event.count}x</span>
                {event.location && <span className="event-location">📍 {event.location}</span>}
              </div>
              <div className="keywords">
                {event.keywords.map(kw => (
                  <span key={kw} className="keyword">{kw}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {displayedEvents.length === 0 && (
        <div className="no-events">
          <p>
            {showOnlyWithLocation
              ? 'No events with locations found. Try unchecking the filter.'
              : 'No events found in the selected calendars for this year.'}
          </p>
        </div>
      )}
    </div>
  );
}
