import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import LazyImage from "./LazyImage";
import { apiClient, getImageUrl } from "../utils/api";

/** Render ★ rating */
const RatingStars = ({ rating }) => {
  const val = Number(rating) || 0;
  const full = Math.floor(val / 2);
  const half = val / 2 - full >= 0.25;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex items-center gap-0.5">
        {Array.from({ length: full }, (_, i) => (
          <Star key={`f${i}`} className="h-3 w-3 fill-amber-400 text-amber-400" />
        ))}
        {half && (
          <Star key="h" className="h-3 w-3 text-amber-400" style={{ clipPath: 'inset(0 50% 0 0)', fill: '#fbbf24' }} />
        )}
        {Array.from({ length: empty }, (_, i) => (
          <Star key={`e${i}`} className="h-3 w-3 text-gray-600" />
        ))}
      </span>
      <span className="ml-1 text-[11px] font-medium text-gray-400">{val.toFixed(1)}</span>
    </span>
  );
};

const PopularSection = () => {
  const navigate = useNavigate();
  const [manga, setManga] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const isInitialScrolledRef = useRef(false);

  const scrollRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const dragDistanceRef = useRef(0);

  // Repeat manga 3 times for true 360-degree infinite looping without empty gaps
  const displayItems = manga.length > 0 ? [...manga, ...manga, ...manga] : [];

  const fetchPopularManga = useCallback(async () => {
    try {
      setLoading(true);
      const payload = { page: 1, per_page: 10, orderBy: "Popular", popularWindow: "day" };
      const response = await apiClient.getContents(payload);
      const items = response.data || [];
      setManga(items);
      if (items.length > 0) {
        setActiveIndex(items.length); // Start at middle clone set
      }
    } catch (error) {
      console.error("Error fetching popular manga:", error);
      setManga([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPopularManga();
  }, [fetchPopularManga]);

  // Smooth scroll to card at index
  const scrollToCard = useCallback((index, smooth = true) => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const children = Array.from(container.children);
    if (!children[index]) return;
    const targetCard = children[index];
    const containerWidth = container.clientWidth;
    const cardLeft = targetCard.offsetLeft;
    const cardWidth = targetCard.offsetWidth;
    const targetScroll = cardLeft - containerWidth / 2 + cardWidth / 2;

    container.scrollTo({
      left: Math.max(0, targetScroll),
      behavior: smooth ? "smooth" : "auto",
    });
    setActiveIndex(index);
  }, []);

  // Initial scroll alignment on middle clone set
  useEffect(() => {
    if (manga.length > 0 && scrollRef.current && !isInitialScrolledRef.current) {
      isInitialScrolledRef.current = true;
      setTimeout(() => {
        scrollToCard(manga.length, false);
      }, 50);
    }
  }, [manga.length, scrollToCard]);

  // Update active index based on scroll position & handle seamless infinite bounds jump
  const updateActiveIndexOnScroll = useCallback(() => {
    if (!scrollRef.current || manga.length === 0) return;
    const container = scrollRef.current;
    const containerCenter = container.scrollLeft + container.clientWidth / 2;
    const children = Array.from(container.children);
    let closestIndex = 0;
    let minDistance = Infinity;

    children.forEach((child, index) => {
      const childCenter = child.offsetLeft + child.offsetWidth / 2;
      const distance = Math.abs(childCenter - containerCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    setActiveIndex(closestIndex);

    // Seamless infinite reset when entering prefix or suffix sets
    const total = manga.length;
    if (closestIndex < total) {
      const targetIndex = closestIndex + total;
      const targetCard = children[targetIndex];
      if (targetCard) {
        const targetScroll = targetCard.offsetLeft - container.clientWidth / 2 + targetCard.offsetWidth / 2;
        container.scrollLeft = targetScroll;
        setActiveIndex(targetIndex);
      }
    } else if (closestIndex >= 2 * total) {
      const targetIndex = closestIndex - total;
      const targetCard = children[targetIndex];
      if (targetCard) {
        const targetScroll = targetCard.offsetLeft - container.clientWidth / 2 + targetCard.offsetWidth / 2;
        container.scrollLeft = targetScroll;
        setActiveIndex(targetIndex);
      }
    }
  }, [manga.length]);

  // Auto slide interval (every 4 seconds)
  useEffect(() => {
    if (manga.length <= 1) return;
    const timer = setInterval(() => {
      if (!isDraggingRef.current) {
        setActiveIndex((prev) => {
          const nextIdx = prev + 1;
          scrollToCard(nextIdx, true);
          return nextIdx;
        });
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [manga.length, scrollToCard]);

  // Mouse Drag handlers
  const handleMouseDown = (e) => {
    if (!scrollRef.current) return;
    isDraggingRef.current = true;
    dragDistanceRef.current = 0;
    startXRef.current = e.pageX - scrollRef.current.offsetLeft;
    scrollLeftRef.current = scrollRef.current.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    dragDistanceRef.current = Math.abs(walk);
    scrollRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handlePrev = () => {
    if (manga.length === 0) return;
    scrollToCard(activeIndex - 1, true);
  };

  const handleNext = () => {
    if (manga.length === 0) return;
    scrollToCard(activeIndex + 1, true);
  };

  if (loading) {
    return (
      <div className="mb-12">
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-[#12121a] px-5 py-2 shadow-lg">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 to-red-500 text-xs">🔥</span>
            <span className="text-sm font-bold text-white tracking-wide">Popular Today</span>
          </div>
        </div>
        <div className="text-center py-12 bg-gray-900/40 rounded-2xl border border-gray-800 max-w-xl mx-auto">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
          <p className="text-gray-400 mt-4 text-sm">Memuat komik populer hari ini...</p>
        </div>
      </div>
    );
  }

  if (manga.length === 0) {
    return null;
  }

  return (
    <div className="lg:mb-12 relative min-h-[440px] sm:min-h-[490px] md:min-h-[520px]">
      {/* Centered Pill Header Badge "Popular Today" */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-[#12121a] px-5 py-2 shadow-lg shadow-pink-950/20 backdrop-blur-md">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-pink-500 via-rose-500 to-red-500 text-xs shadow-md">
            🔥
          </span>
          <span className="text-sm sm:text-base font-bold text-white tracking-wide">
            Popular Today
          </span>
        </div>
      </div>

      {/* Slider Container with Left & Right Arrow Buttons */}
      <div className="relative w-full overflow-hidden">
        {/* Left Arrow Button */}
        <button
          type="button"
          onClick={handlePrev}
          className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/80 text-white shadow-2xl border border-white/20 hover:bg-red-600 hover:scale-110 active:scale-95 transition-all"
          aria-label="Previous"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        {/* Right Arrow Button */}
        <button
          type="button"
          onClick={handleNext}
          className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-black/80 text-white shadow-2xl border border-white/20 hover:bg-red-600 hover:scale-110 active:scale-95 transition-all"
          aria-label="Next"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {/* Horizontal Drag/Scroll Container */}
        <div
          ref={scrollRef}
          onScroll={updateActiveIndexOnScroll}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className="flex items-center gap-4 sm:gap-6 lg:gap-8 overflow-x-auto py-10 px-[calc(50vw-95px)] sm:px-[calc(50vw-105px)] md:px-[calc(50vw-120px)] lg:px-[calc(50vw-140px)] h-[410px] sm:h-[440px] md:h-[470px] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory cursor-grab active:cursor-grabbing select-none"
        >
          {displayItems.map((item, index) => {
            const isActive = index === activeIndex;
            const latestCh = item?.lastChapters?.[0];

            return (
              <div
                key={`${item.id}-${index}`}
                onClick={() => {
                  if (dragDistanceRef.current > 10) return;
                  if (isActive) {
                    navigate(`/komik/${item.slug}`);
                  } else {
                    scrollToCard(index, true);
                  }
                }}
                className={`relative shrink-0 overflow-hidden rounded-2xl bg-[#1e1e26] border transition-all duration-300 flex flex-col justify-between select-none snap-center h-[330px] sm:h-[360px] md:h-[380px] w-[52vw] max-w-[200px] sm:w-[230px] md:w-[260px] lg:w-[280px] ${isActive
                  ? "-translate-y-3.5 z-10 border-red-500/80 ring-2 ring-red-500/50 shadow-2xl shadow-red-950/60 opacity-100 cursor-pointer"
                  : "translate-y-0 z-0 opacity-60 hover:opacity-85 border-white/10 cursor-pointer"
                  }`}
              >
                {/* Cover */}
                <div className="relative aspect-[3/4] w-full flex-1 overflow-hidden bg-gray-950">
                  <LazyImage
                    src={getImageUrl(item.cover)}
                    alt={item.title}
                    className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                    wrapperClassName="h-full w-full"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e26] via-transparent to-transparent opacity-60" />
                </div>

                {/* Card Footer Info */}
                <div className="p-2.5 sm:p-3.5 lg:p-4 flex flex-col justify-between bg-[#1e1e26] h-[85px] sm:h-[95px] lg:h-[105px] shrink-0">
                  <div>
                    <h3 className={`font-bold line-clamp-1 leading-snug transition-colors ${isActive ? 'text-white text-xs sm:text-sm md:text-base lg:text-lg' : 'text-gray-300 text-[11px] sm:text-xs lg:text-sm'}`}>
                      {item.title}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] lg:text-xs text-gray-400 mt-0.5 sm:mt-1">
                      Chapter {latestCh?.number || "N/A"}
                    </p>
                  </div>

                  <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center justify-between">
                    <RatingStars rating={item.rating} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PopularSection;
