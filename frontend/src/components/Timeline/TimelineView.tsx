import { useState, useEffect, useMemo, useCallback } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { useCalendars } from '../../hooks/useCalendars';
import { computeLocationSpans } from '../../utils/locationSpans';
import { fetchEventCover } from '../../utils/eventCovers';
import { CoverBackground } from './CoverBackground';
import { LocationHeader } from './LocationHeader';
import { LocationStats } from './LocationStats';
import { EventList } from './EventList';
import type { ExpandedEvent } from '../../types/event';
import type { Calendar } from '../../types/calendar';
import './TimelineView.css';

export function TimelineView() {
  // Current location navigation
  const [currentIndex, setCurrentIndex] = useState(0);

  // Cover image state
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [hoverCoverUrl, setHoverCoverUrl] = useState<string | null>(null);

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

  // Reset index if it's out of bounds after data changes
  useEffect(() => {
    if (currentIndex >= locationSpans.length && locationSpans.length > 0) {
      setCurrentIndex(locationSpans.length - 1);
    }
  }, [locationSpans.length, currentIndex]);

  const currentSpan = locationSpans[currentIndex] || null;
  const hasNext = currentIndex < locationSpans.length - 1;
  const hasPrev = currentIndex > 0;

  // Navigation handlers
  const goToNext = useCallback(() => {
    if (hasNext) {
      setCurrentIndex(i => i + 1);
    }
  }, [hasNext]);

  const goToPrev = useCallback(() => {
    if (hasPrev) {
      setCurrentIndex(i => i - 1);
    }
  }, [hasPrev]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToPrev, goToNext]);

  // Load cover for current location's most attended event
  useEffect(() => {
    if (!currentSpan) {
      setCoverUrl(null);
      return;
    }

    const event = currentSpan.mostAttendedEvent;
    fetchEventCover(event.summary, event.description, event.location)
      .then(url => setCoverUrl(url));
  }, [currentSpan]);

  // Hover cover handler with debounce
  const handleEventHover = useCallback((event: ExpandedEvent | null) => {
    if (!event) {
      setHoverCoverUrl(null);
      return;
    }

    fetchEventCover(event.summary, event.description, event.location)
      .then(url => setHoverCoverUrl(url));
  }, []);

  // Determine which cover to show (hover takes priority)
  const displayCoverUrl = hoverCoverUrl || coverUrl;

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
      <CoverBackground imageUrl={displayCoverUrl} />

      <div className="timeline-content">
        <LocationHeader
          location={currentSpan?.location || ''}
          onPrev={goToPrev}
          onNext={goToNext}
          hasPrev={hasPrev}
          hasNext={hasNext}
          currentIndex={currentIndex + 1}
          totalCount={locationSpans.length}
        />

        {currentSpan && (
          <>
            <LocationStats span={currentSpan} />
            <EventList
              events={currentSpan.events}
              calendars={calendars}
              onEventHover={handleEventHover}
            />
          </>
        )}
      </div>
    </div>
  );
}
