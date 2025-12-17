import { useState } from 'react';
import PropTypes from 'prop-types';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/opacity.css';

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
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-800">
          <div className="text-center p-4">
            <svg 
              className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-2" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
              />
            </svg>
            <p className="text-xs text-gray-500 dark:text-gray-400">Gagal memuat gambar</p>
          </div>
        </div>
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


