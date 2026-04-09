import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, Trash2 } from 'lucide-react';
import { apiClient, getImageUrl } from '../../utils/api';

export default function OrderManager() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 450);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchOrders = async (targetPage = page, search = debouncedSearch) => {
    try {
      setLoading(true);
      setError('');
      const res = await apiClient.getAdminPremiumOrders({ page: targetPage, limit, search });
      const data = res?.data || {};
      setOrders(data.items || []);
      setTotal(Number(data.pagination?.total || 0));
    } catch (e) {
      setError(e?.message || 'Gagal memuat order');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(page, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);

  const handleStatusChange = async (order, paymentStatus) => {
    try {
      setSavingId(order.id);
      setError('');
      setSuccess('');
      await apiClient.updateAdminPremiumOrderStatus(order.id, paymentStatus);
      setSuccess('Status pembayaran berhasil diperbarui');
      fetchOrders();
    } catch (e) {
      setError(e?.message || 'Gagal update status pembayaran');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (order) => {
    if (!window.confirm(`Hapus order "${order.username}" - ${order.package_name}?`)) return;
    try {
      setSavingId(order.id);
      setError('');
      setSuccess('');
      await apiClient.deleteAdminPremiumOrder(order.id);
      setSuccess('Order berhasil dihapus');
      fetchOrders();
    } catch (e) {
      setError(e?.message || 'Gagal menghapus order');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Manajemen Order Premium</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Search dengan debounce, maksimal 10 data per halaman, update status pembayaran, dan hapus order.
            </p>
          </div>
        </div>

        <div className="mt-4 relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari username / nama paket..."
            className="w-full md:max-w-md h-10 pl-9 pr-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>

        {error && <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-200">{error}</div>}
        {success && <div className="mt-4 p-3 rounded-lg bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-200">{success}</div>}

        <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="text-left px-4 py-3">User / Paket</th>
                <th className="text-left px-4 py-3">Bukti Transfer</th>
                <th className="text-left px-4 py-3">Status</th>
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
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    Tidak ada order
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{order.username}</div>
                      <div className="text-xs text-gray-500">
                        {order.package_name} {order.package_price ? `(${order.package_price})` : ''}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.created_at ? new Date(order.created_at).toLocaleString('id-ID') : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {order.proof_image ? (
                        <a href={getImageUrl(order.proof_image)} target="_blank" rel="noreferrer">
                          <img
                            src={getImageUrl(order.proof_image)}
                            alt={`Bukti transfer ${order.username}`}
                            className="h-14 w-24 object-cover rounded border border-gray-200 dark:border-gray-700"
                          />
                        </a>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={order.payment_status || 'pending'}
                        disabled={savingId === order.id}
                        onChange={(e) => handleStatusChange(order, e.target.value)}
                        className="h-9 rounded-lg border border-gray-200 dark:border-gray-700 px-2 bg-white dark:bg-gray-900"
                      >
                        <option value="pending">pending</option>
                        <option value="sukses">sukses</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(order)}
                        disabled={savingId === order.id}
                        className="h-9 px-3 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/20 dark:text-red-300 inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total: {total.toLocaleString()} order</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Page {page}/{totalPages}
            </span>
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
    </div>
  );
}
