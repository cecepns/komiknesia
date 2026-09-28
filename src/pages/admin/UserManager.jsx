import { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Pencil, Trash2, Loader2, X, Globe, Smartphone, Crown, Filter, Check } from 'lucide-react';
import { apiClient, formatToInputString, formatToLocaleString } from '../../utils/api';

const initialForm = {
  username: '',
  email: '',
  password: '',
  points: 0,
  is_membership: false,
  membership_type: 'web', // Default yang web terselect!
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
  const [membershipFilter, setMembershipFilter] = useState('all'); // 'all' | 'web' | 'mobile' | 'both' | 'non_membership'

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

  const displayedUsers = useMemo(() => {
    if (membershipFilter === 'all') return users;
    if (membershipFilter === 'non_membership') return users.filter((u) => !u.is_membership);
    return users.filter((u) => u.is_membership && (u.membership_type || 'web') === membershipFilter);
  }, [users, membershipFilter]);

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
      membership_type: user.membership_type || 'web', // default web jika belum ada
      membership_expires_at: formatToInputString(user.membership_expires_at),
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
        membership_type: form.membership_type || 'web',
        membership_expires_at: form.is_membership && form.membership_expires_at ? form.membership_expires_at : null,
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
              Cari user, kelola role, edit membership (Web / Mobile / Keduanya), poin, dan password.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="h-10 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white inline-flex items-center gap-2 font-medium"
          >
            <Plus className="h-4 w-4" />
            Tambah User
          </button>
        </div>

        {/* Filter bar: Search & Membership Platform Filter */}
        <div className="mt-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 md:max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari username / email..."
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <Filter className="w-3.5 h-3.5 text-gray-400 mr-1" />
            <button
              type="button"
              onClick={() => setMembershipFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                membershipFilter === 'all'
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Semua User
            </button>
            <button
              type="button"
              onClick={() => setMembershipFilter('web')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                membershipFilter === 'web'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
              }`}
            >
              <Globe className="w-3 h-3" />
              VIP Web
            </button>
            <button
              type="button"
              onClick={() => setMembershipFilter('mobile')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                membershipFilter === 'mobile'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100'
              }`}
            >
              <Smartphone className="w-3 h-3" />
              VIP Mobile
            </button>
            <button
              type="button"
              onClick={() => setMembershipFilter('both')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                membershipFilter === 'both'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
              }`}
            >
              <Crown className="w-3 h-3" />
              VIP Keduanya
            </button>
            <button
              type="button"
              onClick={() => setMembershipFilter('non_membership')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                membershipFilter === 'non_membership'
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Non-Member
            </button>
          </div>
        </div>

        {error && <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-200 text-sm">{error}</div>}
        {success && <div className="mt-4 p-3 rounded-lg bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-200 text-sm">{success}</div>}

        <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Membership VIP</th>
                <th className="text-left px-4 py-3">Point</th>
                <th className="text-left px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin inline-block mr-2" />
                    Loading user...
                  </td>
                </tr>
              ) : displayedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    Tidak ada user yang sesuai kriteria.
                  </td>
                </tr>
              ) : (
                displayedUsers.map((user) => (
                  <tr key={user.id} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{user.username}</div>
                      <div className="text-xs text-gray-500">{user.email || '-'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {user.role === 'admin' ? (
                        <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200">
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                          User
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.is_membership ? (
                        <div className="space-y-1">
                          {user.membership_type === 'mobile' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                              <Smartphone className="w-3 h-3" />
                              VIP Mobile
                            </span>
                          ) : user.membership_type === 'both' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                              <Crown className="w-3 h-3" />
                              VIP Web & Mobile
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              <Globe className="w-3 h-3" />
                              VIP Web
                            </span>
                          )}
                          <div className="text-[11px] text-gray-500">
                            {user.membership_expires_at
                              ? `Sampai: ${formatToLocaleString(user.membership_expires_at)}`
                              : 'Tanpa batas (Permanen)'}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          Non-member
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">{Number(user.points || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(user)} className="h-8 px-3 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 inline-flex items-center gap-1 text-xs font-medium">
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button onClick={() => handleDelete(user)} className="h-8 px-3 rounded-md bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/20 dark:text-red-300 inline-flex items-center gap-1 text-xs font-medium">
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
            Total: {total.toLocaleString()} user {membershipFilter !== 'all' && `(terfilter: ${displayedUsers.length})`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50 text-sm font-medium"
            >
              Prev
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300">Page {page}/{totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50 text-sm font-medium"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white dark:bg-gray-800 rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">{editingUser ? 'Edit User' : 'Tambah User'}</h4>
              <button onClick={closeForm} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm block mb-1 font-medium">Username *</label>
                  <input
                    value={form.username}
                    onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm block mb-1 font-medium">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm block mb-1 font-medium">{editingUser ? 'Password baru (opsional)' : 'Password *'}</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                    placeholder={editingUser ? 'Kosongkan jika tidak diubah' : 'Minimal 6 karakter'}
                  />
                </div>
                <div>
                  <label className="text-sm block mb-1 font-medium">Point</label>
                  <input
                    type="number"
                    min={0}
                    value={form.points}
                    onChange={(e) => setForm((prev) => ({ ...prev, points: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm block mb-1 font-medium">Role User</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* MEMBERSHIP VIP SECTION WITH SEPARATE PLATFORM (WEB / MOBILE / BOTH) */}
              <div className="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-semibold text-gray-900 dark:text-gray-100 block">
                      Status Membership VIP
                    </label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Pilih platform VIP untuk akun user ini
                    </p>
                  </div>
                  {form.is_membership ? (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      VIP AKTIF
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-gray-500 bg-gray-200 dark:bg-gray-700 px-2.5 py-1 rounded-full">
                      NON-VIP
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Option 1: Non-Member */}
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, is_membership: false }))}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all cursor-pointer ${
                      !form.is_membership
                        ? 'border-gray-400 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-bold ring-2 ring-gray-400'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <X className="w-5 h-5 mb-1 text-gray-400" />
                    <span className="text-xs font-semibold">Non-VIP</span>
                    <span className="text-[10px] text-gray-500">Bukan Member</span>
                  </button>

                  {/* Option 2: VIP Web */}
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, is_membership: true, membership_type: 'web' }))}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all cursor-pointer ${
                      form.is_membership && (form.membership_type === 'web' || !form.membership_type)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold ring-2 ring-blue-500'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <Globe className="w-5 h-5 mb-1 text-blue-500" />
                    <span className="text-xs font-semibold">🌐 VIP Web</span>
                    <span className="text-[10px] text-gray-500">Website Saja</span>
                  </button>

                  {/* Option 3: VIP Mobile */}
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, is_membership: true, membership_type: 'mobile' }))}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all cursor-pointer ${
                      form.is_membership && form.membership_type === 'mobile'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 font-bold ring-2 ring-purple-500'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <Smartphone className="w-5 h-5 mb-1 text-purple-500" />
                    <span className="text-xs font-semibold">📱 VIP Mobile</span>
                    <span className="text-[10px] text-gray-500">App HP Saja</span>
                  </button>

                  {/* Option 4: VIP Keduanya */}
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, is_membership: true, membership_type: 'both' }))}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all cursor-pointer ${
                      form.is_membership && form.membership_type === 'both'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold ring-2 ring-amber-500'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <Crown className="w-5 h-5 mb-1 text-amber-500" />
                    <span className="text-xs font-semibold">👑 VIP Keduanya</span>
                    <span className="text-[10px] text-gray-500">Web & Mobile</span>
                  </button>
                </div>

                {form.is_membership && (
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <label className="text-xs font-semibold block mb-1 text-gray-700 dark:text-gray-300">
                      Masa Berlaku VIP (Kosongkan jika Permanen / Seumur Hidup)
                    </label>
                    <input
                      type="datetime-local"
                      value={form.membership_expires_at}
                      onChange={(e) => setForm((prev) => ({ ...prev, membership_expires_at: e.target.value }))}
                      className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={closeForm} className="h-10 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium">
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 px-5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white inline-flex items-center gap-2 disabled:opacity-50 text-sm font-semibold"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Simpan User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
