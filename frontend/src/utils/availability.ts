/**
 * Availability Utilities
 *
 * Functions for converting between different availability formats
 * and generating human-readable shorthand descriptions.
 */

import type { AvailabilityBlock, PendingAvailabilityBlock } from '../types/booking';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Convert pending availability blocks (from calendar drawing) to AvailabilityBlock format.
 * Groups blocks by day of week and time slot.
 */
export function pendingBlocksToAvailability(
  blocks: PendingAvailabilityBlock[]
): AvailabilityBlock[] {
  const availability: AvailabilityBlock[] = [];

  blocks.forEach((block) => {
    const dayOfWeek = block.start.getDay();
    const startTime = formatTime(block.start);
    const endTime = formatTime(block.end);

    availability.push({
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
    });
  });

  // Sort by day of week, then by start time
  return availability.sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) {
      return a.day_of_week - b.day_of_week;
    }
    return a.start_time.localeCompare(b.start_time);
  });
}

/**
 * Format a Date to HH:MM string.
 */
export function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Format time for display (e.g., "9am", "2:30pm")
 */
export function formatTimeDisplay(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'pm' : 'am';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const displayMinutes = minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : '';
  return `${displayHours}${displayMinutes}${period}`;
}

/**
 * Generate a human-readable shorthand for availability.
 * e.g., "Mon-Fri 9am-5pm" or "Mon, Wed, Fri 10am-2pm"
 */
export function getAvailabilityShorthand(availability: AvailabilityBlock[]): string {
  if (availability.length === 0) {
    return 'No availability set';
  }

  // Group by time slot
  const timeSlotGroups: Record<string, number[]> = {};

  availability.forEach((block) => {
    const key = `${block.start_time}-${block.end_time}`;
    if (!timeSlotGroups[key]) {
      timeSlotGroups[key] = [];
    }
    if (!timeSlotGroups[key].includes(block.day_of_week)) {
      timeSlotGroups[key].push(block.day_of_week);
    }
  });

  // Generate shorthand for each time slot group
  const parts = Object.entries(timeSlotGroups).map(([timeSlot, days]) => {
    const [startTime, endTime] = timeSlot.split('-');
    const daysStr = formatDaysShorthand(days.sort((a, b) => a - b));
    return `${daysStr} ${formatTimeDisplay(startTime)}-${formatTimeDisplay(endTime)}`;
  });

  return parts.join(', ');
}

/**
 * Format days as a shorthand string.
 * Consecutive days become ranges (e.g., "Mon-Fri")
 * Non-consecutive days are comma-separated (e.g., "Mon, Wed, Fri")
 */
function formatDaysShorthand(days: number[]): string {
  if (days.length === 0) return '';
  if (days.length === 1) return DAYS[days[0]];

  // Check for consecutive ranges
  const ranges: { start: number; end: number }[] = [];
  let rangeStart = days[0];
  let rangeEnd = days[0];

  for (let i = 1; i < days.length; i++) {
    if (days[i] === rangeEnd + 1) {
      rangeEnd = days[i];
    } else {
      ranges.push({ start: rangeStart, end: rangeEnd });
      rangeStart = days[i];
      rangeEnd = days[i];
    }
  }
  ranges.push({ start: rangeStart, end: rangeEnd });

  return ranges
    .map((range) => {
      if (range.start === range.end) {
        return DAYS[range.start];
      } else if (range.end - range.start === 1) {
        return `${DAYS[range.start]}, ${DAYS[range.end]}`;
      } else {
        return `${DAYS[range.start]}-${DAYS[range.end]}`;
      }
    })
    .join(', ');
}

/**
 * Get full day names for display.
 */
export function getDayName(dayOfWeek: number): string {
  return FULL_DAYS[dayOfWeek] || '';
}

/**
 * Check if two availability blocks overlap.
 */
export function blocksOverlap(a: AvailabilityBlock, b: AvailabilityBlock): boolean {
  if (a.day_of_week !== b.day_of_week) return false;

  const aStart = timeToMinutes(a.start_time);
  const aEnd = timeToMinutes(a.end_time);
  const bStart = timeToMinutes(b.start_time);
  const bEnd = timeToMinutes(b.end_time);

  return aStart < bEnd && bStart < aEnd;
}

/**
 * Convert HH:MM to minutes since midnight.
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Merge overlapping availability blocks for the same day.
 */
export function mergeAvailabilityBlocks(blocks: AvailabilityBlock[]): AvailabilityBlock[] {
  const byDay: Record<number, AvailabilityBlock[]> = {};

  // Group by day
  blocks.forEach((block) => {
    if (!byDay[block.day_of_week]) {
      byDay[block.day_of_week] = [];
    }
    byDay[block.day_of_week].push(block);
  });

  // Merge overlapping blocks within each day
  const merged: AvailabilityBlock[] = [];

  Object.entries(byDay).forEach(([_day, dayBlocks]) => {
    // Sort by start time
    dayBlocks.sort((a, b) => a.start_time.localeCompare(b.start_time));

    let current = { ...dayBlocks[0] };

    for (let i = 1; i < dayBlocks.length; i++) {
      const next = dayBlocks[i];
      if (blocksOverlap(current, next) || current.end_time === next.start_time) {
        // Merge: extend end time if needed
        if (next.end_time > current.end_time) {
          current.end_time = next.end_time;
        }
      } else {
        merged.push(current);
        current = { ...next };
      }
    }

    merged.push(current);
  });

  return merged.sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) {
      return a.day_of_week - b.day_of_week;
    }
    return a.start_time.localeCompare(b.start_time);
  });
}
