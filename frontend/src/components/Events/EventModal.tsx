import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateEvent, useUpdateEvent, useDeleteEvent } from '../../hooks/useEvents';
import { useCalendars } from '../../hooks/useCalendars';
import type { ExpandedEvent } from '../../types/event';
import type { Calendar } from '../../types/calendar';
import './EventModal.css';

const eventSchema = z.object({
  summary: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  calendar_id: z.string().min(1, 'Calendar is required'),
  start: z.string().min(1, 'Start time is required'),
  end: z.string().min(1, 'End time is required'),
  all_day: z.boolean(),
  rrule: z.string().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: ExpandedEvent | null;
  defaultStart?: Date;
  defaultEnd?: Date;
  defaultAllDay?: boolean;
}

function formatDateTimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function EventModal({
  isOpen,
  onClose,
  event,
  defaultStart,
  defaultEnd,
  defaultAllDay = false,
}: EventModalProps) {
  const { data: calendars = [] } = useCalendars();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const isEditing = !!event;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      summary: event?.summary || '',
      description: event?.description || '',
      location: event?.location || '',
      calendar_id: event?.calendar_id || calendars[0]?.id || '',
      start: event
        ? event.all_day
          ? formatDateLocal(new Date(event.start))
          : formatDateTimeLocal(new Date(event.start))
        : defaultStart
          ? defaultAllDay
            ? formatDateLocal(defaultStart)
            : formatDateTimeLocal(defaultStart)
          : formatDateTimeLocal(new Date()),
      end: event
        ? event.all_day
          ? formatDateLocal(new Date(event.end))
          : formatDateTimeLocal(new Date(event.end))
        : defaultEnd
          ? defaultAllDay
            ? formatDateLocal(defaultEnd)
            : formatDateTimeLocal(defaultEnd)
          : formatDateTimeLocal(new Date(Date.now() + 3600000)),
      all_day: event?.all_day || defaultAllDay,
      rrule: event?.rrule || '',
    },
  });

  const allDay = watch('all_day');

  const onSubmit = async (data: EventFormData) => {
    try {
      const startDate = new Date(data.start);
      const endDate = new Date(data.end);

      if (isEditing && event) {
        await updateEvent.mutateAsync({
          uid: event.uid,
          calendarId: event.calendar_id,
          data: {
            summary: data.summary,
            description: data.description || null,
            location: data.location || null,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            all_day: data.all_day,
            rrule: data.rrule || null,
          },
        });
      } else {
        await createEvent.mutateAsync({
          calendar_id: data.calendar_id,
          summary: data.summary,
          description: data.description || null,
          location: data.location || null,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          all_day: data.all_day,
          rrule: data.rrule || null,
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to save event:', error);
    }
  };

  const handleDelete = async () => {
    if (!event) return;

    if (confirm('Are you sure you want to delete this event?')) {
      try {
        await deleteEvent.mutateAsync({
          uid: event.uid,
          calendarId: event.calendar_id,
        });
        onClose();
      } catch (error) {
        console.error('Failed to delete event:', error);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Event' : 'New Event'}</h2>
          <button className="close-button" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
            <label htmlFor="summary">Title</label>
            <input
              id="summary"
              type="text"
              {...register('summary')}
              placeholder="Event title"
              autoFocus
            />
            {errors.summary && (
              <span className="error">{errors.summary.message}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="calendar_id">Calendar</label>
            <select id="calendar_id" {...register('calendar_id')}>
              {calendars.map((cal: Calendar) => (
                <option key={cal.id} value={cal.id}>
                  {cal.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group checkbox">
            <label>
              <input type="checkbox" {...register('all_day')} />
              All day
            </label>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="start">Start</label>
              <input
                id="start"
                type={allDay ? 'date' : 'datetime-local'}
                {...register('start')}
              />
              {errors.start && (
                <span className="error">{errors.start.message}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="end">End</label>
              <input
                id="end"
                type={allDay ? 'date' : 'datetime-local'}
                {...register('end')}
              />
              {errors.end && (
                <span className="error">{errors.end.message}</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              id="location"
              type="text"
              {...register('location')}
              placeholder="Add location"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              {...register('description')}
              placeholder="Add description"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="rrule">Recurrence Rule (RRULE)</label>
            <input
              id="rrule"
              type="text"
              {...register('rrule')}
              placeholder="e.g., FREQ=WEEKLY;BYDAY=MO,WE,FR"
            />
            <small className="help-text">
              Leave empty for non-recurring events
            </small>
          </div>

          <div className="modal-footer">
            {isEditing && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
              >
                Delete
              </button>
            )}
            <div className="spacer" />
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
