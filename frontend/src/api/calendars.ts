import { api } from './index';
import type { Calendar, CalendarListResponse, CalendarUpdate } from '../types/calendar';

export async function getCalendars(): Promise<Calendar[]> {
  const response = await api.get<CalendarListResponse>('/calendars');
  return response.data.calendars;
}

export async function getCalendar(id: string): Promise<Calendar> {
  const response = await api.get<Calendar>(`/calendars/${id}`);
  return response.data;
}

export async function updateCalendar(
  id: string,
  data: CalendarUpdate
): Promise<Calendar> {
  const response = await api.put<Calendar>(`/calendars/${id}`, data);
  return response.data;
}
