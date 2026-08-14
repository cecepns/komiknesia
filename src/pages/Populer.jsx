import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Flame, Star, ChevronLeft, ChevronRight } from "lucide-react";
import LazyImage from "../components/LazyImage";
import AdBanner from "../components/AdBanner";
import { useAds } from "../hooks/useAds";
import { apiClient, getImageUrl } from "../utils/api";
import { getChapterTimeAgo } from "../utils/chapterTime";
import ChapterAccessLink from "../components/ChapterAccessLink";

const VALID_TYPES = ["manhwa", "manga", "manhua"];

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

const Populer = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const typeParam = (searchParams.get("type") || "manhwa").toLowerCase();
  const activeType = VALID_TYPES.includes(typeParam) ? typeParam : "manhwa";

  const [mangaList, setMangaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { ads: popularTopAds } = useAds("popular-top");
  const { ads: popularFooterAds } = useAds("popular-footer");

  const setType = (type) => {
    const next = new URLSearchParams(searchParams);
    next.set("type", type);
    setSearchParams(next);
    setPage(1);
  };

  const fetchPopularManga = useCallback(async () => {
    setLoading(true);
    try {
      // Map type to type_id for backend API (manhwa: 2, manga: 1, manhua: 3)
      const typeIdMap = { manga: 1, manhwa: 2, manhua: 3 };
      const res = await apiClient.getContents({
        page,
        limit: 100,
        per_page: 100,
        orderBy: "Popular",
        type: activeType,
        type_id: typeIdMap[activeType],
      });
      if (res.status && res.data) {
        setMangaList(res.data);
        const meta = res.meta || {};
        setTotalPages(Math.max(1, Number(meta.totalPages) || 1));
      } else {
        setMangaList([]);
        setTotalPages(1);
      }
    } catch (err) {
      console.error("Error fetching popular manga:", err);
      setMangaList([]);
    } finally {
      setLoading(false);
    }
  }, [activeType, page]);

  useEffect(() => {
    fetchPopularManga();
  }, [fetchPopularManga]);

  return (
    <div className="min-h-screen pb-20 pt-4 bg-black text-gray-100 dark:bg-black dark:text-gray-100">
      <Helmet>
        <title>Populer - Komiknesia</title>
        <meta name="description" content="Komik Populer Manhwa, Manga, dan Manhua di Komiknesia." />
      </Helmet>

      <div className="container mx-auto px-4 max-w-7xl">
        {/* Top Ads */}
        {popularTopAds && popularTopAds.length > 0 && (
          <div className="mb-6">
            <AdBanner ads={popularTopAds} layout="grid" columns={2} />
          </div>
        )}

        {/* Title */}
        <div className="mb-6 flex items-center space-x-3">
          <div className="bg-gradient-to-r from-red-600 to-rose-500 p-2.5 rounded-xl shadow-lg shadow-red-500/20">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 sm:text-3xl">
              Komik Populer
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
              Top 100 komik terbanyak dibaca disortir per kategori
            </p>
          </div>
        </div>

        {/* Category Tabs (Red Theme UI) */}
        <div className="mb-6 flex items-center justify-start gap-2 border-b border-gray-200 pb-3 dark:border-white/10">
          {[
            { id: "manhwa", label: "Manhwa" },
            { id: "manga", label: "Manga" },
            { id: "manhua", label: "Manhua" },
          ].map(({ id, label }) => {
            const isActive = activeType === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setType(id)}
                className={`rounded-xl border transition-all duration-200 px-4 py-2.5 text-xs font-bold sm:text-sm ${
                  isActive
                    ? "border-red-500/50 bg-red-600 text-white shadow-md dark:border-red-400/40 dark:bg-red-600 dark:text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-gray-100 dark:border-white/10 dark:bg-black dark:text-gray-200 hover:dark:bg-white/5"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Content Grid */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
            <p className="mt-4 text-sm font-semibold text-gray-500 dark:text-gray-400">
              Memuat komik populer...
            </p>
          </div>
        ) : mangaList.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-gray-500 dark:text-gray-400">
              Tidak ada data komik untuk kategori {activeType}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-4">
            {mangaList.map((manga, idx) => (
              <div
                key={manga.id}
                onClick={() => navigate(`/komik/${manga.slug}`)}
                className="bg-white dark:bg-white/[0.06] dark:border dark:border-white/10 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer flex flex-col"
              >
                {/* Cover Image */}
                <div className="relative aspect-[3/4] overflow-hidden">
                  <LazyImage
                    src={getImageUrl(manga.cover)}
                    alt={manga.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    wrapperClassName="h-full w-full"
                  />

                  {/* Rank Badge */}
                  <div className="absolute top-2 left-2 flex h-6 min-w-[24px] items-center justify-center rounded-lg bg-red-600 px-1.5 text-xs font-black text-white shadow-md">
                    #{idx + 1 + (page - 1) * 100}
                  </div>

                  {/* Rating Badge */}
                  {manga.rating > 0 && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-black/75 px-1.5 py-0.5 text-[11px] font-bold text-amber-400 backdrop-blur-sm">
                      <Star className="h-3 w-3 fill-amber-400" />
                      <span>{Number(manga.rating).toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col justify-between p-3">
                  <h3 className="line-clamp-2 text-xs font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors sm:text-sm">
                    {manga.title}
                  </h3>

                  {manga.lastChapters?.length > 0 ? (
                    <div className="mt-2 space-y-1.5">
                      {manga.lastChapters.slice(0, 2).map((ch) => (
                        <ChapterAccessLink
                          key={ch.slug}
                          chapter={ch}
                          to={`/view/${ch.slug}`}
                          onClick={(e) => e.stopPropagation()}
                          label={`Chapter ${ch.number || "N/A"}`}
                          meta={getChapterTimeAgo(ch) || null}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-gray-400">Chapter N/A</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 shadow-sm transition-all disabled:opacity-40 dark:border-primary-700 dark:bg-primary-900 dark:text-gray-200"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <span className="px-3 text-xs font-semibold text-gray-600 dark:text-gray-400">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 shadow-sm transition-all disabled:opacity-40 dark:border-primary-700 dark:bg-primary-900 dark:text-gray-200"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Footer Ads */}
        {popularFooterAds && popularFooterAds.length > 0 && (
          <div className="mt-8">
            <AdBanner ads={popularFooterAds} layout="grid" columns={2} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Populer;
