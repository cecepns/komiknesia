import { useSyncExternalStore } from "react";

const MD_UP = "(min-width: 768px)";

function subscribe(onStoreChange) {
  const mq = window.matchMedia(MD_UP);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(MD_UP).matches;
}

/** SSR / prerender: anggap desktop agar tidak memotong daftar */
function getServerSnapshot() {
  return true;
}

/** True jika lebar viewport ≥ breakpoint `md` Tailwind (768px). */
export function useIsMdUp() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
