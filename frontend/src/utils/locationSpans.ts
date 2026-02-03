import type { ExpandedEvent } from '../types/event';

export interface LocationSpan {
  location: string;
  startDate: Date;
  endDate: Date;
  events: ExpandedEvent[];
  totalMinutes: number;
  locationEvent: ExpandedEvent; // The event that defined this location
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Computes location spans from events.
 * Rule: If a day has an event with a location, that location applies to ALL events
 * on that day AND succeeding days until a new event with a different location appears.
 */
export function computeLocationSpans(events: ExpandedEvent[]): LocationSpan[] {
  if (events.length === 0) return [];

  // Sort events by start date
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  // Group events by date
  const eventsByDate = new Map<string, ExpandedEvent[]>();
  for (const event of sortedEvents) {
    const dateKey = formatDateKey(new Date(event.start));
    if (!eventsByDate.has(dateKey)) {
      eventsByDate.set(dateKey, []);
    }
    eventsByDate.get(dateKey)!.push(event);
  }

  // Get sorted dates
  const sortedDates = Array.from(eventsByDate.keys()).sort();

  // Track governing location and build spans
  const spans: LocationSpan[] = [];
  let currentLocation: string | null = null;
  let currentSpan: LocationSpan | null = null;

  for (const dateKey of sortedDates) {
    const dayEvents = eventsByDate.get(dateKey)!;
    const date = new Date(dateKey + 'T00:00:00');

    // Find the first event with a location on this day
    const eventWithLocation = dayEvents.find(e => e.location && e.location.trim() !== '');
    const dayLocation = eventWithLocation?.location?.trim() || null;

    // If we found a new location, it becomes the governing location
    if (dayLocation && dayLocation !== currentLocation && eventWithLocation) {
      // Close the current span if exists
      if (currentSpan) {
        spans.push(currentSpan);
      }

      // Start a new span
      currentLocation = dayLocation;
      currentSpan = {
        location: dayLocation,
        startDate: date,
        endDate: date,
        events: [],
        totalMinutes: 0,
        locationEvent: eventWithLocation,
      };
    }

    // Add events to current span (if we have a governing location)
    if (currentSpan) {
      currentSpan.endDate = date;
      for (const event of dayEvents) {
        currentSpan.events.push(event);
        // Calculate duration
        const start = new Date(event.start);
        const end = new Date(event.end);
        const durationMs = end.getTime() - start.getTime();
        currentSpan.totalMinutes += Math.max(0, durationMs / 60000);
      }
    }
  }

  // Don't forget the last span
  if (currentSpan) {
    spans.push(currentSpan);
  }

  return spans;
}

export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatDateRange(start: Date, end: Date): string {
  const sameDay = formatDateKey(start) === formatDateKey(end);

  if (sameDay) {
    return start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.getDate()}, ${end.getFullYear()}`;
  }

  if (sameYear) {
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${end.getFullYear()}`;
  }

  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
