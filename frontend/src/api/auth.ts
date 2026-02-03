import { api } from './index';
import type {
  ConnectRequest,
  ConnectResponse,
  AuthStatusResponse,
  DisconnectResponse,
  SyncResponse,
} from '../types/auth';

export async function connect(data: ConnectRequest): Promise<ConnectResponse> {
  const response = await api.post<ConnectResponse>('/auth/connect', data);
  return response.data;
}

export async function getAuthStatus(): Promise<AuthStatusResponse> {
  const response = await api.get<AuthStatusResponse>('/auth/status');
  return response.data;
}

export async function disconnect(): Promise<DisconnectResponse> {
  const response = await api.post<DisconnectResponse>('/auth/disconnect');
  return response.data;
}

export async function syncAll(): Promise<SyncResponse> {
  const response = await api.post<SyncResponse>('/sync');
  return response.data;
}

export interface SyncStatusResponse {
  last_sync: string | null;
  sync_in_progress: boolean;
  sync_interval_minutes?: number;
}

export async function getSyncStatus(): Promise<SyncStatusResponse> {
  const response = await api.get<SyncStatusResponse>('/sync/status');
  return response.data;
}
