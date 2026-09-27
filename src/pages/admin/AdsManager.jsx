import { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  X, 
  PencilIcon, 
  Image as ImageIcon, 
  ArrowUp, 
  ArrowDown, 
  Video, 
  Globe, 
  Smartphone, 
  Monitor,
  Film
} from 'lucide-react';
import { apiClient, getImageUrl, formatToInputString, formatToLocaleString } from '../../utils/api';

const AdsManager = () => {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('all');
  const [selectedPlatform, setSelectedPlatform] = useState('all'); // 'all' | 'web' | 'mobile' | 'both'
  const [editingAd, setEditingAd] = useState(null);
  
  // Default newAd: target_platform 'web' terselect by default
  const [newAd, setNewAd] = useState({ 
    link_url: '', 
    ads_type: 'popup',
    target_platform: 'web', // Default yang web terselect!
    media_type: 'image', // 'image' | 'video'
    video_url: '',
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

  const PLATFORM_OPTIONS = [
    { value: 'web', label: 'Web Saja', shortLabel: 'Web', icon: Globe, desc: 'Tampil di website komiknesia.id' },
    { value: 'mobile', label: 'Mobile Saja', shortLabel: 'Mobile', icon: Smartphone, desc: 'Tampil di aplikasi mobile Android/iOS' },
    { value: 'both', label: 'Keduanya (Web & Mobile)', shortLabel: 'Web & Mobile', icon: Monitor, desc: 'Tampil di website dan aplikasi mobile' },
  ];

  /**
   * List penempatan iklan banner & video lengkap.
   */
  const adsTypes = [
    { value: 'popup', shortLabel: 'PopUp No Skip', label: 'PopUp No Skip' },
    { value: 'home-popup', shortLabel: 'PopUp Pengumuman', label: 'PopUp Pengumuman' },
    // Tipe Video Ads baru
    { value: 'video', shortLabel: 'Video In-Stream', label: '🎬 Video Ads (In-Stream / Video Player)' },
    { value: 'popup-video', shortLabel: 'PopUp Video', label: '🎬 PopUp Video Ads (No Skip Video)' },
    { value: 'reward-video', shortLabel: 'Reward Video', label: '🎬 Video Reward Ads (Kelipatan Chapter)' },
    // Banner standard
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

  const handleMediaFileChange = (e, isEdit = false) => {
    const file = e.target.files[0];
    if (file) {
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      if (!isImage && !isVideo) {
        alert('Format file tidak didukung. Pilih file gambar atau video (MP4, WebM, GIF, JPG, PNG).');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        alert('Ukuran file maksimal 50MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const previewUrl = reader.result;
        if (isEdit) {
          setEditingAd((prev) => ({
            ...prev,
            image: file,
            imagePreview: previewUrl,
            media_type: isVideo ? 'video' : prev.media_type || 'image',
          }));
        } else {
          setNewAd((prev) => ({
            ...prev,
            image: file,
            imagePreview: previewUrl,
            media_type: isVideo ? 'video' : prev.media_type || 'image',
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newAd.image && !newAd.video_url?.trim()) {
      alert('Silakan pilih file gambar/video atau masukkan URL video');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      if (newAd.image) {
        formData.append('image', newAd.image);
      }
      formData.append('link_url', newAd.link_url || '');
      formData.append('ads_type', newAd.ads_type);
      formData.append('target_platform', newAd.target_platform || 'web');
      formData.append('media_type', newAd.media_type || (newAd.video_url ? 'video' : 'image'));
      formData.append('video_url', newAd.video_url ? newAd.video_url.trim() : '');
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
        target_platform: 'web', // Reset tetap default web
        media_type: 'image',
        video_url: '',
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
      formData.append('target_platform', data.target_platform || 'web');
      formData.append('media_type', data.media_type || (data.video_url ? 'video' : 'image'));
      formData.append('video_url', data.video_url ? data.video_url.trim() : '');
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

  const isVideoAd = (ad) => {
    if (!ad) return false;
    if (ad.media_type === 'video') return true;
    if (ad.video_url && ad.video_url.trim()) return true;
    if (ad.ads_type === 'video' || ad.ads_type === 'popup-video' || ad.ads_type === 'reward-video') return true;
    if (typeof ad.image === 'string' && ad.image.match(/\.(mp4|webm|ogg|mov)$/i)) return true;
    return false;
  };

  const startEdit = (ad) => {
    const videoFlag = isVideoAd(ad);
    setEditingAd({
      id: ad.id,
      link_url: ad.link_url || '',
      ads_type: ad.ads_type || 'popup',
      target_platform: ad.target_platform || 'web', // default web jika kosong
      media_type: videoFlag ? 'video' : 'image',
      video_url: ad.video_url || '',
      image: null,
      imagePreview: ad.image ? getImageUrl(ad.image) : null,
      image_alt: ad.image_alt ?? '',
      title: ad.title ?? '',
      expired_at: formatToInputString(ad.expired_at),
      display_order: ad.display_order ?? 0,
    });
  };

  const cancelEdit = () => {
    setEditingAd(null);
  };

  // Filter gabungan Slot dan Platform
  const filteredAds = ads.filter((ad) => {
    // 1. Filter Slot Ads
    if (selectedTab !== 'all' && ad.ads_type !== selectedTab) {
      return false;
    }
    // 2. Filter Platform
    if (selectedPlatform !== 'all') {
      const platform = (ad.target_platform || 'web').toLowerCase();
      if (selectedPlatform === 'web' && platform !== 'web') return false;
      if (selectedPlatform === 'mobile' && platform !== 'mobile') return false;
      if (selectedPlatform === 'both' && platform !== 'both' && platform !== 'keduanya') return false;
    }
    return true;
  });

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
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Manajemen Iklan
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Kelola penempatan banner, popup, dan video ads untuk Web & Mobile
          </p>
        </div>
        <button
          onClick={() => {
            setNewAd((prev) => ({
              ...prev,
              ads_type: selectedTab !== 'all' ? selectedTab : 'popup',
              target_platform: selectedPlatform !== 'all' ? selectedPlatform : 'web',
            }));
            setShowAddForm(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium text-sm shadow-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Tambah Iklan
        </button>
      </div>

      {/* FILTER 1: Target Platform (Web, Mobile, Keduanya) */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Target Platform:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedPlatform('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedPlatform === 'all'
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                Semua Platform ({ads.length})
              </button>

              <button
                type="button"
                onClick={() => setSelectedPlatform('web')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedPlatform === 'web'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                Khusus Web ({ads.filter((a) => (a.target_platform || 'web') === 'web').length})
              </button>

              <button
                type="button"
                onClick={() => setSelectedPlatform('mobile')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedPlatform === 'mobile'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Khusus Mobile ({ads.filter((a) => a.target_platform === 'mobile').length})
              </button>

              <button
                type="button"
                onClick={() => setSelectedPlatform('both')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedPlatform === 'both'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                Keduanya (Web & Mobile) ({ads.filter((a) => a.target_platform === 'both' || a.target_platform === 'keduanya').length})
              </button>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Menampilkan: <span className="font-bold text-gray-700 dark:text-gray-200">{filteredAds.length}</span> iklan
          </div>
        </div>

        {/* FILTER 2: Slot Kategori */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex space-x-1.5 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedTab('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
              selectedTab === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Semua Slot
          </button>
          {adsTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setSelectedTab(type.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                selectedTab === type.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {type.shortLabel}
            </button>
          ))}
        </div>
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

      {/* Add Ad Form Modal / Card */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-primary-500/20 p-6">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
            <div>
              <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Tambah Iklan Baru
              </h4>
              <p className="text-xs text-gray-500">
                Konfigurasikan target platform (Web/Mobile) dan tipe media (Gambar/Video)
              </p>
            </div>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleCreate} className="space-y-5">
            {/* 1. Target Platform Selection (Default Web terselect) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                1. Target Platform Iklan * (Default: Web)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {PLATFORM_OPTIONS.map((opt) => {
                  const isSelected = (newAd.target_platform || 'web') === opt.value;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewAd((prev) => ({ ...prev, target_platform: opt.value }))}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20 ring-2 ring-primary-500/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-bold ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-gray-100'}`}>
                            {opt.label}
                          </span>
                          {opt.value === 'web' && (
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {opt.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Format Media: Gambar vs Video */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  2. Format Media *
                </label>
                <div className="inline-flex rounded-lg p-0.5 bg-gray-100 dark:bg-gray-700">
                  <button
                    type="button"
                    onClick={() => setNewAd((prev) => ({ ...prev, media_type: 'image' }))}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      newAd.media_type !== 'video'
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    🖼️ Gambar / GIF
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewAd((prev) => ({ ...prev, media_type: 'video' }))}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                      newAd.media_type === 'video'
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    🎬 Video Ads
                  </button>
                </div>
              </div>

              {/* Media Upload & Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    {newAd.imagePreview ? (
                      newAd.media_type === 'video' ? (
                        <video 
                          src={newAd.imagePreview} 
                          controls 
                          muted 
                          className="w-full h-full object-contain rounded-lg bg-black"
                        />
                      ) : (
                        <img 
                          src={newAd.imagePreview} 
                          alt="Preview" 
                          className="w-full h-full object-contain rounded-lg p-1"
                        />
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 text-center">
                        {newAd.media_type === 'video' ? (
                          <Film className="w-10 h-10 mb-2 text-primary-500 animate-pulse" />
                        ) : (
                          <ImageIcon className="w-10 h-10 mb-2 text-gray-400" />
                        )}
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                          {newAd.media_type === 'video' ? 'Upload Video Iklan' : 'Upload Banner / GIF'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {newAd.media_type === 'video' ? 'Format MP4, WebM (Maks. 50MB)' : 'Format PNG, JPG, GIF, WebP (Maks. 5MB)'}
                        </p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept={newAd.media_type === 'video' ? 'video/*,image/*' : 'image/*'}
                      onChange={(e) => handleMediaFileChange(e, false)}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="space-y-3">
                  {newAd.media_type === 'video' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        Atau URL Video Langsung (Opsional)
                      </label>
                      <input
                        type="url"
                        value={newAd.video_url || ''}
                        onChange={(e) => setNewAd((prev) => ({ ...prev, video_url: e.target.value }))}
                        placeholder="https://domain.com/video.mp4"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        Bisa menggunakan direct link MP4 CDN atau streaming URL
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Alt Gambar / Judul Iklan
                    </label>
                    <input
                      type="text"
                      value={newAd.title}
                      onChange={(e) => setNewAd((prev) => ({ ...prev, title: e.target.value, image_alt: e.target.value }))}
                      placeholder="Judul kampanye iklan..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      URL Tautan Tujuan (Klik Iklan)
                    </label>
                    <input
                      type="url"
                      value={newAd.link_url}
                      onChange={(e) => setNewAd((prev) => ({ ...prev, link_url: e.target.value }))}
                      placeholder="https://landingpage.com"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Slot Penempatan, Urutan, dan Expired */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Slot Penempatan *
                </label>
                <select
                  value={newAd.ads_type}
                  onChange={(e) => setNewAd((prev) => ({ ...prev, ads_type: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Urutan Tampil (Priority)
                </label>
                <input
                  type="number"
                  value={newAd.display_order}
                  onChange={(e) => setNewAd((prev) => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                  Tanggal Expired (Opsional)
                </label>
                <input
                  type="datetime-local"
                  value={newAd.expired_at}
                  onChange={(e) => setNewAd((prev) => ({ ...prev, expired_at: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex space-x-3 pt-2">
              <button
                type="submit"
                disabled={uploading}
                className="inline-flex items-center px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-semibold text-sm disabled:opacity-50 shadow-sm"
              >
                <Save className="h-4 w-4 mr-2" />
                {uploading ? 'Menyimpan Iklan...' : 'Simpan Iklan'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="inline-flex items-center px-4 py-2.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm font-medium"
              >
                <X className="h-4 w-4 mr-1.5" />
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ads List Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/60">
              <tr>
                <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Media Iklan
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Platform
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Slot Iklan
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Judul / Alt
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  URL Tujuan
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Expired
                </th>
                <th className="px-3 py-3.5 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Urutan
                </th>
                <th className="px-5 py-3.5 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAds.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    Tidak ada iklan yang cocok dengan filter. Klik &quot;Tambah Iklan&quot; untuk menambahkan.
                  </td>
                </tr>
              ) : (
                filteredAds.map((ad) => {
                  const isEditingThis = editingAd && editingAd.id === ad.id;
                  const adIsVideo = isVideoAd(ad);
                  const targetPlat = (ad.target_platform || 'web').toLowerCase();

                  return (
                    <tr key={ad.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                      {/* 1. Media Preview (Image or Video) */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {isEditingThis ? (
                          <div className="space-y-1.5">
                            <label className="flex flex-col items-center justify-center w-28 h-20 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                              {editingAd.imagePreview ? (
                                editingAd.media_type === 'video' ? (
                                  <video 
                                    src={editingAd.imagePreview} 
                                    className="w-full h-full object-cover rounded-lg bg-black"
                                  />
                                ) : (
                                  <img 
                                    src={editingAd.imagePreview} 
                                    alt="Preview" 
                                    className="w-full h-full object-contain rounded-lg"
                                  />
                                )
                              ) : (
                                <ImageIcon className="w-6 h-6 text-gray-400" />
                              )}
                              <input
                                type="file"
                                accept={editingAd.media_type === 'video' ? 'video/*,image/*' : 'image/*'}
                                onChange={(e) => handleMediaFileChange(e, true)}
                                className="hidden"
                              />
                            </label>
                            {editingAd.media_type === 'video' && (
                              <input
                                type="url"
                                value={editingAd.video_url || ''}
                                onChange={(e) => setEditingAd((prev) => ({ ...prev, video_url: e.target.value }))}
                                placeholder="Video URL..."
                                className="w-28 text-[11px] px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                              />
                            )}
                          </div>
                        ) : (
                          <div className="relative w-28 h-18 rounded-lg overflow-hidden bg-gray-950 flex items-center justify-center border border-gray-200 dark:border-gray-700 shadow-sm">
                            {adIsVideo ? (
                              <div className="relative w-full h-full flex items-center justify-center">
                                <video 
                                  src={ad.video_url || (ad.image ? getImageUrl(ad.image) : '')} 
                                  className="w-full h-full object-cover"
                                  muted
                                  playsInline
                                />
                                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-amber-400 flex items-center gap-1">
                                  <Video className="w-2.5 h-2.5" />
                                  VIDEO
                                </div>
                              </div>
                            ) : ad.image ? (
                              <img 
                                src={getImageUrl(ad.image)} 
                                alt={ad.image_alt || ad.title || "Ad Banner"} 
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  e.target.src = '/broken-image.png';
                                }}
                              />
                            ) : (
                              <ImageIcon className="w-6 h-6 text-gray-500" />
                            )}
                          </div>
                        )}
                      </td>

                      {/* 2. Platform (Web / Mobile / Both) */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isEditingThis ? (
                          <select
                            value={editingAd.target_platform || 'web'}
                            onChange={(e) => setEditingAd((prev) => ({ ...prev, target_platform: e.target.value }))}
                            className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold"
                          >
                            <option value="web">🌐 Web Saja</option>
                            <option value="mobile">📱 Mobile Saja</option>
                            <option value="both">👑 Keduanya</option>
                          </select>
                        ) : (
                          <div>
                            {targetPlat === 'mobile' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                <Smartphone className="w-3 h-3" />
                                Mobile
                              </span>
                            ) : targetPlat === 'both' || targetPlat === 'keduanya' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                <Monitor className="w-3 h-3" />
                                Keduanya
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                <Globe className="w-3 h-3" />
                                Web Saja
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 3. Slot Iklan (Tipe) */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {isEditingThis ? (
                          <select
                            value={editingAd.ads_type}
                            onChange={(e) => setEditingAd((prev) => ({ ...prev, ads_type: e.target.value }))}
                            className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium"
                          >
                            {adsTypes.map((t) => (
                              <option key={t.value} value={t.value}>{t.shortLabel}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                            {adsTypes.find((t) => t.value === ad.ads_type)?.shortLabel || ad.ads_type}
                          </span>
                        )}
                      </td>

                      {/* 4. Judul / Alt */}
                      <td className="px-4 py-3.5 max-w-[180px]">
                        {isEditingThis ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={editingAd.title}
                              onChange={(e) => setEditingAd((prev) => ({ ...prev, title: e.target.value, image_alt: e.target.value }))}
                              placeholder="Judul iklan"
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                            />
                          </div>
                        ) : (
                          <div className="text-xs">
                            <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {ad.title || ad.image_alt || '-'}
                            </div>
                            {adIsVideo && (
                              <span className="text-[10px] text-amber-500 font-bold uppercase">
                                Format: Video
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 5. URL Link */}
                      <td className="px-4 py-3.5">
                        {isEditingThis ? (
                          <input
                            type="url"
                            value={editingAd.link_url}
                            onChange={(e) => setEditingAd((prev) => ({ ...prev, link_url: e.target.value }))}
                            placeholder="https://example.com"
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                          />
                        ) : (
                          <div className="text-xs">
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

                      {/* 6. Expired */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                        {isEditingThis ? (
                          <input
                            type="datetime-local"
                            value={editingAd.expired_at}
                            onChange={(e) => setEditingAd((prev) => ({ ...prev, expired_at: e.target.value }))}
                            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                          />
                        ) : (
                          formatToLocaleString(ad.expired_at)
                        )}
                      </td>

                      {/* 7. Urutan */}
                      <td className="px-3 py-3.5 whitespace-nowrap text-center">
                        {isEditingThis ? (
                          <input
                            type="number"
                            value={editingAd.display_order ?? 0}
                            onChange={(e) => setEditingAd((prev) => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                            className="w-14 text-center px-1.5 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                          />
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                              {ad.display_order ?? 0}
                            </span>
                            <div className="flex flex-col">
                              <button
                                onClick={() => handleMoveOrder(ad, 'up')}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                title="Naikkan urutan"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleMoveOrder(ad, 'down')}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                title="Turunkan urutan"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 8. Aksi */}
                      <td className="px-5 py-3.5 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {isEditingThis ? (
                            <>
                              <button
                                onClick={handleSaveEdit}
                                disabled={uploading}
                                className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 disabled:opacity-50"
                                title="Simpan"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={uploading}
                                className="p-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 disabled:opacity-50"
                                title="Batal"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(ad)}
                                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                                title="Edit Iklan"
                              >
                                <PencilIcon className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(ad.id)}
                                className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                                title="Hapus Iklan"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

export default AdsManager;
