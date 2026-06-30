import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, CalendarDays } from 'lucide-react';
import LazyImage from '../components/LazyImage';
import LiveChatWidget from '../components/LiveChatWidget';
import { apiClient, getImageUrl } from '../utils/api';

const DAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

function formatWeekRange(start, end) {
  if (!start || !end) return '';
  const fmt = (s) => {
    const d = new Date(`${s}T00:00:00`);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

function ScheduleCard({ item }) {
  const cover = getImageUrl(item.manga?.cover || item.manga?.thumbnail);
  const releaseLabel = item.scheduled_release_at?.formatted || '';

  return (
    <Link
      to={`/komik/${item.manga.slug}`}
      className="group flex gap-3 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-sky-400/60 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-400/40"
    >
      <div className="h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800">
        {cover ? (
          <LazyImage src={cover} alt={item.manga.title} className="h-full w-full object-cover" wrapperClassName="h-full w-full" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">No cover</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-sky-600 dark:text-gray-100 dark:group-hover:text-cyan-300">
          {item.manga.title}
        </p>
        <p className="truncate text-xs text-gray-600 dark:text-gray-400">
          Ch. {item.chapter_number}
          {item.title ? ` — ${item.title}` : ''}
        </p>
        {releaseLabel ? (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-sky-600 dark:text-cyan-400">
            <Clock className="h-3 w-3 shrink-0" />
            {releaseLabel} WIB
          </p>
        ) : null}
      </div>
    </Link>
  );
}

const Jadwal = () => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [schedule, setSchedule] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await apiClient.getChapterSchedule(weekOffset);
        if (!cancelled) setSchedule(res);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Gagal memuat jadwal');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [weekOffset]);

  const dayLabels = schedule?.day_labels || {};
  const total = schedule?.total ?? 0;

  const todayKey = useMemo(() => {
    const jsDay = new Date().getDay();
    return DAY_ORDER[jsDay === 0 ? 6 : jsDay - 1];
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100 pt-5 md:pt-20 pb-24">
      <Helmet>
        <title>Jadwal Rilis | KomikNesia</title>
        <meta
          name="description"
          content="Jadwal rilis chapter komik mingguan — Senin sampai Minggu."
        />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl dark:border-white/20 dark:bg-white/10 dark:backdrop-blur-2xl">
          <div className="border-b border-gray-200 px-6 py-5 dark:border-white/10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400">
                  Release Schedule
                </p>
                <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold md:text-3xl">
                  <CalendarDays className="h-7 w-7 text-sky-500 dark:text-cyan-400" />
                  Jadwal Rilis
                </h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Chapter terjadwal muncul di sini sampai jam tayang, lalu masuk Terbaru & Project.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeekOffset((w) => w - 1)}
                  className="rounded-xl border border-gray-200 p-2 hover:bg-gray-50 dark:border-white/15 dark:hover:bg-white/10"
                  aria-label="Minggu sebelumnya"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="min-w-[10rem] text-center text-sm font-medium">
                  {formatWeekRange(schedule?.week_start, schedule?.week_end)}
                </div>
                <button
                  type="button"
                  onClick={() => setWeekOffset((w) => w + 1)}
                  className="rounded-xl border border-gray-200 p-2 hover:bg-gray-50 dark:border-white/15 dark:hover:bg-white/10"
                  aria-label="Minggu berikutnya"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                {weekOffset !== 0 ? (
                  <button
                    type="button"
                    onClick={() => setWeekOffset(0)}
                    className="rounded-xl border border-sky-500/40 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 dark:border-cyan-400/30 dark:bg-cyan-950/40 dark:text-cyan-200"
                  >
                    Minggu ini
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="p-4 md:p-6">
            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
                {DAY_ORDER.map((day) => (
                  <div key={day} className="animate-pulse rounded-2xl border border-gray-200 p-4 dark:border-white/10">
                    <div className="mb-3 h-4 w-16 rounded bg-gray-200 dark:bg-gray-700" />
                    <div className="space-y-2">
                      <div className="h-16 rounded-xl bg-gray-200 dark:bg-gray-700" />
                      <div className="h-16 rounded-xl bg-gray-200 dark:bg-gray-700" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            ) : total === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-16 text-center dark:border-white/15">
                <CalendarDays className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-3 font-medium text-gray-700 dark:text-gray-300">Belum ada jadwal minggu ini</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Chapter dengan timer rilis akan tampil di sini sebelum jam tayang.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
                {DAY_ORDER.map((dayKey) => {
                  const items = schedule?.days?.[dayKey] || [];
                  const isToday = dayKey === todayKey && weekOffset === 0;
                  return (
                    <div
                      key={dayKey}
                      className={`rounded-2xl border p-3 md:min-h-[12rem] ${
                        isToday
                          ? 'border-sky-400/60 bg-sky-50/80 dark:border-cyan-400/40 dark:bg-cyan-950/20'
                          : 'border-gray-200 bg-gray-50/50 dark:border-white/10 dark:bg-white/5'
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100">
                          {dayLabels[dayKey] || dayKey}
                        </h2>
                        {isToday ? (
                          <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-cyan-600">
                            Hari ini
                          </span>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        {items.length === 0 ? (
                          <p className="py-6 text-center text-xs text-gray-400">—</p>
                        ) : (
                          items.map((item) => <ScheduleCard key={item.id} item={item} />)
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <LiveChatWidget />
    </div>
  );
};

export default Jadwal;
