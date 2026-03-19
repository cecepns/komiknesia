import { useEffect, useMemo, useState } from 'react';
import { CloudDownload, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { apiClient } from '../../utils/api';

const pretty = (obj) => {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
};

export default function IkiruSync() {
  const [mode, setMode] = useState('delta'); // delta | full
  const [slug, setSlug] = useState('');
  const [chapterSlug, setChapterSlug] = useState('');
  const [feedType, setFeedType] = useState('latest'); // latest | project
  const [page, setPage] = useState(1);
  const [withImages, setWithImages] = useState(false);
  const [feed, setFeed] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [feedLoading, setFeedLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const selectedSlugs = useMemo(() => Array.from(selected), [selected]);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      setResult(res);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const loadFeed = async () => {
    setFeedLoading(true);
    setError(null);
    try {
      const res = await apiClient.getIkiruSyncFeed(feedType, page);
      setFeed(res?.data || []);
      setSelected(new Set());
      setResult(res);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    // auto-load first time
    loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleAll = () => {
    if (!feed.length) return;
    if (selected.size === feed.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(feed.map((m) => m.slug)));
  };

  const toggleOne = (s) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Ikiru Sync
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Ambil daftar manga dari Ikiru, pilih yang ingin di-sync, lalu simpan ke database.
              Rekomendasi default: <b>delta</b> untuk update cepat; gunakan <b>full</b> untuk re-scan
              semua chapter.
            </p>
          </div>

          <div className="lg:col-span-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  Mode
                </label>
                <select
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  disabled={busy}
                >
                  <option value="delta">delta (chapter terbaru utk existing)</option>
                  <option value="full">full (scan semua chapter)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  Options
                </label>
                <label className="h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                  <input
                    className="h-4 w-4"
                    type="checkbox"
                    checked={withImages}
                    onChange={(e) => setWithImages(e.target.checked)}
                    disabled={busy}
                  />
                  <span className="leading-tight">
                    Insert images untuk chapter baru
                  </span>
                </label>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Images hanya disimpan untuk <b>chapter yang baru dibuat</b> (lebih aman dari segi beban).
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Feed
              </label>
              <select
                className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                value={feedType}
                onChange={(e) => setFeedType(e.target.value)}
                disabled={busy || feedLoading}
              >
                <option value="latest">Latest Update</option>
                <option value="project">Project</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Page
              </label>
              <input
                type="number"
                min={1}
                value={page}
                onChange={(e) => setPage(parseInt(e.target.value || '1', 10))}
                disabled={busy || feedLoading}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={loadFeed}
                disabled={busy || feedLoading}
                className="w-full h-10 flex items-center justify-center px-4 rounded-lg bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-60 dark:bg-gray-700 dark:hover:bg-gray-600"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {feedLoading ? 'Loading...' : 'Load List'}
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={toggleAll}
              disabled={busy || feedLoading || !feed.length}
              className="h-10 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60"
            >
              {selected.size === feed.length && feed.length ? 'Unselect all' : 'Select all'}
            </button>
            <button
              onClick={() =>
                run(() =>
                  apiClient.syncIkiruSelected(selectedSlugs, { mode, withImages })
                )
              }
              disabled={busy || feedLoading || selected.size === 0}
              className="h-10 flex items-center justify-center px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-60"
            >
              <CloudDownload className="h-4 w-4 mr-2" />
              Sync Selected
              <span className="ml-2 inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded-md bg-white/15 text-white text-xs">
                {selected.size}
              </span>
            </button>
          </div>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                <tr>
                  <th className="text-left p-3 w-10">
                    <input
                      type="checkbox"
                      checked={!!feed.length && selected.size === feed.length}
                      onChange={toggleAll}
                      disabled={busy || feedLoading || !feed.length}
                    />
                  </th>
                  <th className="text-left p-3">Title</th>
                  <th className="text-left p-3">Slug</th>
                </tr>
              </thead>
              <tbody>
                {feed.map((m) => (
                  <tr
                    key={m.slug}
                    className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900/40"
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(m.slug)}
                        onChange={() => toggleOne(m.slug)}
                        disabled={busy || feedLoading}
                      />
                    </td>
                    <td className="p-3 text-gray-900 dark:text-gray-100">
                      {m.title || '-'}
                    </td>
                    <td className="p-3 text-gray-600 dark:text-gray-400">
                      {m.slug}
                    </td>
                  </tr>
                ))}
                {!feed.length && (
                  <tr>
                    <td colSpan={3} className="p-4 text-gray-600 dark:text-gray-400">
                      {feedLoading ? 'Loading...' : 'Belum ada data. Klik Load List.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Sync Per Manga
          </h4>

          <div className="space-y-2">
            <label className="text-sm text-gray-700 dark:text-gray-300">Manga slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="contoh: noa-senpai-wa-tomodachi"
              disabled={busy}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() =>
                run(() => apiClient.syncIkiruManga(slug.trim(), { mode, withImages }))
              }
              disabled={busy || !slug.trim()}
              className="h-10 flex items-center justify-center px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync Manga
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm text-gray-700 dark:text-gray-300">Chapter slug</label>
              <input
                value={chapterSlug}
                onChange={(e) => setChapterSlug(e.target.value)}
                placeholder="contoh: chapter-1.12345"
                disabled={busy}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() =>
                  run(() => apiClient.syncIkiruChapterImages(slug.trim(), chapterSlug.trim()))
                }
                disabled={busy || !slug.trim() || !chapterSlug.trim()}
                className="w-full h-10 flex items-center justify-center px-4 rounded-lg bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-60 dark:bg-gray-700 dark:hover:bg-gray-600"
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                Sync Chapter Images
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Images disarankan on-demand: sync hanya saat chapter benar-benar dibuka.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Output
        </h4>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}
        <pre className="text-xs overflow-auto p-4 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700">
          {result ? pretty(result) : 'Belum ada output. Jalankan salah satu aksi di atas.'}
        </pre>
      </div>
    </div>
  );
}

