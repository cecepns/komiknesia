import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import {
  EffectCoverflow,
  EffectFade,
  Autoplay,
  Navigation,
} from "swiper/modules";
import { ChevronLeft, ChevronRight, ArrowRight, Play, Star } from "lucide-react";
import { getImageUrl } from "../utils/api";

import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/effect-fade";

function synopsisPlain(html) {
  if (!html || typeof html !== "string") return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function contentTypeLabel(type) {
  if (!type) return "MANGA";
  return String(type).replace(/_/g, " ").toUpperCase();
}

function FeaturedBannerSkeleton() {
  return (
    <div className="relative h-[520px] rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 animate-pulse">
      <div className="h-full w-full bg-gray-300 dark:bg-gray-700 md:hidden" />
      <div className="hidden h-full w-full md:flex md:flex-row">
        <div className="w-full md:w-1/2 h-full p-8 flex flex-col justify-end md:justify-center space-y-4">
          <div className="h-8 md:h-12 w-3/4 bg-gray-300 dark:bg-gray-700 rounded" />
          <div className="flex gap-3">
            <div className="h-6 w-24 bg-gray-300 dark:bg-gray-700 rounded-full" />
            <div className="h-6 w-20 bg-gray-300 dark:bg-gray-700 rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-gray-300 dark:bg-gray-700 rounded" />
            <div className="h-4 w-5/6 bg-gray-300 dark:bg-gray-700 rounded" />
          </div>
          <div className="hidden md:block h-10 w-40 bg-gray-300 dark:bg-gray-700 rounded-lg mt-2" />
        </div>
        <div className="hidden md:block w-1/2 h-full p-8">
          <div className="h-full w-64 max-w-full mx-auto bg-gray-300 dark:bg-gray-700 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function MobileCoverSlide({ item, isActive, onActivate }) {
  const content = (
    <div className="featured-coverflow-card relative mx-auto w-full max-w-[190px]">
      <img
        src={getImageUrl(item.cover)}
        alt={item.title}
        className="aspect-[2/3] w-full rounded-2xl object-cover shadow-2xl pointer-events-none"
        loading="lazy"
      />
    </div>
  );

  if (isActive) {
    return (
      <div className="featured-coverflow-hit flex h-full w-full items-start justify-center px-2 pt-1">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      className="featured-coverflow-hit flex h-full w-full items-start justify-center border-0 bg-transparent px-2 pt-1"
      aria-label={`Tampilkan ${item.title}`}
    >
      {content}
    </button>
  );
}

function MobileFeaturedMeta({ item, onReadLatest }) {
  const latest = item.lastChapters?.[0];
  const rating = item.rating != null ? Number(item.rating) : null;

  return (
    <div className="flex w-full flex-col items-center px-4 pb-4 pt-1">
      <div className="flex w-full max-w-sm flex-wrap items-center justify-center gap-2">
        <span className="rounded-md bg-[#c61737] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {contentTypeLabel(item.content_type)}
        </span>
        {rating != null && !Number.isNaN(rating) ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300">
            <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" aria-hidden />
            {rating.toFixed(1)}
          </span>
        ) : null}
        {latest?.number != null ? (
          <span className="text-xs font-medium text-white/75">
            Chapter {latest.number}
          </span>
        ) : null}
      </div>

      <Link
        to={`/komik/${item.slug}`}
        className="mt-2 line-clamp-2 max-w-sm text-center text-base font-bold leading-snug text-white transition-colors hover:text-amber-100"
      >
        {item.title}
      </Link>

      <button
        type="button"
        onClick={() => onReadLatest(latest, item.slug)}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-400 px-8 py-3 text-sm font-bold text-gray-900 shadow-md transition-colors hover:bg-amber-300"
      >
        <Play className="h-4 w-4 shrink-0 fill-current text-gray-900" aria-hidden />
        Read now
      </button>
    </div>
  );
}

function DesktopFeaturedSlide({ item, onReadLatest }) {
  const latest = item.lastChapters?.[0];
  const synopsis = synopsisPlain(item.synopsis);
  const genres = Array.isArray(item.genres) ? item.genres : [];

  return (
    <div className="relative flex h-full w-full items-center">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12 lg:gap-16">
            <div className="z-[1] space-y-4 text-center text-white md:space-y-6 md:text-left">
              {latest?.number != null && (
                <p className="text-sm font-bold uppercase tracking-wide text-white/90 md:text-base">
                  Chapter: {latest.number}
                </p>
              )}
              <Link to={`/komik/${item.slug}`}>
                <h2 className="text-2xl font-bold leading-tight line-clamp-2 cursor-pointer transition-colors hover:text-white/90 md:text-4xl lg:text-5xl">
                  {item.title}
                </h2>
              </Link>

              {synopsis ? (
                <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/85 line-clamp-3 md:mx-0 md:text-base md:line-clamp-4">
                  {synopsis}
                </p>
              ) : (
                <p className="mx-auto max-w-xl text-sm text-white/70 md:mx-0 md:text-base">
                  {item.author ? `Oleh ${item.author}` : "\u00a0"}
                </p>
              )}

              {genres.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                  {genres.slice(0, 8).map((g) => (
                    <span
                      key={g.id ?? g.slug ?? g.name}
                      className="rounded-full border border-white/50 bg-white/5 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm md:text-sm"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-4 pt-1 md:justify-start">
                <button
                  type="button"
                  onClick={() => onReadLatest(latest, item.slug)}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-8 py-3.5 text-base font-bold text-gray-900 shadow-lg transition-all hover:bg-amber-300 hover:shadow-xl"
                >
                  Mulai Baca
                  <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
                </button>
                {item.total_views != null && (
                  <span className="text-sm text-white/70">
                    <span className="font-semibold text-white/90">
                      {Number(item.total_views).toLocaleString()}
                    </span>{" "}
                    tayangan
                  </span>
                )}
              </div>
            </div>

            <div className="relative z-[1] flex justify-center lg:justify-end">
              <Link
                to={`/komik/${item.slug}`}
                className="group relative block"
                aria-label={item.title}
              >
                <div className="absolute -inset-3 rounded-3xl bg-white/10 blur-2xl transition-opacity group-hover:opacity-90" />
                <img
                  src={getImageUrl(item.cover)}
                  alt={item.title}
                  className="relative h-[22rem] w-[14rem] rounded-xl object-cover shadow-2xl ring-1 ring-white/10 transition-transform duration-300 sm:h-[24rem] sm:w-[15rem] md:h-[26rem] md:w-64 md:-rotate-[4deg] md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] group-hover:md:-rotate-[2deg]"
                />
              </Link>
            </div>
          </div>
        </div>
    </div>
  );
}

const FeaturedBanner = ({ items = [], loading = false, onReadLatest }) => {
  const [mobileIndex, setMobileIndex] = useState(0);
  const [desktopIndex, setDesktopIndex] = useState(0);
  const desktopSwiperRef = useRef(null);
  const mobileSwiperRef = useRef(null);

  if (loading) {
    return <FeaturedBannerSkeleton />;
  }

  if (!items.length) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
        <p className="text-gray-500 dark:text-gray-400">Tidak ada banner tersedia</p>
      </div>
    );
  }

  const activeMobileItem = items[mobileIndex] ?? items[0];
  const activeDesktopItem = items[desktopIndex] ?? items[0];

  return (
    <div className="featured-banner relative">
      {/* Mobile — coverflow carousel */}
      <div className="relative md:hidden">
        <div className="relative flex flex-col overflow-hidden rounded-2xl">
          <div className="absolute inset-0" aria-hidden>
            <div
              key={activeMobileItem.slug ?? activeMobileItem.id}
              className="featured-banner-bg absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${getImageUrl(activeMobileItem.cover)})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20 -bottom-1" />
          </div>

          <div className="relative z-10 flex shrink-0 items-center justify-between px-4 pt-4">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/90">
              Featured
            </span>
            {items.length > 1 ? (
              <span className="text-xs font-semibold text-white/70">
                {mobileIndex + 1}/{items.length}
              </span>
            ) : null}
          </div>

          <Swiper
            className="featured-coverflow relative z-10 w-full shrink-0"
            modules={[EffectCoverflow, Autoplay]}
            effect="coverflow"
            centeredSlides
            slidesPerView="auto"
            slideToClickedSlide
            loop={items.length > 2}
            grabCursor
            speed={500}
            autoplay={{
              delay: 5000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }}
            coverflowEffect={{
              rotate: 0,
              stretch: 36,
              depth: 100,
              modifier: 2,
              slideShadows: false,
            }}
            onSlideChange={(swiper) => setMobileIndex(swiper.realIndex)}
            onSwiper={(swiper) => {
              mobileSwiperRef.current = swiper;
              setMobileIndex(swiper.realIndex);
            }}
          >
            {items.map((item, index) => (
              <SwiperSlide key={item.id ?? item.slug} className="featured-coverflow-slide">
                <MobileCoverSlide
                  item={item}
                  isActive={index === mobileIndex}
                  onActivate={() => {
                    const swiper = mobileSwiperRef.current;
                    if (!swiper || index === swiper.realIndex) return;
                    if (items.length > 2) {
                      swiper.slideToLoop(index);
                    } else {
                      swiper.slideTo(index);
                    }
                  }}
                />
              </SwiperSlide>
            ))}
          </Swiper>

          <div className="relative z-10 -mt-1">
            <MobileFeaturedMeta
              item={activeMobileItem}
              onReadLatest={onReadLatest}
            />
          </div>
        </div>
      </div>

      {/* Desktop — fade carousel */}
      <div className="relative hidden md:block">
        <div className="relative h-[500px] overflow-hidden rounded-2xl">
          <div className="absolute inset-0" aria-hidden>
            <div
              key={activeDesktopItem.slug ?? activeDesktopItem.id}
              className="featured-banner-bg absolute inset-0 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${getImageUrl(activeDesktopItem.cover)})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/25" />
          </div>

          <Swiper
            className="featured-fade relative z-10 h-full"
            modules={[EffectFade, Autoplay, Navigation]}
            effect="fade"
            fadeEffect={{ crossFade: true }}
            loop={items.length > 1}
            speed={700}
            autoplay={{
              delay: 5000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }}
            navigation={{
              prevEl: ".featured-fade-prev",
              nextEl: ".featured-fade-next",
            }}
            onSwiper={(swiper) => {
              desktopSwiperRef.current = swiper;
            }}
            onSlideChange={(swiper) => setDesktopIndex(swiper.realIndex)}
          >
            {items.map((item) => (
              <SwiperSlide key={item.id ?? item.slug}>
                <DesktopFeaturedSlide item={item} onReadLatest={onReadLatest} />
              </SwiperSlide>
            ))}
          </Swiper>

          {items.length > 1 && (
            <>
              <button
                type="button"
                className="featured-fade-prev absolute left-4 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-3 text-white backdrop-blur-sm transition-all hover:bg-black/50"
                aria-label="Slide sebelumnya"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                className="featured-fade-next absolute right-4 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-3 text-white backdrop-blur-sm transition-all hover:bg-black/50"
                aria-label="Slide berikutnya"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>

        {items.length > 1 && (
          <div
            className="featured-banner-dots mt-4 flex max-w-full justify-center gap-2.5 overflow-x-auto px-4 pb-1"
            role="tablist"
            aria-label="Pilih slide banner"
          >
            {items.map((item, index) => (
              <button
                key={item.id ?? item.slug ?? index}
                type="button"
                onClick={() => desktopSwiperRef.current?.slideToLoop(index)}
                className={`shrink-0 rounded-full transition-all ${
                  index === desktopIndex
                    ? "h-3 w-8 bg-sky-600 dark:bg-white"
                    : "h-3 w-3 bg-slate-400/90 hover:bg-slate-500 dark:bg-white/45 dark:hover:bg-white/70"
                }`}
                aria-label={`Ke slide ${index + 1}`}
                aria-current={index === desktopIndex ? "true" : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FeaturedBanner;
