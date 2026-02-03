import type { ExpandedEvent } from '../../types/event';
import type { Calendar } from '../../types/calendar';
import { EventListItem } from './EventListItem';

interface EventListProps {
  events: ExpandedEvent[];
  calendars: Calendar[];
  onEventHover: (event: ExpandedEvent | null) => void;
}

export function EventList({ events, calendars, onEventHover }: EventListProps) {
  // Sort events by date and time
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  return (
    <div className="event-list">
      {sortedEvents.map((event) => {
        const calendar = calendars.find(c => c.id === event.calendar_id);
        return (
          <EventListItem
            key={`${event.uid}-${event.start}`}
            event={event}
            calendar={calendar}
            onHover={onEventHover}
          />
        );
      })}
    </div>
  );
}
