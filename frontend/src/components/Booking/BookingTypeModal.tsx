import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCalendarMode } from '../../contexts/CalendarModeContext';
import { useCreateBookingType } from '../../hooks/useBookings';
import { pendingBlocksToAvailability, getAvailabilityShorthand } from '../../utils/availability';
import './BookingTypeModal.css';

const bookingTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  duration_minutes: z.number().min(5, 'Duration must be at least 5 minutes').max(480, 'Duration must be at most 8 hours'),
  location_type: z.enum(['video', 'phone', 'in_person']),
});

type BookingTypeFormData = z.infer<typeof bookingTypeSchema>;

interface BookingTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BookingTypeModal({ isOpen, onClose }: BookingTypeModalProps) {
  const { pendingBlocks, clearPendingBlocks, setMode } = useCalendarMode();
  const createBookingType = useCreateBookingType();

  const availability = pendingBlocksToAvailability(pendingBlocks);
  const availabilityShorthand = getAvailabilityShorthand(availability);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BookingTypeFormData>({
    resolver: zodResolver(bookingTypeSchema),
    defaultValues: {
      name: '',
      description: '',
      duration_minutes: 30,
      location_type: 'video',
    },
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      reset({
        name: '',
        description: '',
        duration_minutes: 30,
        location_type: 'video',
      });
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: BookingTypeFormData) => {
    try {
      await createBookingType.mutateAsync({
        name: data.name,
        description: data.description || null,
        duration_minutes: data.duration_minutes,
        location_type: data.location_type,
        availability,
      });

      // Clear pending blocks and switch back to events mode
      clearPendingBlocks();
      setMode('events');
      onClose();
    } catch (error) {
      console.error('Failed to create booking type:', error);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className={`booking-type-pane ${isOpen ? 'open' : ''}`}>
      <div className="modal-header">
        <h2>Create Booking Type</h2>
        <button className="close-button" onClick={handleCancel}>
          &times;
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="availability-summary">
          <h3>Availability</h3>
          <p className="availability-shorthand">{availabilityShorthand}</p>
          <p className="availability-count">
            {pendingBlocks.length} time block{pendingBlocks.length === 1 ? '' : 's'} selected
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="name">Booking Name</label>
          <input
            id="name"
            type="text"
            {...register('name')}
            placeholder="e.g., 30-minute meeting"
            autoFocus
          />
          {errors.name && <span className="error">{errors.name.message}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            {...register('description')}
            placeholder="What is this booking for?"
            rows={3}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="duration_minutes">Duration</label>
            <select id="duration_minutes" {...register('duration_minutes', { valueAsNumber: true })}>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
            {errors.duration_minutes && (
              <span className="error">{errors.duration_minutes.message}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="location_type">Location</label>
            <select id="location_type" {...register('location_type')}>
              <option value="video">Video call</option>
              <option value="phone">Phone call</option>
              <option value="in_person">In person</option>
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <div className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary btn-green"
            disabled={isSubmitting || pendingBlocks.length === 0}
          >
            {isSubmitting ? 'Creating...' : 'Create Booking Type'}
          </button>
        </div>
      </form>
    </div>
  );
}
