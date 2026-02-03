import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CalendarView } from './components/Calendar';
import { EventModal } from './components/Events';
import { CalendarList } from './components/Sidebar';
import { ConnectForm } from './components/Auth';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
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

function AppContent() {
  const [selectedEvent, setSelectedEvent] = useState<ExpandedEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
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

  return (
    <div className="app">
      <aside className={`sidebar ${sidebarVisible ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <img src={logo} alt="AirCal" className="logo" />
          <span className="logo-text">AirCal</span>
        </div>
        {sidebarVisible && (
          <div className="sidebar-content">
            <ConnectForm />
            <CalendarList />
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
        <CalendarView
          onEventClick={handleEventClick}
          onDateSelect={handleDateSelect}
        />
      </main>

      <EventModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        event={selectedEvent}
        defaultStart={defaultEventTimes?.start}
        defaultEnd={defaultEventTimes?.end}
        defaultAllDay={defaultEventTimes?.allDay}
      />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
