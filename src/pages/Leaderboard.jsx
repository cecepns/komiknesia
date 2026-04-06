import { Helmet } from "react-helmet-async";
import { Crown, ChevronUp, ChevronDown, Minus } from "lucide-react";
import crownImage from "../assets/leaderboard/crown.png";
import diamondImage from "../assets/leaderboard/diamond.png";

const leaderboardData = [
  { id: 1, name: "Iman", level: 32, points: 2019, trend: "up" },
  { id: 2, name: "Vatani", level: 3, points: 1952, trend: "down" },
  { id: 3, name: "Jonathan", level: 84, points: 1431, trend: "down" },
  { id: 4, name: "Paul", level: 12, points: 1241, trend: "up" },
  { id: 5, name: "Robert", level: 9, points: 1051, trend: "flat" },
  { id: 6, name: "Gwen", level: 17, points: 953, trend: "up" },
  { id: 7, name: "Emma", level: 8, points: 943, trend: "flat" },
  { id: 8, name: "Sophia", level: 21, points: 914, trend: "down" },
  { id: 9, name: "Mia", level: 18, points: 896, trend: "down" },
  { id: 10, name: "John", level: 14, points: 848, trend: "down" },
];

function rankStyle(rank) {
  if (rank === 1) return "bg-amber-500 text-amber-950";
  if (rank === 2) return "bg-slate-300 text-slate-900";
  if (rank === 3) return "bg-orange-400 text-orange-950";
  return "bg-gray-800 text-gray-100 dark:bg-gray-700 dark:text-gray-100";
}

function TrendIcon({ trend }) {
  if (trend === "up") return <ChevronUp className="h-4 w-4 text-emerald-400" />;
  if (trend === "down") return <ChevronDown className="h-4 w-4 text-rose-400" />;
  return <Minus className="h-4 w-4 text-gray-400" />;
}

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
  const topThree = leaderboardData.slice(0, 3);
  const podiumData = [topThree[1], topThree[0], topThree[2]];

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100 pb-24">
      <Helmet>
        <title>Leaderboard | KomikNesia</title>
        <meta
          name="description"
          content="Lihat leaderboard komunitas KomikNesia dan cek posisi peringkatmu hari ini."
        />
      </Helmet>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 md:pt-14">
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
                {podiumData.map((player) => {
                  const isChampion = player.id === 1;
                  const isSecond = player.id === 2;
                  const barHeight = isChampion ? "h-44 sm:h-52" : isSecond ? "h-36 sm:h-44" : "h-32 sm:h-40";
                  return (
                    <div key={player.id} className="flex flex-col items-center text-center">
                      <div className={`relative mb-2 ${isChampion ? "mt-0" : "mt-6 sm:mt-8"}`}>
                        {isChampion && (
                          <img
                            src={crownImage}
                            alt="Mahkota juara"
                            className="absolute -top-9 left-1/2 -translate-x-1/2 h-8 w-8 sm:h-10 sm:w-10 drop-shadow-[0_8px_14px_rgba(245,158,11,0.6)]"
                          />
                        )}
                        <div
                          className={`h-12 w-12 sm:h-14 sm:w-14 rounded-full ${avatarSeed(
                            player.name
                          )} border-4 border-white dark:border-gray-900 flex items-center justify-center text-sm sm:text-lg font-extrabold`}
                        >
                          {player.name.charAt(0)}
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
                        <span className="text-2xl sm:text-3xl font-bold">{player.id}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-gray-50 border border-gray-200 overflow-hidden dark:bg-gray-800/50 dark:border-gray-700">
              <div className="max-h-[460px] overflow-y-auto">
                {leaderboardData.map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center gap-3 px-4 md:px-5 py-3.5 border-b border-gray-200/70 dark:border-gray-700/60 last:border-b-0 ${
                      player.id <= 3 ? "bg-amber-50/40 dark:bg-amber-900/10" : "bg-transparent"
                    }`}
                  >
                    <div className="w-8 flex items-center justify-center">
                      {player.id === 1 ? (
                        <img src={crownImage} alt="Rank 1" className="h-6 w-6" />
                      ) : (
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{player.id}</span>
                      )}
                    </div>

                    <TrendIcon trend={player.trend} />

                    <div
                      className={`h-9 w-9 rounded-full ${avatarSeed(
                        player.name
                      )} flex items-center justify-center font-bold text-sm`}
                    >
                      {player.name.charAt(0)}
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
