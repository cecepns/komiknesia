import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { Search, Sparkles, MessageSquare, Trophy, ChevronLeft, ChevronRight } from "lucide-react";
import crownImage from "../assets/leaderboard/crown.png";
import { apiClient, getImageUrl } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import LiveChatWidget from "../components/LiveChatWidget";

function avatarSeed(name) {
  const colors = [
    "bg-cyan-500",
    "bg-fuchsia-500",
    "bg-indigo-500",
    "bg-emerald-500",
    "bg-orange-500",
    "bg-pink-500",
  ];
  const total = (name || "U").split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return colors[total % colors.length];
}

function getLevelBadgeStyle(level) {
  const lvl = Number(level) || 1;
  if (lvl >= 6) {
    return {
      label: `LVL ${lvl} • MYTHIC`,
      badgeClass: "bg-purple-600/30 text-purple-300 border border-purple-500/50 shadow-sm",
    };
  }
  if (lvl >= 5) {
    return {
      label: `LVL ${lvl} • CHAMPION`,
      badgeClass: "bg-amber-500/30 text-amber-300 border border-amber-500/50 shadow-sm",
    };
  }
  if (lvl >= 4) {
    return {
      label: `LVL ${lvl} • WARRIOR`,
      badgeClass: "bg-orange-600/30 text-orange-300 border border-orange-500/50 shadow-sm",
    };
  }
  if (lvl >= 3) {
    return {
      label: `LVL ${lvl} • ELITE`,
      badgeClass: "bg-blue-600/30 text-blue-300 border border-blue-500/50 shadow-sm",
    };
  }
  return {
    label: `LVL ${lvl} • RECRUIT`,
    badgeClass: "bg-red-950/60 text-red-300 border border-red-500/40 shadow-sm",
  };
}

const Leaderboard = () => {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [brokenImageIds, setBrokenImageIds] = useState(() => new Set());
  const { user } = useAuth();
  const navigate = useNavigate();
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await apiClient.getLeaderboard({ page: currentPage, limit: ITEMS_PER_PAGE });
        setLeaderboardData(res?.data || []);
        setCurrentUserRank(res?.current_user || null);
        setTotalUsers(Number(res?.total_users || 0));
        setTotalPages(Number(res?.total_pages || 1));
      } catch (e) {
        setError(e?.message || "Gagal memuat leaderboard");
      } finally {
        setLoading(false);
      }
    };
    loadLeaderboard();
  }, [currentPage]);

  const filteredLeaderboard = useMemo(() => {
    if (!searchQuery.trim()) return leaderboardData;
    const q = searchQuery.toLowerCase().trim();
    return leaderboardData.filter(
      (item) =>
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.username && item.username.toLowerCase().includes(q))
    );
  }, [leaderboardData, searchQuery]);

  const topThree = useMemo(() => leaderboardData.slice(0, 3), [leaderboardData]);
  const firstPlace = topThree[0];
  const secondPlace = topThree[1];
  const thirdPlace = topThree[2];

  const markImageBroken = (id) => {
    if (!id) return;
    setBrokenImageIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-black text-gray-100 pt-5 md:pt-20 pb-24">
      <Helmet>
        <title>Leaderboard | KomikNesia</title>
        <meta
          name="description"
          content="Lihat leaderboard komunitas KomikNesia dan cek posisi peringkatmu hari ini."
        />
      </Helmet>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Header Title */}
        <div className="text-center pt-2">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-red-950/60 border border-red-600/30 text-[11px] font-bold text-red-400 uppercase tracking-widest shadow-md">
            <Sparkles className="h-3.5 w-3.5" /> Tiga Besar KomikNesia
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 tracking-tight">
            Leaderboard Komunitas
          </h1>
        </div>

        {/* 1. TOP 3 PODIUM CARDS */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-64 rounded-3xl bg-white/5 border border-white/10" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 items-end">
            
            {/* RANK 2 */}
            {secondPlace && (
              <div
                onClick={() => secondPlace.username && navigate(`/profile/${encodeURIComponent(secondPlace.username)}`)}
                className="relative rounded-3xl border border-white/10 bg-[#14141c] p-6 text-center cursor-pointer transition-all hover:border-white/20 hover:scale-[1.02] shadow-xl order-2 md:order-1"
              >
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-white font-extrabold text-xs shadow-md ring-4 ring-black">
                  2
                </div>
                <div className="relative mx-auto mb-3 h-20 w-20 rounded-full border-2 border-slate-400 overflow-hidden shadow-lg">
                  {secondPlace.profile_image && !brokenImageIds.has(secondPlace.id) ? (
                    <img
                      src={getImageUrl(secondPlace.profile_image)}
                      alt={secondPlace.name}
                      className="h-full w-full object-cover"
                      onError={() => markImageBroken(secondPlace.id)}
                    />
                  ) : (
                    <div className={`h-full w-full ${avatarSeed(secondPlace.name)} flex items-center justify-center text-xl font-black`}>
                      {secondPlace.name.charAt(0)}
                    </div>
                  )}
                </div>
                <h3 className="text-base font-bold text-white truncate">{secondPlace.name}</h3>
                <p className="text-xs text-gray-400 truncate">@{secondPlace.username || 'user'}</p>

                <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-black/40 border border-white/5 p-2.5 text-center">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Level</p>
                    <p className="text-xs font-black text-white mt-0.5">{secondPlace.level || 1}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">XP Bulanan</p>
                    <p className="text-xs font-black text-red-400 mt-0.5">{(secondPlace.points || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* RANK 1 (JUARA UTAMA) */}
            {firstPlace && (
              <div
                onClick={() => firstPlace.username && navigate(`/profile/${encodeURIComponent(firstPlace.username)}`)}
                className="relative rounded-3xl border-2 border-red-500/70 bg-gradient-to-b from-[#221217] to-[#14141c] p-7 text-center cursor-pointer transition-all hover:scale-[1.03] shadow-[0_0_30px_rgba(220,38,38,0.2)] order-1 md:order-2"
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center justify-center">
                  <img src={crownImage} alt="Mahkota" className="h-8 w-8 drop-shadow-md" />
                </div>
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-slate-950 font-black text-xs shadow-md ring-4 ring-black mt-4">
                  1
                </div>
                <div className="relative mx-auto mb-3 h-24 w-24 rounded-full border-4 border-amber-400 overflow-hidden shadow-2xl mt-3">
                  {firstPlace.profile_image && !brokenImageIds.has(firstPlace.id) ? (
                    <img
                      src={getImageUrl(firstPlace.profile_image)}
                      alt={firstPlace.name}
                      className="h-full w-full object-cover"
                      onError={() => markImageBroken(firstPlace.id)}
                    />
                  ) : (
                    <div className={`h-full w-full ${avatarSeed(firstPlace.name)} flex items-center justify-center text-2xl font-black`}>
                      {firstPlace.name.charAt(0)}
                    </div>
                  )}
                </div>
                <h3 className="text-lg font-extrabold text-white truncate">{firstPlace.name}</h3>
                <p className="text-xs text-red-400 font-medium truncate">@{firstPlace.username || 'user'}</p>

                <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-black/60 border border-red-500/20 p-3 text-center shadow-inner">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Level</p>
                    <p className="text-sm font-black text-amber-400 mt-0.5">{firstPlace.level || 1}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">XP Bulanan</p>
                    <p className="text-sm font-black text-red-400 mt-0.5">{(firstPlace.points || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {/* RANK 3 */}
            {thirdPlace && (
              <div
                onClick={() => thirdPlace.username && navigate(`/profile/${encodeURIComponent(thirdPlace.username)}`)}
                className="relative rounded-3xl border border-white/10 bg-[#14141c] p-6 text-center cursor-pointer transition-all hover:border-white/20 hover:scale-[1.02] shadow-xl order-3"
              >
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-amber-700 text-white font-extrabold text-xs shadow-md ring-4 ring-black">
                  3
                </div>
                <div className="relative mx-auto mb-3 h-20 w-20 rounded-full border-2 border-amber-600 overflow-hidden shadow-lg">
                  {thirdPlace.profile_image && !brokenImageIds.has(thirdPlace.id) ? (
                    <img
                      src={getImageUrl(thirdPlace.profile_image)}
                      alt={thirdPlace.name}
                      className="h-full w-full object-cover"
                      onError={() => markImageBroken(thirdPlace.id)}
                    />
                  ) : (
                    <div className={`h-full w-full ${avatarSeed(thirdPlace.name)} flex items-center justify-center text-xl font-black`}>
                      {thirdPlace.name.charAt(0)}
                    </div>
                  )}
                </div>
                <h3 className="text-base font-bold text-white truncate">{thirdPlace.name}</h3>
                <p className="text-xs text-gray-400 truncate">@{thirdPlace.username || 'user'}</p>

                <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-black/40 border border-white/5 p-2.5 text-center">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">Level</p>
                    <p className="text-xs font-black text-white mt-0.5">{thirdPlace.level || 1}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400">XP Bulanan</p>
                    <p className="text-xs font-black text-red-400 mt-0.5">{(thirdPlace.points || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. SEARCH BAR & CONTROLS */}
        <div className="rounded-2xl border border-white/10 bg-[#14141c] p-3 sm:p-4 shadow-xl">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari username..."
              className="w-full rounded-xl border border-white/10 bg-black/50 pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-red-500/60 focus:outline-none"
            />
          </div>
        </div>

        {/* 3. USER RANK LIST TABLE */}
        <div className="rounded-3xl border border-white/10 bg-[#14141c] overflow-hidden shadow-2xl">
          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-12 gap-3 px-6 py-4 border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            <div className="col-span-1">Rank</div>
            <div className="col-span-5">Pengguna</div>
            <div className="col-span-3 text-center">Tingkatan Level</div>
            <div className="col-span-3 text-right">XP Bulan Ini</div>
          </div>

          <div className="divide-y divide-white/5">
            {loading ? (
              <div className="p-6 space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-12 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="p-8 text-center text-red-500 text-sm font-semibold">{error}</div>
            ) : filteredLeaderboard.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Tidak ada data pengguna ditemukan.</div>
            ) : (
              filteredLeaderboard.map((player) => {
                const isUserRow = player.id === user?.id;
                const { label: badgeLabel, badgeClass } = getLevelBadgeStyle(player.level);

                return (
                  <Link
                    key={player.id || player.rank}
                    to={player.username ? `/profile/${encodeURIComponent(player.username)}` : '#'}
                    className={`flex flex-col sm:grid sm:grid-cols-12 gap-3 px-4 sm:px-6 py-4 transition-colors items-center ${
                      isUserRow
                        ? "bg-red-950/40 border-l-4 border-red-600 ring-1 ring-red-500/40"
                        : "hover:bg-white/[0.04]"
                    }`}
                  >
                    {/* Rank Number */}
                    <div className="col-span-1 flex items-center gap-2 sm:justify-start w-full sm:w-auto">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full font-black text-xs ${
                          player.rank === 1
                            ? "bg-amber-500 text-slate-950"
                            : player.rank === 2
                            ? "bg-slate-400 text-slate-950"
                            : player.rank === 3
                            ? "bg-amber-700 text-white"
                            : "bg-white/10 text-gray-300"
                        }`}
                      >
                        {player.rank}
                      </div>
                      <span className="sm:hidden text-xs text-gray-400 font-semibold">Rank #{player.rank}</span>
                    </div>

                    {/* User Info */}
                    <div className="col-span-5 flex items-center gap-3 w-full">
                      <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden border border-white/10">
                        {player.profile_image && !brokenImageIds.has(player.id) ? (
                          <img
                            src={getImageUrl(player.profile_image)}
                            alt={player.name}
                            className="h-full w-full object-cover"
                            onError={() => markImageBroken(player.id)}
                          />
                        ) : (
                          <div className={`h-full w-full ${avatarSeed(player.name)} flex items-center justify-center font-extrabold text-sm text-white`}>
                            {player.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-white text-sm truncate">{player.name}</p>
                          {player.role === 'vip' || player.membership_active ? (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-black text-amber-300 border border-amber-500/30">
                              VIP
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-gray-400 truncate">@{player.username || 'user'}</p>
                      </div>
                    </div>

                    {/* Level Badge */}
                    <div className="col-span-3 flex justify-start sm:justify-center w-full">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide uppercase ${badgeClass}`}>
                        {badgeLabel}
                      </span>
                    </div>

                    {/* XP Only */}
                    <div className="col-span-3 flex items-center justify-between sm:justify-end gap-2 w-full text-right">
                      <div>
                        <p className="text-sm font-black text-red-400">{(player.points || 0).toLocaleString()} <span className="text-[10px] text-gray-400 font-semibold">XP</span></p>
                      </div>
                    </div>
                  </Link>
                );
              })
            )}
          </div>

          {/* Pagination Controls */}
          {!loading && !error && totalPages > 1 && (
            <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between gap-3 text-sm">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Sebelumnya</span>
              </button>
              <span className="text-xs font-semibold text-gray-400">
                Halaman {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <span>Berikutnya</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <LiveChatWidget />
    </div>
  );
};

export default Leaderboard;
