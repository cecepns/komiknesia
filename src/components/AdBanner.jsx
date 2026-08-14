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
      <div className={`flex overflow-x-auto gap-0 scrollbar-hide w-full ${className}`}>
        {ads.map((ad) => {
          const alt = ad.image_alt || ad.title || 'Advertisement';
          const title = ad.title || ad.image_alt || '';
          return (
            <div
              key={ad.id}
              onClick={() => handleAdClick(ad)}
              className={`flex-shrink-0 w-full cursor-pointer transition-opacity duration-200 ${
                ad.link_url ? 'hover:opacity-90' : ''
              }`}
              title={title || undefined}
            >
              <LazyImage
                src={getImageUrl(ad.image)}
                alt={alt}
                title={title || undefined}
                className="w-full h-auto object-contain block"
                wrapperClassName="w-full block"
              />
            </div>
          );
        })}
      </div>
    );
  }

  // Grid layout - flush edge to edge with 0 gap
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
  };

  return (
    <div className={`grid gap-0 w-full overflow-hidden ${gridCols[columns] || gridCols[1]} ${className}`}>
      {ads.map((ad) => {
        const alt = ad.image_alt || ad.title || 'Advertisement';
        const title = ad.title || ad.image_alt || '';
        return (
          <div
            key={ad.id}
            onClick={() => handleAdClick(ad)}
            className={`relative w-full overflow-hidden cursor-pointer transition-opacity duration-200 ${
              ad.link_url ? 'hover:opacity-90' : ''
            }`}
            title={title || undefined}
          >
            <LazyImage
              src={getImageUrl(ad.image)}
              alt={alt}
              title={title || undefined}
              className="w-full h-auto object-contain block"
              wrapperClassName="w-full block"
            />
          </div>
        );
      })}
    </div>
  );
};

export default AdBanner;







