import { useRef } from 'react';
import { useCalendars, useUpdateCalendar } from '../../hooks/useCalendars';
import type { Calendar } from '../../types/calendar';
import './CalendarList.css';

export function CalendarList() {
  const { data: calendars = [], isLoading } = useCalendars();
  const updateCalendar = useUpdateCalendar();
  const colorInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleToggleVisibility = (calendar: Calendar) => {
    updateCalendar.mutate({
      id: calendar.id,
      data: { visible: !calendar.visible },
    });
  };

  const handleColorClick = (calendarId: string) => {
    colorInputRefs.current[calendarId]?.click();
  };

  const handleColorChange = (calendar: Calendar, newColor: string) => {
    updateCalendar.mutate({
      id: calendar.id,
      data: { color: newColor },
    });
  };

  if (isLoading) {
    return (
      <div className="calendar-list">
        <h3>My Calendars</h3>
        <p className="loading">Loading...</p>
      </div>
    );
  }

  if (calendars.length === 0) {
    return (
      <div className="calendar-list">
        <h3>My Calendars</h3>
        <p className="empty">No calendars found. Connect to Fastmail first.</p>
      </div>
    );
  }

  return (
    <div className="calendar-list">
      <h3>My Calendars</h3>
      <ul>
        {calendars.map((calendar: Calendar) => (
          <li key={calendar.id} className="calendar-item">
            <label>
              <input
                type="checkbox"
                checked={calendar.visible}
                onChange={() => handleToggleVisibility(calendar)}
                style={{ accentColor: calendar.color }}
              />
              <span
                className="color-dot"
                style={{ backgroundColor: calendar.color }}
                onClick={(e) => {
                  e.preventDefault();
                  handleColorClick(calendar.id);
                }}
                title="Click to change color"
              />
              <input
                ref={(el) => { colorInputRefs.current[calendar.id] = el; }}
                type="color"
                value={calendar.color}
                onChange={(e) => handleColorChange(calendar, e.target.value)}
                className="color-picker-input"
              />
              <span className="calendar-name">{calendar.name}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
