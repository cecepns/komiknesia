// export const API_BASE_URL = 'https://be-api.komiknesia.net/api';
// export const API_BASE_URL_WITHOUT_API = 'https://be-api.komiknesia.net';
// export const API_BASE_URL = 'http://localhost:8080/api';
// export const API_BASE_URL_WITHOUT_API = 'http://localhost:8080';

// export const API_BASE_URL = 'https://be-api-node.komiknesia.net//api';
// export const API_BASE_URL_WITHOUT_API = 'https://be-api-node.komiknesia.net/';
export const API_BASE_URL = 'https://api-be.komiknesia.my.id/api';
export const API_BASE_URL_WITHOUT_API = 'https://api-be.komiknesia.my.id/';

/** Origin for static files (no trailing slash). Same host as API, path /uploads is served by backend. */
const STATIC_ORIGIN = API_BASE_URL_WITHOUT_API.replace(/\/+$/, '');

/**
 * Map legacy /uploads-komiknesia/... to public /uploads/... (Express serves disk folder at /uploads).
 * @param {string} pathname - URL pathname starting with /
 */
function normalizeUploadsPathname(pathname) {
  if (pathname.startsWith('/uploads-komiknesia/')) {
    return '/uploads/' + pathname.slice('/uploads-komiknesia/'.length);
  }
  return pathname;
}

/**
 * Get full image URL with endpoint prefix if the path is relative
 * @param {string} imagePath - Image path (can be relative like "/uploads/..." or absolute URL)
 * @returns {string} Full image URL
 */
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;

  let path = typeof imagePath === 'string' ? imagePath.replace(/\\\//g, '/').trim() : String(imagePath);

  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const u = new URL(path);
      const next = normalizeUploadsPathname(u.pathname);
      if (next !== u.pathname) {
        u.pathname = next;
        return u.toString();
      }
    } catch {
      /* ignore */
    }
    return path;
  }

  if (path.startsWith('uploads/')) {
    path = `/${path}`;
  }

  if (path.startsWith('/')) {
    return `${STATIC_ORIGIN}${normalizeUploadsPathname(path)}`;
  }

  return path;
};

class APIClient {
  getAuthToken() {
    return localStorage.getItem('auth_token');
  }

  setAuthToken(token) {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const isFormData = options.body instanceof FormData;
    const token = this.getAuthToken();
    
    // Build headers: start with custom headers, then add Content-Type, then add Authorization (so it can't be overridden)
    const headers = {
      ...options.headers,
      // Don't set Content-Type for FormData - browser will set it with boundary
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    };
    
    // Always add auth token if available (this will override any Authorization in options.headers)
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
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
        const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Auth methods
  async register(formData) {
    const url = `${API_BASE_URL}/auth/register`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (data && data.status && data.data && data.data.token) {
      this.setAuthToken(data.data.token);
    }
    return data;
  }

  async login(username, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    if (response && response.status && response.data && response.data.token) {
      this.setAuthToken(response.data.token);
    }
    return response;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  async getUserProfile(username) {
    return this.request(`/auth/profile/${encodeURIComponent(username)}`);
  }

  async updateProfile(formData) {
    return this.request('/auth/profile', {
      method: 'PUT',
      headers: {},
      body: formData,
    });
  }

  // Admin users
  getAdminUsers({ search = '', page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(search ? { search } : {}),
    });
    return this.request(`/admin/users?${params.toString()}`);
  }

  createAdminUser(payload) {
    return this.request('/admin/users', {
      method: 'POST',
      body: payload,
    });
  }

  updateAdminUser(id, payload) {
    return this.request(`/admin/users/${id}`, {
      method: 'PUT',
      body: payload,
    });
  }

  deleteAdminUser(id) {
    return this.request(`/admin/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Public leaderboard
  getLeaderboard({ page = 1, limit = 20 } = {}) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    return this.request(`/leaderboard?${params.toString()}`);
  }

  logout() {
    this.setAuthToken(null);
  }

  // Bookmarks (requires auth)
  getBookmarks() {
    return this.request('/bookmarks');
  }

  addBookmark(mangaIdOrSlug) {
    const key = Number.isNaN(Number(mangaIdOrSlug)) ? 'slug' : 'manga_id';
    return this.request('/bookmarks', {
      method: 'POST',
      body: { [key]: mangaIdOrSlug },
    });
  }

  removeBookmark(mangaIdOrSlug) {
    return this.request(`/bookmarks/${encodeURIComponent(mangaIdOrSlug)}`, {
      method: 'DELETE',
    });
  }

  checkBookmark(mangaIdOrSlug) {
    return this.request(`/bookmarks/check/${encodeURIComponent(mangaIdOrSlug)}`);
  }

  // Comments
  getComments(params) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/comments?${q}`);
  }

  postComment(body) {
    return this.request('/comments', {
      method: 'POST',
      body,
    });
  }

  deleteComment(id) {
    return this.request(`/comments/${id}`, {
      method: 'DELETE',
    });
  }

  // Categories
  getCategories() {
    return this.request('/categories');
  }

  createCategory(data) {
    return this.request('/categories', {
      method: 'POST',
      body: data,
    });
  }

  updateCategory(id, data) {
    return this.request(`/categories/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  deleteCategory(id) {
    return this.request(`/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // Manga
  getManga(page = 1, limit = 12, search = '', category = '', source = 'all') {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
      ...(category && { category }),
      ...(source && source !== 'all' && { source }),
    });
    return this.request(`/manga?${params}`);
  }

  getMangaBySlug(slug) {
    return this.request(`/manga/slug/${slug}`);
  }

  createManga(formData) {
    return this.request('/manga', {
      method: 'POST',
      headers: {},
      body: formData,
    });
  }

  updateManga(id, formData) {
    return this.request(`/manga/${id}`, {
      method: 'PUT',
      headers: {},
      body: formData,
    });
  }

  deleteManga(id) {
    return this.request(`/manga/${id}`, {
      method: 'DELETE',
    });
  }

  // Votes (by slug; token sent when logged in so vote is per-user)
  getVotes(slug) {
    return this.request(`/votes/${encodeURIComponent(slug)}`);
  }

  submitVote(slug, vote_type) {
    return this.request('/votes', {
      method: 'POST',
      body: { slug, vote_type },
    });
  }

  voteManga(mangaId, type) {
    return this.request('/votes', {
      method: 'POST',
      body: { manga_id: mangaId, vote_type: type },
    });
  }

  // Chapters
  getChapters(mangaId) {
    return this.request(`/manga/${mangaId}/chapters`);
  }

  createChapter(mangaId, formData) {
    return this.request(`/manga/${mangaId}/chapters`, {
      method: 'POST',
      headers: {},
      body: formData,
    });
  }

  updateChapter(chapterId, formData) {
    return this.request(`/chapters/${chapterId}`, {
      method: 'PUT',
      headers: {},
      body: formData,
    });
  }

  deleteChapter(chapterId) {
    return this.request(`/chapters/${chapterId}`, {
      method: 'DELETE',
    });
  }

  // Chapter Images
  getChapterImages(chapterId) {
    return this.request(`/chapters/${chapterId}/images`);
  }

  addChapterImages(chapterId, formData) {
    return this.request(`/chapters/${chapterId}/images`, {
      method: 'POST',
      headers: {},
      body: formData,
    });
  }

  deleteChapterImage(chapterId, imageId) {
    return this.request(`/chapters/${chapterId}/images/${imageId}`, {
      method: 'DELETE',
    });
  }

  reorderChapterImages(chapterId, images) {
    return this.request(`/chapters/${chapterId}/images/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ images }),
    });
  }

  // Admin: Ikiru sync
  syncIkiruLatest(body = {}) {
    return this.request('/admin/ikiru-sync/latest', {
      method: 'POST',
      body,
    });
  }

  syncIkiruProject(body = {}) {
    return this.request('/admin/ikiru-sync/project', {
      method: 'POST',
      body,
    });
  }

  getIkiruSyncFeed(type = 'latest', page = 1) {
    const params = new URLSearchParams({
      type: String(type || 'latest'),
      page: String(page || 1),
    });
    return this.request(`/admin/ikiru-sync/feed?${params.toString()}`);
  }

  syncIkiruSelected(slugs, body = {}) {
    return this.request('/admin/ikiru-sync/selected', {
      method: 'POST',
      body: { slugs, ...body },
    });
  }

  syncIkiruManga(slug, body = {}) {
    return this.request(`/admin/ikiru-sync/manga/${encodeURIComponent(slug)}`, {
      method: 'POST',
      body,
    });
  }

  // Init + return chapter queue plan (does upsert manga cover/meta).
  syncIkiruMangaInit(slug, body = {}) {
    return this.request(`/admin/ikiru-sync/manga/${encodeURIComponent(slug)}/init`, {
      method: 'POST',
      body,
    });
  }

  // Sync a single chapter (optionally images) for progress queue.
  syncIkiruChapter(slug, chapterSlug, body = {}) {
    return this.request(
      `/admin/ikiru-sync/manga/${encodeURIComponent(slug)}/chapter/${encodeURIComponent(
        chapterSlug
      )}`,
      {
        method: 'POST',
        body,
      }
    );
  }

  syncIkiruChapterImages(mangaSlug, chapterSlug, body = {}) {
    return this.request(
      `/admin/ikiru-sync/manga/${encodeURIComponent(mangaSlug)}/chapter/${encodeURIComponent(
        chapterSlug
      )}/images`,
      {
        method: 'POST',
        body,
      }
    );
  }

  // Ads
  getAds() {
    return this.request('/ads');
  }

  createAd(formData) {
    return this.request('/ads', {
      method: 'POST',
      headers: {},
      body: formData,
    });
  }

  updateAd(id, formData) {
    // Use POST with _method override so multipart form-data
    // is parsed correctly by the backend for updates
    const fd = new FormData();
    // Copy existing fields
    if (formData instanceof FormData) {
      for (const [key, value] of formData.entries()) {
        fd.append(key, value);
      }
    }
    fd.append('_method', 'PUT');

    return this.request(`/ads/${id}`, {
      method: 'POST',
      headers: {},
      body: fd,
    });
  }

  deleteAd(id) {
    return this.request(`/ads/${id}`, {
      method: 'DELETE',
    });
  }

  getSettings() {
    return this.request('/settings');
  }

  updateSettings(body) {
    return this.request('/settings', {
      method: 'PUT',
      body,
    });
  }

  // Helper function for SSE streaming
  _handleSSEStream = (url, body, onProgress) => {
    return new Promise((resolve, reject) => {
      const token = this.getAuthToken();
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      };
      
      // Add auth token if available
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })
        .then(async (response) => {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
          }
          
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let currentEvent = '';
          
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                // Check if we have any remaining data in buffer
                if (buffer.trim()) {
                  const lines = buffer.split('\n');
                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      try {
                        const data = JSON.parse(line.substring(6));
                        if (onProgress) onProgress(data);
                      } catch {
                        // Ignore parse errors
                      }
                    }
                  }
                }
                break;
              }
              
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                if (line.startsWith('event: ')) {
                  currentEvent = line.substring(7).trim();
                } else if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.substring(6));
                    
                    // Call progress callback
                    if (onProgress) {
                      onProgress(data);
                    }
                    
                    // Check for completion or error
                    if (currentEvent === 'complete') {
                      // Call progress one more time with final data
                      if (onProgress) {
                        onProgress(data);
                      }
                      resolve(data);
                      return;
                    }
                    if (data.status === 'complete') {
                      // Also handle complete status in progress data
                      if (onProgress) {
                        onProgress(data);
                      }
                      resolve(data);
                      return;
                    }
                    if (currentEvent === 'error' || data.error) {
                      if (onProgress) {
                        onProgress(data);
                      }
                      reject(new Error(data.error || 'Sync failed'));
                      return;
                    }
                  } catch (e) {
                    console.warn('Failed to parse SSE data:', e);
                  }
                } else if (line.trim() === '') {
                  // Empty line indicates end of event, reset currentEvent
                  currentEvent = '';
                }
              }
            }
            
            // If we reach here without resolve/reject, resolve with last data
            resolve({ message: 'Sync completed' });
          } catch (streamError) {
            reject(streamError);
          } finally {
            reader.releaseLock();
          }
        })
        .catch(reject);
    });
  }

  // WestManga Full Sync (with chapters and images) - with progress callback support
  syncWestManga = (page = 1, limit = 25, onProgress = null) => {
    // If onProgress callback is provided, use SSE streaming
    if (onProgress) {
      const url = `${API_BASE_URL}/westmanga/sync`;
      return this._handleSSEStream(url, { page, limit }, onProgress);
    } else {
      // Fallback to regular request
      return this.request('/westmanga/sync', {
        method: 'POST',
        body: { page, limit },
      });
    }
  };

  // WestManga Manga-Only Sync (no chapters/images) - with progress callback support
  syncWestMangaOnly = (page = 1, limit = 25, onProgress = null) => {
    // If onProgress callback is provided, use SSE streaming
    if (onProgress) {
      const url = `${API_BASE_URL}/westmanga/sync-manga-only`;
      return this._handleSSEStream(url, { page, limit }, onProgress);
    } else {
      // Fallback to regular request
      return this.request('/westmanga/sync-manga-only', {
        method: 'POST',
        body: { page, limit },
      });
    }
  };

  // WestManga Manga + Chapters Sync (no images) - with progress callback support
  syncWestMangaChapters = (page = 1, limit = 25, onProgress = null) => {
    // If onProgress callback is provided, use SSE streaming
    if (onProgress) {
      const url = `${API_BASE_URL}/westmanga/sync-manga-chapters`;
      return this._handleSSEStream(url, { page, limit }, onProgress);
    } else {
      // Fallback to regular request
      return this.request('/westmanga/sync-manga-chapters', {
        method: 'POST',
        body: { page, limit },
      });
    }
  };

  // Sync a single manga from WestManga to database by slug
  syncMangaBySlug(slug) {
    return this.request(`/westmanga/sync-manga/${encodeURIComponent(slug)}`, {
      method: 'POST',
    });
  }

  // Sync chapters for a specific manga by slug (WestManga only)
  syncChaptersBySlug(slug) {
    return this.request(`/westmanga/sync-chapters/${encodeURIComponent(slug)}`, {
      method: 'POST',
    });
  }

  // Search Manga
  searchManga(query, source = 'all') {
    const params = new URLSearchParams({
      query,
      source,
    });
    return this.request(`/manga/search?${params}`);
  }

  // Dashboard Stats
  getDashboardStats() {
    return this.request('/dashboard/stats');
  }

  // Featured Items
  getFeaturedItems(type = null, active = null) {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (active !== null) params.append('active', active.toString());
    const queryString = params.toString();
    return this.request(`/featured-items${queryString ? `?${queryString}` : ''}`);
  }

  createFeaturedItem(data) {
    return this.request('/featured-items', {
      method: 'POST',
      body: data,
    });
  }

  updateFeaturedItem(id, data) {
    return this.request(`/featured-items/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  deleteFeaturedItem(id) {
    return this.request(`/featured-items/${id}`, {
      method: 'DELETE',
    });
  }

  // Contact Info
  getContactInfo(active = null) {
    const params = new URLSearchParams();
    if (active !== null) params.append('active', active.toString());
    const queryString = params.toString();
    return this.request(`/contact-info${queryString ? `?${queryString}` : ''}`);
  }

  createContactInfo(data) {
    return this.request('/contact-info', {
      method: 'POST',
      body: data,
    });
  }

  updateContactInfo(id, data) {
    return this.request(`/contact-info/${id}`, {
      method: 'PUT',
      body: data,
    });
  }

  deleteContactInfo(id) {
    return this.request(`/contact-info/${id}`, {
      method: 'DELETE',
    });
  }

  // Contents (Manga List with filters)
  getContents(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.per_page) queryParams.append('per_page', params.per_page.toString());
    if (params.q) queryParams.append('q', params.q);
    if (params.genre) {
      if (Array.isArray(params.genre)) {
        params.genre.forEach(g => queryParams.append('genre[]', g));
      } else {
        queryParams.append('genre', params.genre);
      }
    }
    if (params.status) queryParams.append('status', params.status);
    if (params.country) queryParams.append('country', params.country);
    if (params.type) queryParams.append('type', params.type);
    if (params.orderBy) queryParams.append('orderBy', params.orderBy);
    if (params.project) queryParams.append('project', params.project);
    
    const queryString = queryParams.toString();
    return this.request(`/contents${queryString ? `?${queryString}` : ''}`);
  }
}

export const apiClient = new APIClient();