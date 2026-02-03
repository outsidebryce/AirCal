/**
 * Location Spans Utility
 *
 * Computes "location spans" from calendar events. A location span is a period
 * where a location applies to all events, starting from when an event with that
 * location first appears until an event with a different location is encountered.
 */

import type { ExpandedEvent } from '../types/event';

export interface LocationSpan {
  location: string;
  startDate: Date;
  endDate: Date;
  events: ExpandedEvent[];
  totalMinutes: number;
  mostAttendedEvent: ExpandedEvent;
}

/**
 * Compute location spans from a list of events.
 *
 * Algorithm:
 * 1. Sort events by start date
 * 2. Group events by date
 * 3. Track "governing location" - inherits forward until new location found
 * 4. Build spans from consecutive dates with same location
 */
export function computeLocationSpans(events: ExpandedEvent[]): LocationSpan[] {
  if (events.length === 0) return [];

  // Step 1: Sort all events by start date
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  // Step 2: Group events by date (YYYY-MM-DD)
  const eventsByDate = new Map<string, ExpandedEvent[]>();
  for (const event of sortedEvents) {
    const dateKey = new Date(event.start).toISOString().split('T')[0];
    if (!eventsByDate.has(dateKey)) {
      eventsByDate.set(dateKey, []);
    }
    eventsByDate.get(dateKey)!.push(event);
  }

  // Step 3: Determine the "governing location" for each date
  // A date's governing location is the location of an event WITH a location on that date,
  // or the governing location of the previous date (inheritance)
  const dateLocations = new Map<string, string | null>();
  const sortedDates = Array.from(eventsByDate.keys()).sort();

  let currentLocation: string | null = null;

  for (const dateKey of sortedDates) {
    const dayEvents = eventsByDate.get(dateKey)!;

    // Check if any event on this day has a location (take the first one with location)
    const eventWithLocation = dayEvents.find(e => e.location && e.location.trim() !== '');

    if (eventWithLocation) {
      currentLocation = eventWithLocation.location!.trim();
    }

    dateLocations.set(dateKey, currentLocation);
  }

  // Step 4: Build location spans by grouping consecutive dates with same location
  const spans: LocationSpan[] = [];
  let currentSpan: {
    location: string;
    startDate: string;
    endDate: string;
    events: ExpandedEvent[];
  } | null = null;

  for (const dateKey of sortedDates) {
    const location = dateLocations.get(dateKey);
    const dayEvents = eventsByDate.get(dateKey)!;

    if (!location) {
      // No location yet (events before any location-bearing event)
      // These events won't be part of any span
      continue;
    }

    if (!currentSpan || currentSpan.location !== location) {
      // Start new span
      if (currentSpan) {
        spans.push(finalizeSpan(currentSpan));
      }
      currentSpan = {
        location,
        startDate: dateKey,
        endDate: dateKey,
        events: [...dayEvents],
      };
    } else {
      // Extend current span
      currentSpan.endDate = dateKey;
      currentSpan.events.push(...dayEvents);
    }
  }

  // Don't forget the last span
  if (currentSpan) {
    spans.push(finalizeSpan(currentSpan));
  }

  return spans;
}

/**
 * Finalize a span by calculating aggregates
 */
function finalizeSpan(span: {
  location: string;
  startDate: string;
  endDate: string;
  events: ExpandedEvent[];
}): LocationSpan {
  // Calculate total time in minutes
  const totalMinutes = span.events.reduce((sum, event) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    return sum + (end.getTime() - start.getTime()) / (1000 * 60);
  }, 0);

  // Find most attended event (by counting occurrences of same summary)
  const eventCounts = new Map<string, { count: number; event: ExpandedEvent }>();
  for (const event of span.events) {
    const key = event.summary.toLowerCase().trim();
    if (!eventCounts.has(key)) {
      eventCounts.set(key, { count: 0, event });
    }
    eventCounts.get(key)!.count++;
  }

  const mostAttended = Array.from(eventCounts.values())
    .sort((a, b) => b.count - a.count)[0];

  return {
    location: span.location,
    startDate: new Date(span.startDate),
    endDate: new Date(span.endDate),
    events: span.events,
    totalMinutes,
    mostAttendedEvent: mostAttended?.event || span.events[0],
  };
}

/**
 * Format minutes as human-readable duration
 */
export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);

  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

/**
 * Format a date range for display
 */
export function formatDateRange(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  const sameDay = sameMonth && start.getDate() === end.getDate();

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (sameDay) {
    return `${monthNames[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
  }

  if (sameMonth) {
    return `${monthNames[start.getMonth()]} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
  }

  if (sameYear) {
    return `${monthNames[start.getMonth()]} ${start.getDate()} - ${monthNames[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`;
  }

  return `${monthNames[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()} - ${monthNames[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
}
