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
    const raw = String(s).trim();
    const d = raw.includes('T') ? new Date(raw) : new Date(`${raw.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const a = fmt(start);
  const b = fmt(end);
  if (!a || !b) return '';
  return `${a} – ${b}`;
}

function getDayDateLabel(weekStart, dayIndex) {
  if (!weekStart) return '';
  const raw = String(weekStart).trim();
  const base = raw.includes('T') ? new Date(raw) : new Date(`${raw.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(base.getTime())) return '';
  base.setDate(base.getDate() + dayIndex);
  return base.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
}

function formatReleaseTime(item) {
  const ts = item.scheduled_release_at?.time;
  if (ts) {
    return new Date(ts * 1000).toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  const formatted = item.scheduled_release_at?.formatted;
  if (!formatted) return '';
  const match = formatted.match(/(\d{1,2}[.:]\d{2})/);
  return match ? match[1].replace('.', ':') : formatted;
}

function ScheduleCard({ item }) {
  const cover = getImageUrl(item.manga?.cover || item.manga?.thumbnail);
  const releaseTime = formatReleaseTime(item);

  return (
    <Link
      to={`/komik/${item.manga.slug}`}
      className="group flex gap-3 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-sky-400/60 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-400/40"
    >
      <div className="h-[4.5rem] w-[3.25rem] shrink-0 overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800 sm:h-20 sm:w-14">
        {cover ? (
          <LazyImage
            src={cover}
            alt={item.manga.title}
            className="h-full w-full object-cover"
            wrapperClassName="h-full w-full"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">No cover</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 group-hover:text-sky-600 dark:text-gray-100 dark:group-hover:text-cyan-300">
          {item.manga.title}
        </p>
        <p className="mt-0.5 line-clamp-1 text-xs text-gray-600 dark:text-gray-400">
          Ch. {item.chapter_number}
          {item.title ? ` — ${item.title}` : ''}
        </p>
        {releaseTime ? (
          <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-cyan-950/50 dark:text-cyan-300">
            <Clock className="h-3 w-3 shrink-0" aria-hidden />
            {releaseTime} WIB
          </p>
        ) : null}
      </div>
    </Link>
  );
}

function DaySection({ dayKey, dayLabel, dateLabel, items, isToday }) {
  const isEmpty = items.length === 0;

  return (
    <section
      className={`rounded-2xl border transition-colors ${
        isToday
          ? 'border-sky-400/60 bg-sky-50/50 dark:border-cyan-400/40 dark:bg-cyan-950/15'
          : 'border-gray-200 bg-gray-50/40 dark:border-white/10 dark:bg-white/[0.03]'
      } ${isEmpty ? 'px-4 py-3 md:px-5 md:py-3.5' : 'p-4 md:p-5'}`}
    >
      <div className={`flex items-center gap-3 ${isEmpty ? '' : 'mb-4'}`}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100 md:text-base">
              {dayLabel}
            </h2>
            {isToday ? (
              <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-[10px] font-semibold text-white dark:bg-cyan-600">
                Hari ini
              </span>
            ) : null}
            {!isEmpty ? (
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">
                {items.length} chapter
              </span>
            ) : null}
          </div>
          {dateLabel ? (
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{dateLabel}</p>
          ) : null}
        </div>
      </div>

      {isEmpty ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Tidak ada jadwal</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ScheduleCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function ScheduleSkeleton() {
  return (
    <div className="space-y-3">
      {DAY_ORDER.map((day) => (
        <div key={day} className="animate-pulse rounded-2xl border border-gray-200 p-5 dark:border-white/10">
          <div className="mb-4 h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="h-20 rounded-xl bg-gray-200 dark:bg-gray-700" />
            <div className="hidden h-20 rounded-xl bg-gray-200 dark:bg-gray-700 sm:block" />
          </div>
        </div>
      ))}
    </div>
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
    <div className="min-h-screen bg-gray-100 pb-24 pt-5 text-gray-900 dark:bg-gray-950 dark:text-gray-100 md:pt-20">
      <Helmet>
        <title>Jadwal Rilis | KomikNesia</title>
        <meta
          name="description"
          content="Jadwal rilis chapter komik mingguan — Senin sampai Minggu."
        />
      </Helmet>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl dark:border-white/20 dark:bg-white/10 dark:backdrop-blur-2xl">
          <div className="border-b border-gray-200 px-6 py-5 dark:border-white/10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeekOffset((w) => w - 1)}
                  className="rounded-xl border border-gray-200 p-2 hover:bg-gray-50 dark:border-white/15 dark:hover:bg-white/10"
                  aria-label="Minggu sebelumnya"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="min-w-[11rem] flex-1 text-center text-sm font-medium sm:flex-none sm:min-w-[14rem]">
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
              <ScheduleSkeleton />
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
              <div className="space-y-3 md:space-y-4">
                {DAY_ORDER.map((dayKey, dayIndex) => {
                  const items = schedule?.days?.[dayKey] || [];
                  const isToday = dayKey === todayKey && weekOffset === 0;
                  return (
                    <DaySection
                      key={dayKey}
                      dayKey={dayKey}
                      dayLabel={dayLabels[dayKey] || dayKey}
                      dateLabel={getDayDateLabel(schedule?.week_start, dayIndex)}
                      items={items}
                      isToday={isToday}
                    />
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
