export interface Calendar {
  id: string;
  caldav_url: string;
  name: string;
  color: string;
  visible: boolean;
  can_write: boolean;
  sync_token: string | null;
  last_synced: string | null;
}

export interface CalendarListResponse {
  calendars: Calendar[];
}

export interface CalendarUpdate {
  name?: string;
  color?: string;
  visible?: boolean;
}
