import { Platform } from 'react-native';
import { decryptResponseAddress } from '../utils/decryptor';
import { storage } from '../utils/storage';
import * as FileSystem from 'expo-file-system/legacy';

export const API_BASE_URL = 'https://api-be.komiknesia.my.id/api';
export const API_BASE_URL_WITHOUT_API = 'https://api-be.komiknesia.my.id/';
const STATIC_ORIGIN = API_BASE_URL_WITHOUT_API.replace(/\/+$/, '');

let currentCdnDomain = 'https://data.cdnesia.my.id';

export const setCdnDomain = (domain) => {
  if (!domain) return;
  let d = String(domain).trim().replace(/\/+$/, '');
  if (!d.startsWith('http://') && !d.startsWith('https://')) {
    d = `https://${d}`;
  }
  currentCdnDomain = d;
};

export const toProxiedImageUrlIfNeeded = (imagePath) => {
  if (!imagePath) return imagePath;
  try {
    const isYuu = imagePath.includes('yuucdn.com');
    if (isYuu) {
      return `https://proxy.cdnesia.my.id/?url=${encodeURIComponent(imagePath)}`;
    }
    const isCdnap = imagePath.includes('cdnap.site');
    if (isCdnap) {
      return `${API_BASE_URL}/image-proxy?url=${encodeURIComponent(imagePath)}`;
    }
  } catch (e) {
    /* ignore */
  }
  return imagePath;
};

export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;

  let path = typeof imagePath === 'string' ? imagePath.replace(/\\\//g, '/').trim() : String(imagePath);

  if (path.startsWith('data:') || path.startsWith('file://') || path.startsWith('content://')) {
    return path;
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return toProxiedImageUrlIfNeeded(path);
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (cleanPath.startsWith('/uploads/')) {
    return `${STATIC_ORIGIN}${cleanPath}`;
  }

  if (cleanPath.startsWith('/uploads-komiknesia/')) {
    return `${STATIC_ORIGIN}/uploads/${cleanPath.slice('/uploads-komiknesia/'.length)}`;
  }

  const cdnBase = currentCdnDomain.replace(/\/+$/, '');
  return `${cdnBase}${cleanPath}`;
};

class APIClient {
  async getHeaders(options = {}) {
    const token = await storage.getAuthToken();
    const deviceId = await storage.getDeviceId();
    const isFormData = options.body instanceof FormData;

    const headers = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      'X-Device-Id': deviceId,
      'X-App-Client': 'komiknesia-mobile',
      'X-App-Platform': Platform?.OS || 'android',
      'X-App-Key': 'komiknesia-mobile-app-2026',
      'Origin': 'https://www.komiknesia.asia',
      'Referer': 'https://www.komiknesia.asia/',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = await this.getHeaders(options);
    const isFormData = options.body instanceof FormData;

    const config = {
      ...options,
      headers,
    };

    if (config.body && typeof config.body === 'object' && !isFormData) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP error! status: ${response.status}`,
        }));
        const err = new Error(errorData.error || `HTTP error! status: ${response.status}`);
        err.status = response.status;
        throw err;
      }

      const responseData = await response.json();

      if (
        responseData &&
        typeof responseData === 'object' &&
        responseData.encrypted &&
        responseData.data &&
        responseData.time
      ) {
        try {
          return decryptResponseAddress(responseData.data, responseData.time);
        } catch (decryptErr) {
          console.error('[APIClient] Error decrypting response:', decryptErr);
          return responseData;
        }
      }

      return responseData;
    } catch (error) {
      console.warn(`[APIClient] Request failed for ${endpoint}:`, error.message);
      if (
        error?.message?.includes('UnknownHostException') ||
        error?.message?.includes('Network request failed') ||
        error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('fetch failed') ||
        error?.name === 'TypeError'
      ) {
        const netErr = new Error('Koneksi internet tidak tersedia. Periksa jaringan internet kamu.');
        netErr.isNetworkError = true;
        throw netErr;
      }
      throw error;
    }
  }

  // Auth APIs
  async login(username, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    if (response?.status && response?.data?.token) {
      await storage.setAuthToken(response.data.token);
      await storage.setUser(response.data.user);
    }
    return response;
  }

  async register(payload) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: payload,
    });
    if (response?.status && response?.data?.token) {
      await storage.setAuthToken(response.data.token);
      await storage.setUser(response.data.user);
    }
    return response;
  }

  async sendRegisterOtp(payload) {
    return this.request('/auth/send-register-otp', {
      method: 'POST',
      body: payload,
    });
  }

  async forgotPassword(identifier) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: { identifier },
    });
  }

  async resetPassword({ email, otp_code, new_password }) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: { email, otp_code, new_password },
    });
  }

  async getMe() {
    return this.request('/auth/me');
  }

  async getUserProfile(username) {
    return this.request(`/auth/profile/${encodeURIComponent(username)}`);
  }

  async updateProfile(formDataOrObject) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: formDataOrObject,
    });
  }

  async logout() {
    await storage.clearAuth();
  }

  // App Settings & Banners
  async getSettings() {
    return this.request('/settings');
  }

  async getContactInfo(active = true) {
    const params = new URLSearchParams();
    if (active !== null) params.append('active', active.toString());
    const q = params.toString();
    return this.request(`/contact-info${q ? `?${q}` : ''}`);
  }

  async getFeaturedItems(type = 'banner', active = true) {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (active !== null) params.append('active', active.toString());
    return this.request(`/featured-items?${params.toString()}`);
  }

  // Content & Manga List
  async getContents(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.per_page) queryParams.append('per_page', params.per_page.toString());
    if (params.q) queryParams.append('q', params.q);
    const genreList = params.genre || params.genreId || params.genres;
    if (genreList) {
      if (Array.isArray(genreList)) {
        genreList.forEach((g) => queryParams.append('genre[]', g.toString()));
      } else {
        queryParams.append('genre[]', genreList.toString());
      }
    }
    if (params.status && params.status !== 'All') queryParams.append('status', params.status);
    if (params.country) queryParams.append('country', params.country);
    if (params.type && params.type !== 'All') queryParams.append('type', params.type.toLowerCase());
    if (params.orderBy) queryParams.append('orderBy', params.orderBy);
    if (params.project && params.project !== 'all') queryParams.append('project', params.project);
    if (params.popularWindow) queryParams.append('popularWindow', params.popularWindow);

    return this.request(`/contents?${queryParams.toString()}`);
  }

  async getGenres() {
    return this.request('/contents/genres');
  }

  async getMangaDetail(slug) {
    return this.request(`/comic/${encodeURIComponent(slug)}`);
  }

  async getChapterDetail(chapterSlug) {
    return this.request(`/chapters/slug/${encodeURIComponent(chapterSlug)}`);
  }

  async recordView(slug) {
    try {
      return await this.request(`/comic/${encodeURIComponent(slug)}/view`, {
        method: 'POST',
      });
    } catch {
      return null;
    }
  }

  // Popular
  async getPopularManga(type = 'manhwa', page = 1, perPage = 18) {
    const params = new URLSearchParams({
      type: type.toLowerCase(),
      page: String(page),
      per_page: String(perPage),
      orderBy: 'Popular',
    });
    return this.request(`/contents?${params.toString()}`);
  }

  // Bookmarks
  async getBookmarks({ page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    return this.request(`/bookmarks?${params.toString()}`);
  }

  async addBookmark(mangaIdOrSlug) {
    const key = Number.isNaN(Number(mangaIdOrSlug)) ? 'slug' : 'manga_id';
    return this.request('/bookmarks', {
      method: 'POST',
      body: { [key]: mangaIdOrSlug },
    });
  }

  async removeBookmark(mangaIdOrSlug) {
    return this.request(`/bookmarks/${encodeURIComponent(mangaIdOrSlug)}`, {
      method: 'DELETE',
    });
  }

  async checkBookmark(mangaIdOrSlug) {
    return this.request(`/bookmarks/check/${encodeURIComponent(mangaIdOrSlug)}`);
  }

  // Readlists
  async getReadlists() {
    return this.request('/readlists');
  }

  async createReadlist(title) {
    return this.request('/readlists', {
      method: 'POST',
      body: { title },
    });
  }

  async getReadlist(id) {
    return this.request(`/readlists/${encodeURIComponent(id)}`);
  }

  async deleteReadlist(id) {
    return this.request(`/readlists/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async addReadlistItem(id, mangaIdOrSlug) {
    const isNum = !Number.isNaN(Number(mangaIdOrSlug));
    const body = isNum
      ? { manga_ids: [Number(mangaIdOrSlug)], manga_id: Number(mangaIdOrSlug) }
      : { slugs: [String(mangaIdOrSlug)], slug: String(mangaIdOrSlug) };
    return this.request(`/readlists/${encodeURIComponent(id)}/items`, {
      method: 'POST',
      body,
    });
  }

  async addReadlistItems(id, body) {
    return this.request(`/readlists/${encodeURIComponent(id)}/items`, {
      method: 'POST',
      body,
    });
  }

  async removeReadlistItem(id, mangaIdOrSlug) {
    return this.request(
      `/readlists/${encodeURIComponent(id)}/items/${encodeURIComponent(mangaIdOrSlug)}`,
      { method: 'DELETE' }
    );
  }

  // Reactions / Votes
  async getVotes(slug) {
    return this.request(`/votes/${encodeURIComponent(slug)}`);
  }

  async submitVote(slug, vote_type) {
    return this.request('/votes', {
      method: 'POST',
      body: { slug, vote_type },
    });
  }

  async getChapterReactions(chapterSlug) {
    return this.request(`/chapter-reactions/${encodeURIComponent(chapterSlug)}`);
  }

  async submitChapterReaction(chapterSlug, reaction_type) {
    return this.request('/chapter-reactions', {
      method: 'POST',
      body: { slug: chapterSlug, reaction_type },
    });
  }

  // Comments
  async getComments(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/comments?${q}`);
  }

  async postComment(body) {
    return this.request('/comments', {
      method: 'POST',
      body,
    });
  }

  async deleteComment(id) {
    return this.request(`/comments/${id}`, {
      method: 'DELETE',
    });
  }

  // Stickers
  async getStickers(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/stickers${q ? `?${q}` : ''}`);
  }

  // Upload Image for Chat & Comments
  async uploadImage(fileData) {
    let fileUri = null;
    let mimeType = 'image/jpeg';
    let fileName = 'upload.jpg';

    if (typeof fileData === 'string') {
      fileUri = fileData;
    } else if (fileData?.uri) {
      fileUri = fileData.uri;
      mimeType = fileData.type || mimeType;
      fileName = fileData.name || fileName;
    } else if (fileData?._parts && Array.isArray(fileData._parts)) {
      const part = fileData._parts.find(([key]) => key === 'image')?.[1];
      if (part?.uri) {
        fileUri = part.uri;
        mimeType = part.type || mimeType;
        fileName = part.name || fileName;
      }
    }

    const token = await storage.getAuthToken();
    const deviceId = await storage.getDeviceId();

    // Strategy 1: FileSystem.uploadAsync (Native OkHttp/URLSession - 100% reliable in Expo)
    if (fileUri) {
      const endpoints = ['/comments/upload-image', '/upload-image'];
      for (const endpoint of endpoints) {
        try {
          const targetUrl = `${API_BASE_URL}${endpoint}`;
          const headers = {
            'X-Device-Id': deviceId,
            'X-App-Client': 'komiknesia-mobile',
            'Origin': 'https://www.komiknesia.asia',
            'Referer': 'https://www.komiknesia.asia/',
          };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const res = await FileSystem.uploadAsync(targetUrl, fileUri, {
            fieldName: 'image',
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            mimeType,
            headers,
          });

          if (res.status >= 200 && res.status < 300) {
            const data = JSON.parse(res.body);
            if (data && (data.image || data.url || data.path || data.status)) {
              return data;
            }
          }
        } catch (err) {
          console.warn(`FileSystem.uploadAsync to ${endpoint} failed:`, err);
        }
      }
    }

    // Strategy 2: XMLHttpRequest fallback (Native React Native bridge - bypasses Expo fetch convertFormData)
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      if (fileUri) {
        formData.append('image', {
          uri: fileUri,
          name: fileName,
          type: mimeType,
        });
      } else if (fileData instanceof FormData) {
        fileData._parts?.forEach(([k, v]) => formData.append(k, v));
      }

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/comments/upload-image`);
      xhr.setRequestHeader('X-Device-Id', deviceId);
      xhr.setRequestHeader('X-App-Client', 'komiknesia-mobile');
      xhr.setRequestHeader('Origin', 'https://www.komiknesia.asia');
      xhr.setRequestHeader('Referer', 'https://www.komiknesia.asia/');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve({ status: true, image: xhr.responseText });
          }
        } else {
          const xhr2 = new XMLHttpRequest();
          xhr2.open('POST', `${API_BASE_URL}/upload-image`);
          xhr2.setRequestHeader('X-Device-Id', deviceId);
          xhr2.setRequestHeader('X-App-Client', 'komiknesia-mobile');
          if (token) xhr2.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr2.onload = () => {
            if (xhr2.status >= 200 && xhr2.status < 300) {
              try {
                resolve(JSON.parse(xhr2.responseText));
              } catch {
                resolve({ status: true, image: xhr2.responseText });
              }
            } else {
              reject(new Error(`Upload failed with status ${xhr2.status}`));
            }
          };
          xhr2.onerror = () => reject(new Error('Network error during upload'));
          xhr2.send(formData);
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
  }

  // Ads
  async getAds() {
    return this.request('/ads');
  }

  // Live Chat / Chatroom
  async getLiveChats(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/live-chat${q ? `?${q}` : ''}`);
  }

  async postLiveChat(message) {
    return this.request('/live-chat', {
      method: 'POST',
      body: { message },
    });
  }
}

export const apiClient = new APIClient();
