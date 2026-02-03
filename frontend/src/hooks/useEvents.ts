import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as eventsApi from '../api/events';
import type { EventCreate, EventUpdate, UpdateMode, DeleteMode } from '../types/event';

export function useEvents(start: Date, end: Date, calendarIds?: string[]) {
  return useQuery({
    queryKey: ['events', start.toISOString(), end.toISOString(), calendarIds],
    queryFn: () => eventsApi.getEvents(start, end, calendarIds),
    staleTime: 30000, // 30 seconds
  });
}

export function useEvent(uid: string, calendarId: string) {
  return useQuery({
    queryKey: ['events', uid, calendarId],
    queryFn: () => eventsApi.getEvent(uid, calendarId),
    enabled: !!uid && !!calendarId,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: EventCreate) => eventsApi.createEvent(data),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['events'] });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      uid,
      calendarId,
      data,
      updateMode,
    }: {
      uid: string;
      calendarId: string;
      data: EventUpdate;
      updateMode?: UpdateMode;
    }) => eventsApi.updateEvent(uid, calendarId, data, updateMode),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['events'] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      uid,
      calendarId,
      deleteMode,
      occurrenceDate,
    }: {
      uid: string;
      calendarId: string;
      deleteMode?: DeleteMode;
      occurrenceDate?: Date;
    }) => eventsApi.deleteEvent(uid, calendarId, deleteMode, occurrenceDate),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['events'] });
    },
  });
}
