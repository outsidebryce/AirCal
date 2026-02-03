import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { CalendarMode, PendingAvailabilityBlock } from '../types/booking';

interface CalendarModeContextType {
  mode: CalendarMode;
  setMode: (mode: CalendarMode) => void;
  pendingBlocks: PendingAvailabilityBlock[];
  addPendingBlock: (block: Omit<PendingAvailabilityBlock, 'id'>) => void;
  removePendingBlock: (id: string) => void;
  clearPendingBlocks: () => void;
  isReadyToSave: boolean;
}

const CalendarModeContext = createContext<CalendarModeContextType | null>(null);

export function CalendarModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<CalendarMode>('events');
  const [pendingBlocks, setPendingBlocks] = useState<PendingAvailabilityBlock[]>([]);

  const addPendingBlock = useCallback((block: Omit<PendingAvailabilityBlock, 'id'>) => {
    const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setPendingBlocks((prev) => [...prev, { ...block, id }]);
  }, []);

  const removePendingBlock = useCallback((id: string) => {
    setPendingBlocks((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const clearPendingBlocks = useCallback(() => {
    setPendingBlocks([]);
  }, []);

  const handleSetMode = useCallback((newMode: CalendarMode) => {
    setMode(newMode);
    // Clear pending blocks when switching away from availability mode
    if (newMode === 'events') {
      setPendingBlocks([]);
    }
  }, []);

  const isReadyToSave = mode === 'availability' && pendingBlocks.length > 0;

  return (
    <CalendarModeContext.Provider
      value={{
        mode,
        setMode: handleSetMode,
        pendingBlocks,
        addPendingBlock,
        removePendingBlock,
        clearPendingBlocks,
        isReadyToSave,
      }}
    >
      {children}
    </CalendarModeContext.Provider>
  );
}

export function useCalendarMode() {
  const context = useContext(CalendarModeContext);
  if (!context) {
    throw new Error('useCalendarMode must be used within CalendarModeProvider');
  }
  return context;
}
