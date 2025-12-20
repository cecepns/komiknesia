import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getImageUrl } from '../utils/api';
import LazyImage from './LazyImage';
import { useAds } from '../hooks/useAds';

/**
 * AdPopup component to display popup ads in a 2-column grid
 * Cannot be closed for the first 10 seconds
 */
const AdPopup = () => {
  const { ads, loading } = useAds('popup'); // Get all popup ads
  const [isOpen, setIsOpen] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const [countdown, setCountdown] = useState(10);

  // Effect to show popup when ads are loaded
  useEffect(() => {
    // Check if popup has already been shown in this session
    const hasShownPopup = sessionStorage.getItem('adPopupShown');
    
    // Only show popup if there's an ad, not loading, and hasn't been shown yet
    if (!loading && ads.length > 0 && !hasShownPopup) {
      setIsOpen(true);
      // Mark as shown in sessionStorage
      sessionStorage.setItem('adPopupShown', 'true');
    }
  }, [ads, loading]);

  // Effect to handle countdown timer when popup is open
  useEffect(() => {
    if (!isOpen) {
      // Reset countdown when popup is closed
      setCountdown(10);
      setCanClose(false);
      return;
    }

    // Start countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanClose(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  const handleClose = () => {
    if (canClose) {
      setIsOpen(false);
    }
  };

  const handleAdClick = (ad) => {
    if (ad.link_url) {
      window.open(ad.link_url, '_blank', 'noopener,noreferrer');
    }
  };

  // Don't render if no ads or not open
  if (!isOpen || !ads.length) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm">
      <div className="relative max-w-4xl w-full mx-4">
        {/* Close Button */}
        <button
          onClick={handleClose}
          disabled={!canClose}
          className={`absolute -top-10 right-0 text-white hover:text-gray-300 transition-opacity ${
            canClose ? 'opacity-100 cursor-pointer' : 'opacity-50 cursor-not-allowed'
          }`}
          aria-label="Close popup"
        >
          <span className="text-red-600">Close</span>
        </button>

        {/* Countdown Timer */}
        {!canClose && (
          <div className="absolute -top-10 left-0 text-white text-sm font-medium">
            Dapat ditutup dalam {countdown} detik
          </div>
        )}

        {/* Ads Grid - 2 columns */}
        <div className="grid grid-cols-2 gap-4 bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4">
          {ads.map((ad, index) => (
            <div
              key={ad.id || index}
              onClick={() => handleAdClick(ad)}
              className={`relative bg-white dark:bg-gray-800 rounded-lg overflow-hidden ${
                ad.link_url ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
              }`}
            >
              <LazyImage
                src={getImageUrl(ad.image)}
                alt="Advertisement"
                className="w-full h-auto"
                wrapperClassName="w-full"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdPopup;

