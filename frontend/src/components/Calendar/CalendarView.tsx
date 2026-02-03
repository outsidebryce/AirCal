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
import { useBookingTypes } from '../../hooks/useBookings';
import { useCalendarMode } from '../../contexts/CalendarModeContext';
import { getContrastTextColor } from '../../utils/color';
import type { ExpandedEvent } from '../../types/event';
import type { Calendar } from '../../types/calendar';
import type { BookingType } from '../../types/booking';
import './CalendarView.css';

interface CalendarViewProps {
  onEventClick: (event: ExpandedEvent) => void;
  onDateSelect: (start: Date, end: Date, allDay: boolean) => void;
  onSaveAvailability?: () => void;
}

export function CalendarView({ onEventClick, onDateSelect, onSaveAvailability }: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return { start, end };
  });

  const { mode, setMode, pendingBlocks, addPendingBlock, removePendingBlock, clearPendingBlocks, isReadyToSave } =
    useCalendarMode();

  // Switch to week view when entering availability mode
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    if (mode === 'availability') {
      api.changeView('timeGridWeek');
    }
  }, [mode]);

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

      // Don't allow view changes in availability mode
      if (mode === 'availability') {
        if (e.key.toLowerCase() === 'escape') {
          clearPendingBlocks();
          setMode('events');
        }
        return;
      }

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
  }, [mode, setMode, clearPendingBlocks]);

  const { data: calendars = [] } = useCalendars();
  const { data: bookingTypes = [] } = useBookingTypes();
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
    const isAvailabilityMode = mode === 'availability';

    return {
      id: `${event.uid}-${event.start}`,
      title: event.summary,
      start: event.start,
      end: event.end,
      allDay: event.all_day,
      backgroundColor: bgColor,
      borderColor: bgColor,
      textColor: getContrastTextColor(bgColor),
      classNames: isAvailabilityMode ? ['availability-mode-event'] : [],
      editable: !isAvailabilityMode,
      extendedProps: {
        ...event,
      },
    };
  });

  // Add pending availability blocks as events
  const pendingAvailabilityEvents = pendingBlocks.map((block) => ({
    id: block.id,
    title: 'Available',
    start: block.start,
    end: block.end,
    allDay: false,
    backgroundColor: 'rgba(34, 197, 94, 0.3)',
    borderColor: '#22c55e',
    textColor: '#166534',
    classNames: ['availability-block', 'pending'],
    editable: true,
    extendedProps: {
      isAvailabilityBlock: true,
      isPending: true,
      blockId: block.id,
    },
  }));

  // Convert saved booking types to recurring availability events
  const savedAvailabilityEvents = bookingTypes
    .filter((bt: BookingType) => bt.active && bt.availability.length > 0)
    .flatMap((bt: BookingType) => {
      // Generate events for the current date range based on availability
      const events: Array<{
        id: string;
        title: string;
        daysOfWeek: number[];
        startTime: string;
        endTime: string;
        backgroundColor: string;
        borderColor: string;
        textColor: string;
        classNames: string[];
        editable: boolean;
        extendedProps: {
          isAvailabilityBlock: boolean;
          isSaved: boolean;
          bookingTypeId: string;
          bookingTypeName: string;
        };
      }> = [];

      // Group availability by time slot
      const timeSlots: Record<string, number[]> = {};
      bt.availability.forEach((block) => {
        const key = `${block.start_time}-${block.end_time}`;
        if (!timeSlots[key]) {
          timeSlots[key] = [];
        }
        timeSlots[key].push(block.day_of_week);
      });

      Object.entries(timeSlots).forEach(([timeSlot, days]) => {
        const [startTime, endTime] = timeSlot.split('-');
        events.push({
          id: `booking-${bt.id}-${timeSlot}`,
          title: bt.name,
          daysOfWeek: days,
          startTime,
          endTime,
          backgroundColor: 'rgba(34, 197, 94, 0.2)',
          borderColor: '#22c55e',
          textColor: '#166534',
          classNames: ['availability-block', 'saved'],
          editable: false,
          extendedProps: {
            isAvailabilityBlock: true,
            isSaved: true,
            bookingTypeId: bt.id,
            bookingTypeName: bt.name,
          },
        });
      });

      return events;
    });

  const allEvents = [...calendarEvents, ...pendingAvailabilityEvents, ...savedAvailabilityEvents];

  const handleDateSelect = useCallback(
    (selectInfo: DateSelectArg) => {
      if (mode === 'availability') {
        addPendingBlock({
          start: selectInfo.start,
          end: selectInfo.end,
        });
        calendarRef.current?.getApi().unselect();
      } else {
        onDateSelect(selectInfo.start, selectInfo.end, selectInfo.allDay);
      }
    },
    [mode, addPendingBlock, onDateSelect]
  );

  const handleEventClick = useCallback(
    (clickInfo: EventClickArg) => {
      const extendedProps = clickInfo.event.extendedProps;

      if (extendedProps.isAvailabilityBlock) {
        if (extendedProps.isPending) {
          removePendingBlock(extendedProps.blockId);
        }
        // For saved availability blocks, could open a delete confirmation
        return;
      }

      if (mode === 'availability') {
        return;
      }

      const eventData = extendedProps as ExpandedEvent;
      onEventClick(eventData);
    },
    [mode, removePendingBlock, onEventClick]
  );

  const handleEventDrop = useCallback(
    (dropInfo: EventDropArg) => {
      const extendedProps = dropInfo.event.extendedProps;

      if (extendedProps.isAvailabilityBlock) {
        if (extendedProps.isPending) {
          removePendingBlock(extendedProps.blockId);
          if (dropInfo.event.start && dropInfo.event.end) {
            addPendingBlock({
              start: dropInfo.event.start,
              end: dropInfo.event.end,
            });
          }
        } else {
          dropInfo.revert();
        }
        return;
      }

      if (mode === 'availability') {
        dropInfo.revert();
        return;
      }

      const event = extendedProps as ExpandedEvent;
      updateEvent.mutate({
        uid: event.uid,
        calendarId: event.calendar_id,
        data: {
          start: dropInfo.event.start?.toISOString(),
          end: dropInfo.event.end?.toISOString(),
        },
      });
    },
    [mode, updateEvent, removePendingBlock, addPendingBlock]
  );

  const handleEventResize = useCallback(
    (resizeInfo: EventResizeDoneArg) => {
      const extendedProps = resizeInfo.event.extendedProps;

      if (extendedProps.isAvailabilityBlock) {
        if (extendedProps.isPending) {
          removePendingBlock(extendedProps.blockId);
          if (resizeInfo.event.start && resizeInfo.event.end) {
            addPendingBlock({
              start: resizeInfo.event.start,
              end: resizeInfo.event.end,
            });
          }
        } else {
          resizeInfo.revert();
        }
        return;
      }

      if (mode === 'availability') {
        resizeInfo.revert();
        return;
      }

      const event = extendedProps as ExpandedEvent;
      updateEvent.mutate({
        uid: event.uid,
        calendarId: event.calendar_id,
        data: {
          start: resizeInfo.event.start?.toISOString(),
          end: resizeInfo.event.end?.toISOString(),
        },
      });
    },
    [mode, updateEvent, removePendingBlock, addPendingBlock]
  );

  const handleDatesSet = useCallback((dateInfo: { start: Date; end: Date }) => {
    setDateRange({ start: dateInfo.start, end: dateInfo.end });
  }, []);

  const handleSave = () => {
    if (onSaveAvailability && isReadyToSave) {
      onSaveAvailability();
    }
  };

  const handleCancel = () => {
    clearPendingBlocks();
    setMode('events');
  };

  const handleModeChange = (newMode: 'events' | 'availability') => {
    if (newMode === mode) return;
    setMode(newMode);
  };

  // Custom buttons for FullCalendar header
  const customButtons = {
    eventsMode: {
      text: 'Events',
      click: () => handleModeChange('events'),
    },
    availabilityMode: {
      text: 'Availability',
      click: () => handleModeChange('availability'),
    },
    cancelAvailability: {
      text: 'Cancel',
      click: handleCancel,
    },
    saveAvailability: {
      text: 'Save Availability',
      click: handleSave,
    },
  };

  // Dynamic header toolbar based on mode
  const headerToolbar = mode === 'availability'
    ? {
        left: 'eventsMode,availabilityMode prev,next today',
        center: 'title',
        right: 'cancelAvailability,saveAvailability',
      }
    : {
        left: 'eventsMode,availabilityMode prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay',
      };

  return (
    <div className={`calendar-view ${mode === 'availability' ? 'availability-mode' : ''}`} ref={containerRef}>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin]}
        initialView="dayGridMonth"
        customButtons={customButtons}
        headerToolbar={headerToolbar}
        events={allEvents}
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
