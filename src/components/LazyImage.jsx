import { useState } from 'react';
import PropTypes from 'prop-types';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/opacity.css';
import brokenImage from '../assets/broken-image.png';

const LazyImage = ({ 
  src, 
  alt, 
  className = '', 
  wrapperClassName = '',
  loadingClassName = '',
  placeholderSrc = null,
  effect = 'opacity',
  threshold = 100,
  /** Omit Referer on image requests (many CDNs block hotlinking by Referer). */
  referrerPolicy = 'no-referrer',
  ...props 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleBeforeLoad = () => {
    setIsLoading(true);
  };

  const handleAfterLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div className={`relative ${isLoading ? loadingClassName : ''} ${wrapperClassName}`}>
      {/* Loading Skeleton (height only while loading to avoid permanent gaps) */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-800 animate-pulse">
          <div className="h-8 w-8 rounded-full border-4 border-gray-300 dark:border-gray-700 border-t-blue-500" />
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <img 
          src={brokenImage} 
          alt="Broken image" 
          className={className}
          referrerPolicy={referrerPolicy}
        />
      )}

      {/* Lazy Loaded Image */}
      {!hasError && (
        <LazyLoadImage
          src={src}
          alt={alt}
          className={className}
          wrapperProps={{ className: 'w-full block leading-[0]' }}
          effect={effect}
          threshold={threshold}
          placeholderSrc={placeholderSrc}
          beforeLoad={handleBeforeLoad}
          afterLoad={handleAfterLoad}
          onError={handleError}
          referrerPolicy={referrerPolicy}
          {...props}
        />
      )}
    </div>
  );
};

LazyImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  className: PropTypes.string,
  wrapperClassName: PropTypes.string,
  loadingClassName: PropTypes.string,
  placeholderSrc: PropTypes.string,
  effect: PropTypes.string,
  threshold: PropTypes.number,
  referrerPolicy: PropTypes.string,
};

export default LazyImage;















