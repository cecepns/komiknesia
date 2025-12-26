import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, PencilIcon, Search, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { apiClient, getImageUrl } from '../../utils/api';
import LazyImage from '../../components/LazyImage';

const FeaturedManager = () => {
  const [featuredItems, setFeaturedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('banner');
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Search results list for manga (from /contents endpoint)
  const [searchResults, setSearchResults] = useState(null); // will hold an array of manga objects
  const [searching, setSearching] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedManga, setSelectedManga] = useState(null);
  const [syncingChapters, setSyncingChapters] = useState({}); // Track syncing status per manga slug
  const [newItem, setNewItem] = useState({
    manga_id: null,
    featured_type: 'banner',
    display_order: 0,
    is_active: true
  });

  const featuredTypes = [
    { value: 'banner', label: 'Banner Slider' },
    { value: 'popular_daily', label: 'Popular Hari Ini' },
    { value: 'popular_weekly', label: 'Popular Minggu Ini' },
    { value: 'popular_monthly', label: 'Popular Bulan Ini' },
    { value: 'rekomendasi', label: 'Rekomendasi' }
  ];

  useEffect(() => {
    fetchFeaturedItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType]);

  const fetchFeaturedItems = async () => {
    try {
      setLoading(true);
      const items = await apiClient.getFeaturedItems(selectedType, true);
      setFeaturedItems(items);
    } catch (error) {
      console.error('Error fetching featured items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      // Use /contents API so the result is consistent with Content page
      const response = await apiClient.getContents({
        q: searchQuery.trim(),
        page: 1,
        per_page: 40,
        project: 'false'
      });

      if (response?.status && Array.isArray(response.data)) {
        setSearchResults(response.data);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching manga:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectManga = (manga) => {
    setSelectedManga(manga);
    setNewItem(prev => ({
      ...prev,
      manga_id: manga.id
    }));
    // Don't clear searchResults immediately so images can still load
    // setSearchResults(null);
    // setSearchQuery('');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newItem.manga_id) {
      alert('Silakan pilih manga terlebih dahulu');
      return;
    }

    try {
      // Include westmanga_id and slug if the selected manga is from WestManga
      const createData = {
        ...newItem,
        featured_type: selectedType,
        display_order: newItem.display_order ?? 0
      };
      
      // Check if selected manga is from WestManga using available flags
      // Prefer explicit westmanga_id if provided by API
      const isWestManga = selectedManga && (selectedManga.westmanga_id || selectedManga.is_local === false || !selectedManga.is_input_manual);

      // If selected manga is from WestManga, include westmanga_id and slug to help backend find/create the local manga
      if (isWestManga) {
        createData.westmanga_id = selectedManga.westmanga_id || selectedManga.id;
        // Always include slug for auto-sync if manga not found in database
        if (selectedManga.slug) {
          createData.slug = selectedManga.slug;
        }
      } else if (selectedManga && selectedManga.slug) {
        // Even for local manga, include slug as fallback (though it should already exist)
        createData.slug = selectedManga.slug;
      }
      
      await apiClient.createFeaturedItem(createData);
      setNewItem({
        manga_id: null,
        featured_type: selectedType,
        display_order: 0,
        is_active: true
      });
      setSelectedManga(null);
      setShowAddForm(false);
      fetchFeaturedItems();
    } catch (error) {
      console.error('Error creating featured item:', error);
      alert('Error creating featured item: ' + (error.message || 'Unknown error'));
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await apiClient.updateFeaturedItem(id, data);
      setEditingItem(null);
      fetchFeaturedItems();
    } catch (error) {
      console.error('Error updating featured item:', error);
      alert('Error updating featured item: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus item ini dari featured?')) return;

    try {
      await apiClient.deleteFeaturedItem(id);
      fetchFeaturedItems();
    } catch (error) {
      console.error('Error deleting featured item:', error);
      alert('Error deleting featured item: ' + (error.message || 'Unknown error'));
    }
  };

  const handleMoveOrder = async (item, direction) => {
    const newOrder = direction === 'up' ? item.display_order - 1 : item.display_order + 1;
    await handleUpdate(item.id, { display_order: newOrder });
  };

  const handleSyncChapters = async (item) => {
    const manga = getMangaFromItem(item);
    
    // Only allow sync for WestManga manga (is_input_manual = false)
    if (item.is_input_manual) {
      alert('Sync chapters hanya untuk manga dari WestManga');
      return;
    }
    
    if (!manga.slug) {
      alert('Slug manga tidak ditemukan');
      return;
    }
    
    if (!confirm(`Apakah Anda yakin ingin sync chapters untuk "${manga.title}"?`)) {
      return;
    }
    
    setSyncingChapters(prev => ({ ...prev, [manga.slug]: true }));
    
    try {
      const result = await apiClient.syncChaptersBySlug(manga.slug);
      alert(`Sync berhasil!\n\nSynced: ${result.synced}\nUpdated: ${result.updated}\nErrors: ${result.errors}\nTotal: ${result.total}`);
      // Refresh the list to show updated data
      fetchFeaturedItems();
    } catch (error) {
      console.error('Error syncing chapters:', error);
      alert('Error syncing chapters: ' + (error.message || 'Unknown error'));
    } finally {
      setSyncingChapters(prev => ({ ...prev, [manga.slug]: false }));
    }
  };

  const startEdit = (item) => {
    setEditingItem({
      id: item.id,
      display_order: item.display_order,
      is_active: item.is_active
    });
  };

  const cancelEdit = () => {
    setEditingItem(null);
  };

  const getMangaFromItem = (item) => {
    return {
      id: item.manga_id,
      title: item.title,
      slug: item.slug,
      cover: item.cover,
      rating: item.rating,
      total_views: item.total_views
    };
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
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Manajemen Featured Items
        </h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Tambah Featured Item
        </button>
      </div>

      {/* Type Filter */}
      <div className="flex space-x-2 flex-wrap gap-2">
        {featuredTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => {
              setSelectedType(type.value);
              setNewItem(prev => ({ ...prev, featured_type: type.value }));
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedType === type.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            Tambah Featured Item - {featuredTypes.find(t => t.value === selectedType)?.label}
          </h4>
          
          {/* Search Manga */}
          <form onSubmit={handleSearch} className="mb-4">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari manga untuk ditambahkan..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <button
                type="submit"
                disabled={searching || !searchQuery.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {searching ? 'Mencari...' : 'Cari'}
              </button>
            </div>
          </form>

          {/* Search Results */}
          {Array.isArray(searchResults) && searchResults.length > 0 && (
            <div className="mb-4 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Hasil Pencarian ({searchResults.length})
                </p>
                <button
                  onClick={() => {
                    setSearchResults(null);
                    setSearchQuery('');
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {searchResults.map((manga) => (
                  <div
                    key={manga.id}
                    onClick={() => handleSelectManga(manga)}
                    className={`cursor-pointer border-2 rounded-lg p-2 transition-all ${
                      newItem.manga_id === manga.id
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900'
                        : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
                    }`}
                  >
                    <div className="aspect-[3/4] rounded overflow-hidden mb-2 bg-gray-100 dark:bg-gray-800">
                      {(manga.cover || manga.thumbnail) && (
                        <LazyImage
                          src={getImageUrl(manga.cover || manga.thumbnail)}
                          alt={manga.title}
                          className="w-full h-full object-cover"
                          wrapperClassName="w-full h-full"
                        />
                      )}
                    </div>
                    <p className="text-xs font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
                      {manga.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Manga */}
          {selectedManga && newItem.manga_id && (
            <div className="mb-4 p-4 bg-primary-50 dark:bg-primary-900 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Manga Terpilih:
              </p>
              <div className="flex items-center space-x-4">
                <div className="w-16 h-24 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
                  {(selectedManga.cover || selectedManga.thumbnail) && (
                    <LazyImage
                      src={getImageUrl(selectedManga.cover || selectedManga.thumbnail)}
                      alt={selectedManga.title}
                      className="w-full h-full object-cover"
                      wrapperClassName="w-full h-full"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {selectedManga.title}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Rating: {selectedManga.rating || 'N/A'} | Views: {(selectedManga.total_views || selectedManga.views || 0)?.toLocaleString() || 0}
                  </p>
                  {selectedManga.westmanga_id && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                      (WestManga ID: {selectedManga.westmanga_id || selectedManga.id})
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSelectedManga(null);
                    setNewItem(prev => ({ ...prev, manga_id: null }));
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="Hapus pilihan"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Urutan Tampil
              </label>
              <input
                type="number"
                value={newItem.display_order === null || newItem.display_order === undefined ? '' : newItem.display_order}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewItem(prev => ({ 
                    ...prev, 
                    display_order: value === '' ? null : (parseInt(value) || 0)
                  }));
                }}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active_new"
                checked={newItem.is_active}
                onChange={(e) => setNewItem(prev => ({ ...prev, is_active: e.target.checked }))}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active_new" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Aktif
              </label>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={!newItem.manga_id}
                className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4 mr-2" />
                Simpan
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewItem({
                    manga_id: null,
                    featured_type: selectedType,
                    display_order: 0,
                    is_active: true
                  });
                  setSelectedManga(null);
                  setSearchResults(null);
                  setSearchQuery('');
                }}
                className="inline-flex items-center px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
              >
                <X className="h-4 w-4 mr-2" />
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Featured Items List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Cover
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Manga
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Urutan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {featuredItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Belum ada featured item untuk tipe ini. Klik &quot;Tambah Featured Item&quot; untuk menambahkan.
                  </td>
                </tr>
              ) : (
                featuredItems.map((item) => {
                  const manga = getMangaFromItem(item);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-16 h-24 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
                          {manga.cover && (
                            <LazyImage
                              src={getImageUrl(manga.cover)}
                              alt={manga.title}
                              className="w-full h-full object-cover"
                              wrapperClassName="w-full h-full"
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {manga.title}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Rating: {item.rating || 'N/A'} | Views: {item.total_views?.toLocaleString() || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingItem && editingItem.id === item.id ? (
                          <input
                            type="number"
                            value={editingItem.display_order === null || editingItem.display_order === undefined ? '' : editingItem.display_order}
                            onChange={(e) => {
                              const value = e.target.value;
                              setEditingItem(prev => ({ 
                                ...prev, 
                                display_order: value === '' ? null : (parseInt(value) || 0)
                              }));
                            }}
                            min="0"
                            className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                          />
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-900 dark:text-gray-100">
                              {item.display_order}
                            </span>
                            <div className="flex flex-col space-y-1">
                              <button
                                onClick={() => handleMoveOrder(item, 'up')}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                title="Naikkan urutan"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleMoveOrder(item, 'down')}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                title="Turunkan urutan"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editingItem && editingItem.id === item.id ? (
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={editingItem.is_active}
                              onChange={(e) => setEditingItem(prev => ({ ...prev, is_active: e.target.checked }))}
                              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                            />
                          </label>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.is_active
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                          }`}>
                            {item.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {editingItem && editingItem.id === item.id ? (
                            <>
                              <button
                                onClick={() => handleUpdate(item.id, editingItem)}
                                className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                                title="Simpan"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                title="Batal"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Sync chapters button - only for WestManga manga */}
                              {!item.is_input_manual && (
                                <button
                                  onClick={() => handleSyncChapters(item)}
                                  disabled={syncingChapters[getMangaFromItem(item).slug]}
                                  className={`text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 ${
                                    syncingChapters[getMangaFromItem(item).slug] ? 'opacity-50 cursor-not-allowed' : ''
                                  }`}
                                  title="Sync Chapters dari WestManga"
                                >
                                  <RefreshCw className={`h-4 w-4 ${syncingChapters[getMangaFromItem(item).slug] ? 'animate-spin' : ''}`} />
                                </button>
                              )}
                              <button
                                onClick={() => startEdit(item)}
                                className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                                title="Edit"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                title="Hapus"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FeaturedManager;


