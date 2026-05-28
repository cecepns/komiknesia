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
    imagePreview: null,
    image_alt: '',
    title: ''
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [settings, setSettings] = useState({
    popup_ads_interval_minutes: 20,
    home_popup_interval_minutes: 30,
    popup_ads_initial_delay_minutes: 5,
    popup_ads_unlock_seconds: 10,
    redirect_script_urls: ['https://mbuh.my.id/siap/1770790072377-komiknesia.js'],
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  const POPUP_INTERVAL_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
  const POPUP_INITIAL_DELAY_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 30];
  const POPUP_UNLOCK_SECONDS_OPTIONS = [5, 10, 15, 20, 30, 45, 60];

  /**
   * Tipe iklan (`ads_type`) + label untuk dropdown & dokumentasi brief klien.
   * Halaman detail/sinopsis: `src/pages/MangaDetail.jsx` — area baca: `src/pages/ChapterReader.jsx`
   */
  const adsTypes = [
    {
      value: 'popup',
      clientNos: '1',
      label: '(1) Popup iklan (no skip, interval)',
      brief: 'PopUp no skip — muncul di banyak halaman (KomikNesia-style).',
      file: 'src/components/AdPopup.jsx',
      notes: 'Interval: pengaturan "Popup Iklan" di bawah. Tidak di admin/login.',
    },
    {
      value: 'home-popup',
      clientNos: '2',
      label: '(2) Popup pemberitahuan (Home)',
      brief: 'Popup / banner pengumuman khusus Home.',
      file: 'src/pages/Home.jsx',
      notes: 'Interval: "Popup Pengumuman (Home)".',
    },
    {
      value: 'floating-fixed-top',
      clientNos: '3',
      label: '(3) Float atas (bawah header)',
      brief: 'Di bawah logo & pencarian; semua halaman kecuali area baca (ideal).',
      file: 'src/components/Layout.jsx → FloatingFixedAd',
      notes:
        'Rute `<Layout>` + halaman detail `/komik/:slug` (MangaDetail.jsx) memuat float ini. `/view/:chapterSlug` (ChapterReader, area baca) belum — sesuai brief hindari float di area baca.',
    },
    {
      value: 'floating-fixed-bottom',
      clientNos: '4',
      label: '(4) Float bawah (di atas nav)',
      brief: 'Di atas logo navigasi bawah; semua halaman kecuali area baca (ideal).',
      file: 'src/components/Layout.jsx → FloatingFixedAd',
      notes: 'Aturan penayangan sama seperti (3) (Layout + MangaDetail).',
    },
    {
      value: 'home-top',
      clientNos: '5',
      label: '(5) Home header',
      brief: 'Paling atas konten beranda (setelah header).',
      file: 'src/pages/Home.jsx',
      notes: null,
    },
    {
      value: 'project-top',
      clientNos: '6',
      label: '(6) Atas Projek (Home)',
      brief: 'Di atas section Project di beranda.',
      file: 'src/components/ProjectSection.jsx',
      notes: 'Tipe lama `new-update` diganti; pindahkan iklan ke slot ini jika masih pakai key lama.',
    },
    {
      value: 'update-top',
      clientNos: '7',
      label: '(7) Atas Update Terbaru (Home)',
      brief: 'Di atas section Terbaru di beranda.',
      file: 'src/components/UpdateSection.jsx',
      notes: null,
    },
    {
      value: 'populer',
      clientNos: '8',
      label: '(8) Atas Populer (Home)',
      brief: 'Di halaman Home, sebelum section Populer.',
      file: 'src/pages/Home.jsx',
      notes: 'Bukan halaman `/populer` terpisah.',
    },
    {
      value: 'home-footer',
      clientNos: '9',
      label: '(9) Home footer',
      brief: 'Paling bawah halaman Home.',
      file: 'src/pages/Home.jsx',
      notes: null,
    },
    {
      value: 'popular-top',
      clientNos: '10',
      label: '(10) Populer header',
      brief: 'Di halaman atas Populer (/populer).',
      file: 'src/pages/Popular.jsx',
      notes: null,
    },
    {
      value: 'popular-footer',
      clientNos: '11',
      label: '(11) Populer footer',
      brief: 'Di halaman bawah Populer (/populer).',
      file: 'src/pages/Popular.jsx',
      notes: null,
    },
    {
      value: 'library-top',
      clientNos: '12',
      label: '(12) Library header',
      brief: 'Atas halaman Library.',
      file: 'src/pages/Library.jsx',
      notes: null,
    },
    {
      value: 'library-footer',
      clientNos: '13',
      label: '(13) Library footer',
      brief: 'Di halaman bawah Library.',
      file: 'src/pages/Library.jsx',
      notes: null,
    },
    {
      value: 'comic-top',
      clientNos: '14',
      label: '(14) Genre / daftar komik header',
      brief: 'Atas halaman daftar komik (filter genre).',
      file: 'src/pages/Content.jsx',
      notes: null,
    },
    {
      value: 'comic-footer',
      clientNos: '15',
      label: '(15) Genre / daftar komik footer',
      brief: 'Di halaman daftar komik bagian bawah.',
      file: 'src/pages/Content.jsx',
      notes: null,
    },
    {
      value: 'chapter-top',
      clientNos: '16',
      label: '(16) Sinopsis / detail — header',
      brief: 'Atas konten detail komik (sinopsis/info).',
      file: 'src/pages/MangaDetail.jsx',
      notes: 'Di kode dinamai chapter-top; posisi atas main detail.',
    },
    {
      value: 'list-chapter',
      clientNos: '17',
      label: '(17) Sinopsis — middle (atas list chapter)',
      brief: 'Di atas daftar chapter (tab Chapters).',
      file: 'src/pages/MangaDetail.jsx',
      notes: null,
    },
    {
      value: 'top-upvote',
      clientNos: '18',
      label: '(18) Sinopsis — footer (atas reaksi)',
      brief: 'Bawah daftar chapter, di atas blok reaksi / vote.',
      file: 'src/pages/MangaDetail.jsx',
      notes: 'Nama key `top-upvote` (legacy); fungsi = slot bawah sebelum reaksi.',
    },
    {
      value: 'manga-detail-top',
      clientNos: '19',
      label: '(19) Area baca — header',
      brief: 'Halaman baca chapter — bagian atas.',
      file: 'src/pages/ChapterReader.jsx',
      notes:
        'Key `manga-detail-*` dipakai di reader (bukan MangaDetail). Nonaktif jika user premium sesuai logic reader.',
    },
    {
      value: 'manga-detail-bottom',
      clientNos: '20',
      label: '(20) Area baca — footer',
      brief: 'Halaman baca chapter — bagian bawah.',
      file: 'src/pages/ChapterReader.jsx',
      notes: 'Sama seperti (19) untuk premium / penamaan.',
    },
  ];

  const placementGuideRows = adsTypes.map((t) => ({ kind: 'ad', ...t }));

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
      formData.append('image_alt', newAd.image_alt || '');
      formData.append('title', newAd.title || '');

      await apiClient.createAd(formData);
      setNewAd({ 
        link_url: '', 
        ads_type: 'home-top',
        image: null,
        imagePreview: null,
        image_alt: '',
        title: ''
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
      image: editingAd.image,
      image_alt: editingAd.image_alt ?? '',
      title: editingAd.title ?? ''
    };
    
    await handleUpdate(editingAd.id, updated);
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
      };
      await apiClient.updateSettings(payload);
      alert('Pengaturan popup disimpan.');
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
      ads_type: ad.ads_type || 'home-top',
      image: null,
      imagePreview: getImageUrl(ad.image),
      image_alt: ad.image_alt ?? '',
      title: ad.title ?? ''
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

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg p-4 text-sm text-amber-950 dark:text-amber-100/95">
        <p className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
          Referensi halaman (internal)
        </p>
        <ul className="list-disc pl-5 space-y-0.5 text-amber-900/90 dark:text-amber-100/85">
          <li>
            <span className="font-medium">Detail / sinopsis komik:</span>{' '}
            <code className="rounded bg-amber-100/80 dark:bg-black/30 px-1">src/pages/MangaDetail.jsx</code>
          </li>
          <li>
            <span className="font-medium">Area baca chapter:</span>{' '}
            <code className="rounded bg-amber-100/80 dark:bg-black/30 px-1">src/pages/ChapterReader.jsx</code>
          </li>
        </ul>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/80">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Peta brief klien ↔ tipe iklan (<code className="text-xs">ads_type</code>)
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Angka mengikuti urutan permintaan klien. Baris dengan latar berbeda = belum ada key backend / belum dipasang di UI.
          </p>
        </div>
        <div className="overflow-x-auto max-h-[min(70vh,520px)] overflow-y-auto">
          <table className="min-w-full text-xs sm:text-sm divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-[1]">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  No
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 min-w-[140px]">
                  Ringkasan klien
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  ads_type
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 min-w-[180px]">
                  File
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300 min-w-[200px]">
                  Catatan
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {placementGuideRows.map((row, idx) =>
                row.kind === 'gap' ? (
                  <tr
                    key={`placement-gap-${idx}`}
                    className="bg-amber-50/90 dark:bg-amber-950/25 text-amber-950 dark:text-amber-50/95"
                  >
                    <td className="px-3 py-2 align-top font-mono whitespace-nowrap">{row.clientNos}</td>
                    <td className="px-3 py-2 align-top">{row.brief}</td>
                    <td className="px-3 py-2 align-top text-gray-500 dark:text-gray-400">—</td>
                    <td className="px-3 py-2 align-top">
                      <code className="text-[11px] sm:text-xs break-all">{row.file}</code>
                    </td>
                    <td className="px-3 py-2 align-top text-gray-700 dark:text-gray-300">{row.notes}</td>
                  </tr>
                ) : (
                  <tr key={row.value} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <td className="px-3 py-2 align-top font-mono whitespace-nowrap">{row.clientNos}</td>
                    <td className="px-3 py-2 align-top text-gray-800 dark:text-gray-200">{row.brief}</td>
                    <td className="px-3 py-2 align-top">
                      <code className="rounded bg-gray-100 dark:bg-gray-900 px-1.5 py-0.5 text-[11px] sm:text-xs">
                        {row.value}
                      </code>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <code className="text-[11px] sm:text-xs break-all text-gray-700 dark:text-gray-300">
                        {row.file}
                      </code>
                    </td>
                    <td className="px-3 py-2 align-top text-gray-600 dark:text-gray-400">
                      {row.notes || '—'}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pengaturan interval popup ads & popup pengumuman */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
          Pengaturan popup dan redirect script
        </h4>
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              (1) Popup iklan — interval antar slot
            </label>
            <select
              value={settings.popup_ads_interval_minutes}
              onChange={(e) => setSettings(prev => ({ ...prev, popup_ads_interval_minutes: Number(e.target.value) }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {POPUP_INTERVAL_OPTIONS.map((m) => (
                <option key={m} value={m}>{m} menit</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              (1b) Popup iklan — jeda pertama kali buka
            </label>
            <select
              value={settings.popup_ads_initial_delay_minutes}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  popup_ads_initial_delay_minutes: Number(e.target.value),
                }))
              }
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {POPUP_INITIAL_DELAY_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} menit
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              (1c) Popup iklan — durasi no skip (detik)
            </label>
            <select
              value={settings.popup_ads_unlock_seconds}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  popup_ads_unlock_seconds: Number(e.target.value),
                }))
              }
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {POPUP_UNLOCK_SECONDS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s} detik
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              (2) Popup pengumuman / pemberitahuan — khusus Home
            </label>
            <select
              value={settings.home_popup_interval_minutes}
              onChange={(e) => setSettings(prev => ({ ...prev, home_popup_interval_minutes: Number(e.target.value) }))}
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
              Redirect script URL (bisa lebih dari 1, dijalankan 5 menit setelah user masuk)
            </label>
            <div className="space-y-2">
              {(settings.redirect_script_urls || []).map((url, index) => (
                <div key={`redirect-script-${index}`} className="flex items-center gap-2">
                  <input
                    type="url"
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
                Alt Gambar
              </label>
              <input
                type="text"
                value={newAd.image_alt}
                onChange={(e) => setNewAd(prev => ({ ...prev, image_alt: e.target.value }))}
                placeholder="Teks alternatif untuk aksesibilitas"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title
              </label>
              <input
                type="text"
                value={newAd.title}
                onChange={(e) => setNewAd(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Title untuk tooltip/link"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
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
                    imagePreview: null,
                    image_alt: '',
                    title: ''
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
                  Alt / Title
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
                  <td colSpan="6" className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
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
                    <td className="px-6 py-4 max-w-[180px]">
                      {editingAd && editingAd.id === ad.id ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={editingAd.image_alt}
                            onChange={(e) => setEditingAd(prev => ({ ...prev, image_alt: e.target.value }))}
                            placeholder="Alt"
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                          />
                          <input
                            type="text"
                            value={editingAd.title}
                            onChange={(e) => setEditingAd(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Title"
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                          />
                        </div>
                      ) : (
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {ad.image_alt || ad.title ? (
                            <>
                              {ad.image_alt && <div>Alt: {ad.image_alt}</div>}
                              {ad.title && <div>Title: {ad.title}</div>}
                            </>
                          ) : (
                            <span className="text-gray-400">-</span>
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

