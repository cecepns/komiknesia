import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Flame, Star } from "lucide-react";
import LazyImage from "./LazyImage";
import { apiClient, getImageUrl } from "../utils/api";
import { getChapterTimeAgo } from "../utils/chapterTime";

const contentBtnTrans = "transition-all duration-200";
const contentCtaClearAll = `rounded-xl border border-red-500/25 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_5px_0_0_#991b1b] ${contentBtnTrans} hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_#991b1b] active:translate-y-0.5 active:shadow-[0_3px_0_0_#991b1b] dark:border-red-400/20 dark:bg-red-600 dark:text-white dark:shadow-[0_5px_0_0_#991b1b] dark:hover:shadow-[0_6px_0_0_#dc2626] dark:active:shadow-[0_3px_0_0_#991b1b] dark:hover:brightness-110`;

/** Render ★ rating */
const RatingStars = ({ rating }) => {
  const val = Number(rating) || 0;
  const full = Math.floor(val / 2);
  const half = val / 2 - full >= 0.25;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: full }, (_, i) => (
        <Star key={`f${i}`} className="h-3 w-3 fill-amber-400 text-amber-400" />
      ))}
      {half && (
        <Star key="h" className="h-3 w-3 text-amber-400" style={{ clipPath: 'inset(0 50% 0 0)', fill: '#fbbf24' }} />
      )}
      {Array.from({ length: empty }, (_, i) => (
        <Star key={`e${i}`} className="h-3 w-3 text-gray-500" />
      ))}
      <span className="ml-1 text-xs font-semibold text-gray-400">{val.toFixed(1)}</span>
    </span>
  );
};

const PopularSection = () => {
  const navigate = useNavigate();
  const [manga, setManga] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popularRange, setPopularRange] = useState("all");
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const fetchPopularManga = useCallback(async () => {
    try {
      setLoading(true);
      const payload = { page: 1, per_page: 10, orderBy: "Popular" };
      if (popularRange === "day") payload.popularWindow = "day";
      else if (popularRange === "week") payload.popularWindow = "week";
      else if (popularRange === "month") payload.popularWindow = "month";

      const response = await apiClient.getContents(payload);
      setManga(response.data || []);
    } catch (error) {
      console.error("Error fetching popular manga:", error);
      setManga([]);
    } finally {
      setLoading(false);
    }
  }, [popularRange]);

  useEffect(() => {
    fetchPopularManga();
  }, [fetchPopularManga]);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollButtons, { passive: true });
    updateScrollButtons();
    return () => el.removeEventListener("scroll", updateScrollButtons);
  }, [updateScrollButtons, manga]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector('[data-card]')?.offsetWidth || 220;
    el.scrollBy({ left: dir * (cardWidth + 16), behavior: "smooth" });
  };

  return (
    <div className="mb-12">
      {/* Section Header */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-red-600 to-rose-500 p-2 rounded-lg shadow-lg shadow-red-500/20">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Populer
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-red-900/60 dark:bg-[#0b1628]"
            role="group"
            aria-label="Rentang popularitas"
          >
            {[
              { id: "all", label: "Sepanjang masa" },
              { id: "day", label: "Harian" },
              { id: "week", label: "Mingguan" },
              { id: "month", label: "Bulanan" },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPopularRange(id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all sm:px-3 sm:text-sm ${
                  popularRange === id
                    ? "bg-red-600 text-white shadow-[0_2px_0_0_#991b1b] dark:bg-red-600 dark:text-white dark:shadow-[0_2px_0_0_#991b1b]"
                    : "text-slate-700 hover:bg-white dark:text-gray-200 dark:hover:bg-primary-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate("/populer")}
            className={`group inline-flex items-center gap-1.5 ${contentCtaClearAll}`}
          >
            Lihat semua
            <ChevronRight
              className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </button>
        </div>
      </div>

      {/* Carousel */}
      {loading ? (
        <div className="text-center py-12 bg-gray-100 dark:bg-primary-900 rounded-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="text-gray-500 dark:text-gray-400 mt-4">Memuat...</p>
        </div>
      ) : manga.length === 0 ? (
        <div className="text-center py-12 bg-gray-100 dark:bg-primary-900 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">
            Tidak ada manga populer
          </p>
        </div>
      ) : (
        <div className="relative group/slider">
          {/* Prev Arrow */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scroll(-1)}
              className="absolute left-0 top-1/2 z-20 -translate-y-1/2 -translate-x-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-black/80 md:h-11 md:w-11"
              aria-label="Scroll kiri"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          {/* Next Arrow */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scroll(1)}
              className="absolute right-0 top-1/2 z-20 -translate-y-1/2 translate-x-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm transition-all hover:bg-black/80 md:h-11 md:w-11"
              aria-label="Scroll kanan"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          {/* Scrollable Track */}
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scroll-smooth pb-2 scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {manga.map((m) => {
              const latestCh = m.lastChapters?.[0];
              return (
                <div
                  key={m.id}
                  data-card
                  onClick={() => navigate(`/komik/${m.slug}`)}
                  className="group relative w-[45vw] max-w-[200px] shrink-0 cursor-pointer overflow-hidden rounded-xl bg-gray-900 shadow-lg transition-transform hover:scale-[1.03] sm:w-[180px] md:w-[200px]"
                >
                  {/* Cover */}
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <LazyImage
                      src={getImageUrl(m.cover)}
                      alt={m.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                      wrapperClassName="h-full w-full"
                    />
                    {/* Bottom gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />

                    {/* Info overlay at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h3 className="mb-1 text-sm font-bold leading-tight text-white line-clamp-2 drop-shadow-md">
                        {m.title}
                      </h3>
                      {latestCh && (
                        <p className="text-xs text-gray-300 drop-shadow">
                          Chapter {latestCh.number || "N/A"}
                        </p>
                      )}
                      {m.rating > 0 && (
                        <div className="mt-1.5">
                          <RatingStars rating={m.rating} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PopularSection;
