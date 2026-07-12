import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { X, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import LazyImage from "../components/LazyImage";
import AdBanner from "../components/AdBanner";
import { useAds } from "../hooks/useAds";
import { getImageUrl } from "../utils/api";
import { API_BASE_URL } from "../utils/api";
import { getChapterTimeAgo } from "../utils/chapterTime";
import LiveChatWidget from "../components/LiveChatWidget";
import ChapterAccessLink from "../components/ChapterAccessLink";
const statusOptions = ["All", "Ongoing", "Completed", "Hiatus"];
const typeOptions = [
  { label: "All", value: "All", country: null },
  { label: "Comic", value: "Comic", country: null, apiType: "comic" },
  { label: "Manga", value: "Manga", country: "JP", apiType: "manga" },
  { label: "Manhua", value: "Manhua", country: "CN", apiType: "manhua" },
  { label: "Manhwa", value: "Manhwa", country: "KR", apiType: "manhwa" },
];
const orderOptions = ["Az", "Za", "Update", "Added", "Popular"];

const projectFilterOptions = [
  { label: "Semua", value: "all" },
  { label: "Project", value: "true" },
  { label: "Bukan project", value: "false" },
];

const sourceOptions = [
  { label: "Semua Source", value: "all" },
  { label: "Source 1", value: "kiryu" },
  { label: "Source 2", value: "apkomik" },
];

const Content = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get("q") || "";

  // Ads
  const { ads: comicTopAds } = useAds("comic-top");
  const { ads: comicFooterAds } = useAds("comic-footer");

  const [mangaList, setMangaList] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [genresLoading, setGenresLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);

  const currentPage = Math.max(1, Number(searchParams.get("page")) || 1);
  const selectedStatus = statusOptions.includes(searchParams.get("status") || "")
    ? searchParams.get("status")
    : "All";
  const selectedType = typeOptions.some(
    (type) => type.value === (searchParams.get("type") || ""),
  )
    ? searchParams.get("type")
    : "All";
  const selectedOrder = orderOptions.includes(searchParams.get("order") || "")
    ? searchParams.get("order")
    : "Update";

  const projectParam = searchParams.get("project");
  const selectedProject =
    projectParam === "true" || projectParam === "false" ? projectParam : "all";

  const selectedSource = sourceOptions.some(
    (opt) => opt.value === (searchParams.get("source") || ""),
  )
    ? searchParams.get("source")
    : "all";

  // Mobile dropdown states
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showOrderDropdown, setShowOrderDropdown] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);

  // Refs for click outside detection
  const genreDropdownRef = useRef(null);
  const statusDropdownRef = useRef(null);
  const typeDropdownRef = useRef(null);
  const orderDropdownRef = useRef(null);
  const projectDropdownRef = useRef(null);
  const sourceDropdownRef = useRef(null);

  // Load genres from API
  useEffect(() => {
    const fetchGenres = async () => {
      setGenresLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/contents/genres`);
        const data = await response.json();
        if (data.status && data.data) {
          setGenres(data.data);
        }
      } catch (error) {
        console.error("Error fetching genres:", error);
      } finally {
        setGenresLoading(false);
      }
    };
    fetchGenres();
  }, []);

  const selectedGenres = useMemo(() => {
    const genreIdParams = searchParams
      .getAll("genreId")
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id));

    if (genreIdParams.length > 0) {
      return genreIdParams;
    }

    const genreNameParams = searchParams.getAll("genre");
    if (genreNameParams.length > 0 && genres.length > 0) {
      return genreNameParams
        .map((name) => {
          const genre = genres.find(
            (g) => g.name.toLowerCase() === name.toLowerCase(),
          );
          return genre ? genre.id : null;
        })
        .filter((id) => id !== null);
    }

    return [];
  }, [searchParams, genres]);

  const updateSearchParams = useCallback(
    (updater) => {
      const nextParams = new URLSearchParams(searchParams);
      updater(nextParams);
      setSearchParams(nextParams);
    },
    [searchParams, setSearchParams],
  );

  const setPage = useCallback(
    (nextPage) => {
      updateSearchParams((params) => {
        const safePage = Math.max(1, Number(nextPage) || 1);
        if (safePage === 1) {
          params.delete("page");
        } else {
          params.set("page", String(safePage));
        }
      });
    },
    [updateSearchParams],
  );

  const setStatusFilter = useCallback(
    (status) => {
      updateSearchParams((params) => {
        if (status === "All") params.delete("status");
        else params.set("status", status);
        params.delete("page");
      });
    },
    [updateSearchParams],
  );

  const setTypeFilter = useCallback(
    (type) => {
      updateSearchParams((params) => {
        if (type === "All") params.delete("type");
        else params.set("type", type);
        params.delete("page");
      });
    },
    [updateSearchParams],
  );

  const setOrderFilter = useCallback(
    (order) => {
      updateSearchParams((params) => {
        if (order === "Update") params.delete("order");
        else params.set("order", order);
        params.delete("page");
      });
    },
    [updateSearchParams],
  );

  const setProjectFilter = useCallback(
    (project) => {
      updateSearchParams((params) => {
        if (project === "all") params.delete("project");
        else params.set("project", project);
        params.delete("page");
      });
    },
    [updateSearchParams],
  );

  const setSourceFilter = useCallback(
    (source) => {
      updateSearchParams((params) => {
        if (source === "all") params.delete("source");
        else params.set("source", source);
        params.delete("page");
      });
    },
    [updateSearchParams],
  );

  const fetchManga = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      // Add search query if exists
      if (searchQuery.trim()) {
        params.append("q", searchQuery.trim());
      }
      if (selectedProject === "true") {
        params.append("project", "true");
      } else if (selectedProject === "false") {
        params.append("project", "false");
      }

      // Add source filter
      if (selectedSource !== "all") {
        params.append("source", selectedSource);
      }

      // Common parameters
      params.append("page", currentPage);
      params.append("per_page", "24");

      // Add genre filters (can be combined with search)
      selectedGenres.forEach((genreId) => {
        params.append("genre[]", genreId);
      });

      // Add status filter (can be combined with search)
      if (selectedStatus !== "All") {
        params.append("status", selectedStatus);
      }

      // Add type filter (can be combined with search)
      const typeOption = typeOptions.find((t) => t.value === selectedType);
      if (typeOption && typeOption.value !== "All") {
        params.append("type", typeOption.apiType || typeOption.value);
      }

      // Add order filter (can be combined with search)
      if (selectedOrder !== "Update") {
        params.append("orderBy", selectedOrder);
      }

      const response = await fetch(
        `${API_BASE_URL}/contents?${params.toString()}`,
      );
      const data = await response.json();

      if (data.status && Array.isArray(data.data)) {
        setMangaList(data.data);
        setTotalPages(Math.max(1, Number(data.meta?.total_pages) || 1));
      }
    } catch (error) {
      console.error("Error fetching manga:", error);
    } finally {
      setLoading(false);
    }
  }, [
    currentPage,
    selectedGenres,
    selectedStatus,
    selectedType,
    selectedOrder,
    searchQuery,
    selectedProject,
    selectedSource,
  ]);

  // Load manga based on filters
  useEffect(() => {
    fetchManga();
  }, [fetchManga]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [currentPage]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        genreDropdownRef.current &&
        !genreDropdownRef.current.contains(event.target)
      ) {
        setShowGenreDropdown(false);
      }
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(event.target)
      ) {
        setShowStatusDropdown(false);
      }
      if (
        typeDropdownRef.current &&
        !typeDropdownRef.current.contains(event.target)
      ) {
        setShowTypeDropdown(false);
      }
      if (
        orderDropdownRef.current &&
        !orderDropdownRef.current.contains(event.target)
      ) {
        setShowOrderDropdown(false);
      }
      if (
        projectDropdownRef.current &&
        !projectDropdownRef.current.contains(event.target)
      ) {
        setShowProjectDropdown(false);
      }
      if (
        sourceDropdownRef.current &&
        !sourceDropdownRef.current.contains(event.target)
      ) {
        setShowSourceDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleGenre = (genreId) => {
    updateSearchParams((params) => {
      const existing = params
        .getAll("genreId")
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id));

      const next = existing.includes(genreId)
        ? existing.filter((id) => id !== genreId)
        : [...existing, genreId];

      params.delete("genreId");
      params.delete("genre");
      next.forEach((id) => params.append("genreId", String(id)));
      params.delete("page");
    });
  };

  const clearAllFilters = () => {
    updateSearchParams((params) => {
      params.delete("genreId");
      params.delete("genre");
      params.delete("status");
      params.delete("type");
      params.delete("order");
      params.delete("project");
      params.delete("source");
      params.delete("page");
      if (searchQuery) {
        params.delete("q");
      }
    });
  };

  const clearSearch = () => {
    updateSearchParams((params) => {
      params.delete("q");
      params.delete("page");
    });
  };

  const renderPagination = () => {
    const pages = [];
    // Show fewer page numbers on mobile
    const maxVisible = window.innerWidth < 768 ? 3 : 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    // Previous button
    pages.push(
      <button
        key="prev"
        onClick={() => setPage(currentPage - 1)}
        disabled={currentPage === 1}
        className={`px-2 md:px-3 py-2 rounded-lg text-sm md:text-base ${currentPage === 1
            ? "bg-gray-200 dark:bg-primary-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
            : "bg-white dark:bg-primary-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-primary-600"
          }`}
      >
        <ChevronLeft className="h-4 w-4 md:h-5 md:w-5" />
      </button>,
    );

    // First page (only show if not in visible range)
    if (startPage > 1) {
      pages.push(
        <button
          key={1}
          onClick={() => setPage(1)}
          className="px-3 md:px-4 py-2 rounded-lg text-sm md:text-base bg-white dark:bg-primary-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-primary-600"
        >
          1
        </button>,
      );
      if (startPage > 2) {
        pages.push(
          <span
            key="dots1"
            className="px-1 md:px-2 text-gray-500 dark:text-gray-400"
          >
            ...
          </span>,
        );
      }
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => setPage(i)}
          className={`px-3 md:px-4 py-2 rounded-lg text-sm md:text-base ${currentPage === i
              ? "bg-blue-500 text-white"
              : "bg-white dark:bg-primary-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-primary-600"
            }`}
        >
          {i}
        </button>,
      );
    }

    // Last page (only show if not in visible range)
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(
          <span
            key="dots2"
            className="px-1 md:px-2 text-gray-500 dark:text-gray-400"
          >
            ...
          </span>,
        );
      }
      pages.push(
        <button
          key={totalPages}
          onClick={() => setPage(totalPages)}
          className="px-3 md:px-4 py-2 rounded-lg text-sm md:text-base bg-white dark:bg-primary-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-primary-600"
        >
          {totalPages}
        </button>,
      );
    }

    // Next button
    pages.push(
      <button
        key="next"
        onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className={`px-2 md:px-3 py-2 rounded-lg text-sm md:text-base ${currentPage === totalPages
            ? "bg-gray-200 dark:bg-primary-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
            : "bg-white dark:bg-primary-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-primary-600"
          }`}
      >
        <ChevronRight className="h-4 w-4 md:h-5 md:w-5" />
      </button>,
    );

    return pages;
  };

  return (
    <div className="min-h-screen bg-transparent">
      <Helmet>
        <title>
          {searchQuery
            ? `Hasil Pencarian: "${searchQuery}" | KomikNesia`
            : "Daftar Komik Bahasa Indonesia | KomikNesia"}
        </title>
        <meta
          name="description"
          content={
            searchQuery
              ? `Hasil pencarian untuk "${searchQuery}" di KomikNesia. Temukan komik, manga, manhwa, dan manhua favoritmu.`
              : "Temukan daftar lengkap komik, manga, manhwa, dan manhua bahasa Indonesia di KomikNesia. Jelajahi berbagai judul populer dan terbaru dengan mudah."
          }
        />
      </Helmet>

      {/* Ads Section - Top — Layout sudah menyediakan Header + pt-16 di main */}
      <div className="container mx-auto px-4 pt-5 pb-2 md:pt-8">
        <AdBanner
          ads={comicTopAds}
          layout="grid"
          columns={2}
        />
      </div>

      {/* Page Header */}
      <div className="bg-white dark:bg-transparent border-b border-gray-200 dark:border-white/10 shadow-md dark:shadow-none top-20 z-40">
        <div className="container mx-auto px-4 py-6 md:py-10">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
                {searchQuery ? (
                  <>
                    Hasil Pencarian: {'"'}
                    {searchQuery}
                    {'"'}
                  </>
                ) : (
                  "Daftar Komik"
                )}
              </h1>
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="mt-2 flex items-center space-x-1 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <X className="h-4 w-4" />
                  <span>Hapus pencarian</span>
                </button>
              )}
            </div>
            <button
              onClick={clearAllFilters}
              className="hidden items-center gap-2 rounded-xl border border-sky-500/50 bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_4px_0_0_#facc15] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_#facc15] active:translate-y-px active:shadow-[0_2px_0_0_#facc15] md:inline-flex dark:border-cyan-400/40 dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_4px_0_0_#facc15] dark:hover:shadow-[0_5px_0_0_#facc15] dark:active:shadow-[0_2px_0_0_#facc15] dark:hover:brightness-110"
            >
              <X className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline">Clear All</span>
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-8 pt-4 md:pt-8">
        {/* Mobile Filter Dropdowns */}
        <div className="lg:hidden mb-6 grid grid-cols-2 gap-3">
          {/* Genre Dropdown */}
          <div ref={genreDropdownRef} className="relative">
            <button
              onClick={() => setShowGenreDropdown(!showGenreDropdown)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-[0_4px_0_0_#e2e8f0] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_#cbd5e1] active:translate-y-px active:shadow-[0_2px_0_0_#e2e8f0] dark:border-cyan-200/20 dark:bg-[#0b355f]/95 dark:text-cyan-50 dark:shadow-[0_4px_0_0_rgba(56,189,248,0.35)] dark:hover:shadow-[0_5px_0_0_rgba(56,189,248,0.45)]"
            >
              <span className="text-sm font-medium">
                Genre{" "}
                {selectedGenres.length > 0 && `(${selectedGenres.length})`}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showGenreDropdown ? "rotate-180" : ""}`}
              />
            </button>
            {showGenreDropdown && (
              <div className="absolute z-50 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border border-slate-200/90 bg-white shadow-[0_6px_0_0_#cbd5e1] dark:border-primary-700 dark:bg-primary-900 dark:shadow-[0_6px_0_0_rgba(30,58,138,0.5)]">
                <div className="border-b border-slate-200 p-3 dark:border-primary-700">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Pilih Genre
                    </span>
                    {selectedGenres.length > 0 && (
                      <button
                        onClick={() => {
                          updateSearchParams((params) => {
                            params.delete("genreId");
                            params.delete("genre");
                            params.delete("page");
                          });
                        }}
                        className="rounded-lg border border-sky-500/50 bg-sky-600 px-2 py-1 text-xs font-semibold text-white shadow-[0_2px_0_0_#facc15] transition-all hover:-translate-y-px hover:brightness-105 dark:border-cyan-400/40 dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_2px_0_0_#facc15]"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-2">
                  {genresLoading ? (
                    <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                      Loading...
                    </div>
                  ) : (
                    genres.map((genre) => (
                      <label
                        key={genre.id}
                        className="flex items-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-primary-800 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGenres.includes(genre.id)}
                          onChange={() => toggleGenre(genre.id)}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {genre.name}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Status Dropdown */}
          <div ref={statusDropdownRef} className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-[0_4px_0_0_#e2e8f0] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_#cbd5e1] active:translate-y-px active:shadow-[0_2px_0_0_#e2e8f0] dark:border-cyan-200/20 dark:bg-[#0b355f]/95 dark:text-cyan-50 dark:shadow-[0_4px_0_0_rgba(56,189,248,0.35)] dark:hover:shadow-[0_5px_0_0_rgba(56,189,248,0.45)]"
            >
              <span className="text-sm font-medium">Status</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showStatusDropdown ? "rotate-180" : ""}`}
              />
            </button>
            {showStatusDropdown && (
              <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200/90 bg-white shadow-[0_6px_0_0_#cbd5e1] dark:border-primary-700 dark:bg-primary-900 dark:shadow-[0_6px_0_0_rgba(30,58,138,0.5)]">
                <div className="p-2">
                  {statusOptions.map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setStatusFilter(status);
                        setShowStatusDropdown(false);
                      }}
                      className={`mb-1 w-full rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 last:mb-0 ${selectedStatus === status
                          ? "border-sky-500/50 bg-sky-600 font-semibold text-white shadow-[0_3px_0_0_#facc15] dark:border-cyan-400/40 dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_3px_0_0_#facc15]"
                          : "border-transparent text-gray-700 hover:border-slate-200 hover:bg-slate-50 hover:shadow-[0_2px_0_0_#e2e8f0] dark:text-gray-300 dark:hover:border-primary-600 dark:hover:bg-primary-800 dark:hover:shadow-[0_2px_0_0_#1e3a5f]"
                        }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Project filter (is_project) */}
          <div ref={projectDropdownRef} className="relative">
            <button
              onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-[0_4px_0_0_#e2e8f0] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_#cbd5e1] active:translate-y-px active:shadow-[0_2px_0_0_#e2e8f0] dark:border-cyan-200/20 dark:bg-[#0b355f]/95 dark:text-cyan-50 dark:shadow-[0_4px_0_0_rgba(56,189,248,0.35)] dark:hover:shadow-[0_5px_0_0_rgba(56,189,248,0.45)]"
            >
              <span className="text-sm font-medium">Project</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showProjectDropdown ? "rotate-180" : ""}`}
              />
            </button>
            {showProjectDropdown && (
              <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200/90 bg-white shadow-[0_6px_0_0_#cbd5e1] dark:border-primary-700 dark:bg-primary-900 dark:shadow-[0_6px_0_0_rgba(30,58,138,0.5)]">
                <div className="p-2">
                  {projectFilterOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setProjectFilter(opt.value);
                        setShowProjectDropdown(false);
                      }}
                      className={`mb-1 w-full rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 last:mb-0 ${selectedProject === opt.value
                          ? "border-sky-500/50 bg-sky-600 font-semibold text-white shadow-[0_3px_0_0_#facc15] dark:border-cyan-400/40 dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_3px_0_0_#facc15]"
                          : "border-transparent text-gray-700 hover:border-slate-200 hover:bg-slate-50 hover:shadow-[0_2px_0_0_#e2e8f0] dark:text-gray-300 dark:hover:border-primary-600 dark:hover:bg-primary-800 dark:hover:shadow-[0_2px_0_0_#1e3a5f]"
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Type Dropdown */}
          <div ref={typeDropdownRef} className="relative">
            <button
              onClick={() => setShowTypeDropdown(!showTypeDropdown)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-[0_4px_0_0_#e2e8f0] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_#cbd5e1] active:translate-y-px active:shadow-[0_2px_0_0_#e2e8f0] dark:border-cyan-200/20 dark:bg-[#0b355f]/95 dark:text-cyan-50 dark:shadow-[0_4px_0_0_rgba(56,189,248,0.35)] dark:hover:shadow-[0_5px_0_0_rgba(56,189,248,0.45)]"
            >
              <span className="text-sm font-medium">Type</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showTypeDropdown ? "rotate-180" : ""}`}
              />
            </button>
            {showTypeDropdown && (
              <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200/90 bg-white shadow-[0_6px_0_0_#cbd5e1] dark:border-primary-700 dark:bg-primary-900 dark:shadow-[0_6px_0_0_rgba(30,58,138,0.5)]">
                <div className="p-2">
                  {typeOptions.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => {
                        setTypeFilter(type.value);
                        setShowTypeDropdown(false);
                      }}
                      className={`mb-1 w-full rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 last:mb-0 ${selectedType === type.value
                          ? "border-sky-500/50 bg-sky-600 font-semibold text-white shadow-[0_3px_0_0_#facc15] dark:border-cyan-400/40 dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_3px_0_0_#facc15]"
                          : "border-transparent text-gray-700 hover:border-slate-200 hover:bg-slate-50 hover:shadow-[0_2px_0_0_#e2e8f0] dark:text-gray-300 dark:hover:border-primary-600 dark:hover:bg-primary-800 dark:hover:shadow-[0_2px_0_0_#1e3a5f]"
                        }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sort By Dropdown */}
          <div ref={orderDropdownRef} className="relative">
            <button
              onClick={() => setShowOrderDropdown(!showOrderDropdown)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-[0_4px_0_0_#e2e8f0] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_#cbd5e1] active:translate-y-px active:shadow-[0_2px_0_0_#e2e8f0] dark:border-cyan-200/20 dark:bg-[#0b355f]/95 dark:text-cyan-50 dark:shadow-[0_4px_0_0_rgba(56,189,248,0.35)] dark:hover:shadow-[0_5px_0_0_rgba(56,189,248,0.45)]"
            >
              <span className="text-sm font-medium">Sort By</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showOrderDropdown ? "rotate-180" : ""}`}
              />
            </button>
            {showOrderDropdown && (
              <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200/90 bg-white shadow-[0_6px_0_0_#cbd5e1] dark:border-primary-700 dark:bg-primary-900 dark:shadow-[0_6px_0_0_rgba(30,58,138,0.5)]">
                <div className="p-2">
                  {orderOptions.map((order) => (
                    <button
                      key={order}
                      onClick={() => {
                        setOrderFilter(order);
                        setShowOrderDropdown(false);
                      }}
                      className={`mb-1 w-full rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 last:mb-0 ${selectedOrder === order
                          ? "border-sky-500/50 bg-sky-600 font-semibold text-white shadow-[0_3px_0_0_#facc15] dark:border-cyan-400/40 dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_3px_0_0_#facc15]"
                          : "border-transparent text-gray-700 hover:border-slate-200 hover:bg-slate-50 hover:shadow-[0_2px_0_0_#e2e8f0] dark:text-gray-300 dark:hover:border-primary-600 dark:hover:bg-primary-800 dark:hover:shadow-[0_2px_0_0_#1e3a5f]"
                        }`}
                    >
                      {order}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Source Dropdown */}
          <div ref={sourceDropdownRef} className="relative">
            <button
              onClick={() => setShowSourceDropdown(!showSourceDropdown)}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 shadow-[0_4px_0_0_#e2e8f0] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_5px_0_0_#cbd5e1] active:translate-y-px active:shadow-[0_2px_0_0_#e2e8f0] dark:border-cyan-200/20 dark:bg-[#0b355f]/95 dark:text-cyan-50 dark:shadow-[0_4px_0_0_rgba(56,189,248,0.35)] dark:hover:shadow-[0_5px_0_0_rgba(56,189,248,0.45)]"
            >
              <span className="text-sm font-medium">Source</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${showSourceDropdown ? "rotate-180" : ""}`}
              />
            </button>
            {showSourceDropdown && (
              <div className="absolute z-50 mt-2 w-full rounded-xl border border-slate-200/90 bg-white shadow-[0_6px_0_0_#cbd5e1] dark:border-primary-700 dark:bg-primary-900 dark:shadow-[0_6px_0_0_rgba(30,58,138,0.5)]">
                <div className="p-2">
                  {sourceOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setSourceFilter(opt.value);
                        setShowSourceDropdown(false);
                      }}
                      className={`mb-1 w-full rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition-all duration-200 last:mb-0 ${selectedSource === opt.value
                          ? "border-sky-500/50 bg-sky-600 font-semibold text-white shadow-[0_3px_0_0_#facc15] dark:border-cyan-400/40 dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_3px_0_0_#facc15]"
                          : "border-transparent text-gray-700 hover:border-slate-200 hover:bg-slate-50 hover:shadow-[0_2px_0_0_#e2e8f0] dark:text-gray-300 dark:hover:border-primary-600 dark:hover:bg-primary-800 dark:hover:shadow-[0_2px_0_0_#1e3a5f]"
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters Sidebar - Desktop Only */}
          <div className="hidden lg:block lg:w-80">
            <div className="sticky top-24 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_6px_0_0_#e2e8f0] dark:border-cyan-200/15 dark:bg-primary-900 dark:shadow-[0_6px_0_0_rgba(250,204,21,0.22)]">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Filter
                </h3>
                <button
                  onClick={clearAllFilters}
                  className="inline-flex items-center justify-center rounded-lg border border-sky-500/50 bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_3px_0_0_#facc15] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_#facc15] active:translate-y-px active:shadow-[0_2px_0_0_#facc15] dark:border-cyan-400/40 dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_3px_0_0_#facc15] dark:hover:shadow-[0_4px_0_0_#facc15] dark:hover:brightness-110"
                >
                  Clear All
                </button>
              </div>

              {/* Status Filter */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Status
                </h4>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setStatusFilter(status);
                      }}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 ${selectedStatus === status
                          ? "border-sky-500/50 bg-sky-600 text-white shadow-[0_4px_0_0_#facc15] dark:border-cyan-400/40 dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_4px_0_0_#facc15]"
                          : "border-slate-200 bg-slate-50 text-slate-700 shadow-[0_3px_0_0_#e2e8f0] hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_#cbd5e1] active:translate-y-px active:shadow-[0_2px_0_0_#e2e8f0] dark:border-primary-600 dark:bg-primary-800 dark:text-gray-200 dark:shadow-[0_3px_0_0_#1e3a5f] dark:hover:bg-primary-800"
                        }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Project filter */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Project
                </h4>
                <div className="flex flex-wrap gap-2">
                  {projectFilterOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setProjectFilter(opt.value);
                      }}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 ${selectedProject === opt.value
                          ? "border-sky-500/50 bg-sky-600 text-white shadow-[0_4px_0_0_#facc15] dark:border-cyan-400/40 dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_4px_0_0_#facc15]"
                          : "border-slate-200 bg-slate-50 text-slate-700 shadow-[0_3px_0_0_#e2e8f0] hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_#cbd5e1] active:translate-y-px active:shadow-[0_2px_0_0_#e2e8f0] dark:border-primary-600 dark:bg-primary-800 dark:text-gray-200 dark:shadow-[0_3px_0_0_#1e3a5f] dark:hover:bg-primary-800"
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Source Filter */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Source
                </h4>
                <div className="flex flex-wrap gap-2">
                  {sourceOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setSourceFilter(opt.value);
                      }}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 ${selectedSource === opt.value
                          ? "border-sky-500/50 bg-sky-600 text-white shadow-[0_4px_0_0_#facc15] dark:border-cyan-400/40 dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_4px_0_0_#facc15]"
                          : "border-slate-200 bg-slate-50 text-slate-700 shadow-[0_3px_0_0_#e2e8f0] hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_#cbd5e1] active:translate-y-px active:shadow-[0_2px_0_0_#e2e8f0] dark:border-primary-600 dark:bg-primary-800 dark:text-gray-200 dark:shadow-[0_3px_0_0_#1e3a5f] dark:hover:bg-primary-800"
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Type Filter */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Type
                </h4>
                <div className="flex flex-wrap gap-2">
                  {typeOptions.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => {
                        setTypeFilter(type.value);
                      }}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 ${selectedType === type.value
                          ? "border-sky-500/50 bg-sky-600 text-white shadow-[0_4px_0_0_#facc15] dark:border-cyan-400/40 dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_4px_0_0_#facc15]"
                          : "border-slate-200 bg-slate-50 text-slate-700 shadow-[0_3px_0_0_#e2e8f0] hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_#cbd5e1] active:translate-y-px active:shadow-[0_2px_0_0_#e2e8f0] dark:border-primary-600 dark:bg-primary-800 dark:text-gray-200 dark:shadow-[0_3px_0_0_#1e3a5f] dark:hover:bg-primary-800"
                        }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Order Filter */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Order By
                </h4>
                <div className="flex flex-wrap gap-2">
                  {orderOptions.map((order) => (
                    <button
                      key={order}
                      onClick={() => {
                        setOrderFilter(order);
                      }}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-all duration-200 ${selectedOrder === order
                          ? "border-sky-500/50 bg-sky-600 text-white shadow-[0_4px_0_0_#facc15] dark:border-cyan-400/40 dark:bg-[#0b355f] dark:text-cyan-50 dark:shadow-[0_4px_0_0_#facc15]"
                          : "border-slate-200 bg-slate-50 text-slate-700 shadow-[0_3px_0_0_#e2e8f0] hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_#cbd5e1] active:translate-y-px active:shadow-[0_2px_0_0_#e2e8f0] dark:border-primary-600 dark:bg-primary-800 dark:text-gray-200 dark:shadow-[0_3px_0_0_#1e3a5f] dark:hover:bg-primary-800"
                        }`}
                    >
                      {order}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genres Filter */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Genres
                </h4>
                {genresLoading ? (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    Loading genres...
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {genres.map((genre) => (
                      <label
                        key={genre.id}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-primary-800 p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGenres.includes(genre.id)}
                          onChange={() => toggleGenre(genre.id)}
                          className="w-4 h-4 text-blue-500 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {genre.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Active Filters */}
            {(searchQuery ||
              selectedGenres.length > 0 ||
              selectedStatus !== "All" ||
              selectedType !== "All" ||
              selectedOrder !== "Update" ||
              selectedProject !== "all" ||
              selectedSource !== "all") && (
                <div className="mb-6 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_4px_0_0_#e2e8f0] dark:border-primary-700 dark:bg-primary-900 dark:shadow-[0_4px_0_0_rgba(56,189,248,0.18)]">
                  <div className="flex flex-wrap gap-2">
                    {searchQuery && (
                      <span className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                        <span>
                          Pencarian: {'"'}
                          {searchQuery}
                          {'"'}
                        </span>
                        <button
                          onClick={clearSearch}
                          className="hover:text-blue-900 dark:hover:text-blue-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    )}
                    {selectedGenres.map((genreId) => {
                      const genre = genres.find((g) => g.id === genreId);
                      return genre ? (
                        <span
                          key={genreId}
                          className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm"
                        >
                          <span>{genre.name}</span>
                          <button
                            onClick={() => toggleGenre(genreId)}
                            className="hover:text-blue-900 dark:hover:text-blue-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </span>
                      ) : null;
                    })}
                    {selectedStatus !== "All" && (
                      <span className="inline-flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-sm">
                        <span>Status: {selectedStatus}</span>
                        <button
                          onClick={() => setStatusFilter("All")}
                          className="hover:text-green-900 dark:hover:text-green-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    )}
                    {selectedType !== "All" && (
                      <span className="inline-flex items-center space-x-2 px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-sm">
                        <span>Type: {selectedType}</span>
                        <button
                          onClick={() => setTypeFilter("All")}
                          className="hover:text-purple-900 dark:hover:text-purple-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    )}
                    {selectedProject !== "all" && (
                      <span className="inline-flex items-center space-x-2 px-3 py-1 bg-fuchsia-100 dark:bg-fuchsia-900/40 text-fuchsia-800 dark:text-fuchsia-200 rounded-full text-sm">
                        <span>
                          Project:{" "}
                          {selectedProject === "true" ? "Ya" : "Bukan project"}
                        </span>
                        <button
                          onClick={() => setProjectFilter("all")}
                          className="hover:text-fuchsia-950 dark:hover:text-fuchsia-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    )}
                    {selectedSource !== "all" && (
                      <span className="inline-flex items-center space-x-2 px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded-full text-sm">
                        <span>
                          Source:{" "}
                          {sourceOptions.find((opt) => opt.value === selectedSource)?.label ||
                            selectedSource}
                        </span>
                        <button
                          onClick={() => setSourceFilter("all")}
                          className="hover:text-amber-950 dark:hover:text-amber-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    )}
                    {selectedOrder !== "Update" && (
                      <span className="inline-flex items-center space-x-2 px-3 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded-full text-sm">
                        <span>Order: {selectedOrder}</span>
                        <button
                          onClick={() => setOrderFilter("Update")}
                          className="hover:text-orange-900 dark:hover:text-orange-100"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              )}

            {/* Loading State */}
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">
                  Loading manga...
                </p>
              </div>
            ) : mangaList.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-white/[0.04] dark:border dark:border-white/10 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400">
                  No manga found with the selected filters
                </p>
              </div>
            ) : (
              <>
                {/* Manga Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 mb-8">
                  {mangaList.map((manga) => (
                    <div
                      key={manga.id}
                      onClick={() => navigate(`/komik/${manga.slug}`)}
                      className="bg-white dark:bg-white/[0.06] dark:border dark:border-white/10 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer"
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
                            <span className="block text-[10px] md:text-sm">
                              COLOR
                            </span>
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
                        {/* Title */}
                        {!!manga.hot && (
                          <div className="mb-1 max-w-fit bg-red-500/90 backdrop-blur-sm rounded-full px-2 py-1">
                            <span className="text-white text-xs font-bold">
                              HOT
                            </span>
                          </div>
                        )}
                        <div className="min-h-[2.75rem] md:min-h-[3rem] mb-2 flex items-center">
                          <Link
                            to={`/komik/${manga.slug}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block w-full"
                          >
                            <h3 className="font-bold text-xs md:text-sm line-clamp-2 text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                              {manga.title}
                            </h3>
                          </Link>
                        </div>

                        {manga.lastChapters?.length > 0 ? (
                          <div className="space-y-2 mb-1 mt-auto">
                            {manga.lastChapters.slice(0, 3).map((chapter, chapterIndex) => (
                              <ChapterAccessLink
                                key={chapter.slug}
                                chapter={chapter}
                                to={`/view/${chapter.slug}`}
                                onClick={(e) => e.stopPropagation()}
                                label={`Chapter ${chapter.number || "N/A"}`}
                                meta={getChapterTimeAgo(chapter) || null}
                              />
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

                {/* Pagination */}
                <div className="flex justify-center items-center space-x-2 pb-8 md:pb-4">
                  {renderPagination()}
                </div>

                {comicFooterAds.length > 0 && (
                  <div className="mt-6 pb-20 md:pb-8">
                    <AdBanner
                      ads={comicFooterAds}
                      layout="grid"
                      columns={2}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <LiveChatWidget />
    </div>
  );
};

export default Content;
