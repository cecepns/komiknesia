import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, PencilIcon, Image as ImageIcon } from 'lucide-react';
import { apiClient, getImageUrl } from '../../utils/api';

const AdsManager = () => {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingAd, setEditingAd] = useState(null);
  const [newAd, setNewAd] = useState({ 
    link_url: '', 
    ads_type: 'home-top',
    image: null,
    imagePreview: null
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [uploading, setUploading] = useState(false);

  const adsTypes = [
    { value: 'home-top', label: 'Home Top' },
    { value: 'new-update', label: 'New Update' },
    { value: 'populer', label: 'Populer' },
    { value: 'home-footer', label: 'Home Footer' },
    { value: 'library-top', label: 'Library Top' },
    { value: 'chapter-top', label: 'Chapter Top' },
    { value: 'list-chapter', label: 'List Chapter' },
    { value: 'top-upvote', label: 'Top Upvote' },
    { value: 'home-popup', label: 'Home Popup (Banner Pengumuman)' },
    { value: 'popup', label: 'Popup' },
    { value: 'manga-detail-top', label: 'Manga Detail Top' },
    { value: 'manga-detail-bottom', label: 'Manga Detail Bottom' },
    { value: 'comic-top', label: 'Comic Top' },
  ];

  useEffect(() => {
    fetchAds();
  }, []);

  const fetchAds = async () => {
    try {
      const response = await apiClient.getAds();
      setAds(response);
    } catch (error) {
      console.error('Error fetching ads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e, isEdit = false) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        if (isEdit) {
          setEditingAd(prev => ({
            ...prev,
            image: file,
            imagePreview: reader.result
          }));
        } else {
          setNewAd(prev => ({
            ...prev,
            image: file,
            imagePreview: reader.result
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newAd.image) {
      alert('Please select an image');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', newAd.image);
      formData.append('link_url', newAd.link_url || '');
      formData.append('ads_type', newAd.ads_type);

      await apiClient.createAd(formData);
      setNewAd({ 
        link_url: '', 
        ads_type: 'home-top',
        image: null,
        imagePreview: null
      });
      setShowAddForm(false);
      fetchAds();
    } catch (error) {
      console.error('Error creating ad:', error);
      alert('Error creating ad: ' + (error.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async (id, data) => {
    setUploading(true);
    try {
      const formData = new FormData();
      if (data.image) {
        formData.append('image', data.image);
      }
      formData.append('link_url', data.link_url || '');
      formData.append('ads_type', data.ads_type);

      await apiClient.updateAd(id, formData);
      setEditingAd(null);
      fetchAds();
    } catch (error) {
      console.error('Error updating ad:', error);
      alert('Error updating ad: ' + (error.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingAd) return;
    
    const updated = {
      link_url: editingAd.link_url || '',
      ads_type: editingAd.ads_type,
      image: editingAd.image
    };
    
    await handleUpdate(editingAd.id, updated);
  };

  const handleDelete = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus iklan ini?')) return;

    try {
      await apiClient.deleteAd(id);
      fetchAds();
    } catch (error) {
      console.error('Error deleting ad:', error);
      alert('Error deleting ad: ' + (error.message || 'Unknown error'));
    }
  };

  const startEdit = (ad) => {
    setEditingAd({
      id: ad.id,
      link_url: ad.link_url || '',
      ads_type: ad.ads_type || 'home-top',
      image: null,
      imagePreview: getImageUrl(ad.image)
    });
  };

  const cancelEdit = () => {
    setEditingAd(null);
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
          Manajemen Iklan
        </h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Tambah Iklan
        </button>
      </div>

      {/* Add Ad Form */}
      {showAddForm && (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Gambar Iklan *
              </label>
              <div className="mt-1 flex items-center space-x-4">
                <label className="flex flex-col items-center justify-center w-48 h-32 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  {newAd.imagePreview ? (
                    <img 
                      src={newAd.imagePreview} 
                      alt="Preview" 
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <ImageIcon className="w-10 h-10 mb-2 text-gray-400" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">Klik untuk upload</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageChange(e, false)}
                    className="hidden"
                    required
                  />
                </label>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Format: JPG, PNG, GIF, WEBP. Maksimal 5MB
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                URL Tautan
              </label>
              <input
                type="url"
                value={newAd.link_url}
                onChange={(e) => setNewAd(prev => ({ ...prev, link_url: e.target.value }))}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipe Iklan *
              </label>
              <select
                value={newAd.ads_type}
                onChange={(e) => setNewAd(prev => ({ ...prev, ads_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              >
                {adsTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={uploading}
                className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="h-4 w-4 mr-2" />
                {uploading ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewAd({ 
                    link_url: '', 
                    ads_type: 'home-top',
                    image: null,
                    imagePreview: null
                  });
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

      {/* Ads List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Gambar
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  URL Tautan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tipe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Dibuat
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {ads.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Belum ada iklan. Klik &quot;Tambah Iklan&quot; untuk menambahkan.
                  </td>
                </tr>
              ) : (
                ads.map((ad) => (
                  <tr key={ad.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingAd && editingAd.id === ad.id ? (
                        <div className="flex items-center space-x-4">
                          <label className="flex flex-col items-center justify-center w-24 h-16 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            {editingAd.imagePreview ? (
                              <img 
                                src={editingAd.imagePreview} 
                                alt="Preview" 
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <ImageIcon className="w-6 h-6 text-gray-400" />
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageChange(e, true)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      ) : (
                        <div className="w-24 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                          {ad.image ? (
                            <img 
                              src={getImageUrl(ad.image)} 
                              alt="Ad" 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src = '/broken-image.png';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingAd && editingAd.id === ad.id ? (
                        <input
                          type="url"
                          value={editingAd.link_url}
                          onChange={(e) => setEditingAd(prev => ({ ...prev, link_url: e.target.value }))}
                          placeholder="https://example.com"
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                        />
                      ) : (
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {ad.link_url ? (
                            <a 
                              href={ad.link_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 truncate block max-w-xs"
                            >
                              {ad.link_url}
                            </a>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingAd && editingAd.id === ad.id ? (
                        <select
                          value={editingAd.ads_type}
                          onChange={(e) => setEditingAd(prev => ({ ...prev, ads_type: e.target.value }))}
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                        >
                          {adsTypes.map(type => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200">
                          {adsTypes.find(t => t.value === ad.ads_type)?.label || ad.ads_type}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {ad.created_at ? new Date(ad.created_at).toLocaleDateString('id-ID') : '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {editingAd && editingAd.id === ad.id ? (
                          <>
                            <button
                              onClick={handleSaveEdit}
                              disabled={uploading}
                              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-50"
                              title="Simpan"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={uploading}
                              className="text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
                              title="Batal"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(ad)}
                              className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                              title="Edit"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(ad.id)}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdsManager;

