import { useState, useMemo } from 'react';
import { useEvents } from '../../hooks/useEvents';
import { useCalendars } from '../../hooks/useCalendars';
import { useWeather, getWeatherIcon } from '../../hooks/useWeather';
import { EventCoversTest } from './EventCoversTest';
import { getUnsplashUrl, extractKeywords } from '../../utils/eventCovers';
import type { ExpandedEvent } from '../../types/event';
import type { Calendar } from '../../types/calendar';
import './Dashboard.css';

type DateRangeType = 'week' | 'month' | 'quarter' | 'year';
type DashboardTab = 'analytics' | 'covers';

interface EventStats {
  totalEvents: number;
  totalHours: number;
  avgDuration: number;
  blockedPercent: number;
  freePercent: number;
  eventsByDay: Record<string, number>;
  eventsByHour: number[];
  topEventTypes: { name: string; count: number; hours: number }[];
  eventsByCalendar: { name: string; color: string; count: number; hours: number }[];
  busiestDay: string;
  quietestDay: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getEventDuration(event: ExpandedEvent): number {
  const start = new Date(event.start);
  const end = new Date(event.end);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60); // hours
}

function formatHours(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('analytics');
  const [rangeType, setRangeType] = useState<DateRangeType>('month');
  const [baseDate] = useState(() => new Date());

  const dateRange = useMemo(() => {
    const now = baseDate;
    switch (rangeType) {
      case 'week': {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end, totalHours: 7 * 24 };
      }
      case 'month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        const days = end.getDate();
        return { start, end, totalHours: days * 24 };
      }
      case 'quarter': {
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        const start = new Date(now.getFullYear(), quarterStart, 1);
        const end = new Date(now.getFullYear(), quarterStart + 3, 0, 23, 59, 59, 999);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return { start, end, totalHours: days * 24 };
      }
      case 'year': {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        const days = 365 + (now.getFullYear() % 4 === 0 ? 1 : 0);
        return { start, end, totalHours: days * 24 };
      }
    }
  }, [rangeType, baseDate]);

  const { data: calendars = [] } = useCalendars();
  const { data: weather } = useWeather();
  const visibleCalendarIds = useMemo(
    () =>
      calendars
        .filter((cal: Calendar) => cal.visible)
        .map((cal: Calendar) => cal.id),
    [calendars]
  );

  const { data: events = [], isLoading } = useEvents(
    dateRange.start,
    dateRange.end,
    visibleCalendarIds.length > 0 ? visibleCalendarIds : undefined
  );

  // Fetch upcoming events for the "Next Up" and agenda widgets
  const upcomingRange = useMemo(() => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 14); // Look ahead 2 weeks
    return { start: now, end };
  }, []);

  const { data: upcomingEvents = [] } = useEvents(
    upcomingRange.start,
    upcomingRange.end,
    visibleCalendarIds.length > 0 ? visibleCalendarIds : undefined
  );

  // Get sorted upcoming events (next 5)
  const nextEvents = useMemo(() => {
    const now = new Date();
    return upcomingEvents
      .filter((e: ExpandedEvent) => new Date(e.start) > now)
      .sort((a: ExpandedEvent, b: ExpandedEvent) =>
        new Date(a.start).getTime() - new Date(b.start).getTime()
      )
      .slice(0, 5);
  }, [upcomingEvents]);

  const nextEvent = nextEvents[0] || null;

  // Get cover image for next event
  const nextEventCover = useMemo(() => {
    if (!nextEvent) return null;
    const keywords = extractKeywords(nextEvent.summary, nextEvent.description, nextEvent.location);
    return getUnsplashUrl(keywords, 600, 300);
  }, [nextEvent]);

  // Format time for agenda
  const formatEventTime = (dateStr: string, allDay: boolean) => {
    if (allDay) return 'All day';
    const date = new Date(dateStr);
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  // Format date for agenda (relative)
  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === now.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  const stats: EventStats = useMemo(() => {
    const eventsByDay: Record<string, number> = {};
    DAYS.forEach((day) => (eventsByDay[day] = 0));
    const eventsByHour: number[] = new Array(24).fill(0);
    const eventTypeMap: Record<string, { count: number; hours: number }> = {};
    const calendarMap: Record<string, { name: string; color: string; count: number; hours: number }> = {};

    let totalHours = 0;

    events.forEach((event: ExpandedEvent) => {
      const duration = getEventDuration(event);
      totalHours += duration;

      // By day of week
      const dayOfWeek = new Date(event.start).getDay();
      eventsByDay[DAYS[dayOfWeek]]++;

      // By hour
      const hour = new Date(event.start).getHours();
      eventsByHour[hour]++;

      // By event type (summary)
      const summary = event.summary || 'Untitled';
      if (!eventTypeMap[summary]) {
        eventTypeMap[summary] = { count: 0, hours: 0 };
      }
      eventTypeMap[summary].count++;
      eventTypeMap[summary].hours += duration;

      // By calendar
      const calendar = calendars.find((c: Calendar) => c.id === event.calendar_id);
      const calName = calendar?.name || 'Unknown';
      if (!calendarMap[calName]) {
        calendarMap[calName] = {
          name: calName,
          color: calendar?.color || '#6b7280',
          count: 0,
          hours: 0,
        };
      }
      calendarMap[calName].count++;
      calendarMap[calName].hours += duration;
    });

    // Top 10 event types
    const topEventTypes = Object.entries(eventTypeMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Events by calendar
    const eventsByCalendar = Object.values(calendarMap).sort((a, b) => b.hours - a.hours);

    // Busiest and quietest days
    const dayEntries = Object.entries(eventsByDay);
    const busiestDay = dayEntries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    const quietestDay = dayEntries.reduce((a, b) => (b[1] < a[1] ? b : a))[0];

    // Calculate blocked percentage (assuming 8 working hours per day)
    const workingHours = dateRange.totalHours * (8 / 24); // Only count ~8h work day
    const blockedPercent = Math.min(100, (totalHours / workingHours) * 100);

    return {
      totalEvents: events.length,
      totalHours,
      avgDuration: events.length > 0 ? totalHours / events.length : 0,
      blockedPercent,
      freePercent: 100 - blockedPercent,
      eventsByDay,
      eventsByHour,
      topEventTypes,
      eventsByCalendar,
      busiestDay,
      quietestDay,
    };
  }, [events, calendars, dateRange.totalHours]);

  const maxByDay = Math.max(...Object.values(stats.eventsByDay), 1);
  const maxByHour = Math.max(...stats.eventsByHour, 1);

  const getRangeLabel = () => {
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    const start = dateRange.start.toLocaleDateString(undefined, opts);
    const end = dateRange.end.toLocaleDateString(undefined, opts);
    return `${start} - ${end}`;
  };

  if (activeTab === 'covers') {
    return (
      <div className="dashboard">
        <div className="dashboard-header">
          <div className="dashboard-tabs">
            <button
              className="tab-btn"
              onClick={() => setActiveTab('analytics')}
            >
              Analytics
            </button>
            <button
              className="tab-btn active"
              onClick={() => setActiveTab('covers')}
            >
              Event Covers
            </button>
          </div>
        </div>
        <EventCoversTest />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="dashboard loading">
        <div className="loading-spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="dashboard-title-row">
          <div className="dashboard-tabs">
            <button
              className="tab-btn active"
              onClick={() => setActiveTab('analytics')}
            >
              Analytics
            </button>
            <button
              className="tab-btn"
              onClick={() => setActiveTab('covers')}
            >
              Event Covers
            </button>
          </div>
        </div>
        <div className="range-selector">
          <span className="range-label">{getRangeLabel()}</span>
          <div className="btn-group">
            {(['week', 'month', 'quarter', 'year'] as DateRangeType[]).map((type) => (
              <button
                key={type}
                className={`range-btn ${rangeType === type ? 'active' : ''}`}
                onClick={() => setRangeType(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Next Up Widget */}
        <div
          className="widget-card next-up-widget"
          style={{
            backgroundImage: nextEventCover ? `url(${nextEventCover})` : undefined,
          }}
        >
          <div className="widget-overlay">
            {weather && (
              <div className="widget-weather">
                <span className="weather-icon">{getWeatherIcon(weather.weatherCode)}</span>
                <div className="weather-info">
                  <span className="weather-temp">{weather.temperature}°</span>
                  <span className="weather-location">{weather.location}</span>
                </div>
              </div>
            )}
            <div className="widget-content">
              {nextEvent ? (
                <>
                  <div className="widget-label">Next Up</div>
                  <div className="widget-title">{nextEvent.summary}</div>
                  <div className="widget-meta">
                    <span className="widget-time">
                      {formatEventDate(nextEvent.start)} at {formatEventTime(nextEvent.start, nextEvent.all_day)}
                    </span>
                    {nextEvent.location && (
                      <span className="widget-location">{nextEvent.location}</span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="widget-label">Next Up</div>
                  <div className="widget-title">No upcoming events</div>
                  <div className="widget-meta">
                    <span className="widget-time">You're all clear!</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mini Agenda Widget */}
        <div className="widget-card agenda-widget">
          <div className="agenda-header">
            <span className="agenda-title">Upcoming</span>
            <span className="agenda-count">{nextEvents.length} events</span>
          </div>
          <div className="agenda-list">
            {nextEvents.length === 0 ? (
              <div className="agenda-empty">No upcoming events</div>
            ) : (
              nextEvents.map((event: ExpandedEvent, index: number) => (
                <div key={`${event.uid}-${index}`} className="agenda-item">
                  <div className="agenda-item-time">
                    <span className="agenda-item-date">{formatEventDate(event.start)}</span>
                    <span className="agenda-item-hour">{formatEventTime(event.start, event.all_day)}</span>
                  </div>
                  <div className="agenda-item-dot"></div>
                  <div className="agenda-item-content">
                    <span className="agenda-item-title">{event.summary}</span>
                    {event.location && (
                      <span className="agenda-item-location">{event.location}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="stat-card">
          <div className="stat-value">{stats.totalEvents}</div>
          <div className="stat-label">Total Events</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatHours(stats.totalHours)}</div>
          <div className="stat-label">Time Scheduled</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatHours(stats.avgDuration)}</div>
          <div className="stat-label">Avg Duration</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.busiestDay}</div>
          <div className="stat-label">Busiest Day</div>
        </div>

        {/* Time Blocked Gauge */}
        <div className="chart-card gauge-card">
          <h3>Time Utilization</h3>
          <div className="gauge">
            <div className="gauge-background">
              <div
                className="gauge-fill"
                style={{ width: `${stats.blockedPercent}%` }}
              ></div>
            </div>
            <div className="gauge-labels">
              <span>{Math.round(stats.blockedPercent)}% Scheduled</span>
              <span>{Math.round(stats.freePercent)}% Available</span>
            </div>
          </div>
          <p className="gauge-note">Based on 8-hour workdays</p>
        </div>

        {/* Events by Day of Week */}
        <div className="chart-card">
          <h3>Events by Day of Week</h3>
          <div className="bar-chart horizontal">
            {DAYS.map((day) => (
              <div key={day} className="bar-row">
                <span className="bar-label">{day.slice(0, 3)}</span>
                <div className="bar-container">
                  <div
                    className="bar"
                    style={{ width: `${(stats.eventsByDay[day] / maxByDay) * 100}%` }}
                  ></div>
                </div>
                <span className="bar-value">{stats.eventsByDay[day]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Events by Hour */}
        <div className="chart-card wide">
          <h3>Events by Hour of Day</h3>
          <div className="bar-chart vertical">
            {stats.eventsByHour.map((count, hour) => (
              <div key={hour} className="bar-col">
                <div className="bar-wrapper">
                  <div
                    className="bar"
                    style={{ height: `${(count / maxByHour) * 100}%` }}
                  ></div>
                </div>
                <span className="bar-label">{hour}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Event Types */}
        <div className="chart-card list-card">
          <h3>Top Meeting Types</h3>
          {stats.topEventTypes.length === 0 ? (
            <p className="empty-message">No events in this period</p>
          ) : (
            <div className="event-list">
              {stats.topEventTypes.map((type, i) => (
                <div key={type.name} className="event-row">
                  <span className="rank">#{i + 1}</span>
                  <span className="event-name">{type.name}</span>
                  <span className="event-count">{type.count}x</span>
                  <span className="event-hours">{formatHours(type.hours)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Events by Calendar */}
        <div className="chart-card list-card">
          <h3>Time by Calendar</h3>
          {stats.eventsByCalendar.length === 0 ? (
            <p className="empty-message">No events in this period</p>
          ) : (
            <div className="calendar-list">
              {stats.eventsByCalendar.map((cal) => (
                <div key={cal.name} className="calendar-row">
                  <span className="calendar-dot" style={{ backgroundColor: cal.color }}></span>
                  <span className="calendar-name">{cal.name}</span>
                  <span className="calendar-count">{cal.count} events</span>
                  <span className="calendar-hours">{formatHours(cal.hours)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
