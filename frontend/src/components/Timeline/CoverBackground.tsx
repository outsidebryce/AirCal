import { useState, useEffect, useRef } from 'react';

interface CoverBackgroundProps {
  imageUrl: string | null;
}

export function CoverBackground({ imageUrl }: CoverBackgroundProps) {
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [nextImage, setNextImage] = useState<string | null>(null);
  const [showNext, setShowNext] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!imageUrl) {
      setCurrentImage(null);
      setNextImage(null);
      return;
    }

    if (imageUrl === currentImage) return;

    // Start transition
    setNextImage(imageUrl);
    setShowNext(true);

    // After transition completes, swap images
    timeoutRef.current = setTimeout(() => {
      setCurrentImage(imageUrl);
      setNextImage(null);
      setShowNext(false);
    }, 500); // Match CSS transition duration

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [imageUrl, currentImage]);

  return (
    <div className="cover-background">
      {currentImage && (
        <div
          className={`cover-layer ${showNext ? 'fading' : ''}`}
          style={{ backgroundImage: `url(${currentImage})` }}
        />
      )}
      {nextImage && (
        <div
          className={`cover-layer next ${showNext ? 'visible' : ''}`}
          style={{ backgroundImage: `url(${nextImage})` }}
        />
      )}
      <div className="cover-overlay" />
    </div>
  );
}
