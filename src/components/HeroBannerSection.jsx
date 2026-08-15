import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Star, ChevronLeft, ChevronRight, BookOpen, Info } from "lucide-react";
import LazyImage from "./LazyImage";
import { getImageUrl } from "../utils/api";

const HeroBannerSection = ({ banners = [] }) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const autoPlayRef = useRef(null);

  const activeBanners = banners.filter(b => b.is_active !== false);

  const handleNext = useCallback(() => {
    if (activeBanners.length <= 1) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [activeBanners.length]);

  const handlePrev = useCallback(() => {
    if (activeBanners.length <= 1) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev - 1 + activeBanners.length) % activeBanners.length);
    setTimeout(() => setIsTransitioning(false), 300);
  }, [activeBanners.length]);

  // Auto-slide every 5 seconds
  useEffect(() => {
    if (activeBanners.length <= 1) return;
    autoPlayRef.current = setInterval(() => {
      handleNext();
    }, 5000);
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [activeBanners.length, handleNext]);

  if (!activeBanners || activeBanners.length === 0) {
    return null;
  }

  const currentItem = activeBanners[currentIndex] || activeBanners[0];
  const coverUrl = getImageUrl(currentItem.image || currentItem.cover);

  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl bg-gray-900 shadow-2xl">
      {/* Banner Slide Container */}
      <div className="relative aspect-[16/9] sm:aspect-[21/9] md:aspect-[24/9] w-full min-h-[200px] max-h-[420px] overflow-hidden">
        {/* Background Image */}
        <div
          className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${isTransitioning ? "opacity-70" : "opacity-100"
            }`}
        >
          <LazyImage
            src={coverUrl}
            alt={currentItem.title}
            className="h-full w-full object-cover object-center transition-transform duration-700 ease-out hover:scale-105"
            wrapperClassName="h-full w-full"
          />
        </div>

        {/* Gradient Overlay for Text Visibility (Lower Opacity so Banner Image is More Visible) */}
        {/* <div className="absolute inset-0 bg-gradient-to-t from-gray-950/80 via-gray-950/30 to-transparent" /> */}
        <div className="absolute inset-0 bg-gradient-to-r from-gray-950/70 via-gray-950/20 to-transparent" />

        {/* Top Badges: Series Tag & Rating */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 flex items-center gap-2">
          {currentItem.series && (
            <span className="rounded-md bg-red-600 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[9px] sm:text-xs font-black tracking-wider text-white shadow-md uppercase">
              {currentItem.series}
            </span>
          )}
          {currentItem.rating > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-black/60 backdrop-blur-md px-1.5 py-0.5 sm:px-2 sm:py-1 text-[9px] sm:text-xs font-bold text-amber-400 border border-amber-500/20 shadow-md">
              <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 fill-amber-400" />
              <span>{Number(currentItem.rating).toFixed(1)}</span>
            </span>
          )}
        </div>

        {/* Content Details: Title, Read Now & Info Button */}
        <div className="absolute bottom-2.5 left-3 sm:bottom-6 sm:left-6 right-3 sm:right-6 z-10 flex flex-col gap-1.5 sm:gap-2.5">
          <h2 className="text-sm sm:text-2xl md:text-3xl font-extrabold text-white leading-tight tracking-wide drop-shadow-lg line-clamp-2 max-w-2xl">
            {currentItem.title}
          </h2>

          <div className="flex items-center gap-2 pt-0.5">
            {/* Read Now Button (Compact size for mobile) */}
            {currentItem.href || currentItem.link || currentItem.slug ? (
              <Link
                to={currentItem.href || currentItem.link || `/komik/${currentItem.slug}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-md transition-all hover:bg-red-700 active:scale-95 sm:rounded-xl sm:px-5 sm:py-2.5 sm:text-sm"
              >
                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>READ NOW</span>
              </Link>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-md transition-all hover:bg-red-700 active:scale-95 sm:rounded-xl sm:px-5 sm:py-2.5 sm:text-sm"
              >
                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>READ NOW</span>
              </button>
            )}

            {/* Info Circle Button */}
            {/* {(currentItem.slug || currentItem.href) && (
              <button
                type="button"
                onClick={() => navigate(currentItem.href || `/komik/${currentItem.slug}`)}
                className="inline-flex h-7 w-7 sm:h-10 sm:w-10 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white backdrop-blur-md transition-all hover:bg-white/20 hover:scale-105"
                title="Detail Komik"
              >
                <Info className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
              </button>
            )} */}
          </div>
        </div>

        {/* Carousel Navigation Arrows */}
        {activeBanners.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-all hover:bg-black/80 hover:scale-110 sm:left-4 sm:h-10 sm:w-10"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-all hover:bg-black/80 hover:scale-110 sm:right-4 sm:h-10 sm:w-10"
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Slide Indicators Dots */}
      {activeBanners.length > 1 && (
        <div className="absolute bottom-2 right-4 z-20 flex items-center gap-1.5">
          {activeBanners.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${currentIndex === idx
                ? "w-6 bg-red-600 shadow-[0_0_8px_#dc2626]"
                : "w-2 bg-white/40 hover:bg-white/70"
                }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HeroBannerSection;
