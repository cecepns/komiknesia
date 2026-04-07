import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Clock, Bookmark, History, LogIn, Trash2 } from "lucide-react";
import LazyImage from "../components/LazyImage";
import comingSoonImage from "../assets/coming-soon.png";
import AdBanner from "../components/AdBanner";
import { useAds } from "../hooks/useAds";
import { apiClient, getImageUrl } from "../utils/api";
import { removeFromHistory, clearHistory } from "../utils/historyManager";
import { useAuth } from "../contexts/AuthContext";

const VALID_TABS = ["rekomendasi", "bookmark", "history"];
const TAB_ID_MAP = { rekomendasi: "new-update", bookmark: "bookmark", history: "history" };

const Library = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const tabParam = searchParams.get("tab") || "rekomendasi";
  const activeTabId = VALID_TABS.includes(tabParam)
    ? TAB_ID_MAP[tabParam]
    : TAB_ID_MAP.rekomendasi;
  const setActiveTab = (id) => {
    const paramValue = Object.entries(TAB_ID_MAP).find(([, v]) => v === id)?.[0] ?? "rekomendasi";
    setSearchParams({ tab: paramValue });
  };
  const [mangaList, setMangaList] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [bookmarkList, setBookmarkList] = useState([]);
  const [bookmarkPage, setBookmarkPage] = useState(1);
  const [bookmarkHasMore, setBookmarkHasMore] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch ads by type
  const { ads: libraryTopAds } = useAds("library-top", 6);

  const loadMangaUpdates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getContents({
        page: 1,
        per_page: 50,
        orderBy: "Popular",
      });
      setMangaList(response.data || []);
    } catch (error) {
      console.error("Error fetching recommended manga:", error);
      setMangaList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasMore, setHistoryHasMore] = useState(false);

  const loadHistory = useCallback(() => {
    try {
      const history = localStorage.getItem("mangaHistory");
      if (history) {
        const parsedHistory = JSON.parse(history);
        // Dedupe by mangaSlug (manga-only history), take newest
        const seen = new Set();
        const deduped = parsedHistory.filter((item) => {
          if (seen.has(item.mangaSlug)) return false;
          seen.add(item.mangaSlug);
          return true;
        });
        const trimmed = deduped.slice(0, 100);
        setHistoryList(trimmed);
        setHistoryHasMore(trimmed.length > 10);
      } else {
        setHistoryList([]);
        setHistoryHasMore(false);
      }
    } catch (error) {
      console.error("Error loading history:", error);
    }
  }, []);

  const loadBookmarks = useCallback(async () => {
    if (!isAuthenticated) return;
    setBookmarkLoading(true);
    try {
      const res = await apiClient.getBookmarks({
        page: bookmarkPage,
        limit: 24,
      });
      if (res.status && res.data) {
        setBookmarkList(res.data);
        const meta = res.meta || {};
        setBookmarkHasMore(meta.page < meta.totalPages);
      } else {
        setBookmarkList([]);
        setBookmarkHasMore(false);
      }
    } catch (err) {
      console.error("Error loading bookmarks:", err);
      setBookmarkList([]);
      setBookmarkHasMore(false);
    } finally {
      setBookmarkLoading(false);
    }
  }, [isAuthenticated, bookmarkPage]);

  useEffect(() => {
    loadMangaUpdates();
    loadHistory();
  }, [loadMangaUpdates, loadHistory]);

  // Reset history pagination when tab changes
  useEffect(() => {
    if (activeTabId === "history") {
      setHistoryPage(1);
    }
  }, [activeTabId]);

  useEffect(() => {
    if (activeTabId === "bookmark" && isAuthenticated) loadBookmarks();
  }, [activeTabId, isAuthenticated, loadBookmarks]);

  // Reset bookmark pagination when leaving/entering tab
  useEffect(() => {
    if (activeTabId === "bookmark") {
      setBookmarkPage(1);
    }
  }, [activeTabId]);

  const getTimeAgo = (timestamp) => {
    const now = Math.floor(Date.now() / 1000);
    const diff = now - timestamp;

    const hours = Math.floor(diff / 3600);
    const days = Math.floor(diff / (3600 * 24));

    if (hours < 1) {
      return "Baru saja";
    } else if (hours < 24) {
      return `${hours} jam lalu`;
    } else {
      return `${days} hari lalu`;
    }
  };

  const tabs = [
    { id: "new-update", label: "Rekomendasi", icon: Clock },
    { id: "bookmark", label: "Bookmark", icon: Bookmark },
    { id: "history", label: "History", icon: History },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <Helmet>
        <title>Library | KomikNesia</title>
        <meta
          name="description"
          content="Lihat rekomendasi komik, bookmark, dan riwayat baca kamu di KomikNesia. Kelola koleksi komik favoritmu dengan mudah."
        />
      </Helmet>
      {/* Library Top Ads - 6 ads */}
      {libraryTopAds.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 mb-6">
          <AdBanner ads={libraryTopAds} layout="grid" columns={2} />
        </div>
      )}

      {/* Tabs */}
      <div
        className={`sticky top-20 md:top-24 z-30 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 ${libraryTopAds.length === 0 ? "" : "mt-20"}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTabId === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center space-x-2 ${
                    isActive
                      ? "bg-red-600 text-white shadow-lg"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <Icon className={`${isActive ? "h-5 w-5" : "h-4 w-4"}`} />
                  <span className="text-xs md:text-base">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-12 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* New Update Tab */}
          {activeTabId === "new-update" && (
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Rekomendasi
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  50 komik dengan view terbanyak
                </p>
              </div>

              {loading ? (
                <div className="text-center py-12 bg-gray-100 dark:bg-gray-900 rounded-lg">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
                  <p className="text-gray-500 dark:text-gray-400 mt-4">
                    Memuat...
                  </p>
                </div>
              ) : mangaList.length === 0 ? (
                <div className="text-center py-12 bg-gray-100 dark:bg-gray-900 rounded-lg">
                  <p className="text-gray-500 dark:text-gray-400">
                    Tidak ada manga rekomendasi
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {mangaList.map((manga) => (
                    <div
                      key={manga.id}
                      onClick={() => navigate(`/komik/${manga.slug}`)}
                      className="bg-white dark:bg-gray-900 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer"
                    >
                      <div className="relative aspect-[3/4] overflow-hidden">
                        <LazyImage
                          src={getImageUrl(manga.cover)}
                          alt={manga.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          wrapperClassName="w-full h-full"
                        />

                        {/* <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" /> */}

                        {/* <div className="absolute top-2 right-2 text-2xl bg-white/90 dark:bg-gray-900/90 rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                          {countryFlags[manga.country_id] || "🌍"}
                        </div> */}

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

                        {manga.rating > 0 && (
                          <div className="absolute top-2 left-2 h-8 w-8 rounded-full bg-yellow-500/95 text-white shadow-lg backdrop-blur-sm flex items-center justify-center">
                            <span className="text-[11px] font-bold leading-none">
                              {Number(manga.rating).toFixed(1)}
                            </span>
                          </div>
                        )}


                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          {!!manga.hot && (
                            <div className="mb-1 max-w-fit bg-red-500/90 backdrop-blur-sm rounded-full px-2 py-1">
                              <span className="text-white text-xs font-bold">
                                HOT
                              </span>
                            </div>
                          )}
                          <h3 className="text-white font-bold text-sm line-clamp-2 mb-1">
                            {manga.title}
                          </h3>
                        </div>
                      </div>

                      <div className="p-3">
                        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                          <span className="font-medium">
                            Chapter {manga.lastChapters[0]?.number || "N/A"}
                          </span>
                          <span className="text-gray-500 dark:text-gray-500">
                            {getTimeAgo(
                              manga.lastChapters[0]?.created_at?.time,
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bookmark Tab */}
          {activeTabId === "bookmark" && (
            <>
              {!isAuthenticated ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="max-w-md w-full bg-gray-900 dark:bg-gray-950 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="aspect-[4/3]">
                      <img
                        src={comingSoonImage}
                        alt="Login Required"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="p-6 text-center">
                      <h2 className="text-2xl font-bold text-white mb-2">
                        Bookmark
                      </h2>
                      <p className="text-gray-300 mb-6 text-sm">
                        Silakan login untuk melihat daftar bookmark kamu
                      </p>
                      <button
                        onClick={() => navigate("/akun")}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 shadow-lg flex items-center justify-center space-x-2"
                      >
                        <LogIn className="h-5 w-5" />
                        <span>LOGIN</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                      Bookmark
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Komik yang kamu simpan (tersimpan per akun)
                    </p>
                  </div>
                  {bookmarkLoading ? (
                    <div className="text-center py-12 bg-gray-100 dark:bg-gray-900 rounded-lg">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
                      <p className="text-gray-500 dark:text-gray-400 mt-4">
                        Memuat bookmark...
                      </p>
                    </div>
                  ) : bookmarkList.length === 0 ? (
                    <div className="text-center py-12 bg-gray-100 dark:bg-gray-900 rounded-lg">
                      <Bookmark className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400 text-lg font-medium mb-2">
                        Belum ada bookmark
                      </p>
                      <p className="text-gray-400 dark:text-gray-500 text-sm">
                        Buka detail komik dan simpan ke bookmark untuk melihat
                        di sini
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {bookmarkList.map((item) => (
                          <div
                            key={item.id}
                            className="bg-white dark:bg-gray-900 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer relative"
                          >
                            <div
                              className="relative aspect-[3/4] overflow-hidden"
                              onClick={() => navigate(`/komik/${item.slug}`)}
                            >
                              <LazyImage
                                src={getImageUrl(item.cover)}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                wrapperClassName="w-full h-full"
                              />
                              <div className="absolute top-2 right-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    apiClient
                                      .removeBookmark(item.manga_id)
                                      .then(() => loadBookmarks());
                                  }}
                                  className="p-2 bg-red-600/90 hover:bg-red-600 text-white rounded-full shadow"
                                  title="Hapus bookmark"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                                <h3 className="text-white font-bold text-sm line-clamp-2">
                                  {item.title}
                                </h3>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {bookmarkHasMore && (
                        <div className="mt-6 flex justify-center">
                          <button
                            type="button"
                            onClick={() => setBookmarkPage((p) => p + 1)}
                            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                          >
                            Tampilkan bookmark berikutnya
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* History Tab */}
          {activeTabId === "history" && (
            <div>
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    Riwayat Baca
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Maksimal 100 manga, ditampilkan 10 per halaman
                  </p>
                </div>
                {historyList.length > 0 && (
                  <button
                    onClick={() => {
                      if (window.confirm("Hapus semua riwayat?")) {
                        clearHistory();
                        loadHistory();
                      }
                    }}
                    className="flex max-w-fit items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus Semua
                  </button>
                )}
              </div>

              {historyList.length === 0 ? (
                <div className="text-center py-12 bg-gray-100 dark:bg-gray-900 rounded-lg">
                  <History className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-lg font-medium mb-2">
                    Belum ada riwayat
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm">
                    Mulai baca komik untuk melihat riwayat di sini
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyList
                    .slice((historyPage - 1) * 10, historyPage * 10)
                    .map((item, index) => (
                      <div
                        key={`${item.mangaSlug}-${index}`}
                        className="bg-white dark:bg-gray-900 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer flex relative"
                      >
                        <div
                          className="relative w-32 sm:w-40 flex-shrink-0 overflow-hidden flex-1 min-w-0"
                          onClick={() => navigate(`/komik/${item.mangaSlug}`)}
                        >
                          <LazyImage
                            src={getImageUrl(item.cover)}
                            alt={item.mangaTitle}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            wrapperClassName="w-full h-full aspect-[3/4]"
                          />
                        </div>

                        <div
                          className="flex-1 p-4 pr-12 flex flex-col justify-between min-w-0"
                          onClick={() => navigate(`/komik/${item.mangaSlug}`)}
                        >
                          <h3 className="font-bold text-base md:text-lg mb-1 text-gray-900 dark:text-gray-100 line-clamp-2">
                            {item.mangaTitle}
                          </h3>
                          {item.chapterSlug ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/view/${item.chapterSlug}`);
                              }}
                              className="max-w-fit mb-1 text-xs md:text-sm text-blue-600 dark:text-blue-400 hover:underline text-left"
                            >
                              Lanjut baca: Chapter{" "}
                              {item.chapterNumber || item.chapterTitle || "terakhir"}
                            </button>
                          ) : null}
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            {getTimeAgo(Math.floor(item.timestamp / 1000))}
                          </p>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromHistory(item.mangaSlug);
                            loadHistory();
                          }}
                          className="absolute top-2 right-2 p-2 bg-red-600/90 hover:bg-red-600 text-white rounded-full shadow transition-colors"
                          title="Hapus riwayat"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  {historyHasMore && (
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          const nextPage = historyPage + 1;
                          const maxPage = Math.ceil(historyList.length / 10);
                          if (nextPage <= maxPage) {
                            setHistoryPage(nextPage);
                            setHistoryHasMore(nextPage < maxPage);
                          } else {
                            setHistoryHasMore(false);
                          }
                        }}
                        className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                      >
                        Tampilkan riwayat berikutnya
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Library;
