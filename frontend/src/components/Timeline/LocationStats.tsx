import type { LocationSpan } from '../../utils/locationSpans';
import { formatDuration, formatDateRange } from '../../utils/locationSpans';

interface LocationStatsProps {
  span: LocationSpan;
}

export function LocationStats({ span }: LocationStatsProps) {
  return (
    <div className="location-stats">
      <div className="stat-item">
        <div className="stat-value">{formatDateRange(span.startDate, span.endDate)}</div>
        <div className="stat-label">Date Range</div>
      </div>
      <div className="stat-item">
        <div className="stat-value">{formatDuration(span.totalMinutes)}</div>
        <div className="stat-label">Total Time</div>
      </div>
      <div className="stat-item">
        <div className="stat-value">{span.events.length}</div>
        <div className="stat-label">Events</div>
      </div>
    </div>
  );
}
