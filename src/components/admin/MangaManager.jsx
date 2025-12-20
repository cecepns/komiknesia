import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Eye,
  PencilIcon,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  BookOpen,
  Upload,
} from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { apiClient, getImageUrl } from "../../utils/api";
import { compressImage } from "../../utils/imageCompression";
import LazyImage from "../LazyImage";

const MangaManager = () => {
  const [manga, setManga] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncForm, setSyncForm] = useState({ page: 1, limit: 25, syncType: 'full' }); // 'full', 'manga-only', or 'manga-chapters'
  const [syncProgress, setSyncProgress] = useState({
    status: '',
    message: '',
    processed: 0,
    total: 0,
    percentage: 0,
    currentManga: '',
    synced: 0,
    updated: 0,
    errors: 0,
    chaptersSynced: 0,
    imagesSynced: 0
  });
  const [syncFormInput, setSyncFormInput] = useState({
    page: "1",
    limit: "25",
  });
  const [editingManga, setEditingManga] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    alternative_name: "",
    author: "",
    synopsis: "",
    category_id: "",
    category_ids: [],
    country_id: "",
    content_type: "manga",
    status: "ongoing",
    rating: "",
    color: false,
  });
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("all"); // 'all', 'manual', 'westmanga'
  const [selectedMangaForChapters, setSelectedMangaForChapters] =
    useState(null);
  const [chapters, setChapters] = useState([]);
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [editingChapter, setEditingChapter] = useState(null);
  const [chapterFormData, setChapterFormData] = useState({
    title: "",
    chapter_number: "",
  });
  const [chapterCoverFile, setChapterCoverFile] = useState(null);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [selectedChapterForImages, setSelectedChapterForImages] =
    useState(null);
  const [chapterImages, setChapterImages] = useState([]);
  const [chapterImagesMap, setChapterImagesMap] = useState({}); // Store images for each chapter
  const [expandedChapters, setExpandedChapters] = useState({}); // Track which chapters have images expanded
  const [loadingImages, setLoadingImages] = useState({}); // Track loading state for each chapter

  const fetchManga = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getManga(currentPage, 10, "", "", sourceFilter);
      setManga(response.manga);
      setTotalPages(response.totalPages);
      setTotalCount(response.totalCount);
    } catch (error) {
      console.error("Error fetching manga:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, sourceFilter]);

  useEffect(() => {
    fetchManga();
    fetchCategories();
  }, [fetchManga]);

  const fetchCategories = async () => {
    try {
      const response = await apiClient.getCategories();
      setCategories(response);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const generateSlug = (title) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .trim();
  };

  const handleImageUpload = async (file, type) => {
    try {
      // Validate file type before compression
      const allowedTypes = /jpeg|jpg|png|gif|webp/i;
      const fileExtension = file.name.split('.').pop().toLowerCase();
      
      if (!allowedTypes.test(fileExtension) || !allowedTypes.test(file.type)) {
        alert('Format file tidak didukung. Gunakan gambar dengan format JPEG, PNG, GIF, atau WebP.');
        return;
      }
      
      const compressed = await compressImage(file);
      
      // Convert Blob to File with proper metadata for FormData
      // Compressor.js returns a Blob, but multer needs a File with name and type
      // Preserve original file name and extension
      const originalName = file.name;
      const originalType = file.type;
      
      // Determine MIME type from file extension if type is missing
      let mimeType = originalType || compressed.type;
      if (!mimeType) {
        const ext = fileExtension.toLowerCase();
        const mimeMap = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp'
        };
        mimeType = mimeMap[ext] || 'image/jpeg';
      }
      
      const compressedFile = new File(
        [compressed],
        originalName,
        {
          type: mimeType,
          lastModified: Date.now()
        }
      );
      
      if (type === "thumbnail") {
        setThumbnailFile(compressedFile);
      } else {
        setCoverFile(compressedFile);
      }
    } catch (error) {
      console.error("Error compressing image:", error);
      // Fallback to original file if compression fails
      if (type === "thumbnail") {
        setThumbnailFile(file);
      } else {
        setCoverFile(file);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate: at least one category must be selected
    if (formData.category_ids.length === 0) {
      alert("Silakan pilih minimal satu kategori");
      return;
    }

    const submitData = new FormData();
    submitData.append("title", formData.title);
    submitData.append("slug", generateSlug(formData.title));
    submitData.append("author", formData.author);
    submitData.append("synopsis", formData.synopsis);
    submitData.append("category_id", formData.category_ids[0]); // First category as primary

    // Append genre_ids as JSON array for multiple categories
    submitData.append("genre_ids", JSON.stringify(formData.category_ids));
    
    // Append alternative_name, country_id, content_type, status, rating, and color
    if (formData.alternative_name) {
      submitData.append("alternative_name", formData.alternative_name);
    }
    if (formData.country_id) {
      submitData.append("country_id", formData.country_id);
    }
    if (formData.content_type) {
      submitData.append("content_type", formData.content_type);
    }
    if (formData.status) {
      submitData.append("status", formData.status);
    }
    if (formData.rating) {
      submitData.append("rating", formData.rating);
    }
    submitData.append("color", formData.color ? "true" : "false");

    if (thumbnailFile) {
      submitData.append("thumbnail", thumbnailFile);
    }
    if (coverFile) {
      submitData.append("cover_background", coverFile);
    }

    try {
      if (editingManga) {
        await apiClient.updateManga(editingManga.id, submitData);
      } else {
        await apiClient.createManga(submitData);
      }

      setShowForm(false);
      setEditingManga(null);
      setFormData({
        title: "",
        alternative_name: "",
        author: "",
        synopsis: "",
        category_id: "",
        category_ids: [],
        country_id: "",
        content_type: "manga",
        status: "ongoing",
        rating: "",
        color: false,
      });
      setThumbnailFile(null);
      setCoverFile(null);
      setCurrentPage(1);
      fetchManga();
    } catch (error) {
      console.error("Error saving manga:", error);
      alert(`Gagal menyimpan manga: ${error.message || 'Terjadi kesalahan'}`);
    }
  };

  const handleEdit = (item) => {
    setEditingManga(item);
    // Get category IDs from genres if available, otherwise use category_id
    const categoryIds =
      item.genres && item.genres.length > 0
        ? item.genres.map((g) => g.id)
        : item.category_id
        ? [item.category_id]
        : [];

    setFormData({
      title: item.title,
      alternative_name: item.alternative_name || "",
      author: item.author,
      synopsis: item.synopsis,
      category_id:
        item.category_id || (categoryIds.length > 0 ? categoryIds[0] : ""),
      category_ids: categoryIds,
      country_id: item.country_id || "",
      content_type: item.content_type || "manga",
      status: item.status || "ongoing",
      rating: item.rating || "",
      color: item.color || false,
    });
    setShowForm(true);
  };

  const toggleCategory = (categoryId) => {
    setFormData((prev) => {
      const categoryIds = prev.category_ids.includes(categoryId)
        ? prev.category_ids.filter((id) => id !== categoryId)
        : [...prev.category_ids, categoryId];

      return {
        ...prev,
        category_ids: categoryIds,
        category_id: categoryIds.length > 0 ? categoryIds[0] : "",
      };
    });
  };

  const handleDelete = async (id) => {
    if (!confirm("Apakah Anda yakin ingin menghapus manga ini?")) return;

    try {
      await apiClient.deleteManga(id);
      // If current page becomes empty after deletion, go to previous page
      if (manga.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        fetchManga();
      }
    } catch (error) {
      console.error("Error deleting manga:", error);
    }
  };

  const handleSync = async (e) => {
    e.preventDefault();
    setSyncing(true);
    setSyncResult(null);
    setSyncProgress({
      status: '',
      message: 'Memulai sinkronisasi...',
      processed: 0,
      total: syncForm.limit,
      percentage: 0,
      currentManga: '',
      synced: 0,
      updated: 0,
      errors: 0,
      chaptersSynced: 0,
      imagesSynced: 0
    });

    try {
      // Use appropriate sync function based on syncType
      let syncFunction;
      if (syncForm.syncType === 'manga-only') {
        syncFunction = apiClient.syncWestMangaOnly;
      } else if (syncForm.syncType === 'manga-chapters') {
        syncFunction = apiClient.syncWestMangaChapters;
      } else {
        syncFunction = apiClient.syncWestManga; // full sync
      }

      const result = await syncFunction(
        syncForm.page,
        syncForm.limit,
        (progressData) => {
          // Update progress state in real-time
          setSyncProgress((prev) => ({
            ...prev,
            status: progressData.status || prev.status,
            message: progressData.message || prev.message,
            processed: progressData.processed || prev.processed,
            total: progressData.total || prev.total,
            percentage: progressData.percentage || prev.percentage,
            currentManga: progressData.currentManga || prev.currentManga,
            synced: progressData.synced !== undefined ? progressData.synced : prev.synced,
            updated: progressData.updated !== undefined ? progressData.updated : prev.updated,
            errors: progressData.errors !== undefined ? progressData.errors : prev.errors,
            chaptersSynced: progressData.chaptersSynced !== undefined ? progressData.chaptersSynced : prev.chaptersSynced,
            imagesSynced: progressData.imagesSynced !== undefined ? progressData.imagesSynced : prev.imagesSynced
          }));
        }
      );
      setSyncResult(result);
      // Update final progress
      setSyncProgress((prev) => ({
        ...prev,
        status: 'complete',
        message: 'Sinkronisasi selesai!',
        synced: result.synced || 0,
        updated: result.updated || 0,
        errors: result.errors || 0,
        chaptersSynced: result.chaptersSynced || 0,
        imagesSynced: result.imagesSynced || 0
      }));
      // Auto refresh manga list after sync
      await fetchManga();
    } catch (error) {
      console.error("Error syncing manga:", error);
      setSyncResult({
        error: error.message || "Failed to sync manga from WestManga",
      });
      setSyncProgress((prev) => ({
        ...prev,
        status: 'error',
        message: `Error: ${error.message || 'Gagal sinkronisasi'}`,
      }));
    } finally {
      setSyncing(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const results = await apiClient.searchManga(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching manga:", error);
      setSearchResults({
        local: [],
        westmanga: [],
        total: 0,
        error: error.message,
      });
    } finally {
      setSearching(false);
    }
  };

  const handleImportFromSearch = async (mangaData, source) => {
    try {
      if (source === "westmanga") {
        // Import from WestManga - we need to sync it
        await apiClient.syncWestManga(1, 1);
        // After sync, the manga should be available
        await fetchManga();
        setSearchResults(null);
        setSearchQuery("");
        alert(
          "Manga berhasil diimport! Silakan refresh halaman untuk melihat."
        );
      } else {
        // Local manga - already in database
        alert("Manga ini sudah ada di database.");
      }
    } catch (error) {
      console.error("Error importing manga:", error);
      alert("Gagal mengimport manga: " + error.message);
    }
  };

  const fetchChapters = async (mangaId) => {
    try {
      const chaptersData = await apiClient.getChapters(mangaId);
      setChapters(chaptersData);
    } catch (error) {
      console.error("Error fetching chapters:", error);
    }
  };

  const handleOpenChapters = async (manga) => {
    setSelectedMangaForChapters(manga);
    await fetchChapters(manga.id);
  };

  const handleChapterSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMangaForChapters) return;

    const submitData = new FormData();
    submitData.append("title", chapterFormData.title);
    submitData.append("chapter_number", chapterFormData.chapter_number);
    if (chapterCoverFile) {
      submitData.append("cover", chapterCoverFile);
    }

    try {
      if (editingChapter) {
        await apiClient.updateChapter(editingChapter.id, submitData);
      } else {
        await apiClient.createChapter(selectedMangaForChapters.id, submitData);
      }

      setShowChapterForm(false);
      setEditingChapter(null);
      setChapterFormData({ title: "", chapter_number: "" });
      setChapterCoverFile(null);
      await fetchChapters(selectedMangaForChapters.id);
    } catch (error) {
      console.error("Error saving chapter:", error);
      alert("Gagal menyimpan chapter: " + error.message);
    }
  };

  const handleEditChapter = (chapter) => {
    setEditingChapter(chapter);
    setChapterFormData({
      title: chapter.title,
      chapter_number: chapter.chapter_number,
    });
    setShowChapterForm(true);
  };

  const handleDeleteChapter = async (chapterId) => {
    if (!confirm("Apakah Anda yakin ingin menghapus chapter ini?")) return;

    try {
      await apiClient.deleteChapter(chapterId);
      await fetchChapters(selectedMangaForChapters.id);
    } catch (error) {
      console.error("Error deleting chapter:", error);
      alert("Gagal menghapus chapter: " + error.message);
    }
  };

  const handleUploadChapterImages = async (e) => {
    e.preventDefault();
    if (!selectedChapterForImages || chapterImages.length === 0) return;

    const formData = new FormData();
    chapterImages.forEach((file) => {
      formData.append("images", file);
    });

    try {
      await apiClient.addChapterImages(selectedChapterForImages.id, formData);
      setShowImageUpload(false);
      setSelectedChapterForImages(null);
      setChapterImages([]);
      await fetchChapters(selectedMangaForChapters.id);
      // Refresh images for this chapter
      if (expandedChapters[selectedChapterForImages.id]) {
        await fetchChapterImages(selectedChapterForImages.id);
      }
      alert("Gambar berhasil diupload!");
    } catch (error) {
      console.error("Error uploading images:", error);
      alert("Gagal mengupload gambar: " + error.message);
    }
  };

  const fetchChapterImages = async (chapterId) => {
    try {
      setLoadingImages((prev) => ({ ...prev, [chapterId]: true }));
      const images = await apiClient.getChapterImages(chapterId);
      setChapterImagesMap((prev) => ({ ...prev, [chapterId]: images }));
    } catch (error) {
      console.error("Error fetching chapter images:", error);
      setChapterImagesMap((prev) => ({ ...prev, [chapterId]: [] }));
    } finally {
      setLoadingImages((prev) => ({ ...prev, [chapterId]: false }));
    }
  };

  const handleToggleChapterImages = async (chapterId) => {
    const isExpanded = expandedChapters[chapterId];
    setExpandedChapters((prev) => ({
      ...prev,
      [chapterId]: !isExpanded,
    }));

    // Fetch images if expanding and not already loaded
    if (!isExpanded && !chapterImagesMap[chapterId]) {
      await fetchChapterImages(chapterId);
    }
  };

  const handleDeleteChapterImage = async (chapterId, imageId) => {
    if (!confirm("Apakah Anda yakin ingin menghapus gambar ini?")) return;

    try {
      await apiClient.deleteChapterImage(chapterId, imageId);
      // Remove image from state
      setChapterImagesMap((prev) => ({
        ...prev,
        [chapterId]: prev[chapterId].filter((img) => img.id !== imageId),
      }));
      // Refresh chapter count
      await fetchChapters(selectedMangaForChapters.id);
      alert("Gambar berhasil dihapus!");
    } catch (error) {
      console.error("Error deleting chapter image:", error);
      alert("Gagal menghapus gambar: " + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Manajemen Manga
          </h3>
          <div className="flex gap-3 flex-wrap">
            {/* Source Filter */}
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setCurrentPage(1); // Reset to first page when filter changes
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="all">Semua Sumber</option>
              <option value="manual">Input Manual</option>
              <option value="westmanga">Dari API</option>
            </select>
            <button
              onClick={() => {
                setShowSyncModal(true);
                setSyncForm({ page: 1, limit: 25, syncType: 'full' });
                setSyncFormInput({ page: "1", limit: "25" });
                setSyncResult(null);
                setSyncProgress({
                  status: '',
                  message: '',
                  processed: 0,
                  total: 0,
                  percentage: 0,
                  currentManga: '',
                  synced: 0,
                  updated: 0,
                  errors: 0,
                  chaptersSynced: 0,
                  imagesSynced: 0
                });
              }}
              className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync dari WestManga
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Tambah Manga
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari manga dari API (WestManga)..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {searching ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Mencari...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Cari
              </>
            )}
          </button>
          {searchResults && (
            <button
              type="button"
              onClick={() => {
                setSearchResults(null);
                setSearchQuery("");
              }}
              className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
      </div>

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Sync Manga dari WestManga
                </h4>
                <button
                  onClick={() => {
                    setShowSyncModal(false);
                    setSyncResult(null);
                    setSyncForm({ page: 1, limit: 25, syncType: 'full' });
                    setSyncFormInput({ page: "1", limit: "25" });
                    setSyncProgress({
                      status: '',
                      message: '',
                      processed: 0,
                      total: 0,
                      percentage: 0,
                      currentManga: '',
                      synced: 0,
                      updated: 0,
                      errors: 0,
                      chaptersSynced: 0,
                      imagesSynced: 0
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {!syncResult ? (
                <form onSubmit={handleSync} className="space-y-4">
                  {/* Sync Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Tipe Sinkronisasi
                    </label>
                    <div className="space-y-2">
                      {/* <label className="flex items-center space-x-3 cursor-pointer p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <input
                          type="radio"
                          name="syncType"
                          value="full"
                          checked={syncForm.syncType === 'full'}
                          onChange={(e) => setSyncForm((prev) => ({ ...prev, syncType: e.target.value }))}
                          className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            Full Sync
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Sinkronkan manga, chapter, gambar, dan genre
                          </div>
                        </div>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <input
                          type="radio"
                          name="syncType"
                          value="manga-chapters"
                          checked={syncForm.syncType === 'manga-chapters'}
                          onChange={(e) => setSyncForm((prev) => ({ ...prev, syncType: e.target.value }))}
                          className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            Manga + Chapters
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Sinkronkan manga, chapter, dan genre (tanpa gambar)
                          </div>
                        </div>
                      </label> */}
                      <label className="flex items-center space-x-3 cursor-pointer p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <input
                          type="radio"
                          name="syncType"
                          value="manga-only"
                          checked={syncForm.syncType === 'manga-only'}
                          onChange={(e) => setSyncForm((prev) => ({ ...prev, syncType: e.target.value }))}
                          className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            Only Manga
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Hanya sinkronkan daftar manga dan genre (tanpa chapter dan gambar)
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Progress Indicator */}
                  {syncing && (
                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-700 dark:text-gray-300 font-medium">
                          {syncProgress.message || 'Memproses...'}
                        </span>
                        <span className="text-gray-600 dark:text-gray-400">
                          {syncProgress.processed} / {syncProgress.total} ({syncProgress.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-green-600 h-3 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${syncProgress.percentage}%` }}
                        ></div>
                      </div>
                      {syncProgress.currentManga && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                          Sedang memproses: <span className="font-medium">{syncProgress.currentManga}</span>
                        </p>
                      )}
                      {syncProgress.status && (
                        <div className={`grid gap-2 text-xs ${syncForm.syncType === 'manga-only' ? 'grid-cols-2' : syncForm.syncType === 'full' ? 'grid-cols-4' : 'grid-cols-3'}`}>
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                            <span className="text-gray-600 dark:text-gray-400">Baru:</span>
                            <span className="ml-2 font-semibold text-blue-600 dark:text-blue-400">
                              {syncProgress.synced}
                            </span>
                          </div>
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded p-2">
                            <span className="text-gray-600 dark:text-gray-400">Diperbarui:</span>
                            <span className="ml-2 font-semibold text-yellow-600 dark:text-yellow-400">
                              {syncProgress.updated}
                            </span>
                          </div>
                          {(syncForm.syncType === 'full' || syncForm.syncType === 'manga-chapters') && syncProgress.chaptersSynced > 0 && (
                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded p-2">
                              <span className="text-gray-600 dark:text-gray-400">Chapter:</span>
                              <span className="ml-2 font-semibold text-purple-600 dark:text-purple-400">
                                {syncProgress.chaptersSynced}
                              </span>
                            </div>
                          )}
                          {syncForm.syncType === 'full' && syncProgress.imagesSynced > 0 && (
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded p-2">
                              <span className="text-gray-600 dark:text-gray-400">Gambar:</span>
                              <span className="ml-2 font-semibold text-indigo-600 dark:text-indigo-400">
                                {syncProgress.imagesSynced}
                              </span>
                            </div>
                          )}
                          {syncProgress.errors > 0 && (
                            <div className="bg-red-50 dark:bg-red-900/20 rounded p-2">
                              <span className="text-gray-600 dark:text-gray-400">Error:</span>
                              <span className="ml-2 font-semibold text-red-600 dark:text-red-400">
                                {syncProgress.errors}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Page
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={syncFormInput.page}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSyncFormInput((prev) => ({ ...prev, page: value }));
                        const numValue = parseInt(value);
                        if (!isNaN(numValue) && numValue > 0) {
                          setSyncForm((prev) => ({ ...prev, page: numValue }));
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        const numValue = parseInt(value);
                        if (isNaN(numValue) || numValue < 1) {
                          setSyncFormInput((prev) => ({ ...prev, page: "1" }));
                          setSyncForm((prev) => ({ ...prev, page: 1 }));
                        } else {
                          setSyncFormInput((prev) => ({
                            ...prev,
                            page: value,
                          }));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Limit (jumlah manga per sync)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={syncFormInput.limit}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSyncFormInput((prev) => ({ ...prev, limit: value }));
                        const numValue = parseInt(value);
                        if (
                          !isNaN(numValue) &&
                          numValue > 0 &&
                          numValue <= 100
                        ) {
                          setSyncForm((prev) => ({ ...prev, limit: numValue }));
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        const numValue = parseInt(value);
                        if (isNaN(numValue) || numValue < 1) {
                          setSyncFormInput((prev) => ({
                            ...prev,
                            limit: "25",
                          }));
                          setSyncForm((prev) => ({ ...prev, limit: 25 }));
                        } else if (numValue > 100) {
                          setSyncFormInput((prev) => ({
                            ...prev,
                            limit: "100",
                          }));
                          setSyncForm((prev) => ({ ...prev, limit: 100 }));
                        } else {
                          setSyncFormInput((prev) => ({
                            ...prev,
                            limit: value,
                          }));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Maksimal 100 manga per sync
                    </p>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSyncModal(false);
                        setSyncForm({ page: 1, limit: 25, syncType: 'full' });
                        setSyncFormInput({ page: "1", limit: "25" });
                        setSyncResult(null);
                        setSyncProgress({
                          status: '',
                          message: '',
                          processed: 0,
                          total: 0,
                          percentage: 0,
                          currentManga: '',
                          synced: 0,
                          updated: 0,
                          errors: 0,
                          chaptersSynced: 0,
                          imagesSynced: 0
                        });
                      }}
                      className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                      disabled={syncing}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={syncing}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {syncing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Mulai Sync
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  {syncResult.error ? (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2" />
                        <p className="text-red-800 dark:text-red-200 font-medium">
                          Error: {syncResult.error}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-center mb-2">
                          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                          <p className="text-green-800 dark:text-green-200 font-medium">
                            Sync Selesai!
                          </p>
                        </div>
                      </div>

                      <div className={`grid gap-4 ${syncForm.syncType === 'manga-only' ? 'grid-cols-2' : syncForm.syncType === 'full' ? 'grid-cols-4' : 'grid-cols-3'}`}>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Manga Baru
                          </p>
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {syncResult.synced || 0}
                          </p>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Diperbarui
                          </p>
                          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                            {syncResult.updated || 0}
                          </p>
                        </div>
                        {(syncForm.syncType === 'full' || syncForm.syncType === 'manga-chapters') && syncResult.chaptersSynced > 0 && (
                          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Chapter Disinkronkan
                            </p>
                            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                              {syncResult.chaptersSynced || 0}
                            </p>
                          </div>
                        )}
                        {syncForm.syncType === 'full' && syncResult.imagesSynced > 0 && (
                          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Gambar Disinkronkan
                            </p>
                            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                              {syncResult.imagesSynced || 0}
                            </p>
                          </div>
                        )}
                      </div>

                      {syncResult.errors > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Error
                          </p>
                          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {syncResult.errors}
                          </p>
                        </div>
                      )}

                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Total Diproses
                        </p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {syncResult.total || 0}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={() => {
                        setShowSyncModal(false);
                        setSyncResult(null);
                        setSyncForm({ page: 1, limit: 25, syncType: 'full' });
                        setSyncFormInput({ page: "1", limit: "25" });
                        setSyncProgress({
                          status: '',
                          message: '',
                          processed: 0,
                          total: 0,
                          percentage: 0,
                          currentManga: '',
                          synced: 0,
                          updated: 0,
                          errors: 0,
                          chaptersSynced: 0,
                          imagesSynced: 0
                        });
                      }}
                      className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                    >
                      Tutup
                    </button>
                    <button
                      onClick={() => {
                        const nextPage = syncForm.page + 1;
                        setSyncResult(null);
                        setSyncForm((prev) => ({ ...prev, page: nextPage }));
                        setSyncFormInput((prev) => ({
                          ...prev,
                          page: nextPage.toString(),
                        }));
                      }}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                    >
                      Sync Halaman Selanjutnya
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">
                {editingManga ? "Edit Manga" : "Tambah Manga Baru"}
              </h4>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Judul Manga
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Author
                    </label>
                    <input
                      type="text"
                      value={formData.author}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          author: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nama Alternatif <span className="text-xs text-gray-500">(Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.alternative_name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        alternative_name: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Masukkan nama alternatif manga (jika ada)"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Country
                    </label>
                    <select
                      value={formData.country_id}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          country_id: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Pilih Country</option>
                      <option value="JP">🇯🇵 Japan (JP)</option>
                      <option value="KR">🇰🇷 Korea (KR)</option>
                      <option value="CN">🇨🇳 China (CN)</option>
                      <option value="ID">🇮🇩 Indonesia (ID)</option>
                      <option value="US">🇺🇸 United States (US)</option>
                      <option value="TH">🇹🇭 Thailand (TH)</option>
                      <option value="PH">🇵🇭 Philippines (PH)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Content Type
                    </label>
                    <select
                      value={formData.content_type}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          content_type: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="manga">Manga</option>
                      <option value="manhwa">Manhwa</option>
                      <option value="manhua">Manhua</option>
                      <option value="comic">Comic</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          status: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                      <option value="hiatus">Hiatus</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rating <span className="text-xs text-gray-500">(0.0 - 10.0)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={formData.rating}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        rating: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="0.0"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Masukkan rating dari 0.0 hingga 10.0
                  </p>
                </div>

                <div>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.color}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          color: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 border-gray-300 dark:border-gray-600"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Color (Berwarna)
                    </span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Centang jika manga ini berwarna
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kategori{" "}
                    <span className="text-xs text-gray-500">
                      (Pilih satu atau lebih)
                    </span>
                  </label>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 max-h-48 overflow-y-auto bg-white dark:bg-gray-700">
                    {categories.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Tidak ada kategori tersedia
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {categories.map((category) => (
                          <label
                            key={category.id}
                            className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 p-2 rounded transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={formData.category_ids.includes(
                                category.id
                              )}
                              onChange={() => toggleCategory(category.id)}
                              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 border-gray-300 dark:border-gray-600"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {category.name}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {formData.category_ids.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      {formData.category_ids.length} kategori dipilih
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Thumbnail (Max 500KB)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        e.target.files[0] &&
                        handleImageUpload(e.target.files[0], "thumbnail")
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Cover Background (Max 500KB)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        e.target.files[0] &&
                        handleImageUpload(e.target.files[0], "cover")
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sinopsis
                  </label>
                  <ReactQuill
                    theme="snow"
                    value={formData.synopsis}
                    onChange={(value) =>
                      setFormData((prev) => ({ ...prev, synopsis: value }))
                    }
                    className="bg-white dark:bg-gray-700"
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingManga(null);
                      setFormData({
                        title: "",
                        alternative_name: "",
                        author: "",
                        synopsis: "",
                        category_id: "",
                        category_ids: [],
                        country_id: "",
                        content_type: "manga",
                        status: "ongoing",
                        rating: "",
                        color: false,
                      });
                      setThumbnailFile(null);
                      setCoverFile(null);
                    }}
                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                  >
                    {editingManga ? "Update" : "Simpan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Hasil Pencarian ({searchResults.total || 0} hasil)
            </h4>
            <button
              onClick={() => {
                setSearchResults(null);
                setSearchQuery("");
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {searchResults.error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-200">
                {searchResults.error}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {searchResults.westmanga &&
                searchResults.westmanga.length > 0 && (
                  <div>
                    <h5 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Dari WestManga API ({searchResults.westmanga.length})
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {searchResults.westmanga.map((item) => (
                        <div
                          key={item.id || item.slug}
                          className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                        >
                          <div className="aspect-[3/4] relative overflow-hidden rounded-lg mb-2">
                            <LazyImage
                              src={
                                getImageUrl(item.cover) ||
                                getImageUrl(item.thumbnail) ||
                                "https://images.pexels.com/photos/1591447/pexels-photo-1591447.jpeg?auto=compress&cs=tinysrgb&w=400"
                              }
                              alt={item.title}
                              className="w-full h-full object-cover"
                              wrapperClassName="w-full h-full"
                            />
                          </div>
                          <h6 className="font-medium text-gray-900 dark:text-gray-100 mb-1 line-clamp-1 text-sm">
                            {item.title}
                          </h6>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-1">
                            {item.author || "Unknown"}
                          </p>
                          <button
                            onClick={() =>
                              handleImportFromSearch(item, "westmanga")
                            }
                            className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                          >
                            Import ke Database
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {searchResults.local && searchResults.local.length > 0 && (
                <div>
                  <h5 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Dari Database Lokal ({searchResults.local.length})
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {searchResults.local.map((item) => (
                      <div
                        key={item.id}
                        className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                      >
                        <div className="aspect-[3/4] relative overflow-hidden rounded-lg mb-2">
                          <LazyImage
                            src={
                              getImageUrl(item.thumbnail) ||
                              "https://images.pexels.com/photos/1591447/pexels-photo-1591447.jpeg?auto=compress&cs=tinysrgb&w=400"
                            }
                            alt={item.title}
                            className="w-full h-full object-cover"
                            wrapperClassName="w-full h-full"
                          />
                        </div>
                        <h6 className="font-medium text-gray-900 dark:text-gray-100 mb-1 line-clamp-1 text-sm">
                          {item.title}
                        </h6>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-1">
                          {item.author || "Unknown"}
                        </p>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              item.is_input_manual
                                ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                                : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                            }`}
                          >
                            {item.is_input_manual ? "Manual" : "API"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!searchResults.westmanga ||
                searchResults.westmanga.length === 0) &&
                (!searchResults.local || searchResults.local.length === 0) && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">
                      Tidak ada hasil ditemukan
                    </p>
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {/* Chapter Management Modal */}
      {selectedMangaForChapters && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Manajemen Chapter - {selectedMangaForChapters.title}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {selectedMangaForChapters.is_input_manual
                      ? "Manga Manual"
                      : "Manga dari API"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedMangaForChapters(null);
                    setChapters([]);
                    setShowChapterForm(false);
                    setShowImageUpload(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {!selectedMangaForChapters.is_input_manual ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-yellow-800 dark:text-yellow-200">
                    Manga ini berasal dari API. Chapter dikelola oleh sistem
                    eksternal.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={() => {
                        setEditingChapter(null);
                        setChapterFormData({ title: "", chapter_number: "" });
                        setChapterCoverFile(null);
                        setShowChapterForm(true);
                      }}
                      className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Tambah Chapter
                    </button>
                  </div>

                  {/* Chapter List */}
                  <div className="space-y-2 mb-4">
                    {chapters.length === 0 ? (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                        Belum ada chapter
                      </p>
                    ) : (
                      chapters.map((chapter) => (
                        <div
                          key={chapter.id}
                          className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden"
                        >
                          <div className="flex items-center justify-between p-4">
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-900 dark:text-gray-100">
                                {chapter.title}
                              </h5>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Chapter {chapter.chapter_number} •{" "}
                                {chapter.image_count || 0} halaman
                              </p>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleToggleChapterImages(chapter.id)}
                                className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                                title="Lihat Gambar"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedChapterForImages(chapter);
                                  setChapterImages([]);
                                  setShowImageUpload(true);
                                }}
                                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                title="Upload Gambar"
                              >
                                <Upload className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleEditChapter(chapter)}
                                className="p-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                                title="Edit"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteChapter(chapter.id)}
                                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                                title="Hapus"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          
                          {/* Expanded Images Section */}
                          {expandedChapters[chapter.id] && (
                            <div className="border-t border-gray-200 dark:border-gray-600 p-4">
                              {loadingImages[chapter.id] ? (
                                <div className="flex justify-center items-center py-8">
                                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                                </div>
                              ) : (
                                <>
                                  {chapterImagesMap[chapter.id] &&
                                  chapterImagesMap[chapter.id].length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                      {chapterImagesMap[chapter.id].map((image) => (
                                        <div
                                          key={image.id}
                                          className="relative group aspect-[3/4] bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden"
                                        >
                                          <LazyImage
                                            src={getImageUrl(image.image_path)}
                                            alt={`Page ${image.page_number}`}
                                            className="w-full h-full object-cover"
                                            wrapperClassName="w-full h-full"
                                          />
                                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center">
                                            <button
                                              onClick={() =>
                                                handleDeleteChapterImage(
                                                  chapter.id,
                                                  image.id
                                                )
                                              }
                                              className="opacity-0 group-hover:opacity-100 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full transition-all"
                                              title="Hapus Gambar"
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </button>
                                          </div>
                                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                                            <p className="text-white text-xs font-medium">
                                              Halaman {image.page_number}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                                      Belum ada gambar untuk chapter ini
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chapter Form Modal */}
      {showChapterForm && selectedMangaForChapters && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6">
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">
                {editingChapter ? "Edit Chapter" : "Tambah Chapter Baru"}
              </h4>

              <form onSubmit={handleChapterSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Judul Chapter
                  </label>
                  <input
                    type="text"
                    value={chapterFormData.title}
                    onChange={(e) =>
                      setChapterFormData((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nomor Chapter
                  </label>
                  <input
                    type="text"
                    value={chapterFormData.chapter_number}
                    onChange={(e) =>
                      setChapterFormData((prev) => ({
                        ...prev,
                        chapter_number: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cover Chapter (Opsional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      e.target.files[0] &&
                      setChapterCoverFile(e.target.files[0])
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChapterForm(false);
                      setEditingChapter(null);
                      setChapterFormData({ title: "", chapter_number: "" });
                      setChapterCoverFile(null);
                    }}
                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
                  >
                    {editingChapter ? "Update" : "Simpan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Chapter Image Upload Modal */}
      {showImageUpload && selectedChapterForImages && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6">
              <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">
                Upload Gambar Chapter - {selectedChapterForImages.title}
              </h4>

              <form onSubmit={handleUploadChapterImages} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pilih Gambar (Multiple)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) =>
                      setChapterImages(Array.from(e.target.files))
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                  />
                  {chapterImages.length > 0 && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      {chapterImages.length} gambar dipilih
                    </p>
                  )}
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImageUpload(false);
                      setSelectedChapterForImages(null);
                      setChapterImages([]);
                    }}
                    className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={chapterImages.length === 0}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Upload
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Manga Grid */}
      {loading && manga.length === 0 ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
        </div>
      ) : manga.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            Tidak ada manga ditemukan
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Menampilkan {(currentPage - 1) * 10 + 1} -{" "}
            {Math.min(currentPage * 10, totalCount)} dari {totalCount} manga
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {manga.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
              >
                <div className="aspect-[3/4] relative overflow-hidden">
                  <LazyImage
                    src={
                      getImageUrl(item.thumbnail) ||
                      "https://images.pexels.com/photos/1591447/pexels-photo-1591447.jpeg?auto=compress&cs=tinysrgb&w=400"
                    }
                    alt={item.title}
                    className="w-full h-full object-cover"
                    wrapperClassName="w-full h-full"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-50 transition-opacity duration-300 flex items-center justify-center opacity-0 hover:opacity-100">
                    <div className="flex space-x-2">
                      {!!item.is_input_manual && (
                        <button
                          onClick={() => handleOpenChapters(item)}
                          className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                          title="Kelola Chapter"
                        >
                          <BookOpen className="h-4 w-4 text-blue-600" />
                        </button>
                      )}
                      {!!item.is_input_manual && (
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="h-4 w-4 text-gray-700" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1 line-clamp-1">
                    {item.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {item.author}
                  </p>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex flex-wrap gap-1">
                      {item.genres && item.genres.length > 0
                        ? item.genres.map((genre) => (
                            <span
                              key={genre.id}
                              className="text-xs bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 px-2 py-1 rounded-full"
                            >
                              {genre.name}
                            </span>
                          ))
                        : item.category_name && (
                            <span className="text-xs bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 px-2 py-1 rounded-full">
                              {item.category_name}
                            </span>
                          )}
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          item.is_input_manual
                            ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                            : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                        }`}
                      >
                        {item.is_input_manual ? "Manual" : "API"}
                      </span>
                    </div>
                    {/* <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <Eye className="h-3 w-3 mr-1" />
                      {item.view || 0}
                    </div> */}
                  </div>
                  {!!item.is_input_manual && (
                    <button
                      onClick={() => handleOpenChapters(item)}
                      className="mt-2 w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors flex items-center justify-center"
                    >
                      <BookOpen className="h-3 w-3 mr-1" />
                      Kelola Chapter
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center items-center space-x-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                title="Sebelumnya"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="flex space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        currentPage === pageNum
                          ? "bg-primary-600 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                title="Selanjutnya"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MangaManager;
