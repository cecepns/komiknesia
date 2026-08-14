import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, X, PencilIcon, Image as ImageIcon, ArrowUp, ArrowDown } from 'lucide-react';
import { apiClient, getImageUrl, formatToInputString, formatToLocaleString } from '../../utils/api';

const AdsManager = () => {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('all');
  const [editingAd, setEditingAd] = useState(null);
  const [newAd, setNewAd] = useState({ 
    link_url: '', 
    ads_type: 'popup',
    image: null,
    imagePreview: null,
    image_alt: '',
    title: '',
    expired_at: '',
    display_order: 0,
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [settings, setSettings] = useState({
    popup_ads_interval_minutes: 20,
    home_popup_interval_minutes: 30,
    popup_ads_initial_delay_minutes: 5,
    popup_ads_unlock_seconds: 10,
    redirect_script_urls: ['https://mbuh.my.id/siap/1770790072377-komiknesia.js'],
    cdn_domain: 'https://cdn.komiknesia.net',
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  const POPUP_INTERVAL_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
  const POPUP_INITIAL_DELAY_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 30];
  const POPUP_UNLOCK_SECONDS_OPTIONS = [5, 10, 15, 20, 30, 45, 60];

  /**
   * List 22 penempatan iklan banner lengkap sesuai permintaan klien.
   */
  const adsTypes = [
    { value: 'popup', shortLabel: 'PopUp No Skip', label: 'PopUp No Skip' },
    { value: 'home-popup', shortLabel: 'PopUp Pengumuman', label: 'PopUp Pengumuman' },
    { value: 'floating-fixed-top', shortLabel: 'Float Atas', label: 'Float Atas' },
    { value: 'floating-fixed-bottom', shortLabel: 'Float Bawah', label: 'Float Bawah' },
    { value: 'home-top', shortLabel: 'Home - Header', label: 'Home - Header (paling atas)' },
    { value: 'project-top', shortLabel: 'Home - Atas Projek', label: 'Home - Atas Projek' },
    { value: 'update-top', shortLabel: 'Home - Atas Last Update', label: 'Home - Atas Last Update' },
    { value: 'home-manhwa-top', shortLabel: 'Home - Atas Manhwa', label: 'Home - Atas Manhwa' },
    { value: 'home-manga-top', shortLabel: 'Home - Atas Manga', label: 'Home - Atas Manga' },
    { value: 'home-manhua-top', shortLabel: 'Home - Atas Manhua', label: 'Home - Atas Manhua' },
    { value: 'home-footer', shortLabel: 'Home - Footer', label: 'Home - Footer (paling bawah)' },
    { value: 'popular-top', shortLabel: 'Populer - Header', label: 'Populer - Header' },
    { value: 'popular-footer', shortLabel: 'Populer - Footer', label: 'Populer - Footer' },
    { value: 'library-top', shortLabel: 'Library - Header', label: 'Library - Header' },
    { value: 'library-footer', shortLabel: 'Library - Footer', label: 'Library - Footer' },
    { value: 'comic-top', shortLabel: 'Genre - Header', label: 'Genre - Header' },
    { value: 'comic-footer', shortLabel: 'Genre - Footer', label: 'Genre - Footer' },
    { value: 'chapter-top', shortLabel: 'Detail Komik - Header', label: 'Detail Komik - Header (Atas)' },
    { value: 'list-chapter', shortLabel: 'Detail Komik - Tengah', label: 'Detail Komik - Tengah (Atas Chapter)' },
    { value: 'top-upvote', shortLabel: 'Detail Komik - Bawah', label: 'Detail Komik - Bawah (Bawah Chapter)' },
    { value: 'manga-detail-top', shortLabel: 'Halaman Baca - Atas', label: 'Halaman Baca - Atas' },
    { value: 'manga-detail-bottom', shortLabel: 'Halaman Baca - Bawah', label: 'Halaman Baca - Bawah' },
  ];

  useEffect(() => {
    fetchAds();
  }, []);

  useEffect(() => {
    apiClient
      .getSettings()
      .then((value) => {
        const urls = Array.isArray(value?.redirect_script_urls)
          ? value.redirect_script_urls.filter((item) => typeof item === 'string')
          : [];
        setSettings({
          popup_ads_interval_minutes: value?.popup_ads_interval_minutes ?? 20,
          home_popup_interval_minutes: value?.home_popup_interval_minutes ?? 30,
          popup_ads_initial_delay_minutes: value?.popup_ads_initial_delay_minutes ?? 5,
          popup_ads_unlock_seconds: value?.popup_ads_unlock_seconds ?? 10,
          redirect_script_urls: urls.length
            ? urls
            : ['https://mbuh.my.id/siap/1770790072377-komiknesia.js'],
          cdn_domain: value?.cdn_domain ?? 'https://cdn.komiknesia.net',
        });
      })
      .catch(() => {});
  }, []);

  const updateRedirectScriptUrl = (index, nextValue) => {
    setSettings((prev) => {
      const nextUrls = [...(prev.redirect_script_urls || [])];
      nextUrls[index] = nextValue;
      return { ...prev, redirect_script_urls: nextUrls };
    });
  };

  const addRedirectScriptUrl = () => {
    setSettings((prev) => ({
      ...prev,
      redirect_script_urls: [...(prev.redirect_script_urls || []), ''],
    }));
  };

  const removeRedirectScriptUrl = (index) => {
    setSettings((prev) => {
      const nextUrls = [...(prev.redirect_script_urls || [])];
      nextUrls.splice(index, 1);
      return {
        ...prev,
        redirect_script_urls: nextUrls.length ? nextUrls : [''],
      };
    });
  };

  const fetchAds = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAds();
      setAds(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error('Error fetching ads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e, isEdit = false) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        if (isEdit) {
          setEditingAd((prev) => ({
            ...prev,
            image: file,
            imagePreview: reader.result,
          }));
        } else {
          setNewAd((prev) => ({
            ...prev,
            image: file,
            imagePreview: reader.result,
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
      formData.append('image_alt', newAd.image_alt || '');
      formData.append('title', newAd.title || '');
      formData.append('display_order', newAd.display_order ?? 0);
      if (newAd.expired_at) {
        formData.append('expired_at', newAd.expired_at);
      }

      await apiClient.createAd(formData);
      setNewAd({ 
        link_url: '', 
        ads_type: selectedTab !== 'all' ? selectedTab : 'popup',
        image: null,
        imagePreview: null,
        image_alt: '',
        title: '',
        expired_at: '',
        display_order: 0,
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
      formData.append('image_alt', data.image_alt ?? '');
      formData.append('title', data.title ?? '');
      formData.append('expired_at', data.expired_at || '');
      formData.append('display_order', data.display_order ?? 0);

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
    await handleUpdate(editingAd.id, editingAd);
  };

  const handleMoveOrder = async (ad, direction) => {
    const currentOrder = ad.display_order ?? 0;
    const newOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
    await handleUpdate(ad.id, { ...ad, display_order: newOrder });
  };

  const handleSaveSettings = async () => {
    setSettingsLoading(true);
    try {
      const payload = {
        popup_ads_interval_minutes: settings.popup_ads_interval_minutes,
        home_popup_interval_minutes: settings.home_popup_interval_minutes,
        popup_ads_initial_delay_minutes: settings.popup_ads_initial_delay_minutes,
        popup_ads_unlock_seconds: settings.popup_ads_unlock_seconds,
        redirect_script_urls: (settings.redirect_script_urls || [])
          .map((url) => (typeof url === 'string' ? url.trim() : ''))
          .filter(Boolean),
        cdn_domain: (settings.cdn_domain || '').trim(),
      };
      await apiClient.updateSettings(payload);
      alert('Pengaturan berhasil disimpan.');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Gagal menyimpan pengaturan.');
    } finally {
      setSettingsLoading(false);
    }
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
      ads_type: ad.ads_type || 'popup',
      image: null,
      imagePreview: getImageUrl(ad.image),
      image_alt: ad.image_alt ?? '',
      title: ad.title ?? '',
      expired_at: formatToInputString(ad.expired_at),
      display_order: ad.display_order ?? 0,
    });
  };

  const cancelEdit = () => {
    setEditingAd(null);
  };

  const filteredAds = selectedTab === 'all'
    ? ads
    : ads.filter((a) => a.ads_type === selectedTab);

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
          onClick={() => {
            setNewAd((prev) => ({
              ...prev,
              ads_type: selectedTab !== 'all' ? selectedTab : 'popup',
            }));
            setShowAddForm(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Tambah Iklan
        </button>
      </div>

      {/* Category Tab Selector (Mirip FeaturedManager) */}
      <div className="flex space-x-2 flex-wrap gap-2">
        <button
          onClick={() => setSelectedTab('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedTab === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Semua Slot
        </button>
        {adsTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => setSelectedTab(type.value)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedTab === type.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {type.shortLabel}
          </button>
        ))}
      </div>

      {/* Pengaturan popup ads & settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Pengaturan popup, CDN, dan redirect script
        </h4>
        <div className="space-y-4">
          <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Custom Domain CDN (Cloudflare R2)
            </label>
            <input
              type="text"
              value={settings.cdn_domain || ''}
              onChange={(e) => setSettings((prev) => ({ ...prev, cdn_domain: e.target.value }))}
              placeholder="https://cdn.komiknesia.net"
              className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Popup iklan — interval (menit)
              </label>
              <select
                value={settings.popup_ads_interval_minutes}
                onChange={(e) => setSettings((prev) => ({ ...prev, popup_ads_interval_minutes: Number(e.target.value) }))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {POPUP_INTERVAL_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m} menit</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Popup iklan — jeda awal (menit)
              </label>
              <select
                value={settings.popup_ads_initial_delay_minutes}
                onChange={(e) => setSettings((prev) => ({ ...prev, popup_ads_initial_delay_minutes: Number(e.target.value) }))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {POPUP_INITIAL_DELAY_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m} menit</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Popup iklan — durasi no skip (detik)
              </label>
              <select
                value={settings.popup_ads_unlock_seconds}
                onChange={(e) => setSettings((prev) => ({ ...prev, popup_ads_unlock_seconds: Number(e.target.value) }))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {POPUP_UNLOCK_SECONDS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s} detik</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Popup pengumuman Home — interval
              </label>
              <select
                value={settings.home_popup_interval_minutes}
                onChange={(e) => setSettings((prev) => ({ ...prev, home_popup_interval_minutes: Number(e.target.value) }))}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {POPUP_INTERVAL_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m} menit</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">
              Redirect script URL
            </label>
            <div className="space-y-2">
              {(settings.redirect_script_urls || []).map((url, index) => (
                <div key={`redirect-script-${index}`} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => updateRedirectScriptUrl(index, e.target.value)}
                    placeholder="https://example.com/script.js"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => removeRedirectScriptUrl(index)}
                    className="inline-flex items-center px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addRedirectScriptUrl}
              className="mt-2 inline-flex items-center px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4 mr-1" />
              Tambah Script URL
            </button>
          </div>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={settingsLoading}
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {settingsLoading ? 'Menyimpan...' : 'Simpan pengaturan'}
          </button>
        </div>
      </div>

      {/* Add Ad Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Tambah Iklan Baru - {adsTypes.find((t) => t.value === newAd.ads_type)?.label || newAd.ads_type}
          </h4>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Gambar / GIF Iklan *
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
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Alt Gambar / Title
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={newAd.image_alt}
                  onChange={(e) => setNewAd((prev) => ({ ...prev, image_alt: e.target.value }))}
                  placeholder="Alt text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <input
                  type="text"
                  value={newAd.title}
                  onChange={(e) => setNewAd((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="Title text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                URL Tautan
              </label>
              <input
                type="url"
                value={newAd.link_url}
                onChange={(e) => setNewAd((prev) => ({ ...prev, link_url: e.target.value }))}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Penempatan Iklan (Tipe) *
                </label>
                <select
                  value={newAd.ads_type}
                  onChange={(e) => setNewAd((prev) => ({ ...prev, ads_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                >
                  {adsTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Urutan Tampil
                </label>
                <input
                  type="number"
                  value={newAd.display_order}
                  onChange={(e) => setNewAd((prev) => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tanggal Expired
              </label>
              <input
                type="datetime-local"
                value={newAd.expired_at}
                onChange={(e) => setNewAd((prev) => ({ ...prev, expired_at: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={uploading}
                className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-2" />
                {uploading ? 'Menyimpan...' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="inline-flex items-center px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
              >
                <X className="h-4 w-4 mr-2" />
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ads List Table - [GIF - ALT/TITLE - URL - EXPIRED - CREATED - URUTAN - AKSI] */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  GIF
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ALT/TITLE
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  URL
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  EXPIRED
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  CREATED
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  URUTAN
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  AKSI
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAds.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Belum ada iklan di kategori ini. Klik &quot;Tambah Iklan&quot; untuk menambahkan.
                  </td>
                </tr>
              ) : (
                filteredAds.map((ad) => (
                  <tr key={ad.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    {/* 1. GIF / Image */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingAd && editingAd.id === ad.id ? (
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
                      ) : (
                        <div className="w-24 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          {ad.image ? (
                            <img 
                              src={getImageUrl(ad.image)} 
                              alt={ad.image_alt || ad.title || "Ad GIF"} 
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.target.src = '/broken-image.png';
                              }}
                            />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                      )}
                    </td>

                    {/* 2. ALT / TITLE */}
                    <td className="px-6 py-4 max-w-[200px]">
                      {editingAd && editingAd.id === ad.id ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={editingAd.image_alt}
                            onChange={(e) => setEditingAd((prev) => ({ ...prev, image_alt: e.target.value }))}
                            placeholder="Alt text"
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                          />
                          <input
                            type="text"
                            value={editingAd.title}
                            onChange={(e) => setEditingAd((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="Title text"
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                          />
                        </div>
                      ) : (
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          {ad.image_alt || ad.title ? (
                            <>
                              {ad.image_alt && <div className="font-medium text-gray-900 dark:text-gray-100">Alt: {ad.image_alt}</div>}
                              {ad.title && <div className="text-gray-500 dark:text-gray-400">Title: {ad.title}</div>}
                            </>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 3. URL */}
                    <td className="px-6 py-4">
                      {editingAd && editingAd.id === ad.id ? (
                        <input
                          type="url"
                          value={editingAd.link_url}
                          onChange={(e) => setEditingAd((prev) => ({ ...prev, link_url: e.target.value }))}
                          placeholder="https://example.com"
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                        />
                      ) : (
                        <div className="text-xs text-gray-900 dark:text-gray-100">
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

                    {/* 4. EXPIRED */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingAd && editingAd.id === ad.id ? (
                        <input
                          type="datetime-local"
                          value={editingAd.expired_at}
                          onChange={(e) => setEditingAd((prev) => ({ ...prev, expired_at: e.target.value }))}
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                        />
                      ) : (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatToLocaleString(ad.expired_at)}
                        </div>
                      )}
                    </td>

                    {/* 5. CREATED */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatToLocaleString(ad.created_at, true)}
                      </div>
                    </td>

                    {/* 6. URUTAN */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingAd && editingAd.id === ad.id ? (
                        <input
                          type="number"
                          value={editingAd.display_order ?? 0}
                          onChange={(e) => setEditingAd((prev) => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                          className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                        />
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {ad.display_order ?? 0}
                          </span>
                          <div className="flex flex-col space-y-0.5">
                            <button
                              onClick={() => handleMoveOrder(ad, 'up')}
                              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              title="Naikkan urutan"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleMoveOrder(ad, 'down')}
                              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              title="Turunkan urutan"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* 7. AKSI */}
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
