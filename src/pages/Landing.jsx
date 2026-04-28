import { useState } from "react";
import { ExternalLink, Flame, BookOpen, Crown, Smartphone, Moon, Sun, ChevronDown, Sparkles } from "lucide-react";
import logo from "../assets/logo.png";
import discordIcon from "../assets/discord.svg";

const ctaItems = [
  {
    title: "Baca Manga",
    subtitle: "Ribuan judul manga, manhwa & manhua gratis",
    href: "https://02.komiknesia.asia/",
    icon: BookOpen,
    iconWrapClass: "bg-cyan-100 ring-cyan-200",
    iconWrapClassDark: "bg-[#38bdf8] ring-[#38bdf8]",
    iconClass: "text-cyan-700",
    iconClassDark: "text-white",
    badge: "Hot",
    badgeClass: "bg-amber-400 text-amber-900",
  },
  {
    title: "Upgrade ke Premium",
    subtitle: "Baca tanpa iklan & fitur eksklusif",
    href: "https://02.komiknesia.asia/premium",
    icon: Crown,
    iconWrapClass: "bg-amber-100 ring-amber-300",
    iconWrapClassDark: "bg-[#facc15] ring-[#facc15]",
    iconClass: "text-amber-700",
    iconClassDark: "text-[#0f3b62]",
  },
  {
    title: "Join Discord",
    subtitle: "Komunitas pembaca & update info terbaru",
    href: "https://discord.gg/dgC22PSm9h",
    customIcon: discordIcon,
    iconWrapClass: "bg-[#5865F2] ring-[#7c85f7]",
    iconWrapClassDark: "bg-[#5865F2] ring-[#7c85f7]",
  },
  // {
  //   title: "Download Appnya",
  //   subtitle: "Baca manga lebih nyaman di aplikasi",
  //   href: "https://02.komiknesia.asia/",
  //   icon: Smartphone,
  //   iconWrapClass: "bg-emerald-100 ring-emerald-200",
  //   iconWrapClassDark: "bg-[#7dd3fc] ring-[#7dd3fc]",
  //   iconClass: "text-emerald-700",
  //   iconClassDark: "text-white",
  // },
];

const stats = [
  { value: "5000+", label: "Judul Komik" },
  { value: "100K+", label: "Chapter" },
  { value: "24/7", label: "Update Harian" },
];

const genreItems = [
  "Action",
  "Romance",
  "Fantasy",
  "Comedy",
  "Adventure",
  "Martial Arts",
  "Shounen",
  "Seinen",
  "Isekai",
  "Slice of Life",
  "Horror",
  "School Life",
  "Drama",
  "Harem",
  "Supernatural",
  "Ecchi",
];

const faqItems = [
  {
    question: "Apa itu Komiknesia?",
    answer:
      "Komiknesia adalah platform baca komik online yang menyediakan manga (Jepang), manhwa (Korea), dan manhua (China) dalam bahasa Indonesia secara gratis. Komiknesia telah dipercaya oleh ratusan ribu pembaca di seluruh Indonesia.",
  },
  {
    question: "Apakah Komiknesia gratis?",
    answer:
      "Ya! Kamu bisa membaca semua manga, manhwa, dan manhua di Komiknesia secara gratis. Tersedia juga opsi Premium untuk pengalaman tanpa iklan dan fitur eksklusif lainnya.",
  },
  {
    question: "Apa domain resmi Komiknesia?",
    answer:
      "Domain utama Komiknesia untuk baca manga adalah 02.komiknesia.asia. Hati-hati dengan domain lain yang mengatasnamakan Komiknesia dan pastikan kamu selalu mengakses domain resmi.",
  },
  {
    question: "Genre apa saja yang tersedia?",
    answer:
      "Komiknesia menyediakan banyak genre termasuk Action, Romance, Fantasy, Comedy, Slice of Life, Martial Arts, Isekai, Horror, Seinen, Shounen, dan masih banyak lagi.",
  },
  {
    question: "Bagaimana cara baca manga di Komiknesia?",
    answer:
      'Sangat mudah! Klik tombol "Baca Manga" di atas, cari judul manga yang kamu inginkan, pilih chapter, dan mulai membaca. Kamu juga bisa memakai aplikasi Android untuk pengalaman membaca yang lebih nyaman.',
  },
  // {
  //   question: "Apakah tersedia aplikasi Komiknesia?",
  //   answer:
  //     "Ya! Komiknesia tersedia dalam bentuk aplikasi Android yang bisa kamu download. Dengan aplikasi Komiknesia, kamu bisa membaca manga lebih nyaman dan mendapatkan notifikasi chapter terbaru.",
  // },
];

const decorativeStars = [
  { top: "8%", left: "10%", size: 16, rotate: "-12deg" },
  { top: "14%", right: "8%", size: 14, rotate: "8deg" },
  { top: "32%", left: "6%", size: 12, rotate: "20deg" },
  { top: "42%", right: "12%", size: 18, rotate: "-10deg" },
  { top: "58%", left: "9%", size: 14, rotate: "15deg" },
  { top: "73%", right: "7%", size: 12, rotate: "-6deg" },
  { top: "86%", left: "12%", size: 16, rotate: "12deg" },
];

const Landing = () => {
  const [isLightMode, setIsLightMode] = useState(false);
  const [openFaqItems, setOpenFaqItems] = useState(() => new Set([faqItems[0]?.question]));

  const allFaqOpen = openFaqItems.size === faqItems.length;

  const toggleFaq = (question) => {
    setOpenFaqItems((prev) => {
      const next = new Set(prev);
      if (next.has(question)) {
        next.delete(question);
      } else {
        next.add(question);
      }
      return next;
    });
  };

  const toggleAllFaq = () => {
    setOpenFaqItems(() => {
      if (allFaqOpen) return new Set();
      return new Set(faqItems.map((item) => item.question));
    });
  };

  return (
    <main
      className={`relative min-h-screen overflow-hidden transition-colors duration-300 ${
        isLightMode ? "bg-white text-gray-900" : "bg-gray-950 text-gray-100"
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 ${
          isLightMode
            ? "bg-[radial-gradient(circle_at_15%_20%,rgba(14,165,233,0.08),transparent_35%),radial-gradient(circle_at_85%_75%,rgba(239,68,68,0.08),transparent_35%)]"
            : "bg-[radial-gradient(circle_at_15%_20%,rgba(56,189,248,0.12),transparent_35%),radial-gradient(circle_at_85%_75%,rgba(248,113,113,0.12),transparent_35%)]"
        }`}
      />
      <div
        className={`pointer-events-none absolute inset-0 [background-size:36px_36px] ${
          isLightMode
            ? "opacity-10 [background-image:radial-gradient(circle,rgba(2,6,23,0.2)_1px,transparent_1px)]"
            : "opacity-15 [background-image:radial-gradient(circle,rgba(255,255,255,0.25)_1px,transparent_1px)]"
        }`}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {decorativeStars.map((star, index) => (
          <svg
            key={`${star.top}-${index}`}
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={`${isLightMode ? "text-amber-400/70" : "text-yellow-300/70"} absolute`}
            style={{
              top: star.top,
              left: star.left,
              right: star.right,
              width: `${star.size}px`,
              height: `${star.size}px`,
              transform: `rotate(${star.rotate})`,
            }}
          >
            <path
              fill="currentColor"
              d="M12 2.5l2.2 6.1 6.3 2.2-6.3 2.2-2.2 6.1-2.2-6.1-6.3-2.2 6.3-2.2L12 2.5z"
            />
          </svg>
        ))}
      </div>

      <section className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center px-4 pb-12 pt-10 sm:px-6">
        <button
          type="button"
          onClick={() => setIsLightMode((prev) => !prev)}
          className={`absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors sm:right-6 ${
            isLightMode
              ? "border-sky-400/40 bg-white text-sky-600 hover:bg-sky-50"
              : "border-cyan-200/40 bg-[#0b355f] text-cyan-100 hover:bg-[#124777]"
          }`}
          aria-label={isLightMode ? "Aktifkan dark mode" : "Aktifkan light mode"}
        >
          {isLightMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </button>

        <img src={logo} alt="KomikNesia" className="w-44 sm:w-56" />

        <div
          className={`mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ring-1 sm:text-sm ${
            isLightMode
              ? "bg-sky-300/30 text-sky-900 ring-sky-500/30"
              : "bg-cyan-400/20 text-cyan-100 ring-cyan-300/40"
          }`}
        >
          <Flame className={`h-4 w-4 ${isLightMode ? "text-sky-700" : "text-cyan-200"}`} />
          Baca manga, manhwa & manhua favoritmu di sini !!
        </div>

        <div className="mt-7 w-full space-y-4">
          {ctaItems.map((item) => {
            const Icon = item.icon;

            return (
              <a
                key={item.title}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`group flex w-full items-center justify-between rounded-3xl border px-4 py-4 shadow-[0_7px_0_0_#dc2626] transition-all duration-200 hover:-translate-y-0.5 ${
                  isLightMode
                    ? "border-sky-300/70 bg-white/95 hover:bg-sky-50"
                    : "border-cyan-200/40 bg-[#0b355f]/95 hover:bg-[#124777]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${
                      isLightMode
                        ? item.iconWrapClass || "bg-sky-100 ring-sky-200"
                        : item.iconWrapClassDark || "bg-cyan-300/25 ring-cyan-200/35"
                    }`}
                  >
                    {item.customIcon ? (
                      <img src={item.customIcon} alt="" aria-hidden="true" className="h-5 w-5" />
                    ) : (
                      Icon && (
                        <Icon
                          className={`h-5 w-5 ${
                            isLightMode
                              ? item.iconClass || "text-sky-700"
                              : item.iconClassDark || "text-cyan-100"
                          }`}
                        />
                      )
                    )}
                  </span>

                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className={`text-base font-bold sm:text-xl ${isLightMode ? "text-[#163a5f]" : "text-cyan-50"}`}>
                        {item.title}
                      </p>
                      {item.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${item.badgeClass}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs sm:text-sm ${isLightMode ? "text-sky-800/80" : "text-cyan-100/80"}`}>
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                <ExternalLink
                  className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${
                    isLightMode ? "text-sky-600" : "text-cyan-200"
                  }`}
                />
              </a>
            );
          })}
        </div>

        <div
          className={`mt-8 grid w-full grid-cols-3 gap-3 rounded-3xl border p-4 shadow-[0_7px_0_0_#dc2626] ${
            isLightMode
              ? "border-sky-300/60 bg-white/95"
              : "border-cyan-200/30 bg-[#0b355f]/90"
          }`}
        >
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl p-3 text-center ${isLightMode ? "bg-sky-100/80" : "bg-[#0a2d52]"}`}
            >
              <p className={`text-lg font-bold sm:text-2xl ${isLightMode ? "text-sky-700" : "text-cyan-200"}`}>
                {stat.value}
              </p>
              <p className={`text-[11px] sm:text-xs ${isLightMode ? "text-sky-900/70" : "text-cyan-100/80"}`}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 w-full space-y-5">
          <section
            className={`rounded-3xl border p-5 shadow-[0_7px_0_0_#dc2626] sm:p-6 ${
              isLightMode ? "border-sky-300/60 bg-white/95" : "border-cyan-200/30 bg-[#0b355f]/90"
            }`}
          >
            <h2 className={`text-2xl font-extrabold ${isLightMode ? "text-[#163a5f]" : "text-cyan-50"}`}>
              Apa itu Komiknesia? <span className="align-middle">🎌</span>
            </h2>
            <p className={`mt-3 text-sm leading-7 sm:text-base ${isLightMode ? "text-sky-900/80" : "text-cyan-100/80"}`}>
              Komiknesia adalah platform baca manga, manhwa, dan manhua online berbahasa Indonesia yang paling
              lengkap dan terupdate. Dengan ribuan judul dari berbagai genre, Komiknesia menjadi pilihan utama para
              pecinta komik Jepang, Korea, dan China di Indonesia.
            </p>
            <p className={`mt-3 text-sm leading-7 sm:text-base ${isLightMode ? "text-sky-900/80" : "text-cyan-100/80"}`}>
              Nikmati pengalaman membaca yang nyaman dengan update chapter terbaru setiap hari, tampilan modern yang
              responsif di semua perangkat, dan fitur bookmark untuk menyimpan manga favoritmu. Semua bisa kamu akses
              secara gratis!
            </p>
          </section>

          <section
            className={`rounded-3xl border p-5 shadow-[0_7px_0_0_#dc2626] sm:p-6 ${
              isLightMode ? "border-sky-300/60 bg-white/95" : "border-cyan-200/30 bg-[#0b355f]/90"
            }`}
          >
            <h2 className={`text-2xl font-extrabold ${isLightMode ? "text-[#163a5f]" : "text-cyan-50"}`}>
              Jelajahi Genre <span className="align-middle">🔍</span>
            </h2>
            <p className={`mt-3 text-sm sm:text-base ${isLightMode ? "text-sky-900/80" : "text-cyan-100/80"}`}>
              Temukan manga, manhwa, dan manhua sesuai genre favoritmu:
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {genreItems.map((genre) => (
                <span
                  key={genre}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:text-sm ${
                    isLightMode
                      ? "bg-sky-100 text-sky-700 ring-1 ring-sky-200 hover:bg-sky-600 hover:text-white hover:ring-sky-600"
                      : "bg-[#0a2d52] text-cyan-100 ring-1 ring-cyan-200/30 hover:bg-cyan-500 hover:text-slate-950 hover:ring-cyan-300"
                  }`}
                >
                  {genre}
                </span>
              ))}
            </div>
          </section>

          <section
            className={`rounded-3xl border p-5 shadow-[0_7px_0_0_#dc2626] sm:p-6 ${
              isLightMode ? "border-sky-300/60 bg-white/95" : "border-cyan-200/30 bg-[#0b355f]/90"
            }`}
          >
            <h2 className={`text-2xl font-extrabold ${isLightMode ? "text-[#163a5f]" : "text-cyan-50"}`}>
              Kenapa Komiknesia? <span className="align-middle">⚡</span>
            </h2>
            <ul className={`mt-4 space-y-3 text-sm leading-7 sm:text-base ${isLightMode ? "text-sky-900/80" : "text-cyan-100/80"}`}>
              <li>📚 <strong>Koleksi Terlengkap</strong> — Ribuan judul manga, manhwa (komik Korea), dan manhua (komik China) tersedia dalam bahasa Indonesia.</li>
              <li>⚡ <strong>Update Tercepat</strong> — Chapter terbaru langsung tersedia begitu dirilis. Jangan sampai ketinggalan!</li>
              <li>📱 <strong>Baca di Mana Saja</strong> — Tampilan responsif yang nyaman di HP, tablet, maupun laptop. Tersedia juga aplikasi Android.</li>
              <li>🔖 <strong>Bookmark & Riwayat</strong> — Simpan manga favoritmu dan lanjutkan membaca dari halaman terakhir.</li>
              <li>🌙 <strong>Mode Gelap</strong> — Baca manga dengan nyaman di malam hari tanpa menyakiti mata.</li>
              <li>💎 <strong>Premium Tanpa Iklan</strong> — Upgrade ke Premium untuk pengalaman membaca yang lebih nyaman tanpa gangguan iklan.</li>
            </ul>
          </section>

          <section
            className={`rounded-3xl border p-5 shadow-[0_7px_0_0_#dc2626] sm:p-6 ${
              isLightMode ? "border-sky-300/60 bg-white/95" : "border-cyan-200/30 bg-[#0b355f]/90"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={`text-2xl font-extrabold ${isLightMode ? "text-[#163a5f]" : "text-cyan-50"}`}>
                FAQ <span className="align-middle">❓</span>
              </h2>
              <button
                type="button"
                onClick={toggleAllFaq}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
                  isLightMode
                    ? "bg-sky-100 text-sky-700 hover:bg-sky-200"
                    : "bg-[#0a2d52] text-cyan-100 hover:bg-[#124777]"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {allFaqOpen ? "Tutup semua" : "Buka semua"}
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {faqItems.map((item) => (
                <div
                  key={item.question}
                  className={`rounded-2xl p-3 transition-colors sm:p-4 ${
                    isLightMode ? "bg-sky-50" : "bg-[#0a2d52]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(item.question)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                    aria-expanded={openFaqItems.has(item.question)}
                  >
                    <h3 className={`text-base font-bold ${isLightMode ? "text-[#163a5f]" : "text-cyan-50"}`}>
                      {item.question}
                    </h3>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 transition-transform ${
                        openFaqItems.has(item.question)
                          ? "rotate-180"
                          : "rotate-0"
                      } ${isLightMode ? "text-sky-700" : "text-cyan-100"}`}
                    />
                  </button>
                  <div
                    className={`grid transition-all duration-300 ${
                      openFaqItems.has(item.question)
                        ? "mt-2 grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <p
                      className={`overflow-hidden text-sm leading-7 sm:text-base ${
                        isLightMode ? "text-sky-900/80" : "text-cyan-100/80"
                      }`}
                    >
                      {item.answer}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section
            className={`rounded-3xl border p-5 shadow-[0_7px_0_0_#dc2626] sm:p-6 ${
              isLightMode ? "border-sky-300/60 bg-white/95" : "border-cyan-200/30 bg-[#0b355f]/90"
            }`}
          >
            <h2 className={`text-2xl font-extrabold ${isLightMode ? "text-[#163a5f]" : "text-cyan-50"}`}>
              Baca Manga Bahasa Indonesia di Komiknesia <span className="align-middle">📖</span>
            </h2>
            <p className={`mt-3 text-sm leading-7 sm:text-base ${isLightMode ? "text-sky-900/80" : "text-cyan-100/80"}`}>
              Mencari tempat baca manga bahasa Indonesia yang lengkap dan gratis? Komiknesia hadir sebagai solusi untuk
              kamu yang ingin menikmati komik Jepang, manhwa Korea, dan manhua China dengan terjemahan bahasa
              Indonesia berkualitas.
            </p>
            <p className={`mt-3 text-sm leading-7 sm:text-base ${isLightMode ? "text-sky-900/80" : "text-cyan-100/80"}`}>
              Di Komiknesia, kamu bisa menemukan judul-judul populer yang selalu update setiap hari. Dari genre
              action, romance, fantasy, hingga slice of life semuanya tersedia lengkap. Komiknesia juga mendukung
              fitur pencarian canggih, filter berdasarkan genre dan status, serta sistem bookmark agar kamu tidak
              pernah kehilangan jejak bacaanmu.
            </p>
            <p className={`mt-3 text-sm leading-7 sm:text-base ${isLightMode ? "text-sky-900/80" : "text-cyan-100/80"}`}>
              Bergabunglah dengan komunitas Komiknesia di Discord untuk berdiskusi, mendapatkan rekomendasi, dan
              selalu update dengan informasi terbaru seputar manga, manhwa, dan manhua favoritmu.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
};

export default Landing;
