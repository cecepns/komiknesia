import { useState, useEffect, useRef } from 'react';
import { Database, Search, RefreshCw, AlertCircle, CheckCircle2, Play, Ban, CheckSquare, Square, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient } from '../../utils/api';

const MangaMigration = () => {
  const [mangaList, setMangaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ search: '', status: 'pending' });
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Migration Task State
  const [activeTask, setActiveTask] = useState(null);
  const [taskLoading, setTaskLoading] = useState(false);
  const pollIntervalRef = useRef(null);
  const logContainerRef = useRef(null);

  useEffect(() => {
    fetchMangaList();
    return () => stopPolling();
  }, [pagination.page, filters.status]);

  const fetchMangaList = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getMigrationManga({
        page: pagination.page,
        limit: pagination.limit,
        search: filters.search,
        status: filters.status
      });
      if (res.success) {
        setMangaList(res.data);
        setPagination(prev => ({
          ...prev,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages
        }));
      }
    } catch (err) {
      console.error('Error fetching manga for migration:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchMangaList();
  };

  const handleSelectToggle = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllOnPage = () => {
    const pageIds = mangaList.map(m => m.id);
    const allSelected = pageIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      // Unselect all on page
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      // Select all on page
      setSelectedIds(prev => [...new Set([...prev, ...pageIds])]);
    }
  };

  const startMigration = async () => {
    if (selectedIds.length === 0) {
      alert('Pilih minimal 1 komik untuk dimigrasikan.');
      return;
    }
    if (!confirm(`Apakah Anda yakin ingin memigrasikan ${selectedIds.length} komik ke R2 Cloudflare?`)) {
      return;
    }

    try {
      setTaskLoading(true);
      const res = await apiClient.startMigration(selectedIds);
      if (res.success && res.taskId) {
        // Clear selection
        setSelectedIds([]);
        // Start polling progress
        startPolling(res.taskId);
      } else {
        alert('Gagal memulai migrasi: ' + (res.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Terjadi kesalahan saat memulai migrasi: ' + err.message);
    } finally {
      setTaskLoading(false);
    }
  };

  const startPolling = (taskId) => {
    stopPolling();
    
    // Immediate first fetch
    fetchProgress(taskId);

    pollIntervalRef.current = setInterval(() => {
      fetchProgress(taskId);
    }, 1500);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const fetchProgress = async (taskId) => {
    try {
      const res = await apiClient.getMigrationStatus(taskId);
      if (res.success && res.task) {
        setActiveTask(res.task);
        
        // Auto scroll terminal log to bottom
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }

        // Stop polling if task is no longer processing
        if (res.task.status !== 'processing') {
          stopPolling();
          fetchMangaList(); // Refresh data list to show updated status
        }
      }
    } catch (err) {
      console.error('Error fetching migration progress:', err);
    }
  };

  const handleAbort = async () => {
    if (!activeTask || activeTask.status !== 'processing') return;
    if (!confirm('Apakah Anda yakin ingin membatalkan proses migrasi saat ini?')) return;

    try {
      await apiClient.abortMigration(activeTask.id);
      stopPolling();
      // Fetch one last time to update abort status in UI
      fetchProgress(activeTask.id);
    } catch (err) {
      alert('Gagal membatalkan migrasi: ' + err.message);
    }
  };

  const handleCloseProgress = () => {
    setActiveTask(null);
  };

  const getStatusBadge = (manga) => {
    const coverPending = manga.cover_pending;
    const pagesPending = manga.pending_pages_count > 0;
    
    if (coverPending || pagesPending) {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-3.5 w-3.5" />
          Pending
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Migrated
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Background Task Monitor Overlay */}
      {activeTask && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className={`h-6 w-6 text-primary-500 ${activeTask.status === 'processing' ? 'animate-spin' : ''}`} />
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Tugas Migrasi: {activeTask.id}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Status: <span className="font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">{activeTask.status}</span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {activeTask.status === 'processing' && (
                <button
                  onClick={handleAbort}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Ban className="h-4 w-4" />
                  Hentikan
                </button>
              )}
              {activeTask.status !== 'processing' && (
                <button
                  onClick={handleCloseProgress}
                  className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-lg text-sm font-medium transition-colors"
                >
                  Tutup Monitor
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              <span>Progress Komik</span>
              <span>{activeTask.processedManga} / {activeTask.totalManga} ({Math.round((activeTask.processedManga / activeTask.totalManga) * 100)}%)</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div 
                className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${(activeTask.processedManga / activeTask.totalManga) * 100}%` }}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl">
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Chapters Selesai</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{activeTask.processedChapters}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">Gambar Terupload</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{activeTask.processedImages}</p>
            </div>
            <div className="text-center col-span-2 sm:col-span-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Kesalahan Upload</p>
              <p className="text-lg font-bold text-red-600 dark:text-red-400">{activeTask.errors.length}</p>
            </div>
          </div>

          {/* Terminal Logs */}
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Log Aktivitas:</p>
            <div 
              ref={logContainerRef}
              className="bg-black text-gray-300 font-mono text-xs p-4 rounded-lg h-60 overflow-y-auto space-y-1 border border-gray-800 shadow-inner"
            >
              {activeTask.logs.length === 0 && (
                <span className="text-gray-600">[Menunggu log pertama...]</span>
              )}
              {activeTask.logs.map((log, idx) => (
                <div key={`log-${idx}`} className="whitespace-pre-wrap leading-relaxed">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Manga List Page */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Database className="h-5 w-5 text-primary-500" />
              Migrasi Image ke R2 Cloudflare
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Download cover & chapter page dari host external dan simpan langsung ke R2 Cloudflare milik Anda.
            </p>
          </div>

          {selectedIds.length > 0 && (
            <button
              onClick={startMigration}
              disabled={taskLoading || (activeTask && activeTask.status === 'processing')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-bold shadow-md transition-colors disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Migrasikan ({selectedIds.length} Terpilih)
            </button>
          )}
        </div>

        {/* Filters Form */}
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3 bg-gray-50 dark:bg-gray-900/30 p-4 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari judul komik..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Status:</span>
            <select
              value={filters.status}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, status: e.target.value }));
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            >
              <option value="all">Semua</option>
              <option value="pending">Pending (Perlu Migrasi)</option>
              <option value="migrated">Migrated (Selesai)</option>
            </select>
          </div>

          <button
            type="submit"
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-lg text-sm font-semibold transition-colors"
          >
            Terapkan
          </button>
        </form>

        {/* Table List */}
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <RefreshCw className="h-8 w-8 text-primary-500 animate-spin" />
          </div>
        ) : mangaList.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Tidak ada komik yang sesuai dengan kriteria filter.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left w-12">
                      <button
                        type="button"
                        onClick={handleSelectAllOnPage}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        title="Pilih semua di halaman ini"
                      >
                        {mangaList.map(m => m.id).every(id => selectedIds.includes(id)) ? (
                          <CheckSquare className="h-5 w-5 text-primary-500" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Komik
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Cover Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Pending Page Chapter
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                      Status Migrasi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {mangaList.map((manga) => {
                    const isSelected = selectedIds.includes(manga.id);
                    return (
                      <tr 
                        key={manga.id}
                        onClick={() => handleSelectToggle(manga.id)}
                        className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${isSelected ? 'bg-primary-50/30 dark:bg-primary-950/10' : ''}`}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleSelectToggle(manga.id)}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-5 w-5 text-primary-500" />
                            ) : (
                              <Square className="h-5 w-5" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {manga.thumbnail && (
                              <img
                                src={manga.thumbnail}
                                alt=""
                                className="w-10 h-14 object-cover rounded shadow bg-gray-100 shrink-0"
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {manga.title}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                ID: {manga.id} • Slug: {manga.slug}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {manga.cover_pending ? (
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Internal S3/R2 Pending</span>
                          ) : (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">S3/R2 / Lokal OK</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold ${manga.pending_pages_count > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {manga.pending_pages_count} halaman
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {getStatusBadge(manga)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Menampilkan <span className="font-semibold">{mangaList.length}</span> dari <span className="font-semibold">{pagination.total}</span> komik
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="inline-flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="inline-flex items-center px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Selanjutnya
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MangaMigration;
