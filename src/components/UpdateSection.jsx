import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clock } from "lucide-react";
import LazyImage from "./LazyImage";
import { apiClient, getImageUrl } from "../utils/api";

const UpdateSection = () => {
  const navigate = useNavigate();
  const [mangaList, setMangaList] = useState([]);
  const [loading, setLoading] = useState(true);

  const countryFlags = {
    JP: "🇯🇵",
    KR: "🇰🇷",
    CN: "🇨🇳",
    US: "🇺🇸",
    ID: "🇮🇩",
  };

  useEffect(() => {
    fetchUpdateManga();
  }, []);

  const fetchUpdateManga = async () => {
    try {
      setLoading(true);
      // Use /api/contents endpoint with page=1, orderBy=Update, per_page=14
      const response = await apiClient.getContents({
        page: 1,
        per_page: 14,
        orderBy: "Update",
      });

      // Extract manga data from response
      const mangaData = response.data || [];

      // Transform to match expected format
      const transformed = mangaData
        .filter((manga) => manga.lastChapters && manga.lastChapters.length > 0)
        .map((manga) => ({
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
      console.error("Error fetching update manga:", error);
      setMangaList([]);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return "";
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    const hours = Math.floor(diff / 3600);
    const days = Math.floor(diff / (3600 * 24));

    if (hours < 24) {
      return `${hours} jam`;
    } else {
      return `${days} hari`;
    }
  };

  return (
    <div className="mb-12">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-2 rounded-lg">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Update Terbaru
          </h2>
        </div>
        <button
          onClick={() => navigate("/content")}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors duration-300"
        >
          View All
        </button>
      </div>

      {/* Manga Grid */}
      {loading ? (
        <div className="text-center py-12 bg-gray-100 dark:bg-primary-900 rounded-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          <p className="text-gray-500 dark:text-gray-400 mt-4">Memuat...</p>
        </div>
      ) : mangaList.length === 0 ? (
        <div className="text-center py-12 bg-gray-100 dark:bg-primary-900 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">
            Tidak ada manga update terbaru
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-4">
          {mangaList.map((manga) => (
            <div
              key={manga.id}
              onClick={() => navigate(`/komik/${manga.slug}`)}
              className="bg-white dark:bg-primary-900 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer"
            >
              {/* Cover Image */}
              <div className="relative aspect-[3/4] overflow-hidden">
                <LazyImage
                  src={getImageUrl(manga.cover)}
                  alt={manga.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  wrapperClassName="w-full h-full"
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Country Flag */}
                {/* <div className="absolute top-2 right-2 text-2xl bg-white/90 dark:bg-primary-900/90 rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                  {countryFlags[manga.country_id] || "🌍"}
                </div>*/}

                {/* Color Badge */}
               {/* {manga.color && (
                  <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center space-x-1">
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z" />
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
                {/* {manga.hot && (
                  <div className="absolute bottom-2 left-2 bg-red-500/90 backdrop-blur-sm rounded-full px-2 py-1">
                    <span className="text-white text-xs font-bold">HOT</span>
                  </div>
                )} */}
              </div>

              {/* Info Section */}
              <div className="p-3 flex flex-col h-[192px]">
                {!!manga.hot && (
                  <div className="mb-1 max-w-fit bg-red-500/90 backdrop-blur-sm rounded-full px-2 py-1">
                    <span className="text-white text-xs font-bold">HOT</span>
                  </div>
                )}
                {/* Title */}
                <div className="min-h-[2.75rem] md:min-h-[3rem] mb-2 flex items-center">
                  <Link
                    to={`/komik/${manga.slug}`}
                    onClick={(e) => e.stopPropagation()}
                    className="block w-full"
                  >
                    <h3 className="font-bold text-sm line-clamp-2 text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      {manga.title}
                    </h3>
                  </Link>
                </div>

                {manga.lastChapters?.length > 0 ? (
                  <div className="space-y-2 mb-1 mt-auto">
                    {manga.lastChapters.slice(0, 3).map((chapter) => (
                      <Link
                        key={chapter.slug}
                        to={`/view/${chapter.slug}`}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full flex items-center justify-between rounded-lg border-l-2 border-blue-500 bg-gray-100 dark:bg-primary-800/70 px-2.5 py-2 text-xs text-left text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-primary-700 transition-colors"
                      >
                        <span className="font-semibold">
                          Chapter {chapter.number || "N/A"}
                        </span>
                        {chapter?.created_at?.time && (
                          <span className="text-[11px] md:text-xs text-gray-500 dark:text-gray-400">
                            {getTimeAgo(chapter.created_at.time)}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 dark:text-gray-500 mb-1 mt-auto">
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

export default UpdateSection;
