import { api } from './index';
import type {
  BookingType,
  BookingTypeListResponse,
  BookingTypeCreate,
  BookingTypeUpdate,
} from '../types/booking';

export async function getBookingTypes(): Promise<BookingType[]> {
  const response = await api.get<BookingTypeListResponse>('/bookings');
  return response.data.booking_types;
}

export async function getBookingType(id: string): Promise<BookingType> {
  const response = await api.get<BookingType>(`/bookings/${id}`);
  return response.data;
}

export async function createBookingType(data: BookingTypeCreate): Promise<BookingType> {
  const response = await api.post<BookingType>('/bookings', data);
  return response.data;
}

export async function updateBookingType(
  id: string,
  data: BookingTypeUpdate
): Promise<BookingType> {
  const response = await api.put<BookingType>(`/bookings/${id}`, data);
  return response.data;
}

export async function deleteBookingType(id: string): Promise<void> {
  await api.delete(`/bookings/${id}`);
}
