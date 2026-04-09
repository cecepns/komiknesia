import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Crown } from "lucide-react";
import crownImage from "../assets/leaderboard/crown.png";
import diamondImage from "../assets/leaderboard/diamond.png";
import { apiClient, getImageUrl } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

function avatarSeed(name) {
  const colors = [
    "bg-cyan-500",
    "bg-fuchsia-500",
    "bg-indigo-500",
    "bg-emerald-500",
    "bg-orange-500",
    "bg-pink-500",
  ];
  const total = name.split("").reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return colors[total % colors.length];
}

const Leaderboard = () => {
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [brokenImageIds, setBrokenImageIds] = useState(() => new Set());
  const { user } = useAuth();

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await apiClient.getLeaderboard(100);
        setLeaderboardData(res?.data || []);
        setCurrentUserRank(res?.current_user || null);
      } catch (e) {
        setError(e?.message || "Gagal memuat leaderboard");
      } finally {
        setLoading(false);
      }
    };
    loadLeaderboard();
  }, []);

  const topThree = useMemo(() => leaderboardData.slice(0, 3), [leaderboardData]);
  const podiumData = useMemo(() => [topThree[1], topThree[0], topThree[2]].filter(Boolean), [topThree]);
  const podiumSkeletonHeights = ["h-36 sm:h-44", "h-44 sm:h-52", "h-32 sm:h-40"];
  const currentUserInTopList = useMemo(
    () => !!currentUserRank && leaderboardData.some((row) => row.id === currentUserRank.id),
    [currentUserRank, leaderboardData]
  );

  const markImageBroken = (id) => {
    if (!id) return;
    setBrokenImageIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100 pt-5 md:pt-20 pb-4">
      <Helmet>
        <title>Leaderboard | KomikNesia</title>
        <meta
          name="description"
          content="Lihat leaderboard komunitas KomikNesia dan cek posisi peringkatmu hari ini."
        />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl dark:border-white/20 dark:bg-white/10 dark:backdrop-blur-2xl dark:shadow-[0_25px_80px_-25px_rgba(0,0,0,0.75)]">
          <div className="p-6 md:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400">
                  KomikNesia Arena
                </p>
                <h1 className="text-2xl md:text-3xl font-bold mt-1">Leaderboard</h1>
              </div>
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-gray-700 text-xs dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200">
                <Crown className="h-4 w-4 text-amber-500" />
                Ranked by community points
              </div>
            </div>

            <div className="mb-8 rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-50 to-gray-100 p-3 sm:p-4 dark:border-white/15 dark:from-white/10 dark:to-white/5">
              <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end">
                {loading
                  ? podiumSkeletonHeights.map((barHeight, index) => (
                      <div key={`podium-skeleton-${index}`} className="flex flex-col items-center text-center animate-pulse">
                        <div className={`relative mb-2 ${index === 1 ? "mt-0" : "mt-6 sm:mt-8"}`}>
                          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-gray-300 dark:bg-gray-700" />
                        </div>
                        <div className="h-3 sm:h-4 w-16 bg-gray-300 dark:bg-gray-700 rounded" />
                        <div className="mt-2 h-3 w-12 bg-gray-300 dark:bg-gray-700 rounded" />
                        <div className={`mt-2 w-full rounded-t-xl ${barHeight} bg-gray-300 dark:bg-gray-700`} />
                      </div>
                    ))
                  : podiumData.map((player) => {
                      const isChampion = player.rank === 1;
                      const isSecond = player.rank === 2;
                      const barHeight = isChampion ? "h-44 sm:h-52" : isSecond ? "h-36 sm:h-44" : "h-32 sm:h-40";
                      return (
                        <div key={player.id || player.rank} className="flex flex-col items-center text-center">
                          <div className={`relative mb-2 ${isChampion ? "mt-0" : "mt-6 sm:mt-8"}`}>
                            {isChampion && (
                              <img
                                src={crownImage}
                                alt="Mahkota juara"
                                className="absolute -top-9 left-1/2 -translate-x-1/2 h-8 w-8 sm:h-10 sm:w-10 drop-shadow-[0_8px_14px_rgba(245,158,11,0.6)]"
                              />
                            )}
                            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full border-4 border-white dark:border-gray-900 overflow-hidden">
                              {player.profile_image && !brokenImageIds.has(player.id) ? (
                                <img
                                  src={getImageUrl(player.profile_image)}
                                  alt={player.name}
                                  className="h-full w-full object-cover"
                                  onError={() => markImageBroken(player.id)}
                                />
                              ) : (
                                <div
                                  className={`h-full w-full ${avatarSeed(
                                    player.name
                                  )} flex items-center justify-center text-sm sm:text-lg font-extrabold`}
                                >
                                  {player.name.charAt(0)}
                                </div>
                              )}
                            </div>
                          </div>

                          <p className="text-[11px] sm:text-sm font-bold truncate w-full px-1">{player.name}</p>
                          <div className="mt-1 flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <img src={diamondImage} alt="Diamond" className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                            <span>{player.points.toLocaleString()}</span>
                          </div>

                          <div
                            className={`mt-2 w-full rounded-t-xl ${barHeight} ${
                              isChampion
                                ? "bg-gradient-to-b from-orange-400 to-orange-500"
                                : isSecond
                                  ? "bg-gradient-to-b from-slate-400 to-slate-500"
                                  : "bg-gradient-to-b from-cyan-500 to-cyan-600"
                            } flex flex-col items-center justify-between py-2 sm:py-3 text-white shadow-lg`}
                          >
                            <span className="text-[10px] sm:text-xs font-semibold opacity-90">Level {player.level}</span>
                            <span className="text-2xl sm:text-3xl font-bold">{player.rank}</span>
                          </div>
                        </div>
                      );
                    })}
              </div>
            </div>

            <div className="rounded-2xl bg-gray-50 border border-gray-200 overflow-hidden dark:bg-gray-800/50 dark:border-gray-700">
              <div className="max-h-[460px] overflow-y-auto">
                {loading && (
                  <div className="p-4 space-y-3">
                    {[...Array(8)].map((_, idx) => (
                      <div
                        key={`list-skeleton-${idx}`}
                        className="flex items-center gap-3 px-4 md:px-5 py-3.5 border-b border-gray-200/70 dark:border-gray-700/60 last:border-b-0 animate-pulse"
                      >
                        <div className="h-5 w-6 rounded bg-gray-300 dark:bg-gray-700" />
                        <div className="h-9 w-9 rounded-full bg-gray-300 dark:bg-gray-700" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="h-3.5 w-32 rounded bg-gray-300 dark:bg-gray-700" />
                          <div className="h-3 w-20 rounded bg-gray-300 dark:bg-gray-700" />
                        </div>
                        <div className="h-4 w-24 rounded bg-gray-300 dark:bg-gray-700" />
                      </div>
                    ))}
                  </div>
                )}
                {error && (
                  <div className="p-6 text-center text-red-500">{error}</div>
                )}
                {!loading && leaderboardData.map((player) => (
                  <div
                    key={player.id || player.rank}
                    className={`flex items-center gap-3 px-4 md:px-5 py-3.5 border-b border-gray-200/70 dark:border-gray-700/60 last:border-b-0 ${
                      player.id === user?.id
                        ? "bg-emerald-50 ring-1 ring-emerald-300 dark:bg-emerald-900/20 dark:ring-emerald-700"
                        : player.rank <= 3
                          ? "bg-amber-50/40 dark:bg-amber-900/10"
                          : "bg-transparent"
                    }`}
                  >
                    <div className="w-8 flex items-center justify-center">
                      {player.rank === 1 ? (
                        <img src={crownImage} alt="Rank 1" className="h-6 w-6" />
                      ) : (
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{player.rank}</span>
                      )}
                    </div>

                    <div className="h-9 w-9 rounded-full overflow-hidden">
                      {player.profile_image && !brokenImageIds.has(player.id) ? (
                        <img
                          src={getImageUrl(player.profile_image)}
                          alt={player.name}
                          className="h-full w-full object-cover"
                          onError={() => markImageBroken(player.id)}
                        />
                      ) : (
                        <div
                          className={`h-full w-full rounded-full ${avatarSeed(
                            player.name
                          )} flex items-center justify-center font-bold text-sm`}
                        >
                          {player.name.charAt(0)}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{player.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Level {player.level}</p>
                    </div>

                    <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100">
                      <img src={diamondImage} alt="Diamond" className="h-4 w-4" />
                      <span>{player.points.toLocaleString()} pts</span>
                    </div>
                  </div>
                ))}
                {!loading && !error && leaderboardData.length === 0 && (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">Belum ada data leaderboard.</div>
                )}
              </div>
            </div>

            {!loading && !error && currentUserRank && !currentUserInTopList && (
              <div className="mt-4 rounded-2xl border border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20 overflow-hidden">
                <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Posisi Kamu
                </div>
                <div className="flex items-center gap-3 px-4 md:px-5 py-3.5 border-t border-emerald-200 dark:border-emerald-800">
                  <div className="w-8 flex items-center justify-center">
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{currentUserRank.rank}</span>
                  </div>
                  <div className="h-9 w-9 rounded-full overflow-hidden">
                    {currentUserRank.profile_image && !brokenImageIds.has(currentUserRank.id) ? (
                      <img
                        src={getImageUrl(currentUserRank.profile_image)}
                        alt={currentUserRank.name}
                        className="h-full w-full object-cover"
                        onError={() => markImageBroken(currentUserRank.id)}
                      />
                    ) : (
                      <div
                        className={`h-full w-full rounded-full ${avatarSeed(
                          currentUserRank.name
                        )} flex items-center justify-center font-bold text-sm`}
                      >
                        {currentUserRank.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{currentUserRank.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Level {currentUserRank.level}</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100">
                    <img src={diamondImage} alt="Diamond" className="h-4 w-4" />
                    <span>{currentUserRank.points.toLocaleString()} pts</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
