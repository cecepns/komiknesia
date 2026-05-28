import { useState, useEffect, useCallback, useMemo } from "react";
import { useIsMdUp } from "../hooks/useIsMdUp";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Flame, LayoutGrid, List } from "lucide-react";
import LazyImage from "./LazyImage";
import { apiClient, getImageUrl } from "../utils/api";
import { getChapterTimeAgo } from "../utils/chapterTime";

/** Sama dengan Content.jsx — filter tidak aktif & CTA sky */
const contentBtnTrans = "transition-all duration-200";
const contentFilterInactive = `rounded-xl border ${contentBtnTrans} border-slate-200 bg-slate-50 text-slate-700 shadow-[0_3px_0_0_#e2e8f0] hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_#cbd5e1] active:translate-y-px active:shadow-[0_2px_0_0_#e2e8f0] dark:border-primary-600 dark:bg-primary-800 dark:text-gray-200 dark:shadow-[0_3px_0_0_#1e3a5f] dark:hover:bg-primary-800`;
const contentCtaClearAll = `rounded-xl border border-sky-500/25 bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_5px_0_0_#0369a1] ${contentBtnTrans} hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_#0369a1] active:translate-y-0.5 active:shadow-[0_3px_0_0_#0369a1] dark:border-cyan-200/20 dark:bg-[#0a2d52] dark:text-cyan-50 dark:shadow-[0_5px_0_0_#0ea5e9] dark:hover:shadow-[0_6px_0_0_#38bdf8] dark:active:shadow-[0_3px_0_0_#0369a1] dark:hover:brightness-110`;

const MOBILE_HOME_SECTION_CAP = 14;

const PopularSection = () => {
  const navigate = useNavigate();
  const [filteredManga, setFilteredManga] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardLayout, setCardLayout] = useState("vertical");
  const [popularRange, setPopularRange] = useState("all");
  const isMdUp = useIsMdUp();

  const visibleManga = useMemo(
    () => (isMdUp ? filteredManga : filteredManga.slice(0, MOBILE_HOME_SECTION_CAP)),
    [isMdUp, filteredManga],
  );

  const fetchPopularManga = useCallback(async () => {
    try {
      setLoading(true);
      const payload = {
        page: 1,
        per_page: 15,
        orderBy: "Popular",
      };
      if (popularRange === "day") payload.popularWindow = "day";
      else if (popularRange === "week") payload.popularWindow = "week";
      else if (popularRange === "month") payload.popularWindow = "month";

      const response = await apiClient.getContents(payload);
      setFilteredManga(response.data || []);
    } catch (error) {
      console.error("Error fetching popular manga:", error);
      setFilteredManga([]);
    } finally {
      setLoading(false);
    }
  }, [popularRange]);

  useEffect(() => {
    fetchPopularManga();
  }, [fetchPopularManga]);

  return (
    <div className="mb-12">
      {/* Section Header */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-red-500 to-orange-500 p-2 rounded-lg">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Populer
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-primary-600 dark:bg-primary-800/80"
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
                    ? "bg-sky-600 text-white shadow-[0_2px_0_0_#0369a1] dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_2px_0_0_#38bdf8]"
                    : "text-slate-700 hover:bg-white dark:text-gray-200 dark:hover:bg-primary-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setCardLayout((prev) =>
                prev === "vertical" ? "horizontal" : "vertical",
              )
            }
            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center ${contentFilterInactive}`}
            title={
              cardLayout === "vertical"
                ? "Tampilan baris (horizontal)"
                : "Tampilan grid (vertical)"
            }
            aria-label={
              cardLayout === "vertical"
                ? "Ubah ke tampilan baris"
                : "Ubah ke tampilan grid"
            }
          >
            {cardLayout === "vertical" ? (
              <List className="h-5 w-5" aria-hidden />
            ) : (
              <LayoutGrid className="h-5 w-5" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate("/content")}
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

      {/* Manga Grid */}
      {loading ? (
        <div className="text-center py-12 bg-gray-100 dark:bg-primary-900 rounded-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="text-gray-500 dark:text-gray-400 mt-4">Memuat...</p>
        </div>
      ) : filteredManga.length === 0 ? (
        <div className="text-center py-12 bg-gray-100 dark:bg-primary-900 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">
            Tidak ada manga populer
          </p>
        </div>
      ) : (
        <div
          className={
            cardLayout === "vertical"
              ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4"
              : "flex flex-col gap-3"
          }
        >
          {visibleManga.map((manga) => (
            <div
              key={manga.id}
              onClick={() => navigate(`/komik/${manga.slug}`)}
              className={`bg-white dark:bg-primary-900 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer ${
                cardLayout === "horizontal"
                  ? "flex flex-row gap-3 p-3 sm:gap-4 sm:p-4"
                  : "flex flex-col"
              }`}
            >
              {/* Cover Image */}
              <div
                className={
                  cardLayout === "vertical"
                    ? "relative aspect-[3/4] overflow-hidden"
                    : "relative aspect-[3/4] w-[5.5rem] shrink-0 overflow-hidden rounded-md sm:w-28"
                }
              >
                <LazyImage
                  src={getImageUrl(manga.cover)}
                  alt={manga.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  wrapperClassName="w-full h-full"
                />

                {/* Gradient Overlay */}
                {/* <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" /> */}

                {/* Country Flag */}
                {/* <div className="absolute top-2 right-2 text-2xl bg-white/90 dark:bg-primary-900/90 rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                  {countryFlags[manga.country_id] || "🌍"}
                </div> */}

                {/* Color Badge */}
                {/* {manga.color && (
                  <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z"/>
                    </svg>
                    <span>COLOR</span>
                  </div>
                )} */}

                {/* Rating Badge */}
                {manga.rating > 0 && (
                  <div className="absolute top-2 left-2 h-8 w-8 rounded-full bg-yellow-500/95 text-white shadow-lg backdrop-blur-sm flex items-center justify-center">
                    <span className="text-[11px] font-bold leading-none">
                      {Number(manga.rating).toFixed(1)}
                    </span>
                  </div>
                )}

                {/* Hot Badge */}
                {manga.hot && (
                  <div className="absolute bottom-2 left-2">
                    <Flame className="h-5 w-5 text-red-500 filter drop-shadow-lg" />
                  </div>
                )}
              </div>

              {/* Info Section */}
              <div
                className={
                  cardLayout === "vertical"
                    ? "p-3 flex flex-col h-[192px]"
                    : "flex min-w-0 flex-1 flex-col justify-between gap-2 py-0.5"
                }
              >
                {/* Title */}
                <div
                  className={
                    cardLayout === "vertical"
                      ? "min-h-[2.75rem] md:min-h-[3rem] mb-2 flex items-center"
                      : "mb-0 flex items-start"
                  }
                >
                  <Link
                    to={`/komik/${manga.slug}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block w-full"
                  >
                    <h3
                      className={`font-bold line-clamp-2 text-gray-900 transition-colors hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400 ${
                        cardLayout === "vertical" ? "text-sm" : "text-sm sm:text-base"
                      }`}
                    >
                      {manga.title}
                    </h3>
                  </Link>
                </div>
                
                {manga.lastChapters?.length > 0 ? (
                  <div
                    className={
                      cardLayout === "vertical"
                        ? "mb-1 mt-auto space-y-2"
                        : "flex flex-col gap-1.5 sm:gap-2"
                    }
                  >
                    {manga.lastChapters.slice(0, 3).map((chapter) => (
                      <Link
                        key={chapter.slug}
                        to={`/view/${chapter.slug}`}
                        onClick={(e) => e.stopPropagation()}
                        className={`flex w-full items-center justify-between rounded-lg border-l-2 border-blue-500 bg-gray-100 text-left text-gray-700 transition-colors hover:bg-gray-200 dark:bg-primary-800/70 dark:text-gray-300 dark:hover:bg-primary-700 ${
                          cardLayout === "vertical"
                            ? "px-2.5 py-2 text-xs"
                            : "px-2 py-1.5 text-[11px] sm:px-2.5 sm:py-2 sm:text-xs"
                        }`}
                      >
                        <span className="font-semibold">
                          Chapter {chapter.number || "N/A"}
                        </span>
                        {getChapterTimeAgo(chapter) && (
                          <span className="text-[11px] md:text-xs text-gray-500 dark:text-gray-400">
                            {getChapterTimeAgo(chapter)}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div
                    className={`text-xs text-gray-500 dark:text-gray-500 ${
                      cardLayout === "vertical" ? "mb-1 mt-auto" : ""
                    }`}
                  >
                    Chapter N/A
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PopularSection;
