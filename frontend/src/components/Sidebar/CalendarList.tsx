import { useCalendars, useUpdateCalendar } from '../../hooks/useCalendars';
import type { Calendar } from '../../types/calendar';
import './CalendarList.css';

export function CalendarList() {
  const { data: calendars = [], isLoading } = useCalendars();
  const updateCalendar = useUpdateCalendar();

  const handleToggleVisibility = (calendar: Calendar) => {
    updateCalendar.mutate({
      id: calendar.id,
      data: { visible: !calendar.visible },
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
              />
              <span className="calendar-name">{calendar.name}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
