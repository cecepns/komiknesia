import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Pencil, Trash2, Loader2, X } from 'lucide-react';
import { apiClient } from '../../utils/api';

const initialForm = {
  username: '',
  email: '',
  password: '',
  points: 0,
  is_membership: false,
  membership_expires_at: '',
  role: 'user',
};

export default function UserManager() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchUsers = async (targetPage = page, search = debouncedSearch) => {
    try {
      setLoading(true);
      setError('');
      const res = await apiClient.getAdminUsers({
        page: targetPage,
        limit,
        search,
      });
      const data = res?.data || {};
      setUsers(data.items || []);
      setTotal(Number(data.pagination?.total || 0));
    } catch (e) {
      setError(e?.message || 'Gagal memuat user');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(page, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(initialForm);
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({
      username: user.username || '',
      email: user.email || '',
      password: '',
      points: Number(user.points || 0),
      is_membership: !!user.is_membership,
      membership_expires_at: user.membership_expires_at
        ? new Date(user.membership_expires_at).toISOString().slice(0, 16)
        : '',
      role: user.role === 'admin' ? 'admin' : 'user',
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingUser(null);
    setForm(initialForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        points: Number(form.points || 0),
        is_membership: !!form.is_membership,
        membership_expires_at: form.membership_expires_at || null,
        role: form.role === 'admin' ? 'admin' : 'user',
      };
      if (form.password.trim()) {
        payload.password = form.password;
      }

      if (editingUser) {
        await apiClient.updateAdminUser(editingUser.id, payload);
        setSuccess('User berhasil diperbarui');
      } else {
        if (!payload.password) {
          throw new Error('Password wajib diisi untuk user baru');
        }
        await apiClient.createAdminUser(payload);
        setSuccess('User berhasil ditambahkan');
      }

      closeForm();
      fetchUsers();
    } catch (e2) {
      setError(e2?.message || 'Gagal menyimpan user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Hapus user "${user.username}"?`)) return;
    setError('');
    setSuccess('');
    try {
      await apiClient.deleteAdminUser(user.id);
      setSuccess('User berhasil dihapus');
      fetchUsers();
    } catch (e) {
      setError(e?.message || 'Gagal menghapus user');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Manajemen User</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Cari user (debounce), edit membership, edit poin, reset password, atau hapus user.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="h-10 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Tambah User
          </button>
        </div>

        <div className="mt-4 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari username / email..."
            className="w-full md:max-w-md h-10 pl-9 pr-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>

        {error && <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-200">{error}</div>}
        {success && <div className="mt-4 p-3 rounded-lg bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-200">{success}</div>}

        <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Membership</th>
                <th className="text-left px-4 py-3">Point</th>
                <th className="text-left px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                    Loading...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Tidak ada user</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{user.username}</div>
                      <div className="text-xs text-gray-500">{user.email || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {user.role === 'admin' ? (
                        <span className="inline-flex px-2 py-1 text-xs rounded-full bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200">
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                          User
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.is_membership ? (
                        <div>
                          <span className="inline-flex px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">Aktif</span>
                          <div className="text-xs text-gray-500 mt-1">
                            Sampai: {user.membership_expires_at ? new Date(user.membership_expires_at).toLocaleString('id-ID') : 'Tidak ada batas'}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">Non-member</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{Number(user.points || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(user)} className="h-8 px-3 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 inline-flex items-center gap-1">
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button onClick={() => handleDelete(user)} className="h-8 px-3 rounded-md bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/20 dark:text-red-300 inline-flex items-center gap-1">
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
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Total: {total.toLocaleString()} user
          </p>
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
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">{editingUser ? 'Edit User' : 'Tambah User'}</h4>
              <button onClick={closeForm} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm block mb-1">Username</label>
                  <input
                    value={form.username}
                    onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm block mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm block mb-1">{editingUser ? 'Password baru (opsional)' : 'Password'}</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                    placeholder={editingUser ? 'Isi jika ingin ganti password' : 'Minimal 6 karakter'}
                  />
                </div>
                <div>
                  <label className="text-sm block mb-1">Point</label>
                  <input
                    type="number"
                    min={0}
                    value={form.points}
                    onChange={(e) => setForm((prev) => ({ ...prev, points: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm block mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="space-y-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!form.is_membership}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_membership: e.target.checked }))}
                  />
                  Membership aktif
                </label>
                <div>
                  <label className="text-sm block mb-1">Expired membership</label>
                  <input
                    type="datetime-local"
                    value={form.membership_expires_at}
                    onChange={(e) => setForm((prev) => ({ ...prev, membership_expires_at: e.target.value }))}
                    disabled={!form.is_membership}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 disabled:opacity-50"
                  />
                </div>
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
