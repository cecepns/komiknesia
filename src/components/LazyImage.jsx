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
  placeholderSrc = null,
  effect = 'opacity',
  threshold = 100,
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
    <div className={`relative ${wrapperClassName}`}>
      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-800">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-500" />
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <img 
          src={brokenImage} 
          alt="Broken image" 
          className={className}
        />
      )}

      {/* Lazy Loaded Image */}
      {!hasError && (
        <LazyLoadImage
          src={src}
          alt={alt}
          className={className}
          wrapperProps={{ className: 'w-full' }}
          effect={effect}
          threshold={threshold}
          placeholderSrc={placeholderSrc}
          beforeLoad={handleBeforeLoad}
          afterLoad={handleAfterLoad}
          onError={handleError}
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
  placeholderSrc: PropTypes.string,
  effect: PropTypes.string,
  threshold: PropTypes.number,
};

export default LazyImage;








