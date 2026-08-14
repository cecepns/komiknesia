import { useState, useEffect, useCallback } from "react";
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

  const fetchPopularManga = useCallback(async () => {
    try {
      setLoading(true);
      const payload = { page: 1, per_page: 10, orderBy: "Popular", popularWindow: "day" };
      const response = await apiClient.getContents(payload);
      const items = response.data || [];
      setManga(items);
      if (items.length > 0) {
        setActiveIndex(0);
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

  const handlePrev = () => {
    if (manga.length === 0) return;
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : manga.length - 1));
  };

  const handleNext = () => {
    if (manga.length === 0) return;
    setActiveIndex((prev) => (prev < manga.length - 1 ? prev + 1 : 0));
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

  const prevIdx = (activeIndex - 1 + manga.length) % manga.length;
  const currIdx = activeIndex;
  const nextIdx = (activeIndex + 1) % manga.length;

  const visibleCards = [
    { item: manga[prevIdx], position: "left", index: prevIdx },
    { item: manga[currIdx], position: "center", index: currIdx },
    { item: manga[nextIdx], position: "right", index: nextIdx },
  ];

  return (
    <div className="mb-12">
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

      {/* Perfectly Centered 3-Card Spotlight Carousel */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-center gap-2 sm:gap-4 md:gap-6 py-4 px-2 overflow-hidden">
        {visibleCards.map(({ item, position }) => {
          const isCenter = position === "center";
          const latestCh = item?.lastChapters?.[0];

          return (
            <div
              key={`${item.id}-${position}`}
              onClick={() => {
                if (isCenter) {
                  navigate(`/komik/${item.slug}`);
                } else if (position === "left") {
                  handlePrev();
                } else {
                  handleNext();
                }
              }}
              className={`relative shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-[#1e1e26] border transition-all duration-300 flex flex-col justify-between select-none ${
                isCenter
                  ? "w-[54vw] max-w-[215px] sm:w-[220px] md:w-[245px] z-10 scale-105 border-red-500/80 ring-2 ring-red-500/50 shadow-2xl shadow-red-950/50 opacity-100"
                  : "w-[28vw] max-w-[125px] sm:w-[155px] md:w-[180px] z-0 scale-90 opacity-55 hover:opacity-85 border-white/10"
              }`}
            >
              {/* Cover */}
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-950">
                <LazyImage
                  src={getImageUrl(item.cover)}
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  wrapperClassName="h-full w-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1e1e26] via-transparent to-transparent opacity-60" />

                {/* Arrow Button Overlays on Side Cards */}
                {position === "left" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/75 text-white shadow-xl border border-white/15">
                      <ChevronLeft className="h-5 w-5" />
                    </div>
                  </div>
                )}
                {position === "right" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/75 text-white shadow-xl border border-white/15">
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer Info */}
              <div className="p-2.5 sm:p-3.5 flex flex-col justify-between bg-[#1e1e26] min-h-[85px] sm:min-h-[95px]">
                <div>
                  <h3 className={`font-bold line-clamp-1 leading-snug transition-colors ${isCenter ? 'text-white text-xs sm:text-sm md:text-base' : 'text-gray-300 text-[11px] sm:text-xs'}`}>
                    {item.title}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 sm:mt-1">
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
  );
};

export default PopularSection;
