import { useEffect, useRef, useState } from 'react';

/**
 * Sembunyikan elemen floating saat scroll ke bawah, tampilkan lagi saat scroll ke atas.
 * @param {boolean} [enabled=true] — nonaktifkan (mis. saat panel chat terbuka)
 */
export function useScrollHide(enabled = true) {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const scrollTicking = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return undefined;
    }

    const onScroll = () => {
      if (scrollTicking.current) return;
      scrollTicking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 48) {
          setHidden(false);
        } else if (y > lastScrollY.current + 12) {
          setHidden(true);
        } else if (y < lastScrollY.current - 12) {
          setHidden(false);
        }
        lastScrollY.current = y;
        scrollTicking.current = false;
      });
    };

    const onViewportChange = () => {
      setHidden(false);
      lastScrollY.current = window.scrollY;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    const vv = window.visualViewport;
    vv?.addEventListener('resize', onViewportChange);
    vv?.addEventListener('scroll', onViewportChange);

    return () => {
      window.removeEventListener('scroll', onScroll);
      vv?.removeEventListener('resize', onViewportChange);
      vv?.removeEventListener('scroll', onViewportChange);
    };
  }, [enabled]);

  return hidden;
}
