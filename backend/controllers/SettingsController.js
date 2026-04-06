const db = require('../db');
const { createShortLivedCache } = require('../utils/shortLivedCache');

const POPUP_INTERVAL_OPTIONS = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

const settingsPublicCache = createShortLivedCache({ ttlMs: 60 * 1000, maxKeys: 8 });

const show = async (req, res) => {
  try {
    const payload = await settingsPublicCache.wrap('public', async () => {
      const [rows] = await db.execute(
        "SELECT `key`, `value` FROM settings WHERE `key` IN ('popup_ads_interval_minutes', 'home_popup_interval_minutes')"
      );
      const map = Object.fromEntries((rows || []).map((r) => [r.key, r.value]));
      const popupAds = parseInt(map.popup_ads_interval_minutes, 10);
      const homePopup = parseInt(map.home_popup_interval_minutes, 10);
      return {
        popup_ads_interval_minutes:
          Number.isFinite(popupAds) && POPUP_INTERVAL_OPTIONS.includes(popupAds) ? popupAds : 20,
        home_popup_interval_minutes:
          Number.isFinite(homePopup) && POPUP_INTERVAL_OPTIONS.includes(homePopup) ? homePopup : 30,
      };
    });
    res.json(payload);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.json({ popup_ads_interval_minutes: 20, home_popup_interval_minutes: 30 });
  }
};

const update = async (req, res) => {
  try {
    const { popup_ads_interval_minutes, home_popup_interval_minutes } = req.body;

    const set = (key, value) => {
      const v = parseInt(value, 10);
      if (!Number.isFinite(v) || !POPUP_INTERVAL_OPTIONS.includes(v)) return null;
      return db.execute(
        'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
        [key, String(v), String(v)]
      );
    };

    if (popup_ads_interval_minutes !== undefined)
      await set('popup_ads_interval_minutes', popup_ads_interval_minutes);
    if (home_popup_interval_minutes !== undefined)
      await set('home_popup_interval_minutes', home_popup_interval_minutes);

    settingsPublicCache.invalidate();
    res.json({ message: 'Settings updated' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  show,
  update,
};

