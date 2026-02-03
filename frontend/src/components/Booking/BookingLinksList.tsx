import { useBookingTypes, useDeleteBookingType } from '../../hooks/useBookings';
import { getAvailabilityShorthand } from '../../utils/availability';
import type { BookingType } from '../../types/booking';
import './BookingLinksList.css';

export function BookingLinksList() {
  const { data: bookingTypes = [], isLoading } = useBookingTypes();
  const deleteBookingType = useDeleteBookingType();

  const activeBookingTypes = bookingTypes.filter((bt: BookingType) => bt.active);

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteBookingType.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete booking type:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="booking-links-list loading">
        <div className="loading-spinner small"></div>
      </div>
    );
  }

  if (activeBookingTypes.length === 0) {
    return (
      <div className="booking-links-list empty">
        <p>No booking links yet</p>
        <p className="hint">Switch to Availability mode to create one</p>
      </div>
    );
  }

  return (
    <div className="booking-links-list">
      <h3>Booking Links</h3>
      <div className="booking-links">
        {activeBookingTypes.map((bt: BookingType) => (
          <div key={bt.id} className="booking-link-item">
            <div className="booking-link-info">
              <span className="booking-link-name">{bt.name}</span>
              <span className="booking-link-duration">{bt.duration_minutes} min</span>
            </div>
            <div className="booking-link-availability">
              {getAvailabilityShorthand(bt.availability)}
            </div>
            <div className="booking-link-actions">
              {bt.booking_url ? (
                <>
                  <a
                    href={bt.booking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="booking-link-open"
                    title="Open booking page"
                  >
                    Open
                  </a>
                  <button
                    className="booking-link-copy"
                    onClick={() => handleCopyLink(bt.booking_url!)}
                    title="Copy link"
                  >
                    Copy
                  </button>
                </>
              ) : (
                <span className="booking-link-pending">Pending sync</span>
              )}
              <button
                className="booking-link-delete"
                onClick={() => handleDelete(bt.id, bt.name)}
                title="Delete"
              >
                &times;
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
