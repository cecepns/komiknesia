import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Flame } from "lucide-react";
import LazyImage from "./LazyImage";
import { apiClient, getImageUrl } from "../utils/api";

const PopularSection = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("today");
  const [filteredManga, setFilteredManga] = useState([]);
  const [loading, setLoading] = useState(true);

  const countryFlags = {
    JP: "🇯🇵",
    KR: "🇰🇷",
    CN: "🇨🇳",
    US: "🇺🇸",
    ID: "🇮🇩",
  };

  const filters = [
    { id: "today", label: "Hari ini", type: "popular_daily" },
    { id: "week", label: "Minggu ini", type: "popular_weekly" },
    { id: "month", label: "Bulan ini", type: "popular_monthly" },
  ];

  useEffect(() => {
    fetchPopularManga(activeFilter);
  }, [activeFilter]);

  const fetchPopularManga = async (filter) => {
    try {
      setLoading(true);
      const filterConfig = filters.find((f) => f.id === filter);
      const type = filterConfig ? filterConfig.type : "popular_daily";

      const items = await apiClient.getFeaturedItems(type, true);
      // Sort by display_order and transform to match expected format
      const sorted = items
        .sort((a, b) => a.display_order - b.display_order)
        .slice(0, 20)
        .map((item) => ({
          id: item.manga_id,
          title: item.title,
          slug: item.slug,
          cover: item.cover,
          country_id: item.country_id,
          hot: item.hot,
          rating: item.rating,
          total_views: item.total_views,
          lastChapters: item.lastChapters || [],
        }));

      setFilteredManga(sorted);
    } catch (error) {
      console.error("Error fetching popular manga:", error);
      setFilteredManga([]);
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (timestamp) => {
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
          <div className="bg-gradient-to-r from-red-500 to-orange-500 p-2 rounded-lg">
            <Flame className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Populer
          </h2>
        </div>
        <button
          onClick={() => navigate("/content")}
          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors duration-300"
        >
          View All
        </button>
      </div>

      {/* Filter Buttons */}
      <div className="flex space-x-3 mb-6">
        {filters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-6 text-xs md:text-lg py-2 rounded-lg font-medium transition-all duration-300 ${
              activeFilter === filter.id
                ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 shadow-lg"
                : "bg-gray-200 dark:bg-primary-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-primary-600"
            }`}
          >
            {filter.label}
          </button>
        ))}
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
            Tidak ada manga untuk filter ini
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredManga.map((manga) => (
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
                <div className="absolute top-2 right-2 text-2xl bg-white/90 dark:bg-primary-900/90 rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                  {countryFlags[manga.country_id] || "🌍"}
                </div>

                {/* Color Badge */}
                {/* {manga.color && (
                  <div className="absolute top-2 left-2 bg-yellow-500 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center space-x-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z"/>
                    </svg>
                    <span>COLOR</span>
                  </div>
                )} */}

                {/* Hot Badge */}
                {manga.hot && (
                  <div className="absolute bottom-2 left-2">
                    <Flame className="h-5 w-5 text-red-500 filter drop-shadow-lg" />
                  </div>
                )}

                {/* Title Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="text-white font-bold text-sm line-clamp-2 mb-1">
                    {manga.title}
                  </h3>
                </div>
              </div>

              {/* Info Section */}
              <div className="p-3">
                <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-medium">
                    Chapter {manga.lastChapters[0]?.number || "N/A"}
                  </span>
                  <span className="text-gray-500 dark:text-gray-500">
                    {getTimeAgo(manga.lastChapters[0]?.created_at?.time)}
                  </span>
                </div>
                {manga.rating > 0 && (
                  <div className="flex items-center space-x-1">
                    <svg
                      className="w-3 h-3 text-yellow-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {manga.rating}
                    </span>
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
