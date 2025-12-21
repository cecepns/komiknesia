// export const API_BASE_URL = 'http://localhost:5000/api';
// const API_BASE_URL_WITHOUT_API = 'http://localhost:5000';
export const API_BASE_URL = 'https://api-inventory.isavralabel.com/komiknesia/api';
export const API_BASE_URL_WITHOUT_API = 'https://api-inventory.isavralabel.com/komiknesia';

/**
 * Get full image URL with endpoint prefix if the path is relative
 * @param {string} imagePath - Image path (can be relative like "/uploads/..." or absolute URL)
 * @returns {string} Full image URL
 */
export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // If already a full URL (starts with http:// or https://), return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // If it's a relative path starting with /uploads/, add the base URL
  if (imagePath.startsWith('/uploads/') || imagePath.startsWith('/')) {
    return `${API_BASE_URL_WITHOUT_API}${imagePath}`;
  }
  
  // Otherwise return as is (might be a data URL or other format)
  return imagePath;
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
  async login(username, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    // Ensure token is saved after successful login
    if (response && response.status && response.data && response.data.token) {
      this.setAuthToken(response.data.token);
      // Verify token was saved
      const savedToken = this.getAuthToken();
      if (!savedToken || savedToken !== response.data.token) {
        console.error('Failed to save auth token to localStorage');
      }
    }
    return response;
  }

  async getMe() {
    return this.request('/auth/me');
  }

  logout() {
    this.setAuthToken(null);
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

  // Votes
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
    return this.request(`/ads/${id}`, {
      method: 'PUT',
      headers: {},
      body: formData,
    });
  }

  deleteAd(id) {
    return this.request(`/ads/${id}`, {
      method: 'DELETE',
    });
  }

  // Helper function for SSE streaming
  _handleSSEStream = (url, body, onProgress) => {
    return new Promise((resolve, reject) => {
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
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