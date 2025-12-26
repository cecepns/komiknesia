import { getImageUrl } from '../utils/api';
import LazyImage from './LazyImage';

/**
 * AdBanner component to display ads
 * @param {Array} ads - Array of ad objects
 * @param {string} className - Additional CSS classes
 * @param {string} layout - Layout type: 'grid' or 'carousel'
 * @param {number} columns - Number of columns for grid layout
 */
const AdBanner = ({ ads, className = '', layout = 'grid', columns = 1 }) => {
  if (!ads || ads.length === 0) {
    return null;
  }

  const handleAdClick = (ad) => {
    if (ad.link_url) {
      window.open(ad.link_url, '_blank', 'noopener,noreferrer');
    }
  };

  if (layout === 'carousel') {
    return (
      <div className={`flex overflow-x-auto pb-2 scrollbar-hide ${className}`}>
        {ads.map((ad) => (
          <div
            key={ad.id}
            onClick={() => handleAdClick(ad)}
            className={`flex-shrink-0 cursor-pointer transition-transform duration-300 hover:scale-20 ${
              ad.link_url ? 'hover:opacity-90' : ''
            }`}
          >
            <LazyImage
              src={getImageUrl(ad.image)}
              alt="Advertisement"
              className="rounded-lg shadow-md"
              wrapperClassName="w-full"
            />
          </div>
        ))}
      </div>
    );
  }

  // Grid layout
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  };

  return (
    <div className={`grid ${gridCols[columns] || gridCols[1]} ${className}`}>
      {ads.map((ad) => (
        <div
          key={ad.id}
          onClick={() => handleAdClick(ad)}
          className={`cursor-pointer transition-transform duration-300 hover:scale-20 ${
            ad.link_url ? 'hover:opacity-90' : ''
          }`}
        >
          <LazyImage
            src={getImageUrl(ad.image)}
            alt="Advertisement"
            className="w-full rounded-lg shadow-md"
            wrapperClassName="w-full"
          />
        </div>
      ))}
    </div>
  );
};

export default AdBanner;






