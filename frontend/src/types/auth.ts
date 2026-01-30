export interface ConnectRequest {
  username: string;
  app_password: string;
}

export interface ConnectResponse {
  success: boolean;
  message: string;
  calendars_count: number;
}

export interface AuthStatusResponse {
  connected: boolean;
  username?: string | null;
}

export interface DisconnectResponse {
  success: boolean;
  message: string;
}

export interface SyncResponse {
  success: boolean;
  calendars_synced: number;
  events_updated: number;
  last_sync: string | null;
}
