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
  const [retryCount, setRetryCount] = useState(0);

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

  const handleRetry = (e) => {
    e.stopPropagation();
    setHasError(false);
    setIsLoading(true);
    setRetryCount((prev) => prev + 1);
  };

  // Add retry cache busting query param if retried
  const currentSrc = retryCount > 0 
    ? `${src}${src.includes('?') ? '&' : '?'}retry=${retryCount}` 
    : src;

  return (
    <div className={`relative ${isLoading ? loadingClassName : ''} ${wrapperClassName}`}>
      {/* Loading Skeleton */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-800 animate-pulse min-h-[200px]">
          <div className="h-8 w-8 rounded-full border-4 border-gray-300 dark:border-gray-700 border-t-blue-500 animate-spin" />
        </div>
      )}

      {/* Error State with Reload Button */}
      {hasError && (
        <div className="flex flex-col items-center justify-center p-6 bg-gray-900 border border-gray-800 rounded-lg my-2 text-center min-h-[200px]">
          <img 
            src={brokenImage} 
            alt="Gagal memuat gambar" 
            className="max-h-32 opacity-75 mb-3 object-contain"
            referrerPolicy={referrerPolicy}
          />
          <p className="text-sm text-gray-400 mb-3 font-medium">Gambar gagal dimuat</p>
          <button
            type="button"
            onClick={handleRetry}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold rounded-lg shadow transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Muat Ulang Gambar
          </button>
        </div>
      )}

      {/* Lazy Loaded Image */}
      {!hasError && (
        <LazyLoadImage
          key={`${src}-${retryCount}`}
          src={currentSrc}
          alt={alt}
          className={className}
          wrapperProps={{ className: 'w-full h-full block leading-[0]' }}
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















