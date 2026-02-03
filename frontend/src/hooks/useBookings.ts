import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as bookingsApi from '../api/bookings';
import type { BookingTypeCreate, BookingTypeUpdate } from '../types/booking';

export function useBookingTypes() {
  return useQuery({
    queryKey: ['bookingTypes'],
    queryFn: () => bookingsApi.getBookingTypes(),
    staleTime: 60000, // 1 minute
  });
}

export function useBookingType(id: string) {
  return useQuery({
    queryKey: ['bookingTypes', id],
    queryFn: () => bookingsApi.getBookingType(id),
    enabled: !!id,
  });
}

export function useCreateBookingType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BookingTypeCreate) => bookingsApi.createBookingType(data),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['bookingTypes'] });
    },
  });
}

export function useUpdateBookingType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BookingTypeUpdate }) =>
      bookingsApi.updateBookingType(id, data),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['bookingTypes'] });
    },
  });
}

export function useDeleteBookingType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => bookingsApi.deleteBookingType(id),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['bookingTypes'] });
    },
  });
}
