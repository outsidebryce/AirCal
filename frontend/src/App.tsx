import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarView } from './components/Calendar';
import { EventModal } from './components/Events';
import { MapView } from './components/Map';
import { Dashboard } from './components/Dashboard';
import { TimelineView } from './components/Timeline';
import { CalendarList } from './components/Sidebar';
import { ConnectForm } from './components/Auth';
import { BookingTypeModal, BookingLinksList } from './components/Booking';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { CalendarModeProvider } from './contexts/CalendarModeContext';
import type { ExpandedEvent } from './types/event';
import logo from './assets/air-intent-logo.png.png';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}

type NavView = 'dashboard' | 'calendar' | 'timeline' | 'map';

function AppContent() {
  const [selectedEvent, setSelectedEvent] = useState<ExpandedEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [activeView, setActiveView] = useState<NavView>('calendar');
  const [defaultEventTimes, setDefaultEventTimes] = useState<{
    start: Date;
    end: Date;
    allDay: boolean;
  } | null>(null);

  const handleEventClick = (event: ExpandedEvent) => {
    setSelectedEvent(event);
    setDefaultEventTimes(null);
    setIsModalOpen(true);
  };

  const handleDateSelect = (start: Date, end: Date, allDay: boolean) => {
    setSelectedEvent(null);
    setDefaultEventTimes({ start, end, allDay });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
    setDefaultEventTimes(null);
  };

  const handleSaveAvailability = () => {
    setIsBookingModalOpen(true);
  };

  const handleCloseBookingModal = () => {
    setIsBookingModalOpen(false);
  };

  return (
    <div className="app">
      <aside className={`sidebar ${sidebarVisible ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <img src={logo} alt="AirCal" className="logo" />
          <span className="logo-text">AirCal</span>
        </div>
        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveView('dashboard')}
            title="Dashboard"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            {sidebarVisible && <span>Dashboard</span>}
          </button>
          <button
            className={`nav-item ${activeView === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveView('calendar')}
            title="Calendar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            {sidebarVisible && <span>Calendar</span>}
          </button>
          <button
            className={`nav-item ${activeView === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveView('timeline')}
            title="Timeline"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="2" x2="12" y2="22"></line>
              <circle cx="12" cy="6" r="2"></circle>
              <circle cx="12" cy="12" r="2"></circle>
              <circle cx="12" cy="18" r="2"></circle>
              <line x1="14" y1="6" x2="20" y2="6"></line>
              <line x1="4" y1="12" x2="10" y2="12"></line>
              <line x1="14" y1="18" x2="20" y2="18"></line>
            </svg>
            {sidebarVisible && <span>Timeline</span>}
          </button>
          <button
            className={`nav-item ${activeView === 'map' ? 'active' : ''}`}
            onClick={() => setActiveView('map')}
            title="Map"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            {sidebarVisible && <span>Map</span>}
          </button>
        </nav>
        {sidebarVisible && (
          <div className="sidebar-content">
            <ConnectForm />
            <CalendarList />
            <BookingLinksList />
          </div>
        )}
        <div className="sidebar-footer">
          <ThemeToggle />
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarVisible(!sidebarVisible)}
            title={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          >
            {sidebarVisible ? '«' : '»'}
          </button>
        </div>
      </aside>

      <main className="main-content">
        {activeView === 'dashboard' && <Dashboard />}
        {activeView === 'calendar' && (
          <CalendarView
            onEventClick={handleEventClick}
            onDateSelect={handleDateSelect}
            onSaveAvailability={handleSaveAvailability}
          />
        )}
        {activeView === 'timeline' && <TimelineView />}
        {activeView === 'map' && <MapView />}
      </main>

      <EventModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        event={selectedEvent}
        defaultStart={defaultEventTimes?.start}
        defaultEnd={defaultEventTimes?.end}
        defaultAllDay={defaultEventTimes?.allDay}
      />

      <BookingTypeModal
        isOpen={isBookingModalOpen}
        onClose={handleCloseBookingModal}
      />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CalendarModeProvider>
          <AppContent />
        </CalendarModeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
