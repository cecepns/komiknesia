import { useState, useEffect, useMemo } from "react";
import { useIsMdUp } from "../hooks/useIsMdUp";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, FolderKanban, LayoutGrid, List } from "lucide-react";
import LazyImage from "./LazyImage";
import AdBanner from "./AdBanner";
import { useAds } from "../hooks/useAds";
import { apiClient, getImageUrl } from "../utils/api";
import { getChapterTimeAgo } from "../utils/chapterTime";
import ChapterAccessLink from "./ChapterAccessLink";

const contentBtnTrans = "transition-all duration-200";
const contentFilterInactive = `rounded-xl border ${contentBtnTrans} border-slate-200 bg-slate-50 text-slate-700 shadow-[0_3px_0_0_#e2e8f0] hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_#cbd5e1] active:translate-y-px active:shadow-[0_2px_0_0_#e2e8f0] dark:border-primary-600 dark:bg-primary-800 dark:text-gray-200 dark:shadow-[0_3px_0_0_#1e3a5f] dark:hover:bg-primary-800`;
const contentCtaClearAll = `rounded-xl border border-sky-500/25 bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_5px_0_0_#0369a1] ${contentBtnTrans} hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_#0369a1] active:translate-y-0.5 active:shadow-[0_3px_0_0_#0369a1] dark:border-cyan-200/20 dark:bg-[#0a2d52] dark:text-cyan-50 dark:shadow-[0_5px_0_0_#0ea5e9] dark:hover:shadow-[0_6px_0_0_#38bdf8] dark:active:shadow-[0_3px_0_0_#0369a1] dark:hover:brightness-110`;

const MOBILE_HOME_SECTION_CAP = 14;

const ProjectSection = () => {
  const navigate = useNavigate();
  const { ads: projectTopAds } = useAds("project-top");
  const [mangaList, setMangaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardLayout, setCardLayout] = useState("vertical");
  const isMdUp = useIsMdUp();

  const visibleManga = useMemo(
    () => (isMdUp ? mangaList : mangaList.slice(0, MOBILE_HOME_SECTION_CAP)),
    [isMdUp, mangaList],
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getContents({
          page: 1,
          per_page: 15,
          orderBy: "Update",
          project: "true",
        });
        const mangaData =
          response?.status === false ? [] : response?.data || [];
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
        console.error("Error fetching project manga:", error);
        setMangaList([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const projectTopBanner =
    projectTopAds.length > 0 ? (
      <div className="mb-8">
        <AdBanner ads={projectTopAds} layout="grid" columns={2} />
      </div>
    ) : null;

  if (loading || mangaList.length === 0) {
    return projectTopBanner;
  }

  return (
    <>
      {projectTopBanner}
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-violet-500 to-fuchsia-500 p-2 rounded-lg">
            <FolderKanban className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Project
          </h2>
        </div>
        <div className="flex items-center gap-2">
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
            onClick={() => navigate("/content?project=true")}
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
              {manga.rating > 0 && (
                <div className="absolute top-2 left-2 h-8 w-8 rounded-full bg-yellow-500/95 text-white shadow-lg backdrop-blur-sm flex items-center justify-center">
                  <span className="text-[11px] font-bold leading-none">
                    {Number(manga.rating).toFixed(1)}
                  </span>
                </div>
              )}
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
                  className={`max-w-fit rounded-full bg-red-500/90 px-2 py-1 backdrop-blur-sm ${
                    cardLayout === "vertical" ? "mb-1" : "mb-0"
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
                  {manga.lastChapters.slice(0, 3).map((chapter, chapterIndex) => (
                    <ChapterAccessLink
                      key={chapter.slug}
                      chapter={chapter}
                      to={`/view/${chapter.slug}`}
                      onClick={(e) => e.stopPropagation()}
                      accent="violet"
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
    </div>
    </>
  );
};

export default ProjectSection;
