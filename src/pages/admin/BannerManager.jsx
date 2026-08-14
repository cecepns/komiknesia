import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, ArrowUp, ArrowDown, ExternalLink, Image as ImageIcon, Star } from 'lucide-react';
import { apiClient, getImageUrl } from '../../utils/api';
import LazyImage from '../../components/LazyImage';

const BannerManager = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  const [form, setForm] = useState({
    id: '',
    image: '',
    title: '',
    series: 'MANHWA',
    rating: '8.8',
    href: '',
    slug: '',
    is_active: true
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getSettings();
      if (res && Array.isArray(res.hero_banners)) {
        setBanners(res.hero_banners);
      }
    } catch (err) {
      console.error('Error fetching hero banners:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveBanners = async (updatedBanners) => {
    setSaving(true);
    try {
      await apiClient.updateSettings({ hero_banners: updatedBanners });
      setBanners(updatedBanners);
      alert('Hero Banners berhasil disimpan');
    } catch (err) {
      console.error('Error saving hero banners:', err);
      alert('Gagal menyimpan Hero Banners');
    } finally {
      setSaving(false);
    }
  };

  const handleAddOrUpdate = (e) => {
    e.preventDefault();
    if (!form.image || !form.title) {
      alert('URL Gambar dan Judul Banner wajib diisi');
      return;
    }

    const customId = form.id.trim();
    const generatedId = customId || (editingIndex !== null && banners[editingIndex]?.id ? banners[editingIndex].id : `banner_${Date.now()}`);

    const newBanner = {
      id: generatedId,
      image: form.image.trim(),
      title: form.title.trim(),
      series: form.series.trim().toUpperCase() || 'MANHWA',
      rating: parseFloat(form.rating) || 8.8,
      href: form.href.trim(),
      slug: form.slug.trim(),
      is_active: form.is_active
    };

    let updated = [];
    if (editingIndex !== null) {
      updated = [...banners];
      updated[editingIndex] = newBanner;
    } else {
      updated = [...banners, newBanner];
    }

    saveBanners(updated);
    resetForm();
  };

  const resetForm = () => {
    setEditingIndex(null);
    setForm({
      id: '',
      image: '',
      title: '',
      series: 'MANHWA',
      rating: '8.8',
      href: '',
      slug: '',
      is_active: true
    });
  };

  const handleEdit = (index) => {
    const item = banners[index];
    setEditingIndex(index);
    setForm({
      id: item.id || '',
      image: item.image || item.cover || '',
      title: item.title || '',
      series: item.series || 'MANHWA',
      rating: item.rating !== undefined ? String(item.rating) : '8.8',
      href: item.href || item.link || '',
      slug: item.slug || '',
      is_active: item.is_active !== undefined ? item.is_active : true
    });
  };

  const handleDelete = (index) => {
    if (!confirm('Apakah Anda yakin ingin menghapus banner ini?')) return;
    const updated = banners.filter((_, i) => i !== index);
    saveBanners(updated);
    if (editingIndex === index) resetForm();
  };

  const handleMove = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= banners.length) return;
    const updated = [...banners];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    saveBanners(updated);
  };

  const toggleActive = (index) => {
    const updated = [...banners];
    updated[index].is_active = !updated[index].is_active;
    saveBanners(updated);
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
        <p className="mt-4 text-gray-500">Memuat data banner...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Kelola Slider Banner Home
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kelola banner slider utama di Halaman Home (Input Gambar, Judul, Series, Rating, dan Link)
          </p>
        </div>
      </div>

      {/* Form Tambah/Edit */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          {editingIndex !== null ? 'Edit Banner' : 'Tambah Banner Baru'}
        </h4>

        <form onSubmit={handleAddOrUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                URL Gambar Banner *
              </label>
              <input
                type="text"
                value={form.image}
                onChange={(e) => setForm(prev => ({ ...prev, image: e.target.value }))}
                placeholder="https://... atau /uploads/..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Judul Banner *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="SINGLE DADDY"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Series / Tag (misal: MANHWA, MANGA, MANHUA)
              </label>
              <input
                type="text"
                value={form.series}
                onChange={(e) => setForm(prev => ({ ...prev, series: e.target.value }))}
                placeholder="MANHWA"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm uppercase"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Rating (misal: 8.8)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={form.rating}
                onChange={(e) => setForm(prev => ({ ...prev, rating: e.target.value }))}
                placeholder="8.8"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                URL Target / Link Href (misal: /komik/single-daddy atau https://...)
              </label>
              <input
                type="text"
                value={form.href}
                onChange={(e) => setForm(prev => ({ ...prev, href: e.target.value }))}
                placeholder="/komik/single-daddy"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Slug Manga (Opsional, untuk link detail komik)
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="single-daddy"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center space-x-6 pt-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Banner Aktif</span>
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            {editingIndex !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors text-sm font-semibold"
              >
                Batal
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-sm transition-colors text-sm disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {editingIndex !== null ? 'Simpan Perubahan' : 'Tambah Banner'}
            </button>
          </div>
        </form>
      </div>

      {/* Preview & List Banners */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h4 className="font-bold text-gray-900 dark:text-gray-100">
            Daftar Banner Slider ({banners.length})
          </h4>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {banners.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              Belum ada banner yang ditambahkan.
            </div>
          ) : (
            banners.map((item, index) => (
              <div key={item.id || index} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
                  <div className="flex flex-col space-y-1">
                    <button
                      type="button"
                      disabled={index === 0 || saving}
                      onClick={() => handleMove(index, -1)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={index === banners.length - 1 || saving}
                      onClick={() => handleMove(index, 1)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Thumbnail Preview */}
                  <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-gray-900 border border-gray-700">
                    <LazyImage
                      src={getImageUrl(item.image || item.cover)}
                      alt={item.title}
                      className="h-full w-full object-cover"
                      wrapperClassName="h-full w-full"
                    />
                    <div className="absolute top-1 left-1 bg-red-600 px-1 py-0.2 text-[9px] font-black text-white rounded">
                      {item.series || 'MANHWA'}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 dark:text-gray-100">
                        {item.title}
                      </span>
                      {item.rating && (
                        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded bg-amber-400 text-amber-950 font-bold">
                          <Star className="h-3 w-3 fill-amber-950" /> {item.rating}
                        </span>
                      )}
                      {!item.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          Nonaktif
                        </span>
                      )}
                    </div>
                    {(item.href || item.slug) && (
                      <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                        Link: {item.href || `/komik/${item.slug}`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => toggleActive(index)}
                    className={`px-3 py-1 text-xs rounded-lg font-medium transition-colors ${
                      item.is_active
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {item.is_active ? 'Aktif' : 'Nonaktif'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(index)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(index)}
                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default BannerManager;
