export interface AvailabilityBlock {
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
}

export interface BookingType {
  id: string;
  calcom_event_type_id: number | null;
  name: string;
  description: string | null;
  duration_minutes: number;
  location_type: string; // 'video' | 'phone' | 'in_person'
  booking_url: string | null;
  availability: AvailabilityBlock[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookingTypeListResponse {
  booking_types: BookingType[];
}

export interface BookingTypeCreate {
  name: string;
  description?: string | null;
  duration_minutes: number;
  location_type: string;
  availability: AvailabilityBlock[];
}

export interface BookingTypeUpdate {
  name?: string;
  description?: string | null;
  duration_minutes?: number;
  location_type?: string;
  availability?: AvailabilityBlock[];
  active?: boolean;
}

// Calendar mode for switching between events view and availability drawing
export type CalendarMode = 'events' | 'availability';

// Pending availability block drawn on calendar (before saving)
export interface PendingAvailabilityBlock {
  id: string;
  start: Date;
  end: Date;
}
