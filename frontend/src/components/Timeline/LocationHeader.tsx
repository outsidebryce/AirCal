interface LocationHeaderProps {
  location: string;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  currentIndex: number;
  totalCount: number;
}

export function LocationHeader({
  location,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  currentIndex,
  totalCount,
}: LocationHeaderProps) {
  return (
    <div className="location-header">
      <button
        className="location-nav-btn"
        onClick={onPrev}
        disabled={!hasPrev}
        aria-label="Previous location"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      <div className="location-title-wrapper">
        <h1 className="location-title">{location}</h1>
        <div className="location-counter">
          {currentIndex} of {totalCount} locations
        </div>
      </div>

      <button
        className="location-nav-btn"
        onClick={onNext}
        disabled={!hasNext}
        aria-label="Next location"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}
