import type { ExpandedEvent } from '../../types/event';
import type { Calendar } from '../../types/calendar';

interface EventListItemProps {
  event: ExpandedEvent;
  calendar: Calendar | undefined;
  onHover: (event: ExpandedEvent | null) => void;
}

function formatEventTime(event: ExpandedEvent): string {
  if (event.all_day) {
    return 'All day';
  }
  const start = new Date(event.start);
  return start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatEventDate(event: ExpandedEvent): string {
  const start = new Date(event.start);
  return start.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function EventListItem({ event, calendar, onHover }: EventListItemProps) {
  return (
    <div
      className="event-item"
      onMouseEnter={() => onHover(event)}
      onMouseLeave={() => onHover(null)}
    >
      <div
        className="event-calendar-dot"
        style={{ backgroundColor: calendar?.color || '#3788d8' }}
      />
      <div className="event-time">{formatEventTime(event)}</div>
      <div className="event-title">{event.summary}</div>
      <div className="event-date">{formatEventDate(event)}</div>
    </div>
  );
}
