const db = require('../db');
const { createShortLivedCache } = require('../utils/shortLivedCache');

const POPUP_INTERVAL_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const POPUP_INITIAL_DELAY_OPTIONS = [1, 2, 3, 5, 10, 15, 20, 30];
const POPUP_UNLOCK_SECONDS_OPTIONS = [5, 10, 15, 20, 30, 45, 60];

const settingsPublicCache = createShortLivedCache({ ttlMs: 60 * 1000, maxKeys: 8 });
const DEFAULT_REDIRECT_SCRIPT_URLS = ['https://mbuh.my.id/siap/1770790072377-komiknesia.js'];

const sanitizeScriptUrls = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
};

const parseAllowedInt = (raw, allowed, fallback) => {
  const v = parseInt(raw, 10);
  return Number.isFinite(v) && allowed.includes(v) ? v : fallback;
};

const DEFAULT_QUICK_LINKS = [
  {
    id: "read_manga",
    title: "Baca Manga",
    subtitle: "Ribuan judul manga, manhwa & manhua gratis",
    href: "https://v1.komiknesiaku.com/",
    icon: "BookOpen",
    badge: "Hot",
    is_active: true,
    is_internal: false
  },
  {
    id: "premium",
    title: "Upgrade ke Premium",
    subtitle: "Baca tanpa iklan & fitur eksklusif",
    href: "https://v1.komiknesiaku.com/premium",
    icon: "Crown",
    is_active: true,
    is_internal: false
  },
  {
    id: "discord",
    title: "Join Discord",
    subtitle: "Komunitas pembaca & update info terbaru",
    href: "https://discord.gg/dgC22PSm9h",
    icon: "Discord",
    is_active: true,
    is_internal: false
  },
  {
    id: "facebook",
    title: "Facebook",
    subtitle: "Halaman resmi KomikNesia di Facebook",
    href: "https://facebook.com",
    icon: "Facebook",
    is_active: true,
    is_internal: false
  },
  {
    id: "tiktok",
    title: "TikTok",
    subtitle: "Follow TikTok KomikNesia",
    href: "https://tiktok.com",
    icon: "TikTok",
    is_active: true,
    is_internal: false
  },
  {
    id: "instagram",
    title: "Instagram",
    subtitle: "Follow Instagram KomikNesia",
    href: "https://instagram.com",
    icon: "Instagram",
    is_active: true,
    is_internal: false
  },
  {
    id: "download_app",
    title: "Download App",
    subtitle: "Baca manga lebih nyaman di aplikasi",
    href: "https://02.komiknesia.asia/",
    icon: "Download",
    is_active: true,
    is_internal: false
  }
];

const show = async (req, res) => {
  try {
    const payload = await settingsPublicCache.wrap('public', async () => {
      const [rows] = await db.execute(
        "SELECT `key`, `value` FROM settings WHERE `key` IN ('popup_ads_interval_minutes', 'home_popup_interval_minutes', 'popup_ads_initial_delay_minutes', 'popup_ads_unlock_seconds', 'redirect_script_urls', 'cdn_domain', 'quick_links', 'hero_banners')"
      );
      const map = Object.fromEntries((rows || []).map((r) => [r.key, r.value]));
      const popupAds = parseInt(map.popup_ads_interval_minutes, 10);
      const homePopup = parseInt(map.home_popup_interval_minutes, 10);
      const popupInitialDelay = parseInt(map.popup_ads_initial_delay_minutes, 10);
      const popupUnlockSeconds = parseInt(map.popup_ads_unlock_seconds, 10);
      let redirectScriptUrls = DEFAULT_REDIRECT_SCRIPT_URLS;
      if (typeof map.redirect_script_urls === 'string' && map.redirect_script_urls.trim()) {
        try {
          const parsed = JSON.parse(map.redirect_script_urls);
          const sanitized = sanitizeScriptUrls(parsed);
          if (sanitized.length) {
            redirectScriptUrls = sanitized;
          }
        } catch {
          redirectScriptUrls = DEFAULT_REDIRECT_SCRIPT_URLS;
        }
      }

      let quickLinks = DEFAULT_QUICK_LINKS;
      if (typeof map.quick_links === 'string' && map.quick_links.trim()) {
        try {
          const parsed = JSON.parse(map.quick_links);
          if (Array.isArray(parsed) && parsed.length > 0) {
            quickLinks = parsed;
          }
        } catch {
          quickLinks = DEFAULT_QUICK_LINKS;
        }
      }

      let heroBanners = [];
      if (typeof map.hero_banners === 'string' && map.hero_banners.trim()) {
        try {
          const parsed = JSON.parse(map.hero_banners);
          if (Array.isArray(parsed)) {
            heroBanners = parsed;
          }
        } catch {
          heroBanners = [];
        }
      }

      return {
        popup_ads_interval_minutes:
          Number.isFinite(popupAds) && POPUP_INTERVAL_OPTIONS.includes(popupAds) ? popupAds : 20,
        home_popup_interval_minutes:
          Number.isFinite(homePopup) && POPUP_INTERVAL_OPTIONS.includes(homePopup) ? homePopup : 30,
        popup_ads_initial_delay_minutes: parseAllowedInt(
          popupInitialDelay,
          POPUP_INITIAL_DELAY_OPTIONS,
          5
        ),
        popup_ads_unlock_seconds: parseAllowedInt(
          popupUnlockSeconds,
          POPUP_UNLOCK_SECONDS_OPTIONS,
          10
        ),
        redirect_script_urls: redirectScriptUrls,
        cdn_domain: map.cdn_domain || 'https://cdn.komiknesia.net',
        quick_links: quickLinks,
        hero_banners: heroBanners,
      };
    });
    res.json(payload);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.json({
      popup_ads_interval_minutes: 20,
      home_popup_interval_minutes: 30,
      popup_ads_initial_delay_minutes: 5,
      popup_ads_unlock_seconds: 10,
      redirect_script_urls: DEFAULT_REDIRECT_SCRIPT_URLS,
      quick_links: DEFAULT_QUICK_LINKS,
    });
  }
};

const update = async (req, res) => {
  try {
    const {
      popup_ads_interval_minutes,
      home_popup_interval_minutes,
      popup_ads_initial_delay_minutes,
      popup_ads_unlock_seconds,
      redirect_script_urls,
      cdn_domain,
      quick_links,
      hero_banners,
    } = req.body;

    const setIntervalKey = (key, value, allowed) => {
      const v = parseInt(value, 10);
      if (!Number.isFinite(v) || !allowed.includes(v)) return null;
      return db.execute(
        'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
        [key, String(v), String(v)]
      );
    };

    if (popup_ads_interval_minutes !== undefined) {
      await setIntervalKey('popup_ads_interval_minutes', popup_ads_interval_minutes, POPUP_INTERVAL_OPTIONS);
    }
    if (home_popup_interval_minutes !== undefined) {
      await setIntervalKey('home_popup_interval_minutes', home_popup_interval_minutes, POPUP_INTERVAL_OPTIONS);
    }
    if (popup_ads_initial_delay_minutes !== undefined) {
      await setIntervalKey(
        'popup_ads_initial_delay_minutes',
        popup_ads_initial_delay_minutes,
        POPUP_INITIAL_DELAY_OPTIONS
      );
    }
    if (popup_ads_unlock_seconds !== undefined) {
      await setIntervalKey(
        'popup_ads_unlock_seconds',
        popup_ads_unlock_seconds,
        POPUP_UNLOCK_SECONDS_OPTIONS
      );
    }

    if (redirect_script_urls !== undefined) {
      const urls = sanitizeScriptUrls(redirect_script_urls);
      await db.execute(
        'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
        ['redirect_script_urls', JSON.stringify(urls), JSON.stringify(urls)]
      );
    }

    if (cdn_domain !== undefined) {
      await db.execute(
        'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
        ['cdn_domain', String(cdn_domain).trim(), String(cdn_domain).trim()]
      );
      const { refreshCdnDomain } = require('../utils/s3Upload');
      await refreshCdnDomain().catch(() => {});
    }

    if (quick_links !== undefined && Array.isArray(quick_links)) {
      await db.execute(
        'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
        ['quick_links', JSON.stringify(quick_links), JSON.stringify(quick_links)]
      );
    }

    if (hero_banners !== undefined && Array.isArray(hero_banners)) {
      // Fetch existing hero_banners from DB to check for deleted files
      try {
        const [existingRows] = await db.execute("SELECT `value` FROM settings WHERE `key` = 'hero_banners' LIMIT 1");
        if (existingRows && existingRows.length > 0 && existingRows[0].value) {
          const oldBanners = JSON.parse(existingRows[0].value);
          if (Array.isArray(oldBanners)) {
            const newImages = new Set(hero_banners.map((b) => b.image).filter(Boolean));
            const { deleteUrlFromS3 } = require('../utils/s3Upload');
            const { deleteFile } = require('../utils/files');

            for (const oldBanner of oldBanners) {
              const oldImg = oldBanner.image || oldBanner.cover;
              if (oldImg && !newImages.has(oldImg)) {
                if (oldImg.startsWith('/uploads/')) {
                  deleteFile(oldImg);
                } else {
                  deleteUrlFromS3(oldImg).catch(() => {});
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Error unlinking old banner images:', err);
      }

      await db.execute(
        'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
        ['hero_banners', JSON.stringify(hero_banners), JSON.stringify(hero_banners)]
      );
    }

    settingsPublicCache.invalidate();
    res.json({ message: 'Settings updated' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const uploadBanner = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const { uploadFileToS3, s3Client } = require('../utils/s3Upload');
    const path = require('path');
    const fs = require('fs');

    const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
    const filename = `banner_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
    const s3Key = `banners/${filename}`;

    let savedPath = '';

    if (s3Client) {
      try {
        await uploadFileToS3(s3Key, req.file.path, req.file.mimetype);
        savedPath = s3Key;
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (s3Err) {
        console.error('Error uploading banner to S3, falling back to local:', s3Err);
      }
    }

    if (!savedPath) {
      const bannersDir = path.join(__dirname, '..', 'uploads-komiknesia', 'banners');
      if (!fs.existsSync(bannersDir)) {
        fs.mkdirSync(bannersDir, { recursive: true });
      }
      const targetPath = path.join(bannersDir, filename);
      fs.renameSync(req.file.path, targetPath);
      savedPath = `/uploads/banners/${filename}`;
    }

    res.json({ image: savedPath });
  } catch (error) {
    console.error('Error uploading banner image:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  show,
  update,
  uploadBanner,
};
