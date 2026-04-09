import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, Plus, Pencil, Trash2, X } from 'lucide-react';
import { apiClient, getImageUrl } from '../../utils/api';

const initialForm = {
  name: '',
  image: null,
  preview: '',
};

export default function StickerManager() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stickers, setStickers] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSticker, setEditingSticker] = useState(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 450);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchStickers = async (targetPage = page, search = debouncedSearch) => {
    try {
      setLoading(true);
      setError('');
      const res = await apiClient.getAdminStickers({ page: targetPage, limit, search });
      const data = res?.data || {};
      setStickers(data.items || []);
      setTotal(Number(data.pagination?.total || 0));
    } catch (e) {
      setError(e?.message || 'Gagal memuat stiker');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStickers(page, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const openCreate = () => {
    setEditingSticker(null);
    setForm(initialForm);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const openEdit = (sticker) => {
    setEditingSticker(sticker);
    setForm({
      name: sticker.name || '',
      image: null,
      preview: getImageUrl(sticker.image_path) || '',
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingSticker(null);
    setForm(initialForm);
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar (image / gif).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Ukuran file maksimal 8MB.');
      return;
    }
    const preview = URL.createObjectURL(file);
    setForm((prev) => ({ ...prev, image: file, preview }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Nama stiker wajib diisi');
      return;
    }
    if (!editingSticker && !form.image) {
      setError('File stiker wajib diupload');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const formData = new FormData();
      formData.append('name', form.name.trim());
      if (form.image) {
        formData.append('image', form.image);
      }

      if (editingSticker) {
        await apiClient.updateAdminSticker(editingSticker.id, formData);
        setSuccess('Stiker berhasil diperbarui');
      } else {
        await apiClient.createAdminSticker(formData);
        setSuccess('Stiker berhasil ditambahkan');
      }

      closeForm();
      fetchStickers();
    } catch (e) {
      setError(e?.message || 'Gagal menyimpan stiker');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sticker) => {
    if (!window.confirm(`Hapus stiker "${sticker.name}"?`)) return;
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await apiClient.deleteAdminSticker(sticker.id);
      setSuccess('Stiker berhasil dihapus');
      fetchStickers();
    } catch (e) {
      setError(e?.message || 'Gagal menghapus stiker');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Manajemen Stiker</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Tambah, edit, hapus stiker (image/gif). File lama otomatis di-unlink saat diganti/dihapus.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="h-10 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Tambah Stiker
          </button>
        </div>

        <div className="mt-4 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari nama stiker..."
            className="w-full md:max-w-md h-10 pl-9 pr-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>

        {error && <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-200">{error}</div>}
        {success && <div className="mt-4 p-3 rounded-lg bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-200">{success}</div>}

        <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left px-4 py-3">Stiker</th>
                <th className="text-left px-4 py-3">Tipe</th>
                <th className="text-left px-4 py-3">Dibuat</th>
                <th className="text-left px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                    Loading...
                  </td>
                </tr>
              ) : stickers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">Tidak ada stiker</td>
                </tr>
              ) : (
                stickers.map((sticker) => (
                  <tr key={sticker.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={getImageUrl(sticker.image_path)}
                          alt={sticker.name}
                          className="h-12 w-12 rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                        />
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{sticker.name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700">
                        {sticker.is_gif ? 'GIF' : 'Image'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {sticker.created_at ? new Date(sticker.created_at).toLocaleString('id-ID') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(sticker)}
                          className="h-8 px-3 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 inline-flex items-center gap-1"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(sticker)}
                          className="h-8 px-3 rounded-md bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/20 dark:text-red-300 inline-flex items-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total: {total.toLocaleString()} stiker</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300">Page {page}/{totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-xl shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">{editingSticker ? 'Edit Stiker' : 'Tambah Stiker'}</h4>
              <button onClick={closeForm} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-sm block mb-1">Nama stiker</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                  required
                />
              </div>
              <div>
                <label className="text-sm block mb-1">File stiker (image/gif)</label>
                <input type="file" accept="image/*" onChange={handleImageChange} className="w-full text-sm" />
                {form.preview && (
                  <img
                    src={form.preview}
                    alt="Preview stiker"
                    className="mt-3 h-28 w-28 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                  />
                )}
              </div>
              <div className="pt-2 flex items-center justify-end gap-2">
                <button type="button" onClick={closeForm} className="h-10 px-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
