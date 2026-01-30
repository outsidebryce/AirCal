import { api } from './index';
import type {
  Event,
  ExpandedEvent,
  EventListResponse,
  EventCreate,
  EventUpdate,
  UpdateMode,
  DeleteMode,
} from '../types/event';

export async function getEvents(
  start: Date,
  end: Date,
  calendarIds?: string[]
): Promise<ExpandedEvent[]> {
  const params = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString(),
  });

  if (calendarIds && calendarIds.length > 0) {
    params.append('calendar_ids', calendarIds.join(','));
  }

  const response = await api.get<EventListResponse>(`/events?${params}`);
  return response.data.events;
}

export async function getEvent(uid: string, calendarId: string): Promise<Event> {
  const params = new URLSearchParams({ calendar_id: calendarId });
  const response = await api.get<Event>(`/events/${uid}?${params}`);
  return response.data;
}

export async function createEvent(data: EventCreate): Promise<Event> {
  const response = await api.post<Event>('/events', data);
  return response.data;
}

export async function updateEvent(
  uid: string,
  calendarId: string,
  data: EventUpdate,
  updateMode: UpdateMode = 'all'
): Promise<Event> {
  const params = new URLSearchParams({
    calendar_id: calendarId,
    update_mode: updateMode,
  });
  const response = await api.put<Event>(`/events/${uid}?${params}`, data);
  return response.data;
}

export async function deleteEvent(
  uid: string,
  calendarId: string,
  deleteMode: DeleteMode = 'all',
  occurrenceDate?: Date
): Promise<void> {
  const params = new URLSearchParams({
    calendar_id: calendarId,
    delete_mode: deleteMode,
  });

  if (occurrenceDate) {
    params.append('occurrence_date', occurrenceDate.toISOString());
  }

  await api.delete(`/events/${uid}?${params}`);
}
