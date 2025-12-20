import { useState, useEffect } from 'react';
import { Plus, Trash2, Eye, PencilIcon, RefreshCw, X, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Search, BookOpen, Upload } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { apiClient } from '../../utils/api';
import { compressImage } from '../../utils/imageCompression';
import LazyImage from '../LazyImage';

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
  const [syncForm, setSyncForm] = useState({ page: 1, limit: 25 });
  const [syncFormInput, setSyncFormInput] = useState({ page: '1', limit: '25' });
  const [editingManga, setEditingManga] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    synopsis: '',
    category_id: '',
    category_ids: [],
  });
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [selectedMangaForChapters, setSelectedMangaForChapters] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [editingChapter, setEditingChapter] = useState(null);
  const [chapterFormData, setChapterFormData] = useState({ title: '', chapter_number: '' });
  const [chapterCoverFile, setChapterCoverFile] = useState(null);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [selectedChapterForImages, setSelectedChapterForImages] = useState(null);
  const [chapterImages, setChapterImages] = useState([]);

  useEffect(() => {
    fetchManga();
    fetchCategories();
  }, [currentPage]);

  const fetchManga = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getManga(currentPage, 10);
      setManga(response.manga);
      setTotalPages(response.totalPages);
      setTotalCount(response.totalCount);
    } catch (error) {
      console.error('Error fetching manga:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await apiClient.getCategories();
      setCategories(response);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const generateSlug = (title) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  };

  const handleImageUpload = async (file, type) => {
    try {
      const compressed = await compressImage(file);
      if (type === 'thumbnail') {
        setThumbnailFile(compressed);
      } else {
        setCoverFile(compressed);
      }
    } catch (error) {
      console.error('Error compressing image:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate: at least one category must be selected
    if (formData.category_ids.length === 0) {
      alert('Silakan pilih minimal satu kategori');
      return;
    }
    
    const submitData = new FormData();
    submitData.append('title', formData.title);
    submitData.append('slug', generateSlug(formData.title));
    submitData.append('author', formData.author);
    submitData.append('synopsis', formData.synopsis);
    submitData.append('category_id', formData.category_ids[0]); // First category as primary
    
    // Append genre_ids as JSON array for multiple categories
    submitData.append('genre_ids', JSON.stringify(formData.category_ids));
    
    if (thumbnailFile) {
      submitData.append('thumbnail', thumbnailFile);
    }
    if (coverFile) {
      submitData.append('cover_background', coverFile);
    }

    try {
      if (editingManga) {
        await apiClient.updateManga(editingManga.id, submitData);
      } else {
        await apiClient.createManga(submitData);
      }
      
      setShowForm(false);
      setEditingManga(null);
      setFormData({ title: '', author: '', synopsis: '', category_id: '', category_ids: [] });
      setThumbnailFile(null);
      setCoverFile(null);
      setCurrentPage(1);
      fetchManga();
    } catch (error) {
      console.error('Error saving manga:', error);
    }
  };

  const handleEdit = (item) => {
    setEditingManga(item);
    // Get category IDs from genres if available, otherwise use category_id
    const categoryIds = item.genres && item.genres.length > 0 
      ? item.genres.map(g => g.id) 
      : (item.category_id ? [item.category_id] : []);
    
    setFormData({
      title: item.title,
      author: item.author,
      synopsis: item.synopsis,
      category_id: item.category_id || (categoryIds.length > 0 ? categoryIds[0] : ''),
      category_ids: categoryIds,
    });
    setShowForm(true);
  };

  const toggleCategory = (categoryId) => {
    setFormData(prev => {
      const categoryIds = prev.category_ids.includes(categoryId)
        ? prev.category_ids.filter(id => id !== categoryId)
        : [...prev.category_ids, categoryId];
      
      return {
        ...prev,
        category_ids: categoryIds,
        category_id: categoryIds.length > 0 ? categoryIds[0] : '',
      };
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus manga ini?')) return;

    try {
      await apiClient.deleteManga(id);
      // If current page becomes empty after deletion, go to previous page
      if (manga.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        fetchManga();
      }
    } catch (error) {
      console.error('Error deleting manga:', error);
    }
  };

  const handleSync = async (e) => {
    e.preventDefault();
    setSyncing(true);
    setSyncResult(null);

    try {
      const result = await apiClient.syncWestManga(syncForm.page, syncForm.limit);
      setSyncResult(result);
      // Auto refresh manga list after sync
      await fetchManga();
    } catch (error) {
      console.error('Error syncing manga:', error);
      setSyncResult({
        error: error.message || 'Failed to sync manga from WestManga'
      });
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
      console.error('Error searching manga:', error);
      setSearchResults({ local: [], westmanga: [], total: 0, error: error.message });
    } finally {
      setSearching(false);
    }
  };

  const handleImportFromSearch = async (mangaData, source) => {
    try {
      if (source === 'westmanga') {
        // Import from WestManga - we need to sync it
        const result = await apiClient.syncWestManga(1, 1);
        // After sync, the manga should be available
        await fetchManga();
        setSearchResults(null);
        setSearchQuery('');
        alert('Manga berhasil diimport! Silakan refresh halaman untuk melihat.');
      } else {
        // Local manga - already in database
        alert('Manga ini sudah ada di database.');
      }
    } catch (error) {
      console.error('Error importing manga:', error);
      alert('Gagal mengimport manga: ' + error.message);
    }
  };

  const fetchChapters = async (mangaId) => {
    try {
      const chaptersData = await apiClient.getChapters(mangaId);
      setChapters(chaptersData);
    } catch (error) {
      console.error('Error fetching chapters:', error);
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
    submitData.append('title', chapterFormData.title);
    submitData.append('chapter_number', chapterFormData.chapter_number);
    if (chapterCoverFile) {
      submitData.append('cover', chapterCoverFile);
    }

    try {
      if (editingChapter) {
        await apiClient.updateChapter(editingChapter.id, submitData);
      } else {
        await apiClient.createChapter(selectedMangaForChapters.id, submitData);
      }
      
      setShowChapterForm(false);
      setEditingChapter(null);
      setChapterFormData({ title: '', chapter_number: '' });
      setChapterCoverFile(null);
      await fetchChapters(selectedMangaForChapters.id);
    } catch (error) {
      console.error('Error saving chapter:', error);
      alert('Gagal menyimpan chapter: ' + error.message);
    }
  };

  const handleEditChapter = (chapter) => {
    setEditingChapter(chapter);
    setChapterFormData({
      title: chapter.title,
      chapter_number: chapter.chapter_number
    });
    setShowChapterForm(true);
  };

  const handleDeleteChapter = async (chapterId) => {
    if (!confirm('Apakah Anda yakin ingin menghapus chapter ini?')) return;

    try {
      await apiClient.deleteChapter(chapterId);
      await fetchChapters(selectedMangaForChapters.id);
    } catch (error) {
      console.error('Error deleting chapter:', error);
      alert('Gagal menghapus chapter: ' + error.message);
    }
  };

  const handleUploadChapterImages = async (e) => {
    e.preventDefault();
    if (!selectedChapterForImages || chapterImages.length === 0) return;

    const formData = new FormData();
    chapterImages.forEach((file) => {
      formData.append('images', file);
    });

    try {
      await apiClient.addChapterImages(selectedChapterForImages.id, formData);
      setShowImageUpload(false);
      setSelectedChapterForImages(null);
      setChapterImages([]);
      await fetchChapters(selectedMangaForChapters.id);
      alert('Gambar berhasil diupload!');
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Gagal mengupload gambar: ' + error.message);
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
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Manajemen Manga
          </h3>
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setShowSyncModal(true);
                setSyncForm({ page: 1, limit: 25 });
                setSyncFormInput({ page: '1', limit: '25' });
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
                setSearchQuery('');
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
                    setSyncForm({ page: 1, limit: 25 });
                    setSyncFormInput({ page: '1', limit: '25' });
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {!syncResult ? (
                <form onSubmit={handleSync} className="space-y-4">
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
                        setSyncFormInput(prev => ({ ...prev, page: value }));
                        const numValue = parseInt(value);
                        if (!isNaN(numValue) && numValue > 0) {
                          setSyncForm(prev => ({ ...prev, page: numValue }));
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        const numValue = parseInt(value);
                        if (isNaN(numValue) || numValue < 1) {
                          setSyncFormInput(prev => ({ ...prev, page: '1' }));
                          setSyncForm(prev => ({ ...prev, page: 1 }));
                        } else {
                          setSyncFormInput(prev => ({ ...prev, page: value }));
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
                        setSyncFormInput(prev => ({ ...prev, limit: value }));
                        const numValue = parseInt(value);
                        if (!isNaN(numValue) && numValue > 0 && numValue <= 100) {
                          setSyncForm(prev => ({ ...prev, limit: numValue }));
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        const numValue = parseInt(value);
                        if (isNaN(numValue) || numValue < 1) {
                          setSyncFormInput(prev => ({ ...prev, limit: '25' }));
                          setSyncForm(prev => ({ ...prev, limit: 25 }));
                        } else if (numValue > 100) {
                          setSyncFormInput(prev => ({ ...prev, limit: '100' }));
                          setSyncForm(prev => ({ ...prev, limit: 100 }));
                        } else {
                          setSyncFormInput(prev => ({ ...prev, limit: value }));
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
                        setSyncForm({ page: 1, limit: 25 });
                        setSyncFormInput({ page: '1', limit: '25' });
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

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Manga Baru</p>
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {syncResult.synced || 0}
                          </p>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Diperbarui</p>
                          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                            {syncResult.updated || 0}
                          </p>
                        </div>
                      </div>

                      {syncResult.errors > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Error</p>
                          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {syncResult.errors}
                          </p>
                        </div>
                      )}

                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Diproses</p>
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
                        setSyncForm({ page: 1, limit: 25 });
                        setSyncFormInput({ page: '1', limit: '25' });
                      }}
                      className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
                    >
                      Tutup
                    </button>
                    <button
                      onClick={() => {
                        const nextPage = syncForm.page + 1;
                        setSyncResult(null);
                        setSyncForm(prev => ({ ...prev, page: nextPage }));
                        setSyncFormInput(prev => ({ ...prev, page: nextPage.toString() }));
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
                {editingManga ? 'Edit Manga' : 'Tambah Manga Baru'}
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
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
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
                      onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kategori <span className="text-xs text-gray-500">(Pilih satu atau lebih)</span>
                  </label>
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 max-h-48 overflow-y-auto bg-white dark:bg-gray-700">
                    {categories.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada kategori tersedia</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {categories.map((category) => (
                          <label
                            key={category.id}
                            className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 p-2 rounded transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={formData.category_ids.includes(category.id)}
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
                      onChange={(e) => e.target.files[0] && handleImageUpload(e.target.files[0], 'thumbnail')}
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
                      onChange={(e) => e.target.files[0] && handleImageUpload(e.target.files[0], 'cover')}
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
                    onChange={(value) => setFormData(prev => ({ ...prev, synopsis: value }))}
                    className="bg-white dark:bg-gray-700"
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingManga(null);
                      setFormData({ title: '', author: '', synopsis: '', category_id: '', category_ids: [] });
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
                    {editingManga ? 'Update' : 'Simpan'}
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
                setSearchQuery('');
              }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {searchResults.error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-200">{searchResults.error}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {searchResults.westmanga && searchResults.westmanga.length > 0 && (
                <div>
                  <h5 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Dari WestManga API ({searchResults.westmanga.length})
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {searchResults.westmanga.map((item) => (
                      <div key={item.id || item.slug} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div className="aspect-[3/4] relative overflow-hidden rounded-lg mb-2">
                          <LazyImage
                            src={item.cover || item.thumbnail || 'https://images.pexels.com/photos/1591447/pexels-photo-1591447.jpeg?auto=compress&cs=tinysrgb&w=400'}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            wrapperClassName="w-full h-full"
                          />
                        </div>
                        <h6 className="font-medium text-gray-900 dark:text-gray-100 mb-1 line-clamp-1 text-sm">
                          {item.title}
                        </h6>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-1">
                          {item.author || 'Unknown'}
                        </p>
                        <button
                          onClick={() => handleImportFromSearch(item, 'westmanga')}
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
                      <div key={item.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div className="aspect-[3/4] relative overflow-hidden rounded-lg mb-2">
                          <LazyImage
                            src={item.thumbnail || 'https://images.pexels.com/photos/1591447/pexels-photo-1591447.jpeg?auto=compress&cs=tinysrgb&w=400'}
                            alt={item.title}
                            className="w-full h-full object-cover"
                            wrapperClassName="w-full h-full"
                          />
                        </div>
                        <h6 className="font-medium text-gray-900 dark:text-gray-100 mb-1 line-clamp-1 text-sm">
                          {item.title}
                        </h6>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-1">
                          {item.author || 'Unknown'}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded ${
                            item.is_input_manual 
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                              : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          }`}>
                            {item.is_input_manual ? 'Manual' : 'API'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!searchResults.westmanga || searchResults.westmanga.length === 0) && 
               (!searchResults.local || searchResults.local.length === 0) && (
                <div className="text-center py-8">
                  <p className="text-gray-500 dark:text-gray-400">Tidak ada hasil ditemukan</p>
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
                    {selectedMangaForChapters.is_input_manual ? 'Manga Manual' : 'Manga dari API'}
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
                    Manga ini berasal dari API. Chapter dikelola oleh sistem eksternal.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex justify-end mb-4">
                    <button
                      onClick={() => {
                        setEditingChapter(null);
                        setChapterFormData({ title: '', chapter_number: '' });
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
                        <div key={chapter.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex-1">
                            <h5 className="font-medium text-gray-900 dark:text-gray-100">
                              {chapter.title}
                            </h5>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Chapter {chapter.chapter_number} • {chapter.image_count || 0} halaman
                            </p>
                          </div>
                          <div className="flex space-x-2">
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
                {editingChapter ? 'Edit Chapter' : 'Tambah Chapter Baru'}
              </h4>
              
              <form onSubmit={handleChapterSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Judul Chapter
                  </label>
                  <input
                    type="text"
                    value={chapterFormData.title}
                    onChange={(e) => setChapterFormData(prev => ({ ...prev, title: e.target.value }))}
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
                    onChange={(e) => setChapterFormData(prev => ({ ...prev, chapter_number: e.target.value }))}
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
                    onChange={(e) => e.target.files[0] && setChapterCoverFile(e.target.files[0])}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChapterForm(false);
                      setEditingChapter(null);
                      setChapterFormData({ title: '', chapter_number: '' });
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
                    {editingChapter ? 'Update' : 'Simpan'}
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
                    onChange={(e) => setChapterImages(Array.from(e.target.files))}
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
          <p className="text-gray-500 dark:text-gray-400">Tidak ada manga ditemukan</p>
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Menampilkan {((currentPage - 1) * 10) + 1} - {Math.min(currentPage * 10, totalCount)} dari {totalCount} manga
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {manga.map((item) => (
              <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <div className="aspect-[3/4] relative overflow-hidden">
                  <LazyImage
                    src={item.thumbnail || 'https://images.pexels.com/photos/1591447/pexels-photo-1591447.jpeg?auto=compress&cs=tinysrgb&w=400'}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    wrapperClassName="w-full h-full"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-50 transition-opacity duration-300 flex items-center justify-center opacity-0 hover:opacity-100">
                    <div className="flex space-x-2">
                      {item.is_input_manual && (
                        <button
                          onClick={() => handleOpenChapters(item)}
                          className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                          title="Kelola Chapter"
                        >
                          <BookOpen className="h-4 w-4 text-blue-600" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-2 bg-white rounded-full hover:bg-gray-100 transition-colors"
                        title="Edit"
                      >
                        <PencilIcon className="h-4 w-4 text-gray-700" />
                      </button>
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
                      {item.genres && item.genres.length > 0 ? (
                        item.genres.map((genre) => (
                          <span
                            key={genre.id}
                            className="text-xs bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 px-2 py-1 rounded-full"
                          >
                            {genre.name}
                          </span>
                        ))
                      ) : (
                        item.category_name && (
                          <span className="text-xs bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 px-2 py-1 rounded-full">
                            {item.category_name}
                          </span>
                        )
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        item.is_input_manual 
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                          : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                      }`}>
                        {item.is_input_manual ? 'Manual' : 'API'}
                      </span>
                    </div>
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <Eye className="h-3 w-3 mr-1" />
                      {item.votes || 0}
                    </div>
                  </div>
                  {item.is_input_manual && (
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
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
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