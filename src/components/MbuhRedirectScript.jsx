import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../utils/api";

const SCRIPT_DATA_ATTR = "data-mbuh-redirect";
const DEFAULT_SCRIPT_URLS = ["https://mbuh.my.id/siap/1770790072377-komiknesia.js"];
const INITIAL_DELAY_MINUTES = 5;
const STORAGE_KEY = "mbuhRedirectTimingV1";

const sanitizeScriptUrls = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((url) => /^https?:\/\//i.test(url));
};

/**
 * Script redirect/iklan mbuh — tidak dimuat untuk user premium (membership aktif).
 */
export default function MbuhRedirectScript() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return undefined;

    let isCancelled = false;
    let timeoutId = null;

    const cleanupInjectedScripts = () => {
      document.querySelectorAll(`script[${SCRIPT_DATA_ATTR}="1"]`).forEach((el) => el.remove());
    };

    if (user?.membership_active) {
      cleanupInjectedScripts();
      return undefined;
    }

    const getOrInitStartedAt = () => {
      const now = Date.now();
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Number.isFinite(parsed?.startedAt)) {
            return parsed.startedAt;
          }
        }
      } catch {
        // ignore broken localStorage and overwrite below
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ startedAt: now }));
      } catch {
        // ignore storage failures
      }
      return now;
    };

    const injectScripts = async () => {
      try {
        const settings = await apiClient.getSettings();
        if (isCancelled) return;

        const urlsFromSettings = sanitizeScriptUrls(settings?.redirect_script_urls);
        const scriptUrls = urlsFromSettings.length ? urlsFromSettings : DEFAULT_SCRIPT_URLS;

        cleanupInjectedScripts();

        scriptUrls.forEach((src, index) => {
          const script = document.createElement("script");
          script.id = `komiknesia-mbuh-redirect-script-${index + 1}`;
          script.src = src;
          script.async = true;
          script.setAttribute(SCRIPT_DATA_ATTR, "1");
          script.onload = () => {
            document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true }));
          };
          document.body.appendChild(script);
        });
      } catch (error) {
        console.error("Failed loading redirect scripts:", error);
      }
    };

    const startedAt = getOrInitStartedAt();
    const delayMs = Math.max(
      0,
      startedAt + INITIAL_DELAY_MINUTES * 60 * 1000 - Date.now()
    );

    timeoutId = window.setTimeout(injectScripts, delayMs);

    return () => {
      isCancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      cleanupInjectedScripts();
    };
  }, [loading, user?.membership_active]);

  return null;
}
