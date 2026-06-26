import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft,
  Bookmark,
  Flame,
  History,
  ListChecks,
  LogIn,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";
import LazyImage from "../components/LazyImage";
import comingSoonImage from "../assets/coming-soon.png";
import AdBanner from "../components/AdBanner";
import { useAds } from "../hooks/useAds";
import { apiClient, getImageUrl } from "../utils/api";
import { removeFromHistory, clearHistory } from "../utils/historyManager";
import { useAuth } from "../contexts/AuthContext";
import ChapterAccessLink from "../components/ChapterAccessLink";

/** Tombol — selaras Content.jsx (chip + bayangan offset) */
const contentBtnTrans = "transition-all duration-200";
const contentFilterInactive = `rounded-xl border ${contentBtnTrans} border-slate-200 bg-slate-50 text-slate-700 shadow-[0_3px_0_0_#e2e8f0] hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_#cbd5e1] active:translate-y-px active:shadow-[0_2px_0_0_#e2e8f0] dark:border-primary-600 dark:bg-primary-800 dark:text-gray-200 dark:shadow-[0_3px_0_0_#1e3a5f] dark:hover:bg-primary-800`;
const contentFilterActive = `rounded-xl border ${contentBtnTrans} border-sky-500/50 bg-sky-600 text-white shadow-[0_4px_0_0_#0369a1] dark:border-cyan-400/40 dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_4px_0_0_#38bdf8]`;
const contentCtaPrimary = `rounded-xl border border-sky-500/25 bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_5px_0_0_#0369a1] ${contentBtnTrans} hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_#0369a1] active:translate-y-0.5 active:shadow-[0_3px_0_0_#0369a1] dark:border-cyan-200/20 dark:bg-[#0a2d52] dark:text-cyan-50 dark:shadow-[0_5px_0_0_#0ea5e9] dark:hover:shadow-[0_6px_0_0_#38bdf8] dark:active:shadow-[0_3px_0_0_#0369a1] dark:hover:brightness-110`;
const paginationBtnClass = `${contentFilterInactive} px-4 py-2.5 text-sm font-semibold disabled:pointer-events-none disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-[0_3px_0_0_#e2e8f0] dark:disabled:opacity-40`;
const dangerIconBtnClass = `rounded-xl border border-red-500/40 bg-red-600 p-2 text-white shadow-[0_3px_0_0_rgb(127,29,29)] transition-all duration-200 hover:brightness-105 active:translate-y-px active:shadow-[0_2px_0_0_rgb(127,29,29)] dark:border-red-500/30 dark:shadow-[0_3px_0_0_rgb(69,10,10)]`;
const dangerOutlineBtnClass = `inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_0_0_rgb(127,29,29)] ${contentBtnTrans} hover:brightness-105 active:translate-y-px active:shadow-[0_2px_0_0_rgb(127,29,29)] dark:shadow-[0_4px_0_0_rgb(69,10,10)]`;
const linkChipBtnClass = `max-w-fit rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs font-medium text-slate-800 shadow-[0_2px_0_0_#e2e8f0] transition-all duration-200 hover:-translate-y-px hover:bg-white hover:shadow-[0_3px_0_0_#cbd5e1] dark:border-primary-600 dark:bg-primary-800 dark:text-gray-200 dark:shadow-[0_2px_0_0_#1e3a5f] dark:hover:bg-primary-700 md:text-sm`;

const VALID_TABS = ["bookmark", "readlist", "history", "popular"];
const VALID_POPULAR_TYPES = ["manga", "manhwa", "manhua"];

const Library = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const tabParam = (searchParams.get("tab") || "popular").toLowerCase();
  const activeTabId = VALID_TABS.includes(tabParam) ? tabParam : "popular";
  const popularParam = (searchParams.get("popular") || "manga").toLowerCase();
  const activePopularType = VALID_POPULAR_TYPES.includes(popularParam)
    ? popularParam
    : "manga";

  const setActiveTab = (id) => {
    const map = {
      bookmark: "bookmark",
      readlist: "readlist",
      history: "history",
      popular: "popular",
    };
    const nextTab = map[id] || "popular";
    const next = new URLSearchParams(searchParams);
    next.set("tab", nextTab);
    if (nextTab !== "popular") next.delete("popular");
    else if (!VALID_POPULAR_TYPES.includes((next.get("popular") || "").toLowerCase())) {
      next.set("popular", "manga");
    }
    setSearchParams(next);
  };

  const setPopularType = (type) => {
    const nextType = VALID_POPULAR_TYPES.includes(type) ? type : "manga";
    const next = new URLSearchParams(searchParams);
    next.set("tab", "popular");
    next.set("popular", nextType);
    setSearchParams(next);
  };
  const [historyList, setHistoryList] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [bookmarkList, setBookmarkList] = useState([]);
  const [bookmarkPage, setBookmarkPage] = useState(1);
  const [bookmarkHasMore, setBookmarkHasMore] = useState(false);
  const [bookmarkTotalPages, setBookmarkTotalPages] = useState(1);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [popularMangaList, setPopularMangaList] = useState([]);
  const [popularMangaLoading, setPopularMangaLoading] = useState(false);

  const [readlists, setReadlists] = useState([]);
  const [readlistsLoading, setReadlistsLoading] = useState(false);
  const [readlistDetailId, setReadlistDetailId] = useState(null);
  const [readlistDetail, setReadlistDetail] = useState(null);
  const [readlistDetailLoading, setReadlistDetailLoading] = useState(false);
  const [createReadlistOpen, setCreateReadlistOpen] = useState(false);
  const [renameReadlist, setRenameReadlist] = useState(null);
  const [readlistTitleDraft, setReadlistTitleDraft] = useState("");
  const [readlistSaving, setReadlistSaving] = useState(false);
  const [addMangaOpen, setAddMangaOpen] = useState(false);
  const [mangaPickerQuery, setMangaPickerQuery] = useState("");
  const [mangaPickerDebounced, setMangaPickerDebounced] = useState("");
  const [mangaPickerResults, setMangaPickerResults] = useState([]);
  const [mangaPickerLoading, setMangaPickerLoading] = useState(false);
  const [mangaPickerSelected, setMangaPickerSelected] = useState(() => new Set());
  const [addMangaSubmitting, setAddMangaSubmitting] = useState(false);

  // Fetch ads by type
  const { ads: libraryTopAds } = useAds("library-top");
  const { ads: libraryFooterAds } = useAds("library-footer");

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
        const currentPage = Number(meta.page) || bookmarkPage;
        const totalPages = Math.max(1, Number(meta.totalPages) || 1);
        setBookmarkTotalPages(totalPages);
        setBookmarkHasMore(currentPage < totalPages);
      } else {
        setBookmarkList([]);
        setBookmarkHasMore(false);
        setBookmarkTotalPages(1);
      }
    } catch (err) {
      console.error("Error loading bookmarks:", err);
      setBookmarkList([]);
      setBookmarkHasMore(false);
      setBookmarkTotalPages(1);
    } finally {
      setBookmarkLoading(false);
    }
  }, [isAuthenticated, bookmarkPage]);

  const loadReadlists = useCallback(async () => {
    if (!isAuthenticated) return;
    setReadlistsLoading(true);
    try {
      const res = await apiClient.getReadlists();
      if (res.status && Array.isArray(res.data)) {
        setReadlists(res.data);
      } else {
        setReadlists([]);
      }
    } catch (err) {
      console.error("Error loading readlists:", err);
      setReadlists([]);
    } finally {
      setReadlistsLoading(false);
    }
  }, [isAuthenticated]);

  const loadPopularManga = useCallback(async () => {
    setPopularMangaLoading(true);
    try {
      const res = await apiClient.getContents({
        page: 1,
        per_page: 50,
        orderBy: "Popular",
        type: activePopularType,
      });
      setPopularMangaList(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.error("Error loading popular manga:", err);
      setPopularMangaList([]);
    } finally {
      setPopularMangaLoading(false);
    }
  }, [activePopularType]);

  const loadReadlistDetail = useCallback(
    async (id) => {
      if (!id || !isAuthenticated) return;
      setReadlistDetailLoading(true);
      try {
        const res = await apiClient.getReadlist(id);
        if (res.status && res.data) {
          setReadlistDetail(res.data);
        } else {
          setReadlistDetail(null);
        }
      } catch (err) {
        console.error("Error loading readlist:", err);
        setReadlistDetail(null);
      } finally {
        setReadlistDetailLoading(false);
      }
    },
    [isAuthenticated],
  );

  useEffect(() => {
    if (activeTabId !== "readlist") {
      setReadlistDetailId(null);
      setReadlistDetail(null);
      setAddMangaOpen(false);
      setCreateReadlistOpen(false);
      setRenameReadlist(null);
    }
  }, [activeTabId]);

  useEffect(() => {
    if (activeTabId === "readlist" && isAuthenticated) {
      loadReadlists();
    }
  }, [activeTabId, isAuthenticated, loadReadlists]);

  useEffect(() => {
    if (readlistDetailId && activeTabId === "readlist") {
      loadReadlistDetail(readlistDetailId);
    } else {
      setReadlistDetail(null);
    }
  }, [readlistDetailId, activeTabId, loadReadlistDetail]);

  useEffect(() => {
    const t = setTimeout(() => setMangaPickerDebounced(mangaPickerQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [mangaPickerQuery]);

  useEffect(() => {
    if (!addMangaOpen) {
      setMangaPickerResults([]);
      setMangaPickerQuery("");
      setMangaPickerSelected(new Set());
      return;
    }
    if (mangaPickerDebounced.length < 2) {
      setMangaPickerResults([]);
      setMangaPickerLoading(false);
      return;
    }
    let cancelled = false;
    setMangaPickerLoading(true);
    apiClient
      .getManga(1, 40, mangaPickerDebounced, "", "all")
      .then((res) => {
        if (!cancelled) {
          setMangaPickerResults(Array.isArray(res.manga) ? res.manga : []);
        }
      })
      .catch(() => {
        if (!cancelled) setMangaPickerResults([]);
      })
      .finally(() => {
        if (!cancelled) setMangaPickerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addMangaOpen, mangaPickerDebounced]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Reset history pagination when tab changes
  useEffect(() => {
    if (activeTabId === "history") {
      setHistoryPage(1);
    }
  }, [activeTabId]);

  useEffect(() => {
    if (activeTabId === "bookmark" && isAuthenticated) loadBookmarks();
  }, [activeTabId, isAuthenticated, loadBookmarks]);

  useEffect(() => {
    if (activeTabId === "popular") {
      loadPopularManga();
    }
  }, [activeTabId, loadPopularManga]);

  // Reset bookmark pagination when leaving/entering tab
  useEffect(() => {
    if (activeTabId === "bookmark") {
      setBookmarkPage(1);
      setBookmarkTotalPages(1);
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
    { id: "popular", label: "Populer", icon: Flame },
    { id: "bookmark", label: "Bookmark", icon: Bookmark },
    { id: "readlist", label: "Readlist", icon: ListChecks },
    { id: "history", label: "History", icon: History },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-transparent text-gray-900 dark:text-gray-100">
      <Helmet>
        <title>Library | KomikNesia</title>
        <meta
          name="description"
          content="Bookmark, readlist, dan riwayat baca komik di KomikNesia. Kelola koleksi favoritmu dengan mudah."
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
        className={`sticky top-[70px] md:top-[75px] z-30 bg-white dark:bg-transparent border-b border-gray-200 dark:border-white/10 ${libraryTopAds.length === 0 ? "" : "mt-8"}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-4 gap-2 py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTabId === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center gap-1 rounded-xl border px-2.5 py-2.5 text-[11px] font-semibold transition-all duration-200 md:gap-2 md:px-3 md:text-sm ${
                    isActive ? contentFilterActive : contentFilterInactive
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 md:h-5 md:w-5" aria-hidden />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="pt-12 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Bookmark Tab */}
          {activeTabId === "bookmark" && (
            <>
              {!isAuthenticated ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="max-w-md w-full bg-gray-900 dark:bg-[#060d1f]/85 dark:backdrop-blur-md dark:border dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl">
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
                        type="button"
                        onClick={() => navigate("/akun")}
                        className={`flex w-full items-center justify-center gap-2 py-3 text-base font-semibold ${contentCtaPrimary}`}
                      >
                        <LogIn className="h-5 w-5 shrink-0" aria-hidden />
                        <span>Masuk</span>
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
                    <div className="text-center py-12 bg-gray-100 dark:bg-white/[0.04] dark:border dark:border-white/10 rounded-lg">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
                      <p className="text-gray-500 dark:text-gray-400 mt-4">
                        Memuat bookmark...
                      </p>
                    </div>
                  ) : bookmarkList.length === 0 ? (
                    <div className="text-center py-12 bg-gray-100 dark:bg-white/[0.04] dark:border dark:border-white/10 rounded-lg">
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
                            className="bg-white dark:bg-white/[0.06] dark:border dark:border-white/10 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer relative"
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
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    apiClient
                                      .removeBookmark(item.manga_id)
                                      .then(() => loadBookmarks());
                                  }}
                                  className={dangerIconBtnClass}
                                  title="Hapus bookmark"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden />
                                </button>
                              </div>
                            </div>
                            <div
                              className="p-3 min-h-[64px]"
                              onClick={() => navigate(`/komik/${item.slug}`)}
                            >
                              <h3 className="font-bold text-sm line-clamp-2 text-gray-900 dark:text-gray-100">
                                {item.title}
                              </h3>
                            </div>
                          </div>
                        ))}
                      </div>
                      {(bookmarkPage > 1 || bookmarkHasMore) && (
                        <div className="mt-6 flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setBookmarkPage((p) => Math.max(1, p - 1))
                            }
                            disabled={bookmarkPage <= 1}
                            className={paginationBtnClass}
                          >
                            Sebelumnya
                          </button>
                          <span className="text-sm text-gray-600 dark:text-gray-300">
                            Halaman {bookmarkPage}/{bookmarkTotalPages}
                          </span>
                          <button
                            type="button"
                            onClick={() => setBookmarkPage((p) => p + 1)}
                            disabled={!bookmarkHasMore}
                            className={paginationBtnClass}
                          >
                            Selanjutnya
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* Readlist Tab */}
          {activeTabId === "readlist" && (
            <>
              {!isAuthenticated ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="max-w-md w-full bg-gray-900 dark:bg-[#060d1f]/85 dark:backdrop-blur-md dark:border dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="aspect-[4/3]">
                      <img
                        src={comingSoonImage}
                        alt="Login Required"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="p-6 text-center">
                      <h2 className="text-2xl font-bold text-white mb-2">Readlist</h2>
                      <p className="text-gray-300 mb-6 text-sm">
                        Login untuk membuat readlist dan mengatur daftar baca kamu
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate("/akun")}
                        className={`flex w-full items-center justify-center gap-2 py-3 text-base font-semibold ${contentCtaPrimary}`}
                      >
                        <LogIn className="h-5 w-5 shrink-0" aria-hidden />
                        <span>Masuk</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : readlistDetailId ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setReadlistDetailId(null)}
                    className={`mb-4 inline-flex items-center gap-2 text-sm font-semibold ${contentFilterInactive} px-3 py-2`}
                  >
                    <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
                    Kembali
                  </button>
                  {readlistDetailLoading || !readlistDetail ? (
                    <div className="text-center py-12 bg-gray-100 dark:bg-white/[0.04] dark:border dark:border-white/10 rounded-lg">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto" />
                      <p className="text-gray-500 dark:text-gray-400 mt-4">Memuat readlist...</p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1 truncate">
                            {readlistDetail.title}
                          </h2>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {(readlistDetail.items || []).length} komik di readlist ini
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setRenameReadlist({
                                id: readlistDetail.id,
                                title: readlistDetail.title,
                              });
                              setReadlistTitleDraft(readlistDetail.title);
                            }}
                            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold ${contentFilterInactive}`}
                          >
                            <PencilLine className="h-4 w-4 shrink-0" aria-hidden />
                            Ubah judul
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddMangaOpen(true)}
                            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold ${contentCtaPrimary}`}
                          >
                            <Plus className="h-4 w-4 shrink-0" aria-hidden />
                            Tambah manga
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Hapus readlist "${readlistDetail.title}" beserta isinya?`,
                                )
                              ) {
                                apiClient
                                  .deleteReadlist(readlistDetail.id)
                                  .then(() => {
                                    setReadlistDetailId(null);
                                    setReadlistDetail(null);
                                    loadReadlists();
                                  })
                                  .catch(() => {});
                              }
                            }}
                            className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold ${dangerOutlineBtnClass}`}
                          >
                            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                            Hapus readlist
                          </button>
                        </div>
                      </div>
                      {(readlistDetail.items || []).length === 0 ? (
                        <div className="text-center py-12 bg-gray-100 dark:bg-white/[0.04] dark:border dark:border-white/10 rounded-lg">
                          <ListChecks className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500 dark:text-gray-400 text-lg font-medium mb-2">
                            Readlist masih kosong
                          </p>
                          <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">
                            Tambahkan manga lewat pencarian (bisa pilih banyak sekaligus)
                          </p>
                          <button
                            type="button"
                            onClick={() => setAddMangaOpen(true)}
                            className={contentCtaPrimary}
                          >
                            Tambah manga
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                          {(readlistDetail.items || []).map((item) => (
                            <div
                              key={item.manga_id}
                              className="bg-white dark:bg-white/[0.06] dark:border dark:border-white/10 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer relative"
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
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      apiClient
                                        .removeReadlistItem(readlistDetail.id, item.manga_id)
                                        .then(() => loadReadlistDetail(readlistDetail.id))
                                        .then(() => loadReadlists());
                                    }}
                                    className={dangerIconBtnClass}
                                    title="Hapus dari readlist"
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden />
                                  </button>
                                </div>
                              </div>
                              <div
                                className="p-3 min-h-[64px]"
                                onClick={() => navigate(`/komik/${item.slug}`)}
                              >
                                <h3 className="font-bold text-sm line-clamp-2 text-gray-900 dark:text-gray-100">
                                  {item.title}
                                </h3>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                        Readlist
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Buat daftar baca sendiri dan isi dengan manga favorit (multi-pilih)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setReadlistTitleDraft("");
                        setCreateReadlistOpen(true);
                      }}
                      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold ${contentCtaPrimary}`}
                    >
                      <Plus className="h-4 w-4 shrink-0" aria-hidden />
                      Buat readlist
                    </button>
                  </div>
                  {readlistsLoading ? (
                    <div className="text-center py-12 bg-gray-100 dark:bg-white/[0.04] dark:border dark:border-white/10 rounded-lg">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto" />
                      <p className="text-gray-500 dark:text-gray-400 mt-4">Memuat readlist...</p>
                    </div>
                  ) : readlists.length === 0 ? (
                    <div className="text-center py-12 bg-gray-100 dark:bg-white/[0.04] dark:border dark:border-white/10 rounded-lg">
                      <ListChecks className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400 text-lg font-medium mb-2">
                        Belum ada readlist
                      </p>
                      <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">
                        Buat readlist pertama untuk mulai mengatur koleksi baca
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setReadlistTitleDraft("");
                          setCreateReadlistOpen(true);
                        }}
                        className={contentCtaPrimary}
                      >
                        Buat readlist
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {readlists.map((rl) => (
                        <div
                          key={rl.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-[0_3px_0_0_#e2e8f0] dark:border-primary-600 dark:bg-primary-800/40 dark:shadow-[0_3px_0_0_#1e3a5f]"
                        >
                          <h3 className="font-bold text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">
                            {rl.title}
                          </h3>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                            {Number(rl.manga_count) || 0} manga
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setReadlistDetailId(rl.id)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${contentCtaPrimary}`}
                            >
                              Buka
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRenameReadlist({ id: rl.id, title: rl.title });
                                setReadlistTitleDraft(rl.title);
                              }}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${contentFilterInactive}`}
                            >
                              Ubah judul
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Hapus readlist "${rl.title}"?`)) {
                                  apiClient.deleteReadlist(rl.id).then(() => loadReadlists());
                                }
                              }}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border border-red-500/40 bg-red-600 text-white`}
                            >
                              Hapus
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
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
                    type="button"
                    onClick={() => {
                      if (window.confirm("Hapus semua riwayat?")) {
                        clearHistory();
                        loadHistory();
                      }
                    }}
                    className={dangerOutlineBtnClass}
                  >
                    <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                    Hapus Semua
                  </button>
                )}
              </div>

              {historyList.length === 0 ? (
                <div className="text-center py-12 bg-gray-100 dark:bg-white/[0.04] dark:border dark:border-white/10 rounded-lg">
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
                        className="bg-white dark:bg-white/[0.06] dark:border dark:border-white/10 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer flex relative"
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
                            <ChapterAccessLink
                              chapter={{
                                slug: item.chapterSlug,
                                created_at: item.chapterCreatedAt,
                              }}
                              to={`/view/${item.chapterSlug}`}
                              onClick={(e) => e.stopPropagation()}
                              compact
                              className="mb-1"
                              label={`Lanjut baca: Chapter ${item.chapterNumber || item.chapterTitle || "terakhir"}`}
                            />
                          ) : null}
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            {getTimeAgo(Math.floor(item.timestamp / 1000))}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromHistory(item.mangaSlug);
                            loadHistory();
                          }}
                          className={`absolute right-2 top-2 ${dangerIconBtnClass}`}
                          title="Hapus riwayat"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
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
                        className={contentCtaPrimary}
                      >
                        Tampilkan riwayat berikutnya
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Popular Tab */}
          {activeTabId === "popular" && (
            <div>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Populer
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Top 50 komik populer per kategori
                </p>
              </div>

              <div className="mb-5 flex flex-wrap gap-2">
                {VALID_POPULAR_TYPES.map((type) => {
                  const isActive = activePopularType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPopularType(type)}
                      className={`px-4 py-2 text-sm font-semibold capitalize ${
                        isActive ? contentFilterActive : contentFilterInactive
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>

              {popularMangaLoading ? (
                <div className="text-center py-12 bg-gray-100 dark:bg-white/[0.04] dark:border dark:border-white/10 rounded-lg">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto"></div>
                  <p className="text-gray-500 dark:text-gray-400 mt-4">
                    Memuat manga populer...
                  </p>
                </div>
              ) : popularMangaList.length === 0 ? (
                <div className="text-center py-12 bg-gray-100 dark:bg-white/[0.04] dark:border dark:border-white/10 rounded-lg">
                  <Flame className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-lg font-medium mb-2">
                    Belum ada data populer
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm">
                    Coba ganti kategori Manga/Manhwa/Manhua
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {popularMangaList.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-white/[0.06] dark:border dark:border-white/10 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer"
                      onClick={() => navigate(`/komik/${item.slug}`)}
                    >
                      <div className="relative aspect-[3/4] overflow-hidden">
                        <LazyImage
                          src={getImageUrl(item.cover)}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          wrapperClassName="w-full h-full"
                        />
                      </div>
                      <div className="p-3">
                        <h3 className="font-bold text-sm line-clamp-2 text-gray-900 dark:text-gray-100">
                          {item.title}
                        </h3>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {libraryFooterAds.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
            <AdBanner ads={libraryFooterAds} layout="grid" columns={2} />
          </div>
        )}
      </main>

      {createReadlistOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="readlist-create-title"
        >
          <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#060d1f]">
            <h3
              id="readlist-create-title"
              className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3"
            >
              Readlist baru
            </h3>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Judul
            </label>
            <input
              type="text"
              value={readlistTitleDraft}
              onChange={(e) => setReadlistTitleDraft(e.target.value)}
              placeholder="Contoh: Bacaan weekend"
              maxLength={200}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-sky-500/30 focus:ring-2 dark:border-white/15 dark:bg-primary-900/40 dark:text-gray-100"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={readlistSaving}
                onClick={() => {
                  setCreateReadlistOpen(false);
                  setReadlistTitleDraft("");
                }}
                className={`px-4 py-2 text-sm font-semibold ${contentFilterInactive}`}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={readlistSaving || !readlistTitleDraft.trim()}
                onClick={async () => {
                  const t = readlistTitleDraft.trim();
                  if (!t) return;
                  setReadlistSaving(true);
                  try {
                    await apiClient.createReadlist({ title: t });
                    setCreateReadlistOpen(false);
                    setReadlistTitleDraft("");
                    await loadReadlists();
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setReadlistSaving(false);
                  }
                }}
                className={`px-4 py-2 text-sm font-semibold ${contentCtaPrimary}`}
              >
                {readlistSaving ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {renameReadlist && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="readlist-rename-title"
        >
          <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#060d1f]">
            <h3
              id="readlist-rename-title"
              className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3"
            >
              Ubah judul readlist
            </h3>
            <input
              type="text"
              value={readlistTitleDraft}
              onChange={(e) => setReadlistTitleDraft(e.target.value)}
              maxLength={200}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-sky-500/30 focus:ring-2 dark:border-white/15 dark:bg-primary-900/40 dark:text-gray-100"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={readlistSaving}
                onClick={() => {
                  setRenameReadlist(null);
                  setReadlistTitleDraft("");
                }}
                className={`px-4 py-2 text-sm font-semibold ${contentFilterInactive}`}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={readlistSaving || !readlistTitleDraft.trim()}
                onClick={async () => {
                  const t = readlistTitleDraft.trim();
                  if (!t || !renameReadlist) return;
                  setReadlistSaving(true);
                  try {
                    await apiClient.updateReadlist(renameReadlist.id, { title: t });
                    setRenameReadlist(null);
                    setReadlistTitleDraft("");
                    await loadReadlists();
                    if (readlistDetailId === renameReadlist.id) {
                      await loadReadlistDetail(renameReadlist.id);
                    }
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setReadlistSaving(false);
                  }
                }}
                className={`px-4 py-2 text-sm font-semibold ${contentCtaPrimary}`}
              >
                {readlistSaving ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {addMangaOpen && readlistDetailId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="readlist-add-manga-title"
        >
          <div className="max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#060d1f]">
            <div className="p-4 border-b border-slate-200 dark:border-white/10">
              <h3
                id="readlist-add-manga-title"
                className="text-lg font-bold text-gray-900 dark:text-gray-100"
              >
                Tambah manga ke readlist
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Ketik minimal 2 huruf untuk mencari; centang beberapa lalu tambahkan sekaligus.
              </p>
              <input
                type="search"
                value={mangaPickerQuery}
                onChange={(e) => setMangaPickerQuery(e.target.value)}
                placeholder="Cari judul manga…"
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none ring-sky-500/30 focus:ring-2 dark:border-white/15 dark:bg-primary-900/40 dark:text-gray-100"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-3 min-h-[200px] max-h-[50vh]">
              {mangaPickerLoading ? (
                <p className="text-center text-sm text-gray-500 py-8">Mencari…</p>
              ) : mangaPickerDebounced.length < 2 ? (
                <p className="text-center text-sm text-gray-500 py-8">
                  Ketik setidaknya 2 karakter
                </p>
              ) : mangaPickerResults.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-8">Tidak ada hasil</p>
              ) : (
                <ul className="space-y-2">
                  {mangaPickerResults.map((m) => {
                    const alreadyIn =
                      readlistDetail &&
                      Array.isArray(readlistDetail.items) &&
                      readlistDetail.items.some(
                        (it) => Number(it.manga_id) === Number(m.id),
                      );
                    const checked = mangaPickerSelected.has(m.id);
                    return (
                      <li key={m.id}>
                        <label
                          className={`flex items-center gap-3 rounded-lg border p-2 dark:border-white/10 ${
                            alreadyIn
                              ? "cursor-not-allowed border-slate-100 bg-slate-100/80 opacity-60 dark:bg-primary-900/20"
                              : "cursor-pointer border-slate-200 bg-slate-50 dark:bg-primary-900/30"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={alreadyIn}
                            onChange={() => {
                              if (alreadyIn) return;
                              setMangaPickerSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(m.id)) next.delete(m.id);
                                else next.add(m.id);
                                return next;
                              });
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600 disabled:opacity-40"
                          />
                          <LazyImage
                            src={getImageUrl(m.thumbnail)}
                            alt=""
                            className="h-12 w-9 shrink-0 rounded object-cover"
                            wrapperClassName="h-12 w-9 shrink-0 rounded overflow-hidden"
                          />
                          <span className="min-w-0 flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
                            {m.title}
                            {alreadyIn ? (
                              <span className="ml-1 text-xs font-normal text-gray-500">
                                (sudah ada)
                              </span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200 p-4 dark:border-white/10">
              <span className="text-xs text-gray-600 dark:text-gray-300">
                Terpilih: {mangaPickerSelected.size}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={addMangaSubmitting}
                  onClick={() => setAddMangaOpen(false)}
                  className={`px-4 py-2 text-sm font-semibold ${contentFilterInactive}`}
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={addMangaSubmitting || mangaPickerSelected.size === 0}
                  onClick={async () => {
                    const ids = [...mangaPickerSelected];
                    if (!readlistDetailId || ids.length === 0) return;
                    setAddMangaSubmitting(true);
                    try {
                      await apiClient.addReadlistItems(readlistDetailId, { manga_ids: ids });
                      setAddMangaOpen(false);
                      await loadReadlistDetail(readlistDetailId);
                      await loadReadlists();
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setAddMangaSubmitting(false);
                    }
                  }}
                  className={`px-4 py-2 text-sm font-semibold ${contentCtaPrimary}`}
                >
                  {addMangaSubmitting ? "Menambahkan…" : "Tambahkan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* <LiveChatWidget /> */}
    </div>
  );
};

export default Library;
