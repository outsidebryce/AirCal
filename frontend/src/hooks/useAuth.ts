import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as authApi from '../api/auth';
import type { ConnectRequest } from '../types/auth';

export function useAuthStatus() {
  return useQuery({
    queryKey: ['auth', 'status'],
    queryFn: authApi.getAuthStatus,
    staleTime: 30000, // 30 seconds
  });
}

export function useConnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ConnectRequest) => authApi.connect(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['calendars'] });
    },
  });
}

export function useDisconnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['calendars'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['sync'] });
    },
  });
}

export function useSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.syncAll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['calendars'] });
      queryClient.invalidateQueries({ queryKey: ['sync', 'status'] });
    },
  });
}

export function useSyncStatus() {
  return useQuery({
    queryKey: ['sync', 'status'],
    queryFn: authApi.getSyncStatus,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute to show updated sync status
  });
}
