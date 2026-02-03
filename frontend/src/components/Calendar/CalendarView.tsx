import { useRef, useState, useCallback, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import rrulePlugin from '@fullcalendar/rrule';
import type { DateSelectArg, EventClickArg, EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { useEvents, useUpdateEvent } from '../../hooks/useEvents';
import { useCalendars } from '../../hooks/useCalendars';
import { getContrastTextColor } from '../../utils/color';
import type { ExpandedEvent } from '../../types/event';
import type { Calendar } from '../../types/calendar';
import './CalendarView.css';

interface CalendarViewProps {
  onEventClick: (event: ExpandedEvent) => void;
  onDateSelect: (start: Date, end: Date, allDay: boolean) => void;
}

export function CalendarView({ onEventClick, onDateSelect }: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return { start, end };
  });

  // Update calendar size when container resizes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      calendarRef.current?.getApi().updateSize();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const api = calendarRef.current?.getApi();
      if (!api) return;

      switch (e.key.toLowerCase()) {
        case 'm':
          api.changeView('dayGridMonth');
          break;
        case 'w':
          api.changeView('timeGridWeek');
          break;
        case 'd':
          api.changeView('timeGridDay');
          break;
        case 't':
          api.today();
          // Scroll to current time in week/day views
          const viewType = api.view.type;
          if (viewType === 'timeGridWeek' || viewType === 'timeGridDay') {
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            api.scrollToTime(`${hours}:${minutes}:00`);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { data: calendars = [] } = useCalendars();
  const visibleCalendarIds = calendars
    .filter((cal: Calendar) => cal.visible)
    .map((cal: Calendar) => cal.id);

  const { data: events = [] } = useEvents(
    dateRange.start,
    dateRange.end,
    visibleCalendarIds.length > 0 ? visibleCalendarIds : undefined
  );

  const updateEvent = useUpdateEvent();

  // Convert events to FullCalendar format
  const calendarEvents = events.map((event: ExpandedEvent) => {
    const calendar = calendars.find((c: Calendar) => c.id === event.calendar_id);
    const bgColor = calendar?.color || '#3788d8';
    return {
      id: `${event.uid}-${event.start}`,
      title: event.summary,
      start: event.start,
      end: event.end,
      allDay: event.all_day,
      backgroundColor: bgColor,
      borderColor: bgColor,
      textColor: getContrastTextColor(bgColor),
      extendedProps: {
        ...event,
      },
    };
  });

  const handleDateSelect = useCallback(
    (selectInfo: DateSelectArg) => {
      onDateSelect(selectInfo.start, selectInfo.end, selectInfo.allDay);
    },
    [onDateSelect]
  );

  const handleEventClick = useCallback(
    (clickInfo: EventClickArg) => {
      const eventData = clickInfo.event.extendedProps as ExpandedEvent;
      onEventClick(eventData);
    },
    [onEventClick]
  );

  const handleEventDrop = useCallback(
    (dropInfo: EventDropArg) => {
      const event = dropInfo.event.extendedProps as ExpandedEvent;
      updateEvent.mutate({
        uid: event.uid,
        calendarId: event.calendar_id,
        data: {
          start: dropInfo.event.start?.toISOString(),
          end: dropInfo.event.end?.toISOString(),
        },
      });
    },
    [updateEvent]
  );

  const handleEventResize = useCallback(
    (resizeInfo: EventResizeDoneArg) => {
      const event = resizeInfo.event.extendedProps as ExpandedEvent;
      updateEvent.mutate({
        uid: event.uid,
        calendarId: event.calendar_id,
        data: {
          start: resizeInfo.event.start?.toISOString(),
          end: resizeInfo.event.end?.toISOString(),
        },
      });
    },
    [updateEvent]
  );

  const handleDatesSet = useCallback((dateInfo: { start: Date; end: Date }) => {
    setDateRange({ start: dateInfo.start, end: dateInfo.end });
  }, []);

  return (
    <div className="calendar-view" ref={containerRef}>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        events={calendarEvents}
        editable={true}
        selectable={true}
        selectMirror={true}
        dayMaxEvents={true}
        weekends={true}
        fixedWeekCount={false}
        select={handleDateSelect}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        datesSet={handleDatesSet}
        height="100%"
        nowIndicator={true}
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          meridiem: 'short',
        }}
      />
    </div>
  );
}
