import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, LayoutGrid, List, BookOpen, Layers, Sparkles } from "lucide-react";
import LazyImage from "./LazyImage";
import { apiClient, getImageUrl } from "../utils/api";
import { getChapterTimeAgo } from "../utils/chapterTime";
import ChapterAccessLink from "./ChapterAccessLink";
import { useIsMdUp } from "../hooks/useIsMdUp";

const MOBILE_HOME_SECTION_CAP = 14;

const sectionIcons = {
  manhwa: Sparkles,
  manga: BookOpen,
  manhua: Layers,
};

const ComicTypeSection = ({ title, type, targetUrl }) => {
  const navigate = useNavigate();
  const [mangaList, setMangaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardLayout, setCardLayout] = useState("vertical");
  const isMdUp = useIsMdUp();

  const visibleManga = useMemo(
    () => (isMdUp ? mangaList : mangaList.slice(0, MOBILE_HOME_SECTION_CAP)),
    [isMdUp, mangaList]
  );

  useEffect(() => {
    const fetchManga = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getContents({
          page: 1,
          per_page: 15,
          type: type,
          orderBy: "Update",
        });

        const mangaData = response?.data || [];
        const transformed = mangaData.map((manga) => ({
          id: manga.id,
          title: manga.title,
          slug: manga.slug,
          cover: manga.cover,
          country_id: manga.country_id,
          color: manga.color,
          hot: manga.hot,
          rating: manga.rating,
          total_views: manga.total_views,
          lastChapters: manga.lastChapters || [],
        }));

        setMangaList(transformed);
      } catch (error) {
        console.error(`Error fetching ${type} manga:`, error);
        setMangaList([]);
      } finally {
        setLoading(false);
      }
    };

    fetchManga();
  }, [type]);

  const IconComponent = sectionIcons[type.toLowerCase()] || BookOpen;

  if (!loading && mangaList.length === 0) {
    return null;
  }

  return (
    <div className="mb-12">
      {/* Title Bar with Red Background - Styled like reference image */}
      <div className="w-full bg-red-600 dark:bg-red-600 text-white rounded-xl px-4 py-3 mb-6 flex items-center justify-between shadow-lg shadow-red-900/20">
        <div className="flex items-center gap-3">
          <IconComponent className="h-5 w-5 sm:h-6 sm:w-6 text-white shrink-0" />
          <h2 className="text-base sm:text-lg font-bold tracking-wide uppercase text-white">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setCardLayout((prev) =>
                prev === "vertical" ? "horizontal" : "vertical"
              )
            }
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/20 text-white transition-colors hover:bg-black/40"
            title={
              cardLayout === "vertical"
                ? "Tampilan baris (horizontal)"
                : "Tampilan grid (vertical)"
            }
            aria-label="Ubah mode tampilan"
          >
            {cardLayout === "vertical" ? (
              <List className="h-4 w-4" aria-hidden />
            ) : (
              <LayoutGrid className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* Grid or List of Comics */}
      {loading ? (
        <div className="text-center py-12 bg-gray-900/60 rounded-xl border border-gray-800">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500 mx-auto"></div>
          <p className="text-gray-400 mt-4 text-sm">Memuat {title}...</p>
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
              className={`bg-white dark:bg-white/[0.06] dark:border dark:border-white/10 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer ${cardLayout === "horizontal"
                  ? "flex flex-row gap-3 p-3 sm:gap-4 sm:p-4"
                  : "flex flex-col"
                }`}
            >
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

                {/* {manga.rating > 0 && (
                  <div className="absolute top-2 left-2 h-8 w-8 rounded-full bg-yellow-500/95 text-white shadow-lg backdrop-blur-sm flex items-center justify-center">
                    <span className="text-[11px] font-bold leading-none">
                      {Number(manga.rating).toFixed(1)}
                    </span>
                  </div>
                )} */}
              </div>

              <div
                className={
                  cardLayout === "vertical"
                    ? "p-3 flex flex-col h-[192px]"
                    : "flex min-w-0 flex-1 flex-col justify-between gap-2 py-0.5"
                }
              >
                {!!manga.hot && (
                  <div
                    className={`max-w-fit rounded-full bg-red-500/90 px-2 py-1 backdrop-blur-sm ${cardLayout === "vertical" ? "mb-1" : "mb-0"
                      }`}
                  >
                    <span className="text-xs font-bold text-white">HOT</span>
                  </div>
                )}
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
                      className={`font-bold line-clamp-2 text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${cardLayout === "vertical" ? "text-xs md:text-sm" : "text-sm sm:text-base"
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
                      <ChapterAccessLink
                        key={chapter.slug}
                        chapter={chapter}
                        to={`/view/${chapter.slug}`}
                        onClick={(e) => e.stopPropagation()}
                        accent="red"
                        className={
                          cardLayout === "vertical"
                            ? "text-xs"
                            : "px-2 py-1.5 text-[11px] sm:px-2.5 sm:py-2 sm:text-xs"
                        }
                        label={`Chapter ${chapter.number || "N/A"}`}
                        meta={getChapterTimeAgo(chapter) || null}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    className={`text-xs text-gray-500 ${cardLayout === "vertical" ? "mb-1 mt-auto" : ""
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

      {/* Button "Lihat Semuanya" at bottom of section */}
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={() => navigate(targetUrl)}
          className="group inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-red-900/30 hover:bg-red-700 hover:scale-105 active:scale-95 transition-all"
        >
          Lihat semua
          <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
};

export default ComicTypeSection;
