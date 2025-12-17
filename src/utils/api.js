const API_BASE_URL = 'http://localhost:5000/api';

class APIClient {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
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
  getManga(page = 1, limit = 12, search = '', category = '') {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(search && { search }),
      ...(category && { category }),
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
  addChapterImages(chapterId, formData) {
    return this.request(`/chapters/${chapterId}/images`, {
      method: 'POST',
      headers: {},
      body: formData,
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
}

export const apiClient = new APIClient();