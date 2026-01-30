export interface Event {
  uid: string;
  calendar_id: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  all_day: boolean;
  timezone?: string | null;
  etag?: string | null;
  rrule?: string | null;
  recurrence_id?: string | null;
  created?: string | null;
  last_modified?: string | null;
}

export interface ExpandedEvent {
  uid: string;
  calendar_id: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  all_day: boolean;
  is_recurring: boolean;
  master_uid: string | null;
  rrule: string | null;
}

export interface EventListResponse {
  events: ExpandedEvent[];
}

export interface EventCreate {
  calendar_id: string;
  summary: string;
  description?: string | null;
  location?: string | null;
  start: string;
  end: string;
  all_day?: boolean;
  timezone?: string | null;
  rrule?: string | null;
}

export interface EventUpdate {
  summary?: string;
  description?: string | null;
  location?: string | null;
  start?: string;
  end?: string;
  all_day?: boolean;
  timezone?: string | null;
  rrule?: string | null;
}

export type UpdateMode = 'single' | 'this_and_future' | 'all';
export type DeleteMode = 'single' | 'this_and_future' | 'all';
