import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as calendarsApi from '../api/calendars';
import type { CalendarUpdate } from '../types/calendar';

export function useCalendars() {
  return useQuery({
    queryKey: ['calendars'],
    queryFn: calendarsApi.getCalendars,
    staleTime: 60000, // 1 minute
  });
}

export function useCalendar(id: string) {
  return useQuery({
    queryKey: ['calendars', id],
    queryFn: () => calendarsApi.getCalendar(id),
    enabled: !!id,
  });
}

export function useUpdateCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CalendarUpdate }) =>
      calendarsApi.updateCalendar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendars'] });
    },
  });
}
