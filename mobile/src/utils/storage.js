import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  AUTH_TOKEN: 'komiknesia_auth_token',
  USER_CACHE: 'komiknesia_user_cache',
  DEVICE_ID: 'komiknesia_device_id',
  READING_HISTORY: 'komiknesia_reading_history',
  SETTINGS: 'komiknesia_settings',
};

export const storage = {
  async getItem(key) {
    try {
      const val = await AsyncStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  },

  async setItem(key, value) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },

  async removeItem(key) {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },

  async getString(key) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setString(key, value) {
    try {
      if (value === null || value === undefined) {
        await AsyncStorage.removeItem(key);
      } else {
        await AsyncStorage.setItem(key, String(value));
      }
      return true;
    } catch {
      return false;
    }
  },

  // Auth helpers
  async getAuthToken() {
    return this.getString(STORAGE_KEYS.AUTH_TOKEN);
  },

  async setAuthToken(token) {
    return this.setString(STORAGE_KEYS.AUTH_TOKEN, token);
  },

  async getUser() {
    return this.getItem(STORAGE_KEYS.USER_CACHE);
  },

  async setUser(user) {
    return this.setItem(STORAGE_KEYS.USER_CACHE, user);
  },

  async clearAuth() {
    await this.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    await this.removeItem(STORAGE_KEYS.USER_CACHE);
  },

  // Device ID helper
  async getDeviceId() {
    let id = await this.getString(STORAGE_KEYS.DEVICE_ID);
    if (!id || !/^[a-zA-Z0-9_-]{8,40}$/.test(id)) {
      id = `dv_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-6)}`;
      await this.setString(STORAGE_KEYS.DEVICE_ID, id);
    }
    return id;
  },

  // History helpers
  async getHistory() {
    const history = await this.getItem(STORAGE_KEYS.READING_HISTORY);
    return Array.isArray(history) ? history : [];
  },

  async saveHistoryItem(item) {
    try {
      const current = await this.getHistory();
      const filtered = current.filter(
        (h) => h.mangaSlug !== item.mangaSlug && h.chapterSlug !== item.chapterSlug
      );
      const updated = [
        {
          ...item,
          readAt: Date.now(),
        },
        ...filtered,
      ].slice(0, 100); // keep last 100
      await this.setItem(STORAGE_KEYS.READING_HISTORY, updated);
      return updated;
    } catch (e) {
      console.warn('Failed saving history:', e);
      return [];
    }
  },

  async removeHistoryItem(chapterSlug) {
    const current = await this.getHistory();
    const updated = current.filter((h) => h.chapterSlug !== chapterSlug);
    await this.setItem(STORAGE_KEYS.READING_HISTORY, updated);
    return updated;
  },

  async clearHistory() {
    await this.removeItem(STORAGE_KEYS.READING_HISTORY);
    return [];
  },
};

export { STORAGE_KEYS };
