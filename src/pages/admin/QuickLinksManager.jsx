import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, ArrowUp, ArrowDown, ExternalLink, Link2 } from 'lucide-react';
import { apiClient } from '../../utils/api';

const AVAILABLE_ICONS = [
  { value: 'BookOpen', label: 'Book / Manga' },
  { value: 'Crown', label: 'Crown / Premium' },
  { value: 'Discord', label: 'Discord' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'TikTok', label: 'TikTok' },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'Download', label: 'Download / App' },
  { value: 'Heart', label: 'Heart / Donasi' },
  { value: 'Share2', label: 'Share' },
  { value: 'ExternalLink', label: 'External Link' },
];

const QuickLinksManager = () => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    href: '',
    icon: 'ExternalLink',
    badge: '',
    is_active: true,
    is_internal: false
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getSettings();
      if (res && Array.isArray(res.quick_links)) {
        setLinks(res.quick_links);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveQuickLinks = async (updatedLinks) => {
    setSaving(true);
    try {
      await apiClient.updateSettings({ quick_links: updatedLinks });
      setLinks(updatedLinks);
      alert('Quick Links berhasil disimpan');
    } catch (err) {
      console.error('Error saving quick links:', err);
      alert('Gagal menyimpan Quick Links');
    } finally {
      setSaving(false);
    }
  };

  const handleAddOrUpdate = (e) => {
    e.preventDefault();
    if (!form.title || !form.href) {
      alert('Judul dan URL link harus diisi');
      return;
    }

    const newLink = {
      id: editingIndex !== null && links[editingIndex]?.id ? links[editingIndex].id : `link_${Date.now()}`,
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      href: form.href.trim(),
      icon: form.icon,
      badge: form.badge.trim() || undefined,
      is_active: form.is_active,
      is_internal: form.is_internal
    };

    let updated = [];
    if (editingIndex !== null) {
      updated = [...links];
      updated[editingIndex] = newLink;
    } else {
      updated = [...links, newLink];
    }

    saveQuickLinks(updated);
    resetForm();
  };

  const resetForm = () => {
    setEditingIndex(null);
    setForm({
      title: '',
      subtitle: '',
      href: '',
      icon: 'ExternalLink',
      badge: '',
      is_active: true,
      is_internal: false
    });
  };

  const handleEdit = (index) => {
    const item = links[index];
    setEditingIndex(index);
    setForm({
      title: item.title || '',
      subtitle: item.subtitle || '',
      href: item.href || '',
      icon: item.icon || 'ExternalLink',
      badge: item.badge || '',
      is_active: item.is_active !== undefined ? item.is_active : true,
      is_internal: !!item.is_internal
    });
  };

  const handleDelete = (index) => {
    if (!confirm('Apakah Anda yakin ingin menghapus link ini?')) return;
    const updated = links.filter((_, i) => i !== index);
    saveQuickLinks(updated);
    if (editingIndex === index) resetForm();
  };

  const handleMove = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= links.length) return;
    const updated = [...links];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    saveQuickLinks(updated);
  };

  const toggleActive = (index) => {
    const updated = [...links];
    updated[index] = { ...updated[index], is_active: !updated[index].is_active };
    saveQuickLinks(updated);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Link2 className="h-6 w-6 text-primary-500" />
            Manajemen Quick Links (Landing & Home)
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kelola tautan sosial media (Facebook, TikTok, Instagram, Discord, dll) dan link cepat yang tampil di Home & Landing page.
          </p>
        </div>
      </div>

      {/* Form Tambah/Edit */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
        <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
          {editingIndex !== null ? 'Edit Link' : 'Tambah Link Baru'}
        </h4>

        <form onSubmit={handleAddOrUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Judul Link *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Misal: TikTok"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sub-judul / Deskripsi (Opsional)
              </label>
              <input
                type="text"
                value={form.subtitle}
                onChange={(e) => setForm(prev => ({ ...prev, subtitle: e.target.value }))}
                placeholder="Misal: Follow TikTok KomikNesia"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                URL / Href *
              </label>
              <input
                type="text"
                value={form.href}
                onChange={(e) => setForm(prev => ({ ...prev, href: e.target.value }))}
                placeholder="https://tiktok.com/@komiknesia"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Icon
              </label>
              <select
                value={form.icon}
                onChange={(e) => setForm(prev => ({ ...prev, icon: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                {AVAILABLE_ICONS.map(ic => (
                  <option key={ic.value} value={ic.value}>{ic.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Badge Teks (Opsional, misal: Hot / New)
              </label>
              <input
                type="text"
                value={form.badge}
                onChange={(e) => setForm(prev => ({ ...prev, badge: e.target.value }))}
                placeholder="Hot"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div className="flex items-center space-x-6 pt-6">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Aktif</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_internal}
                  onChange={(e) => setForm(prev => ({ ...prev, is_internal: e.target.checked }))}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Internal Route (React Router)</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            {editingIndex !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
              >
                Batal
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {editingIndex !== null ? 'Simpan Perubahan' : 'Tambah Link'}
            </button>
          </div>
        </form>
      </div>

      {/* List Links */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
            Daftar Link ({links.length})
          </h4>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {links.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              Belum ada link yang ditambahkan.
            </div>
          ) : (
            links.map((item, index) => (
              <div key={item.id || index} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-750">
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
                      disabled={index === links.length - 1 || saving}
                      onClick={() => handleMove(index, 1)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {item.title}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-mono">
                        {item.icon}
                      </span>
                      {item.badge && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-400 text-amber-900 font-bold">
                          {item.badge}
                        </span>
                      )}
                      {!item.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          Nonaktif
                        </span>
                      )}
                    </div>
                    {item.subtitle && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {item.subtitle}
                      </p>
                    )}
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1 mt-1"
                    >
                      {item.href} <ExternalLink className="h-3 w-3" />
                    </a>
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
                    className="px-3 py-1 text-xs bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 rounded-lg hover:bg-sky-200 font-medium"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(index)}
                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
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

export default QuickLinksManager;
