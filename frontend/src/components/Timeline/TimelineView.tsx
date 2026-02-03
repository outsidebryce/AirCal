import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { useCalendars } from '../../hooks/useCalendars';
import { computeLocationSpans, formatDuration, formatDateRange } from '../../utils/locationSpans';
import { fetchEventCover } from '../../utils/eventCovers';
import type { ExpandedEvent } from '../../types/event';
import type { Calendar } from '../../types/calendar';
import type { LocationSpan } from '../../utils/locationSpans';
import './TimelineView.css';

interface EventAggregate {
  summary: string;
  totalMinutes: number;
  count: number;
  calendarId: string;
}

// Check if a location should be replaced with the most attended event title
function shouldUseEventTitle(location: string): boolean {
  const trimmed = location.trim().toLowerCase();

  // Generic/virtual meeting locations
  const genericLocations = [
    'microsoft teams meeting',
    'zoom meeting',
    'google meet',
    'webex',
  ];

  if (genericLocations.some(loc => trimmed.includes(loc))) {
    return true;
  }

  // URL patterns
  const urlPatterns = [
    /^https?:\/\//i,           // http:// or https://
    /^www\./i,                  // www.
    /\.[a-z]{2,}(\/|$)/i,      // .com, .org, .net, .io, etc.
  ];

  return urlPatterns.some(pattern => pattern.test(location.trim()));
}

// Get display title for a span - use most attended event if location is generic/URL
function getSpanDisplayTitle(span: LocationSpan, aggregates: EventAggregate[]): string {
  if (shouldUseEventTitle(span.location) && aggregates.length > 0) {
    return aggregates[0].summary;
  }
  return span.location;
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

export function TimelineView() {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [coverUrls, setCoverUrls] = useState<Record<number, string>>({});

  // Fetch a wide date range for timeline (1 year back and forward)
  const dateRange = useMemo(() => {
    const now = new Date();
    return {
      start: new Date(now.getFullYear() - 1, now.getMonth(), 1),
      end: new Date(now.getFullYear() + 1, now.getMonth(), 0),
    };
  }, []);

  const { data: calendars = [] } = useCalendars();
  const visibleCalendarIds = useMemo(
    () => calendars
      .filter((cal: Calendar) => cal.visible)
      .map((cal: Calendar) => cal.id),
    [calendars]
  );

  const { data: events = [], isLoading } = useEvents(
    dateRange.start,
    dateRange.end,
    visibleCalendarIds.length > 0 ? visibleCalendarIds : undefined
  );

  // Compute location spans
  const locationSpans = useMemo(
    () => computeLocationSpans(events),
    [events]
  );

  // Fetch cover images for each span's location event
  useEffect(() => {
    const fetchCovers = async () => {
      const newCoverUrls: Record<number, string> = {};

      for (let i = 0; i < locationSpans.length; i++) {
        const span = locationSpans[i];
        const event = span.locationEvent;
        if (event) {
          const url = await fetchEventCover(event.summary, event.description, event.location);
          if (url) {
            newCoverUrls[i] = url;
          }
        }
      }

      setCoverUrls(newCoverUrls);
    };

    if (locationSpans.length > 0) {
      fetchCovers();
    }
  }, [locationSpans]);

  // Find the index of the most recent location span (closest to today)
  const defaultIndex = useMemo(() => {
    const today = new Date();

    for (let i = locationSpans.length - 1; i >= 0; i--) {
      if (locationSpans[i].endDate <= today) {
        return Math.min(i, locationSpans.length - 1);
      }
    }

    return Math.max(0, locationSpans.length - 1);
  }, [locationSpans]);

  // Scroll to the most recent span on initial load
  useEffect(() => {
    if (locationSpans.length > 0 && sliderRef.current) {
      const cardWidth = sliderRef.current.offsetWidth / 4;
      const targetScroll = Math.max(0, (defaultIndex - 1) * cardWidth);
      sliderRef.current.scrollLeft = targetScroll;
      setScrollPosition(targetScroll);
    }
  }, [locationSpans.length, defaultIndex]);

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (sliderRef.current) {
      setScrollPosition(sliderRef.current.scrollLeft);
    }
  }, []);

  // Navigation
  const scrollBy = useCallback((direction: 'prev' | 'next') => {
    if (!sliderRef.current) return;
    const cardWidth = sliderRef.current.offsetWidth / 4;
    const scrollAmount = direction === 'next' ? cardWidth * 4 : -cardWidth * 4;
    sliderRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }, []);

  // Scroll to today/most recent
  const scrollToToday = useCallback(() => {
    if (!sliderRef.current || locationSpans.length === 0) return;
    const cardWidth = sliderRef.current.offsetWidth / 4;
    const targetScroll = Math.max(0, (defaultIndex - 1) * cardWidth);
    sliderRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' });
  }, [defaultIndex, locationSpans.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        scrollBy('prev');
      } else if (e.key === 'ArrowRight') {
        scrollBy('next');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scrollBy]);

  // Check if we can scroll
  const canScrollPrev = scrollPosition > 0;
  const canScrollNext = sliderRef.current
    ? scrollPosition < sliderRef.current.scrollWidth - sliderRef.current.offsetWidth - 10
    : false;

  // Get calendar color helper
  const getCalendarColor = useCallback((calendarId: string) => {
    const calendar = calendars.find((c: Calendar) => c.id === calendarId);
    return calendar?.color || '#3788d8';
  }, [calendars]);

  if (isLoading) {
    return (
      <div className="timeline-view loading">
        <div className="loading-spinner" />
        <p>Loading events...</p>
      </div>
    );
  }

  if (locationSpans.length === 0) {
    return (
      <div className="timeline-view empty">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <h3>No Location Data</h3>
        <p>Add locations to your events to see them in the timeline view.</p>
      </div>
    );
  }

  return (
    <div className="timeline-view">
      {/* Header with navigation controls */}
      <div className="timeline-header">
        <h2 className="timeline-title">Timeline</h2>
        <span className="timeline-count">{locationSpans.length} locations</span>
        <div className="timeline-nav">
          <button
            className="timeline-nav-btn"
            onClick={() => scrollBy('prev')}
            disabled={!canScrollPrev}
            aria-label="Previous locations"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            className="timeline-today-btn"
            onClick={scrollToToday}
            aria-label="Go to today"
          >
            Today
          </button>
          <button
            className="timeline-nav-btn"
            onClick={() => scrollBy('next')}
            disabled={!canScrollNext}
            aria-label="Next locations"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Horizontal card slider */}
      <div
        className="timeline-slider"
        ref={sliderRef}
        onScroll={handleScroll}
      >
        {locationSpans.map((span: LocationSpan, index: number) => {
          const aggregates = aggregateEvents(span.events);
          const maxMinutes = aggregates.length > 0 ? aggregates[0].totalMinutes : 1;
          const displayTitle = getSpanDisplayTitle(span, aggregates);

          return (
            <div key={`${span.location}-${index}`} className="location-card">
              <div
                className="location-card-header"
                style={{
                  backgroundImage: coverUrls[index] ? `url(${coverUrls[index]})` : undefined,
                }}
              >
                <div className="location-card-header-overlay">
                  <h3 className="location-name">{displayTitle}</h3>
                  <span className="location-dates">{formatDateRange(span.startDate, span.endDate)}</span>
                </div>
              </div>

              <div className="location-stats">
                <div className="stat">
                  <span className="stat-value">{formatDuration(span.totalMinutes)}</span>
                  <span className="stat-label">Total Time</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{span.events.length}</span>
                  <span className="stat-label">Events</span>
                </div>
              </div>

              <div className="location-gauges">
                {aggregates.slice(0, 8).map((agg, idx) => {
                  const percentage = (agg.totalMinutes / maxMinutes) * 100;
                  return (
                    <div key={`${agg.summary}-${idx}`} className="gauge-item">
                      <div className="gauge-header">
                        <span
                          className="gauge-dot"
                          style={{ backgroundColor: getCalendarColor(agg.calendarId) }}
                        />
                        <span className="gauge-label">{agg.summary}</span>
                        <span className="gauge-value">{formatDuration(agg.totalMinutes)}</span>
                      </div>
                      <div className="gauge-bar">
                        <div
                          className="gauge-fill"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: getCalendarColor(agg.calendarId),
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {aggregates.length > 8 && (
                  <div className="gauges-overflow">
                    +{aggregates.length - 8} more activities
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
